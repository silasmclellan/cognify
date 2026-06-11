import { OnboardingData } from '@/types';

const timeMap: Record<string, string> = {
  '20min': '20 minutes per day',
  '1hour': '1 hour per day',
  '2hours': '2 hours per day',
  'halfday': '4 hours per day',
  'fulltime': '8 hours per day (full-time)',
};

const depthMap: Record<string, string> = {
  beginner: 'beginner (no prior knowledge assumed)',
  intermediate: 'intermediate (some familiarity assumed)',
  advanced: 'advanced (solid foundation, pushing deeper)',
  expert: 'expert/mastery level (professional or academic depth)',
};

export function buildCoursePrompt(data: OnboardingData): string {
  const time = timeMap[data.timeCommitment];
  const depth = depthMap[data.depth];
  const styles = data.learningStyles.join(', ');

  const weeks = {
    '20min': 8,
    '1hour': 6,
    '2hours': 5,
    'halfday': 4,
    'fulltime': 3,
  }[data.timeCommitment];

  return `You are an expert curriculum designer and educator with deep knowledge of academic literature. Create a comprehensive, personalized course syllabus grounded in the most reputable sources available.

SOURCE STANDARDS — strictly follow this priority order:
1. Peer-reviewed academic journals (e.g. Nature, Science, JSTOR, PubMed, SSRN, NBER, APA journals, IEEE, ACM)
2. University press books and textbooks (e.g. Oxford, Cambridge, MIT Press, Harvard University Press)
3. Classic foundational texts and seminal papers in the field
4. Reports from authoritative institutions (WHO, CDC, IMF, World Bank, national academies of science)
5. Only if nothing above applies: highly reputable long-form journalism (The Atlantic, New Yorker, BBC, NPR)
Never cite or recommend Wikipedia, blogs, or unverified web content as primary sources.
For each activity, name the specific author, title, journal/publisher, and year where known.

COURSE TOPIC: ${data.topic}
DEPTH LEVEL: ${depth}
TIME AVAILABLE: ${time}
LEARNING STYLES: ${styles}
${data.goals ? `LEARNER GOALS: ${data.goals}` : ''}
${data.background ? `LEARNER BACKGROUND: ${data.background}` : ''}

Design a ${weeks}-week course. For each week, create 3-4 lessons. Each lesson should be completable within the learner's daily time budget. Keep all description and homework strings concise (1-2 sentences max) — detail goes in the lesson content, not the syllabus JSON.

Tailor ALL activities to the specified learning styles AND cite reputable sources:
- reading → peer-reviewed articles, academic textbooks (cite author, title, publisher/journal, year)
- listening → university lecture series, academic podcasts (e.g. BBC In Our Time, Ologies, TED-Ed), named documentaries
- watching → named documentary films, MIT OpenCourseWare, Khan Academy, Crash Course (cite the specific series/episode)
- practicing → exercises drawn from textbook problem sets, lab protocols from published studies
- collaborative → Socratic seminars on specific texts, structured academic debates
- mixed → blend all styles with cited sources throughout

Return ONLY valid JSON matching this exact structure:
{
  "title": "Course title",
  "description": "2-3 sentence course overview",
  "learningObjectives": ["objective 1", "objective 2", ...],
  "prerequisites": ["prereq 1", ...],
  "creditHours": 3,
  "weeks": [
    {
      "weekNumber": 1,
      "theme": "Week theme/focus",
      "lessons": [
        {
          "id": "w1l1",
          "weekNumber": 1,
          "lessonNumber": 1,
          "title": "Lesson title",
          "description": "Brief description",
          "objectives": ["what learner will be able to do"],
          "estimatedMinutes": 20,
          "activities": [
            {
              "type": "reading|video|audio|exercise|discussion|practice",
              "title": "Activity title",
              "description": "What to do and what resource/content",
              "estimatedMinutes": 10
            }
          ],
          "homework": "Optional homework assignment description"
        }
      ]
    }
  ]
}`;
}

export function buildLessonContentPrompt(lesson: { title: string; description: string; objectives: string[]; activities: { type: string; title: string; description: string }[] }, topic: string, depth: string, learningStyles: string[]): string {
  return `You are an expert educator with deep knowledge of academic literature. Write the full lesson content for the following lesson, grounding all content in reputable sources.

COURSE TOPIC: ${topic}
DEPTH: ${depth}
PREFERRED LEARNING STYLES: ${learningStyles.join(', ')}

LESSON: ${lesson.title}
DESCRIPTION: ${lesson.description}
OBJECTIVES: ${lesson.objectives.join('; ')}

Write comprehensive lesson content in markdown format. Include:
1. A brief engaging introduction (2-3 paragraphs) citing foundational works or landmark studies
2. Core concepts explained clearly with examples drawn from published research or authoritative texts
3. A "Key Sources" section listing the 3-5 most important academic references for this lesson (author, title, journal/publisher, year)
4. Key takeaways section
5. For each activity, provide detailed instructions and cite the specific source (author, title, year) the learner should engage with

Activities to cover:
${lesson.activities.map(a => `- ${a.type.toUpperCase()}: ${a.title} — ${a.description}`).join('\n')}

Cite only peer-reviewed journals, university press books, seminal texts, or authoritative institutions. Name specific works — do not be vague. Pitch content at the ${depth} level.`;
}

export function buildQuizPrompt(lesson: { title: string; objectives: string[] }, topic: string, depth: string): string {
  return `Create a quiz for this lesson. Return ONLY valid JSON.

TOPIC: ${topic}
LESSON: ${lesson.title}
OBJECTIVES: ${lesson.objectives.join('; ')}
DEPTH: ${depth}

Return exactly 5 multiple-choice questions:
{
  "questions": [
    {
      "id": "q1",
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Why this answer is correct"
    }
  ]
}`;
}
