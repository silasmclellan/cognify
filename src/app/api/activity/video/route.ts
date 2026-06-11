import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface YouTubeVideo {
  videoId: string;
  title: string;
  channelName: string;
  description: string;
  thumbnail: string;
  duration?: string;
}

async function getSearchQuery(activityTitle: string, activityDescription: string, topic: string): Promise<string> {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 80,
    messages: [{
      role: 'user',
      content: `Write ONE YouTube search query (max 10 words) that would find the best educational video for:
TOPIC: ${topic}
ACTIVITY: ${activityTitle}
DETAILS: ${activityDescription}
Prefer reputable channels: MIT OpenCourseWare, CrashCourse, Khan Academy, TED-Ed, 3Blue1Brown, Kurzgesagt.
Return only the search query string, nothing else.`,
    }],
  });
  return msg.content[0].type === 'text' ? msg.content[0].text.trim().replace(/^["']|["']$/g, '') : activityTitle;
}

async function searchYouTube(query: string): Promise<YouTubeVideo[]> {
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%3D%3D`; // videos only
  const res = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  const html = await res.text();

  const startMarker = 'var ytInitialData = ';
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) return [];
  const jsonStart = html.indexOf('{', startIdx);
  if (jsonStart === -1) return [];
  // Find matching closing brace
  let depth = 0, jsonEnd = -1;
  for (let i = jsonStart; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { jsonEnd = i; break; } }
  }
  if (jsonEnd === -1) return [];
  const match = [null, html.slice(jsonStart, jsonEnd + 1)];
  if (!match) return [];

  const data = JSON.parse(match[1] as string);
  const videos: YouTubeVideo[] = [];

  try {
    const contents = data
      ?.contents
      ?.twoColumnSearchResultsRenderer
      ?.primaryContents
      ?.sectionListRenderer
      ?.contents?.[0]
      ?.itemSectionRenderer
      ?.contents ?? [];

    for (const item of contents) {
      const v = item?.videoRenderer;
      if (!v?.videoId) continue;

      const title = v.title?.runs?.[0]?.text ?? '';
      const channelName = v.ownerText?.runs?.[0]?.text ?? v.shortBylineText?.runs?.[0]?.text ?? '';
      const description = v.descriptionSnippet?.runs?.map((r: { text: string }) => r.text).join('') ?? '';
      const thumbnail = v.thumbnail?.thumbnails?.slice(-1)[0]?.url ?? `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;
      const duration = v.lengthText?.simpleText ?? '';

      videos.push({ videoId: v.videoId, title, channelName, description, thumbnail, duration });
      if (videos.length >= 4) break;
    }
  } catch {
    // parsing failed
  }

  return videos;
}

export async function POST(req: NextRequest) {
  try {
    const { activityTitle, activityDescription, topic } = await req.json();
    const query = await getSearchQuery(activityTitle, activityDescription, topic);
    const videos = await searchYouTube(query);
    return NextResponse.json({ videos, query });
  } catch (error) {
    console.error('Video search error:', error);
    return NextResponse.json({ error: 'Failed to find videos' }, { status: 500 });
  }
}
