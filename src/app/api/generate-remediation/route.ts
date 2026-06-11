import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { buildRemediationPrompt } from '@/lib/prompts';
import { Lesson } from '@/types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { lesson, score, topic, depth }: { lesson: Lesson; score: number; topic: string; depth: string } = await req.json();

    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2048,
      messages: [{ role: 'user', content: buildRemediationPrompt(lesson, score, topic, depth) }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const remLesson = JSON.parse(jsonMatch[0]);
    // Ensure required fields
    remLesson.isRemediation = true;
    remLesson.quiz = undefined;
    remLesson.content = undefined;

    return NextResponse.json({ lesson: remLesson });
  } catch (error) {
    console.error('Remediation generation error:', error);
    return NextResponse.json({ error: 'Failed to generate remediation lesson' }, { status: 500 });
  }
}
