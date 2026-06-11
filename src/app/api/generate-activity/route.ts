import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildPrompt(
  type: string, title: string, description: string,
  lessonTitle: string, topic: string, depth: string, objectives: string[]
): string {
  const ctx = `COURSE TOPIC: ${topic}\nDEPTH: ${depth}\nLESSON: ${lessonTitle}\nOBJECTIVES: ${objectives.join('; ')}\nACTIVITY: ${title}\nDETAILS: ${description}`;

  switch (type) {
    case 'reading':
      return `${ctx}

Write a full academic reading article for this activity.
- 900-1200 words, well-structured with ## and ### headings
- Grounded in real academic sources (cite author, title, journal/publisher, year inline)
- Introduction, 3-4 substantive body sections, conclusion
- Ends with a "Key References" section listing 4-6 real citations
- Pitched at ${depth} level, clear engaging prose
Return only the article in markdown.`;

    case 'audio':
      return `${ctx}

Write an educational podcast transcript as a dialogue between HOST and EXPERT GUEST.
- 1000-1200 words of spoken dialogue
- Natural conversational tone, covers key concepts deeply
- References real research, studies, or books by name
- Ends with HOST summarising 3 key takeaways
Format each line as **HOST:** ... or **GUEST:** ...
Return only the transcript in markdown.`;

    case 'video':
      return `${ctx}

Create a structured Video Viewing Guide.

## Before You Watch
- 3-4 key concepts to understand first (brief explanation each)

## What to Search
- 3 specific YouTube search queries (be precise, name channels: MIT OpenCourseWare, CrashCourse, Khan Academy, 3Blue1Brown, Kurzgesagt, TED-Ed where appropriate)

## What to Look For
- 5-6 specific things to pay attention to while watching
- Note-taking prompts

## Key Concepts to Extract
- 4-5 concepts you should be able to explain after watching

## After You Watch
- 3 reflection questions

Return in markdown. Name real channels, real concepts, real researchers.`;

    case 'exercise':
    case 'practice':
      return `${ctx}

Create an interactive practice exercise set. Return ONLY valid JSON:
{
  "intro": "Brief framing sentence",
  "exercises": [
    {
      "id": "ex1",
      "type": "short-answer",
      "question": "Question text",
      "hint": "Optional hint",
      "modelAnswer": "Full model answer"
    }
  ]
}
Include 4-5 exercises (types: short-answer, problem, analysis, application). Make them challenging for ${depth} level.`;

    case 'discussion':
      return `${ctx}

Create a Socratic discussion guide. Return ONLY valid JSON:
{
  "overview": "1-2 sentence framing",
  "prompts": [
    {
      "id": "d1",
      "mainQuestion": "Central discussion question",
      "followUps": ["Follow-up 1", "Follow-up 2"],
      "keyPoints": ["Key idea to address", "Another key idea"]
    }
  ]
}
Include 3 prompts building on each other. Root in real academic debates in ${topic} at ${depth} level.`;

    default:
      return `${ctx}\n\nGenerate comprehensive educational content for this activity in clear markdown with academic grounding.`;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { type, title, description, lessonTitle, topic, depth, objectives } = await req.json();
    const isJSON = ['exercise', 'practice', 'discussion'].includes(type);

    if (isJSON) {
      const message = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 4096,
        messages: [{ role: 'user', content: buildPrompt(type, title, description, lessonTitle, topic, depth, objectives ?? []) }],
      });
      const text = message.content[0].type === 'text' ? message.content[0].text : '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return NextResponse.json({ error: 'Invalid response' }, { status: 500 });
      return NextResponse.json(JSON.parse(match[0]));
    }

    const stream = await client.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      messages: [{ role: 'user', content: buildPrompt(type, title, description, lessonTitle, topic, depth, objectives ?? []) }],
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

    return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  } catch (error) {
    console.error('Activity generation error:', error);
    return NextResponse.json({ error: 'Failed to generate activity' }, { status: 500 });
  }
}
