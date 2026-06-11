'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, BookOpen, FileText } from 'lucide-react';
import type { AcademicPaper } from '@/app/api/activity/reading/route';
import type { YouTubeVideo } from '@/app/api/activity/video/route';
import type { PodcastEpisode } from '@/app/api/activity/audio/route';

interface Activity {
  type: string;
  title: string;
  description: string;
  estimatedMinutes: number;
}

interface Props {
  activity: Activity;
  lessonTitle: string;
  topic: string;
  depth: string;
  objectives: string[];
  index: number;
}

const activityIcons: Record<string, string> = {
  reading: '📖', video: '🎥', audio: '🎧',
  exercise: '✏️', discussion: '💬', practice: '⚙️',
};

const activityLabel: Record<string, string> = {
  reading: 'Academic Reading', video: 'Video', audio: 'Podcast',
  exercise: 'Exercise', practice: 'Practice', discussion: 'Discussion',
};

// ── Markdown renderer ─────────────────────────────────────────────────────────

function renderMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])(.+)$/gm, '<p>$1</p>');
}

// ── Reading player ────────────────────────────────────────────────────────────

const sourceLabel: Record<string, string> = {
  arxiv: 'arXiv',
  semantic_scholar: 'Semantic Scholar',
  core: 'CORE',
};

const sourceBadgeColor: Record<string, string> = {
  arxiv: '#b31b1b',         // arXiv red
  semantic_scholar: '#1857a4', // SS blue
  core: '#2e7d32',          // CORE green
};

function formatAuthors(authors: string[], max = 3): string {
  if (!authors?.length) return '';
  const names = authors.slice(0, max);
  if (authors.length > max) names.push(`+${authors.length - max} more`);
  return names.join(', ');
}

