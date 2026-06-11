import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { buildCoursePrompt } from '@/lib/prompts';
import { OnboardingData } from '@/types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const data: OnboardingData = await req.json();

    const stream = await client.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 32000,
      messages: [{ role: 'user', content: buildCoursePrompt(data) }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    console.error('Course generation error:', error);
    return NextResponse.json({ error: 'Failed to generate course' }, { status: 500 });
  }
}
