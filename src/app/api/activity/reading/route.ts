import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface AcademicPaper {
  id: string;
  source: 'semantic_scholar' | 'arxiv' | 'core';
  title: string;
  abstract: string | null;
  authors: string[];
  year: number | null;
  citationCount?: number;
  pdfUrl: string | null;
  pageUrl: string;
  doi?: string;
  journal?: string;
  isOpenAccess: true;
  relevanceScore?: number;
}

// ── Query generation ──────────────────────────────────────────────────────────
// Strategy: always use the literal lesson title + topic as the primary query
// (highest precision). Claude refines two additional queries from objectives.

async function getSearchQueries(
  activityTitle: string,
  activityDescription: string,
  topic: string,
  lessonTitle: string,
  objectives: string[],
): Promise<string[]> {
  // Query 1 is always literal — highest relevance guarantee
  const q1 = lessonTitle && lessonTitle !== activityTitle
    ? `${lessonTitle} ${topic}`.trim()
    : `${activityTitle} ${topic}`.trim();

  // Claude generates 2 more specific queries from objectives + description
  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `You are a research librarian. Generate 2 specific academic search queries for finding papers on this exact lesson.

LESSON: "${lessonTitle || activityTitle}"
COURSE TOPIC: "${topic}"
ACTIVITY: "${activityDescription}"
OBJECTIVES: ${objectives.slice(0, 3).join('; ')}

Rules:
- Both queries MUST be directly about the lesson topic above (not tangentially related)
- Use precise technical terms from the subject area
- Query 1: the specific concept/method central to this lesson
- Query 2: a key method or application from the objectives

Return ONLY a JSON array: ["query 1", "query 2"]`,
      }],
    });
    const text = msg.content[0].type === 'text' ? msg.content[0].text : '[]';
    const match = text.match(/\[[\s\S]*?\]/);
    const aiQueries: string[] = match ? JSON.parse(match[0]) : [];
    return [q1, ...aiQueries.slice(0, 2)].filter(Boolean);
  } catch {
    return [q1, activityTitle];
  }
}

// ── Relevance scoring ─────────────────────────────────────────────────────────

function titleRelevanceBonus(paperTitle: string, lessonTitle: string, topic: string): number {
  const haystack = paperTitle.toLowerCase();
  const needles = `${lessonTitle} ${topic}`.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3);
  const hits = needles.filter(w => haystack.includes(w)).length;
  return hits * 15;
}

// ── Semantic Scholar ──────────────────────────────────────────────────────────

async function searchSemanticScholar(query: string): Promise<AcademicPaper[]> {
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=title,abstract,authors,year,citationCount,openAccessPdf,externalIds,url&limit=8`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Pansophia/1.0 (educational platform; contact: education@pansophia.app)' },
    });
    if (!res.ok) return [];
    const data = await res.json();

    return ((data.data ?? []) as Array<{
      paperId: string; title: string; abstract: string | null;
      authors: { name: string }[]; year: number | null; citationCount: number;
      openAccessPdf: { url: string } | null; externalIds: { DOI?: string; ArXiv?: string } | null; url: string;
    }>)
      .filter(p => p.openAccessPdf?.url || p.externalIds?.ArXiv)
      .map(p => {
        const pdfUrl = p.openAccessPdf?.url ?? (p.externalIds?.ArXiv ? `https://arxiv.org/pdf/${p.externalIds.ArXiv}` : null);
        const pageUrl = p.externalIds?.ArXiv ? `https://arxiv.org/abs/${p.externalIds.ArXiv}` : p.url;
        return {
          id: `ss_${p.paperId}`, source: 'semantic_scholar' as const,
          title: p.title, abstract: p.abstract,
          authors: (p.authors ?? []).map(a => a.name),
          year: p.year, citationCount: p.citationCount,
          pdfUrl, pageUrl, doi: p.externalIds?.DOI, isOpenAccess: true as const,
        };
      });
  } catch { return []; }
}

// ── arXiv ─────────────────────────────────────────────────────────────────────