function ReadingPlayer({ papers, queries }: { papers: AcademicPaper[]; queries: string[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [pdfOpen, setPdfOpen] = useState(false);

  if (!papers.length) {
    return (
      <div style={{ padding: '20px 0', color: 'var(--text-muted)', fontSize: 15 }}>
        No open-access articles found. Try searching directly:{' '}
        <a href={`https://arxiv.org/search/?query=${encodeURIComponent(queries[0] ?? '')}&searchtype=all`} target="_blank" rel="noopener" style={{ color: 'var(--accent)' }}>arXiv ↗</a>{' · '}
        <a href={`https://core.ac.uk/search?q=${encodeURIComponent(queries[0] ?? '')}`} target="_blank" rel="noopener" style={{ color: 'var(--accent)' }}>CORE ↗</a>{' · '}
        <a href={`https://scholar.google.com/scholar?q=${encodeURIComponent(queries[0] ?? '')}`} target="_blank" rel="noopener" style={{ color: 'var(--accent)' }}>Google Scholar ↗</a>
      </div>
    );
  }

  const paper = papers[activeIdx];
  // Proxy PDF through our server to avoid X-Frame-Options blocking
  const proxyPdfUrl = paper.pdfUrl
    ? `/api/activity/pdf-proxy?url=${encodeURIComponent(paper.pdfUrl)}`
    : null;

  return (
    <div>
      {/* Tab selector */}
      {papers.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
          {papers.map((p, i) => (
            <button
              key={p.id}
              onClick={() => { setActiveIdx(i); setPdfOpen(false); }}
              style={{
                padding: '5px 12px', borderRadius: 2, fontSize: 13, cursor: 'pointer',
                fontFamily: 'inherit', border: '1px solid var(--border)',
                background: i === activeIdx ? 'var(--accent)' : 'var(--bg-card)',
                color: i === activeIdx ? '#fff' : 'var(--text-muted)',
              }}
            >
              {i + 1}
            </button>
          ))}
          <span style={{ fontSize: 13, color: 'var(--text-faint)', marginLeft: 4 }}>
            {papers.length} open-access papers
          </span>
        </div>
      )}

      {/* Paper metadata card */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 4, padding: '22px 26px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
          <BookOpen size={20} style={{ flexShrink: 0, color: 'var(--accent)', marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                padding: '2px 7px', borderRadius: 2,
                background: sourceBadgeColor[paper.source] ?? 'var(--accent)',
                color: '#fff',
              }}>
                {sourceLabel[paper.source] ?? paper.source}
              </span>
              <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3a6b3a', fontWeight: 600 }}>
                ✓ Open Access
              </span>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.4, margin: '0 0 6px', color: 'var(--text)' }}>
              {paper.title}
            </h3>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              {formatAuthors(paper.authors)}
              {paper.year ? ` · ${paper.year}` : ''}
              {paper.journal ? ` · ${paper.journal}` : ''}
              {(paper.citationCount ?? 0) > 0 ? ` · ${paper.citationCount!.toLocaleString()} citations` : ''}
            </div>
          </div>
        </div>

        {paper.abstract ? (
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 10 }}>
              Abstract
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--text)', margin: 0 }}>
              {paper.abstract}
            </p>
          </div>
        ) : (
          <p style={{ fontSize: 15, color: 'var(--text-muted)', fontStyle: 'italic' }}>Abstract not available.</p>
        )}

        {/* Action buttons */}
        <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {proxyPdfUrl && (
            <button
              onClick={() => setPdfOpen(o => !o)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', background: pdfOpen ? 'var(--accent-light)' : 'var(--accent)',
                color: '#fff', borderRadius: 2, fontSize: 14, fontWeight: 600,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <FileText size={14} /> {pdfOpen ? 'Close PDF' : 'Read Full Paper'}
            </button>
          )}
          <a href={paper.pageUrl} target="_blank" rel="noopener"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--bg)', border: '1px solid var(--border-strong)', color: 'var(--accent)', borderRadius: 2, fontSize: 14, textDecoration: 'none' }}>
            <ExternalLink size={14} /> Paper Page
          </a>
          {paper.pdfUrl && (
            <a href={paper.pdfUrl} target="_blank" rel="noopener"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 2, fontSize: 13, textDecoration: 'none' }}>
              Download PDF ↗
            </a>
          )}
        </div>
      </div>

      {/* Inline PDF viewer */}
      {pdfOpen && proxyPdfUrl && (
        <div style={{ marginTop: 16, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)', background: '#525659' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {paper.title}
            </span>
            <button
              onClick={() => setPdfOpen(false)}
              style={{ flexShrink: 0, marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 18, lineHeight: 1, fontFamily: 'inherit', padding: '0 4px' }}
              aria-label="Close PDF"
            >
              ×
            </button>
          </div>
          <iframe
            src={proxyPdfUrl}
            title={paper.title}
            style={{ width: '100%', height: '80vh', border: 'none', display: 'block' }}
          />
        </div>
      )}

      {/* Search more */}
      <div style={{ marginTop: 14, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>Search more:</span>
        <a href={`https://arxiv.org/search/?query=${encodeURIComponent(queries[0] ?? '')}&searchtype=all`}
          target="_blank" rel="noopener" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'underline' }}>arXiv ↗</a>
        <a href={`https://core.ac.uk/search?q=${encodeURIComponent(queries[0] ?? '')}`}
          target="_blank" rel="noopener" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'underline' }}>CORE ↗</a>
        <a href={`https://www.semanticscholar.org/search?q=${encodeURIComponent(queries[0] ?? '')}&sort=Relevance`}
          target="_blank" rel="noopener" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'underline' }}>Semantic Scholar ↗</a>
        <a href={`https://scholar.google.com/scholar?q=${encodeURIComponent(queries[0] ?? '')}`}
          target="_blank" rel="noopener" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'underline' }}>Google Scholar ↗</a>
      </div>
    </div>
  );
}

// ── Video player ──────────────────────────────────────────────────────────────

