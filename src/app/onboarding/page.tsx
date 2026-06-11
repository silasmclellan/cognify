'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Brain, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { OnboardingData, LearningStyle, DepthLevel, TimeCommitment, Course } from '@/types';
import { saveCourseRemote, saveCourseLocal } from '@/lib/courseStorage';
import { useSession } from 'next-auth/react';
function generateCourseId() {
  return `course_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function extractJSON(text: string): Record<string, unknown> {
  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : text;

  // Walk the string tracking brace depth and string context
  // to find the outermost complete JSON object
  const start = candidate.indexOf('{');
  if (start === -1) throw new Error('No JSON object found in response');

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return JSON.parse(candidate.slice(start, i + 1)) as Record<string, unknown>;
      }
    }
  }
  throw new Error('Incomplete JSON in response');
}

const steps = ['Topic', 'Depth', 'Time', 'Style', 'Generate'];

const depthOptions: { value: DepthLevel; label: string; desc: string }[] = [
  { value: 'beginner', label: 'Beginner', desc: 'Starting from scratch, no prior knowledge needed' },
  { value: 'intermediate', label: 'Intermediate', desc: 'Some familiarity with the basics' },
  { value: 'advanced', label: 'Advanced', desc: 'Solid foundation, ready to go deep' },
  { value: 'expert', label: 'Expert', desc: 'Professional or academic mastery level' },
];

const timeOptions: { value: TimeCommitment; label: string; desc: string; icon: string }[] = [
  { value: '20min', label: '20 min/day', desc: 'Quick daily habit', icon: '⚡' },
  { value: '1hour', label: '1 hour/day', desc: 'Evening learning', icon: '🌙' },
  { value: '2hours', label: '2 hours/day', desc: 'Dedicated study', icon: '📖' },
  { value: 'halfday', label: 'Half day', desc: '4 hours/day intensive', icon: '🔥' },
  { value: 'fulltime', label: 'Full time', desc: '8 hours/day immersive', icon: '🚀' },
];

const styleOptions: { value: LearningStyle; label: string; icon: string; desc: string }[] = [
  { value: 'reading', label: 'Reading', icon: '📚', desc: 'Articles, textbooks, written guides' },
  { value: 'watching', label: 'Watching', icon: '🎥', desc: 'Video lectures and tutorials' },
  { value: 'listening', label: 'Listening', icon: '🎧', desc: 'Podcasts and audio content' },
  { value: 'practicing', label: 'Practicing', icon: '⚙️', desc: 'Hands-on exercises and projects' },
  { value: 'collaborative', label: 'Collaborative', icon: '🤝', desc: 'Discussion and peer learning' },
  { value: 'mixed', label: 'Mixed', icon: '🎯', desc: 'A blend of all styles' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Partial<OnboardingData>>({
    learningStyles: [],
  });
  const [generating, setGenerating] = useState(false);
  const [generatingText, setGeneratingText] = useState('');
  const [error, setError] = useState('');

  const canNext = () => {
    if (step === 0) return !!data.topic?.trim();
    if (step === 1) return !!data.depth;
    if (step === 2) return !!data.timeCommitment;
    if (step === 3) return (data.learningStyles?.length ?? 0) > 0;
    return false;
  };

  const toggleStyle = (s: LearningStyle) => {
    setData(d => {
      const styles = d.learningStyles ?? [];
      return {
        ...d,
        learningStyles: styles.includes(s) ? styles.filter(x => x !== s) : [...styles, s],
      };
    });
  };

  const handleGenerate = async () => {
    if (!data.topic || !data.depth || !data.timeCommitment || !data.learningStyles?.length) return;
    setGenerating(true);
    setError('');
    setGeneratingText('');

    try {
      const res = await fetch('/api/generate-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('API request failed: ' + res.status);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let full = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        full += chunk;
        setGeneratingText(full.slice(0, 200) + (full.length > 200 ? '...' : ''));
      }

      const courseData = extractJSON(full);
      const courseId = generateCourseId();

      const course: Course = {
        id: courseId,
        title: courseData.title as string,
        description: courseData.description as string,
        topic: data.topic,
        depth: data.depth,
        totalWeeks: Array.isArray(courseData.weeks) ? courseData.weeks.length : 0,
        creditHours: courseData.creditHours as number | undefined,
        learningObjectives: (courseData.learningObjectives as string[]) ?? [],
        prerequisites: (courseData.prerequisites as string[]) ?? [],
        weeks: (courseData.weeks as Course['weeks']) ?? [],
        createdAt: new Date().toISOString(),
        onboardingData: data as OnboardingData,
        progress: { completedLessons: [], scores: {} },
      };

      // Always save locally first (instant, no auth dependency)
      saveCourseLocal(course);
      // Also persist to DB if signed in
      if (session?.user) {
        await saveCourseRemote(course);
      }
      router.push(`/course/${courseId}`);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Course generation failed: ${msg}`);
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="flex items-center justify-between px-8 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <Link href="/" className="flex items-center gap-2">
          <div style={{ background: 'linear-gradient(135deg, var(--accent), #8b5cf6)', borderRadius: 10, padding: '6px 10px' }}>
            <Brain size={20} color="white" />
          </div>
          <span className="text-xl font-bold gradient-text">Pansophia</span>
        </Link>
        <div className="flex items-center gap-3">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: i <= step ? 'linear-gradient(135deg, var(--accent), #8b5cf6)' : 'var(--bg-card)',
                  color: i <= step ? 'white' : 'var(--text-faint)',
                }}
              >
                {i + 1}
              </div>
              {i < steps.length - 1 && (
                <div style={{ width: 20, height: 1, background: i < step ? 'var(--accent)' : 'var(--border)' }} />
              )}
            </div>
          ))}
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">

          {step === 0 && (
            <div>
              <h1 className="text-4xl font-bold mb-3">What do you want to learn?</h1>
              <p className="mb-8" style={{ color: 'var(--text-muted)' }}>Be as specific or broad as you like — Pansophia will build the perfect curriculum.</p>
              <input
                className="input-field text-xl mb-4"
                style={{ padding: '18px 20px' }}
                placeholder="e.g. Python programming, History of Thailand, Adolescent Psychology..."
                value={data.topic ?? ''}
                onChange={e => setData(d => ({ ...d, topic: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && canNext() && setStep(1)}
                autoFocus
              />
              <p className="text-sm mb-6" style={{ color: 'var(--text-faint)' }}>Examples: "Fundamentals of Accounting", "Oil Painting for Beginners", "Machine Learning", "Thai Cooking"</p>
              <div className="mt-4">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                  Any specific goals? <span style={{ color: 'var(--text-faint)' }}>(optional)</span>
                </label>
                <textarea
                  className="input-field"
                  style={{ minHeight: 80, resize: 'vertical' }}
                  placeholder="e.g. I want to pass the CPA exam, build a web app, read Thai literature..."
                  value={data.goals ?? ''}
                  onChange={e => setData(d => ({ ...d, goals: e.target.value }))}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h1 className="text-4xl font-bold mb-3">How deep do you want to go?</h1>
              <p className="mb-8" style={{ color: 'var(--text-muted)' }}>This shapes the complexity and pace of your curriculum.</p>
              <div className="flex flex-col gap-3">
                {depthOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setData(d => ({ ...d, depth: opt.value }))}
                    className="card card-hover p-5 text-left flex items-center gap-4"
                    style={{
                      border: data.depth === opt.value ? '1px solid var(--accent)' : undefined,
                      background: data.depth === opt.value ? 'var(--accent-bg)' : undefined,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div className="font-semibold text-lg">{opt.label}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{opt.desc}</div>
                    </div>
                    {data.depth === opt.value && <div style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</div>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 className="text-4xl font-bold mb-3">How much time can you commit?</h1>
              <p className="mb-8" style={{ color: 'var(--text-muted)' }}>We will build lessons that fit your schedule perfectly.</p>
              <div className="grid grid-cols-1 gap-3">
                {timeOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setData(d => ({ ...d, timeCommitment: opt.value }))}
                    className="card card-hover p-5 text-left flex items-center gap-4"
                    style={{
                      border: data.timeCommitment === opt.value ? '1px solid var(--accent)' : undefined,
                      background: data.timeCommitment === opt.value ? 'var(--accent-bg)' : undefined,
                    }}
                  >
                    <span className="text-2xl">{opt.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div className="font-semibold">{opt.label}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{opt.desc}</div>
                    </div>
                    {data.timeCommitment === opt.value && <div style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</div>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h1 className="text-4xl font-bold mb-3">How do you learn best?</h1>
              <p className="mb-8" style={{ color: 'var(--text-muted)' }}>Pick one or more — your lessons will be designed around your preferences.</p>
              <div className="grid grid-cols-2 gap-3">
                {styleOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => toggleStyle(opt.value)}
                    className="card card-hover p-5 text-left"
                    style={{
                      border: data.learningStyles?.includes(opt.value) ? '1px solid var(--accent)' : undefined,
                      background: data.learningStyles?.includes(opt.value) ? 'var(--accent-bg)' : undefined,
                    }}
                  >
                    <span className="text-2xl mb-2 block">{opt.icon}</span>
                    <div className="font-semibold mb-1">{opt.label}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{opt.desc}</div>
                  </button>
                ))}
              </div>
              <div className="mt-6">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                  Tell us about your background <span style={{ color: 'var(--text-faint)' }}>(optional)</span>
                </label>
                <textarea
                  className="input-field"
                  style={{ minHeight: 80, resize: 'vertical' }}
                  placeholder="e.g. I am a software engineer learning accounting for the first time..."
                  value={data.background ?? ''}
                  onChange={e => setData(d => ({ ...d, background: e.target.value }))}
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="text-center">
              {!generating && !error && (
                <>
                  <div className="text-6xl mb-6">✨</div>
                  <h1 className="text-4xl font-bold mb-4">Ready to build your course</h1>
                  <div className="card p-6 mb-8 text-left">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-faint)' }}>Topic</div>
                        <div className="font-semibold">{data.topic}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-faint)' }}>Depth</div>
                        <div className="font-semibold capitalize">{data.depth}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-faint)' }}>Time/day</div>
                        <div className="font-semibold">{timeOptions.find(t => t.value === data.timeCommitment)?.label}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-faint)' }}>Styles</div>
                        <div className="font-semibold capitalize">{data.learningStyles?.join(', ')}</div>
                      </div>
                    </div>
                  </div>
                  <button className="btn-primary" style={{ fontSize: 18, padding: '14px 40px' }} onClick={handleGenerate}>
                    <span className="flex items-center gap-2">
                      <Sparkles size={18} />
                      Generate My Course
                    </span>
                  </button>
                </>
              )}

              {generating && (
                <div className="card generating p-10">
                  <div className="spinner mx-auto mb-6" style={{ width: 40, height: 40, borderWidth: 3 }} />
                  <h2 className="text-2xl font-bold mb-3">Building your curriculum...</h2>
                  <p className="mb-6" style={{ color: 'var(--text-muted)' }}>
                    Claude is crafting a personalized syllabus for you. This takes about 15-30 seconds.
                  </p>
                  {generatingText && (
                    <div className="text-left text-sm p-4 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {generatingText}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div>
                  <div className="card p-6 mb-6" style={{ border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)' }}>
                    <p style={{ color: '#f87171' }}>{error}</p>
                  </div>
                  <button className="btn-primary" onClick={handleGenerate}>Try Again</button>
                </div>
              )}
            </div>
          )}

          {step < 4 && (
            <div className="flex gap-3 mt-10">
              {step > 0 && (
                <button className="btn-secondary flex items-center gap-2" onClick={() => setStep(s => s - 1)}>
                  <ChevronLeft size={16} />
                  Back
                </button>
              )}
              <button
                className="btn-primary flex-1 flex items-center justify-center gap-2"
                disabled={!canNext()}
                onClick={() => setStep(s => s + 1)}
              >
                {step === 3 ? 'Review & Build' : 'Continue'}
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
