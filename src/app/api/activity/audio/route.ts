import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface PodcastEpisode {
  trackId: number;
  trackName: string;
  collectionName: string;
  artistName: string;
  description: string;
  previewUrl: string;    // direct audio URL (30s preview or full)
  episodeUrl?: string;   // full episode audio URL if available
  releaseDate: string;
  trackTimeMillis?: number;
  artworkUrl600: string;
  contentAdvisoryRating?: string;
}

async function getSearchQuery(activityTitle: string, activityDescription: string, topic: string): Promise<string> {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 80,
    messages: [{
      role: 'user',
      content: `Write ONE iTunes/Apple Podcasts search query (max 8 words) that would find the best educational podcast episode for:
TOPIC: ${topic}
ACTIVITY: ${activityTitle}
DETAILS: ${activityDescription}
Prefer educational, scientific, or academic podcasts (e.g. Radiolab, 99% Invisible, Ologies, Freakonomics, Science Vs, Stuff You Should Know).
Return only the search query string, nothing else.`,
    }],
  });
  return msg.content[0].type === 'text' ? msg.content[0].text.trim().replace(/^["']|["']$/g, '') : activityTitle;
}

export async function POST(req: NextRequest) {
  try {
    const { activityTitle, activityDescription, topic } = await req.json();
    const query = await getSearchQuery(activityTitle, activityDescription, topic);

    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=podcast&entity=podcastEpisode&limit=8&explicit=No`;
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: 'iTunes search failed' }, { status: 502 });
    }
    const data = await res.json();
    const episodes: PodcastEpisode[] = (data.results ?? [])
      .filter((r: PodcastEpisode) => r.previewUrl)
      .slice(0, 5)
      .map((r: PodcastEpisode) => ({
        trackId: r.trackId,
        trackName: r.trackName,
        collectionName: r.collectionName,
        artistName: r.artistName,
        description: r.description,
        previewUrl: r.previewUrl,
        releaseDate: r.releaseDate,
        trackTimeMillis: r.trackTimeMillis,
        artworkUrl600: r.artworkUrl600,
      }));

    return NextResponse.json({ episodes, query });
  } catch (error) {
    console.error('Audio search error:', error);
    return NextResponse.json({ error: 'Failed to find podcast episodes' }, { status: 500 });
  }
}