function VideoPlayer({ videos, query }: { videos: YouTubeVideo[]; query: string }) {
  const [activeIdx, setActiveIdx] = useState(0);

  if (!videos.length) {
    return (
      <div style={{ padding: '20px 0', color: 'var(--text-muted)', fontSize: 15 }}>
        No videos found.{' '}
        <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`}
          target="_blank" rel="noopener" style={{ color: 'var(--accent)' }}>
          Search YouTube ↗
        </a>
      </div>
    );
  }

  const video = videos[activeIdx];

  return (
    <div>
      {/* Selector row */}
      {videos.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
          {videos.map((v, i) => (
            <button
              key={v.videoId}
              onClick={() => setActiveIdx(i)}
              style={{
                flexShrink: 0, maxWidth: 180, padding: '6px 12px',
                borderRadius: 2, fontSize: 12, cursor: 'pointer',
                fontFamily: 'inherit', border: '1px solid var(--border)',
                background: i === activeIdx ? 'var(--accent)' : 'var(--bg-card)',
                color: i === activeIdx ? '#fff' : 'var(--text-muted)',
                textAlign: 'left', lineHeight: 1.4,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
              title={v.title}
            >
              {v.title}
            </button>
          ))}
        </div>
      )}

      {/* Embed */}
      <div style={{ position: 'relative', paddingBottom: '56.25%', background: '#000', borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
        <iframe
          key={video.videoId}
          src={`https://www.youtube.com/embed/${video.videoId}?rel=0&modestbranding=1`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
        />
      </div>

      {/* Metadata */}
      <div style={{ padding: '14px 18px', background: 'var(--bg-card)', borderRadius: 3, border: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, lineHeight: 1.4 }}>{video.title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
          {video.channelName}{video.duration ? ` · ${video.duration}` : ''}
        </div>
        {video.description && (
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
            {video.description}
          </p>
        )}
        <a
          href={`https://www.youtube.com/watch?v=${video.videoId}`}
          target="_blank" rel="noopener"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 12, fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}
        >
          <ExternalLink size={13} /> Open in YouTube
        </a>
      </div>
    </div>
  );
}

// ── Audio/Podcast player ──────────────────────────────────────────────────────

function formatDuration(ms?: number): string {
  if (!ms) return '';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function AudioPlayer({ episodes, query }: { episodes: PodcastEpisode[]; query: string }) {
  const [activeIdx, setActiveIdx] = useState(0);

  if (!episodes.length) {
    return (
      <div style={{ padding: '20px 0', color: 'var(--text-muted)', fontSize: 15 }}>
        No podcast episodes found.{' '}
        <a href={`https://podcasts.apple.com/search?term=${encodeURIComponent(query)}`}
          target="_blank" rel="noopener" style={{ color: 'var(--accent)' }}>
          Search Apple Podcasts ↗
        </a>
      </div>
    );
  }

  const ep = episodes[activeIdx];
  const releaseYear = ep.releaseDate ? new Date(ep.releaseDate).getFullYear() : null;

  return (
    <div>
      {/* Episode selector */}
      {episodes.length > 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
          {episodes.map((e, i) => (
            <button
              key={e.trackId}
              onClick={() => setActiveIdx(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 3, cursor: 'pointer',
                fontFamily: 'inherit', border: '1px solid var(--border)',
                background: i === activeIdx ? 'var(--accent-bg-strong)' : 'var(--bg-card)',
                textAlign: 'left',
              }}
            >
              {e.artworkUrl600 && (
                <img src={e.artworkUrl600} alt="" style={{ width: 40, height: 40, borderRadius: 3, flexShrink: 0, objectFit: 'cover' }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: i === activeIdx ? 'var(--accent)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.trackName}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                  {e.collectionName}{e.trackTimeMillis ? ` · ${formatDuration(e.trackTimeMillis)}` : ''}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Active episode */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 4, padding: '20px 22px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
          {ep.artworkUrl600 && (
            <img src={ep.artworkUrl600} alt={ep.collectionName} style={{ width: 72, height: 72, borderRadius: 4, flexShrink: 0, objectFit: 'cover' }} />
          )}
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 5px', lineHeight: 1.4 }}>{ep.trackName}</h3>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {ep.collectionName}
              {ep.artistName && ep.artistName !== ep.collectionName ? ` · ${ep.artistName}` : ''}
              {releaseYear ? ` · ${releaseYear}` : ''}
              {ep.trackTimeMillis ? ` · ${formatDuration(ep.trackTimeMillis)}` : ''}
            </div>
          </div>
        </div>

        {/* HTML5 audio player */}
        <audio
          controls
          src={ep.previewUrl}
          style={{ width: '100%', marginBottom: 14, accentColor: 'var(--accent)' } as React.CSSProperties}
        >
          Your browser does not support audio playback.
        </audio>

        {ep.description && (
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.65, margin: '0 0 14px' }}>
            {ep.description.length > 400 ? ep.description.slice(0, 400) + '…' : ep.description}
          </p>
        )}

        <a
          href={`https://podcasts.apple.com/podcast/id?i=${ep.trackId}`}
          target="_blank" rel="noopener"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}
        >
          <ExternalLink size={13} /> Open in Apple Podcasts
        </a>
      </div>
    </div>
  );
}

// ── Exercise player ───────────────────────────────────────────────────────────

interface Exercise {
  id: string; type: string; question: string; hint?: string; modelAnswer: string;
}

function ExercisePlayer({ data }: { data: { intro: string; exercises: Exercise[] } }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  return (
    <div>
      <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 24, fontStyle: 'italic' }}>{data.intro}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {data.exercises.map((ex, i) => (
          <div key={ex.id} className="card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>
              {ex.type.replace('-', ' ')} {i + 1}
            </div>
            <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 12, lineHeight: 1.5 }}>{ex.question}</p>
            {ex.hint && !revealed.has(ex.id) && (
              <p style={{ fontSize: 13, color: 'var(--text-faint)', fontStyle: 'italic', marginBottom: 10 }}>
                Hint: {ex.hint}
              </p>
            )}
            <textarea
              className="input-field"
              style={{ minHeight: 90, resize: 'vertical', fontSize: 15, marginBottom: 12 }}
              placeholder="Write your answer here…"
              value={answers[ex.id] ?? ''}
              onChange={e => setAnswers(a => ({ ...a, [ex.id]: e.target.value }))}
            />
            <button
              className="btn-secondary"
              style={{ fontSize: 14, padding: '7px 16px' }}
              onClick={() => setRevealed(r => new Set([...r, ex.id]))}
            >
              {revealed.has(ex.id) ? 'Hide Answer' : 'Reveal Model Answer'}
            </button>
            {revealed.has(ex.id) && (
              <div style={{ marginTop: 14, padding: '14px 18px', borderRadius: 3, background: 'var(--accent-bg)', borderLeft: '3px solid var(--accent)', fontSize: 15, color: 'var(--text)', lineHeight: 1.65 }}>
                <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>Model Answer</div>
                {ex.modelAnswer}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Discussion player ─────────────────────────────────────────────────────────

interface DiscussionPrompt {
  id: string; mainQuestion: string; followUps: string[]; keyPoints: string[];
}

function DiscussionPlayer({ data }: { data: { overview: string; prompts: DiscussionPrompt[] } }) {
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set([data.prompts[0]?.id]));

  const toggle = (id: string) => setExpanded(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  return (
    <div>
      <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 24, fontStyle: 'italic' }}>{data.overview}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {data.prompts.map((p, i) => (
          <div key={p.id} className="card" style={{ padding: '18px 22px' }}>
            <button
              onClick={() => toggle(p.id)}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', gap: 12 }}
            >
              <div>
                <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 6 }}>Prompt {i + 1}</div>
                <p style={{ fontWeight: 600, fontSize: 16, lineHeight: 1.5, margin: 0 }}>{p.mainQuestion}</p>
              </div>
              {expanded.has(p.id) ? <ChevronUp size={16} style={{ flexShrink: 0, marginTop: 4 }} /> : <ChevronDown size={16} style={{ flexShrink: 0, marginTop: 4 }} />}
            </button>
            {expanded.has(p.id) && (
              <div style={{ marginTop: 16 }}>
                {p.followUps.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>Consider also</div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {p.followUps.map((f, fi) => (
                        <li key={fi} style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 6, paddingLeft: 16, borderLeft: '2px solid var(--border)' }}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {p.keyPoints.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>Key points to address</div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {p.keyPoints.map((k, ki) => (
                        <li key={ki} style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', gap: 8 }}>
                          <span style={{ color: 'var(--accent)', flexShrink: 0 }}>→</span> {k}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <textarea
                  className="input-field"
                  style={{ minHeight: 110, resize: 'vertical', fontSize: 15 }}
                  placeholder="Write your response here…"
                  value={responses[p.id] ?? ''}
                  onChange={e => setResponses(r => ({ ...r, [p.id]: e.target.value }))}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ActivityPlayer ───────────────────────────────────────────────────────

type LoadingState = 'idle' | 'loading' | 'done' | 'error';

export default function ActivityPlayer({ activity, lessonTitle, topic, depth, objectives, index }: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LoadingState>('idle');
  const [content, setContent] = useState<string | null>(null);      // streamed text (exercise/discussion/audio fallback)
  const [jsonData, setJsonData] = useState<Record<string, unknown> | null>(null); // exercise/discussion
  const [readingData, setReadingData] = useState<{ papers: AcademicPaper[]; queries: string[] } | null>(null);
  const [videoData, setVideoData] = useState<{ videos: YouTubeVideo[]; query: string } | null>(null);
  const [audioData, setAudioData] = useState<{ episodes: PodcastEpisode[]; query: string } | null>(null);
  const [error, setError] = useState('');

  const isRealContent = ['reading', 'video', 'audio'].includes(activity.type);
  const isJSON = ['exercise', 'practice', 'discussion'].includes(activity.type);

  const load = async () => {
    setState('loading');
    setError('');

    try {
      if (activity.type === 'reading') {
        const res = await fetch('/api/activity/reading', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activityTitle: activity.title, activityDescription: activity.description, topic, depth, lessonTitle, objectives }),
        });
        const data = await res.json();
        setReadingData(data);
        setState('done');

      } else if (activity.type === 'video') {
        const res = await fetch('/api/activity/video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activityTitle: activity.title, activityDescription: activity.description, topic }),
        });
        const data = await res.json();
        setVideoData(data);
        setState('done');

      } else if (activity.type === 'audio') {
        const res = await fetch('/api/activity/audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activityTitle: activity.title, activityDescription: activity.description, topic }),
        });
        const data = await res.json();
        setAudioData(data);
        setState('done');

      } else {
        // exercise / practice / discussion — AI generated as before
        const res = await fetch('/api/generate-activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: activity.type, title: activity.title, description: activity.description, lessonTitle, topic, depth, objectives }),
        });
        if (!res.ok) throw new Error('Generation failed');
        if (isJSON) {
          const data = await res.json();
          setJsonData(data);
        } else {
          const reader = res.body?.getReader();
          const decoder = new TextDecoder();
          let full = '';
          while (reader) {
            const { done, value } = await reader.read();
            if (done) break;
            full += decoder.decode(value);
            setContent(full);
          }
        }
        setState('done');
      }
    } catch (e) {
      setError('Failed to load content. Please try again.');
      setState('error');
      console.error(e);
    }
  };

  const handleToggle = () => {
    const opening = !open;
    setOpen(opening);
    if (opening && state === 'idle') load();
  };

  const loadingMessage: Record<string, string> = {
    reading: 'Searching academic databases…',
    video: 'Finding the best video…',
    audio: 'Searching for podcast episodes…',
    exercise: 'Generating exercises…',
    practice: 'Generating practice problems…',
    discussion: 'Generating discussion prompts…',
  };

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <button
        onClick={handleToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 14,
          padding: '16px 20px', background: 'none', border: 'none',
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 20, flexShrink: 0 }}>
          {activityIcons[activity.type] ?? '📌'}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{activity.title}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {activityLabel[activity.type] ?? 'Activity'} · {activity.estimatedMinutes} min
          </div>
        </div>
        {isRealContent && (
          <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginRight: 6 }}>
            {activity.type === 'reading' ? 'Real papers' : activity.type === 'video' ? 'YouTube' : 'Podcast'}
          </span>
        )}
        <div style={{ flexShrink: 0, color: 'var(--text-faint)' }}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expandable body */}
      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '24px 24px 28px' }}>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 20, lineHeight: 1.6 }}>
            {activity.description}
          </p>

          {state === 'loading' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 0', color: 'var(--text-muted)', fontSize: 15 }}>
              <div className="spinner" />
              {loadingMessage[activity.type] ?? 'Loading…'}
            </div>
          )}

          {state === 'error' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <p style={{ color: 'var(--danger)', fontSize: 15, flex: 1 }}>{error}</p>
              <button className="btn-secondary" style={{ fontSize: 14, padding: '7px 16px' }} onClick={() => { setState('idle'); load(); }}>
                Retry
              </button>
            </div>
          )}

          {state === 'done' && (
            <>
              {readingData && <ReadingPlayer papers={readingData.papers} queries={readingData.queries} />}
              {videoData && <VideoPlayer videos={videoData.videos} query={videoData.query} />}
              {audioData && <AudioPlayer episodes={audioData.episodes} query={audioData.query} />}
              {content && <div className="prose-dark" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />}
              {jsonData && activity.type === 'discussion' && (
                <DiscussionPlayer data={jsonData as Parameters<typeof DiscussionPlayer>[0]['data']} />
              )}
              {jsonData && (activity.type === 'exercise' || activity.type === 'practice') && (
                <ExercisePlayer data={jsonData as Parameters<typeof ExercisePlayer>[0]['data']} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