async function searchArXiv(query: string): Promise<AcademicPaper[]> {
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=6&sortBy=relevance`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Pansophia/1.0' } });
    if (!res.ok) return [];
    const xml = await res.text();
    const entries = xml.split('<entry>').slice(1);
    return entries.map(entry => {
      const get = (tag: string) => {
        const m = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
        return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
      };
      const id = get('id').replace('http://arxiv.org/', 'https://arxiv.org/');
      const arxivId = id.split('/abs/')[1]?.split('v')[0] ?? '';
      const authorsRaw = [...entry.matchAll(/<name>([^<]+)<\/name>/g)].map(m => m[1]);
      const published = get('published').slice(0, 4);
      const pdfLink = (entry.match(/href="(https:\/\/arxiv\.org\/pdf\/[^"]+)"/) ?? [])[1]
        ?? (arxivId ? `https://arxiv.org/pdf/${arxivId}` : null);
      return {
        id: `arxiv_${arxivId || Math.random()}`, source: 'arxiv' as const,
        title: get('title').replace(/\s+/g, ' '),
        abstract: get('summary').replace(/\s+/g, ' ') || null,
        authors: authorsRaw, year: published ? parseInt(published) : null,
        pdfUrl: pdfLink,
        pageUrl: id || `https://arxiv.org/search/?query=${encodeURIComponent(query)}`,
        isOpenAccess: true as const,
      };
    }).filter(p => p.title && p.pdfUrl);
  } catch { return []; }
}

// ── CORE ──────────────────────────────────────────────────────────────────────

async function searchCORE(query: string): Promise<AcademicPaper[]> {
  const apiKey = process.env.CORE_API_KEY;
  const headers: Record<string, string> = { 'User-Agent': 'Pansophia/1.0' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  const url = `https://api.core.ac.uk/v3/search/works?q=${encodeURIComponent(query)}&limit=6`;
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.results ?? []) as Array<{
      id: number; title: string; abstract: string | null;
      authors: { name: string }[] | null; yearPublished: number | null;
      downloadUrl: string | null; doi: string | null;
      publisher: string | null; journals: { title: string }[] | null;
    }>)
      .filter(p => p.downloadUrl)
      .map(p => ({
        id: `core_${p.id}`, source: 'core' as const,
        title: p.title, abstract: p.abstract,
        authors: (p.authors ?? []).map(a => a.name),
        year: p.yearPublished, pdfUrl: p.downloadUrl,
        pageUrl: p.doi ? `https://doi.org/${p.doi}` : `https://core.ac.uk/works/${p.id}`,
        doi: p.doi ?? undefined,
        journal: p.journals?.[0]?.title ?? p.publisher ?? undefined,
        isOpenAccess: true as const,
      }));
  } catch { return []; }
}

// ── Dedup + rank ──────────────────────────────────────────────────────────────

function deduplicateAndRank(
  papers: AcademicPaper[],
  lessonTitle: string,
  topic: string,
): AcademicPaper[] {
  const seen = new Set<string>();
  const unique: AcademicPaper[] = [];

  for (const p of papers) {
    const key = p.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    const relevance = titleRelevanceBonus(p.title, lessonTitle, topic);
    const baseScore = (p.abstract ? 100 : 0) + (p.citationCount ?? 0) * 0.01 + (p.year ?? 2000) * 0.1;
    unique.push({ ...p, relevanceScore: relevance + baseScore });
  }

  return unique.sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { activityTitle, activityDescription, topic, depth, lessonTitle = '', objectives = [] } = await req.json();

    const queries = await getSearchQueries(activityTitle, activityDescription, topic, lessonTitle, objectives);
    const [q1] = queries;

    const [ssResults, arxivResults, coreResults] = await Promise.all([
      Promise.all(queries.map(q => searchSemanticScholar(q))).then(r => r.flat()),
      Promise.all(queries.map(q => searchArXiv(q))).then(r => r.flat()),
      searchCORE(q1),
    ]);

    const all = deduplicateAndRank(
      [...ssResults, ...arxivResults, ...coreResults],
      lessonTitle || activityTitle,
      topic,
    );

    return NextResponse.json({
      papers: all.slice(0, 6),
      queries,
      sources: {
        semanticScholar: ssResults.length,
        arxiv: arxivResults.length,
        core: coreResults.length,
      },
    });
  } catch (error) {
    console.error('Reading search error:', error);
    return NextResponse.json({ error: 'Failed to find articles' }, { status: 500 });
  }
}
