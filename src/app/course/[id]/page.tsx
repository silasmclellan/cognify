'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, ChevronUp, CheckCircle, Circle, BookOpen, Award, Clock } from 'lucide-react';
import { getCourseRemote, updateCourseRemote, getCourseLocal, saveCourseLocal } from '@/lib/courseStorage';
import { useSession } from 'next-auth/react';
import { Course, Lesson, QuizQuestion } from '@/types';
import ActivityPlayer from '@/components/ActivityPlayer';


function renderMarkdown(text: string) {
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

export default function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session, status } = useSession();
  const [course, setCourse] = useState<Course | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]));
  const [lessonContent, setLessonContent] = useState('');
  const [loadingContent, setLoadingContent] = useState(false);
  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);

  const isAuthed = status === 'authenticated';

  const persistCourse = async (updated: Course) => {
    if (isAuthed) {
      await updateCourseRemote(updated);
    } else {
      saveCourseLocal(updated);
    }
    setCourse(updated);
  };

  useEffect(() => {
    if (status === 'loading') return;
    async function load() {
      // Try remote first (if authed), fall back to local cache
      let c: Course | null = null;
      if (isAuthed) {
        c = await getCourseRemote(id);
      }
      if (!c) {
        c = getCourseLocal(id);
        // If found locally and authed, sync it up to the DB
        if (c && isAuthed) {
          await updateCourseRemote(c);
        }
      }
      if (!c) { router.push('/dashboard'); return; }
      setCourse(c);
      const firstLesson = c.weeks[0]?.lessons[0];
      if (firstLesson) {
        setSelectedLesson(firstLesson);
        loadLessonContent(firstLesson, c);
      }
    }
    load();
  }, [id, status]);

  const loadLessonContent = async (lesson: Lesson, courseRef?: Course) => {
    const c = courseRef ?? course;
    if (!c) return;
    if (lesson.content) { setLessonContent(lesson.content); return; }

    setLoadingContent(true);
    setLessonContent('');
    setQuiz(null); setShowQuiz(false); setQuizSubmitted(false); setQuizAnswers({});

    try {
      const res = await fetch('/api/generate-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson, topic: c.topic, depth: c.depth, learningStyles: c.onboardingData.learningStyles }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let full = '';
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value);
        setLessonContent(full);
      }

      const updated = { ...c };
      for (const week of updated.weeks) {
        for (const l of week.lessons) {
          if (l.id === lesson.id) l.content = full;
        }
      }
      await persistCourse(updated);
    } finally {
      setLoadingContent(false);
    }
  };

  const loadQuiz = async () => {
    if (!course || !selectedLesson) return;
    setLoadingQuiz(true);
    try {
      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson: selectedLesson, topic: course.topic, depth: course.depth }),
      });
      const data = await res.json();
      setQuiz(data.questions);
      setShowQuiz(true);
    } finally {
      setLoadingQuiz(false);
    }
  };

  const markComplete = async () => {
    if (!course || !selectedLesson) return;
    const score = quizSubmitted ? calcScore() : undefined;
    const updated = { ...course };
    if (!updated.progress.completedLessons.includes(selectedLesson.id)) {
      updated.progress.completedLessons.push(selectedLesson.id);
    }
    if (score !== undefined) updated.progress.scores[selectedLesson.id] = score;
    await persistCourse(updated);

    let found = false;
    for (const week of updated.weeks) {
      for (const lesson of week.lessons) {
        if (found) { selectLesson(lesson); return; }
        if (lesson.id === selectedLesson.id) found = true;
      }
    }
  };

  const selectLesson = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setLessonContent('');
    setQuiz(null); setShowQuiz(false); setQuizSubmitted(false); setQuizAnswers({});
    loadLessonContent(lesson);
  };

  const calcScore = () => {
    if (!quiz) return 0;
    return Math.round(quiz.filter(q => quizAnswers[q.id] === q.correctIndex).length / quiz.length * 100);
  };

  const toggleWeek = (n: number) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  };

  if (!course) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="spinner" />
    </div>
  );

  const totalLessons = course.weeks.reduce((a, w) => a + w.lessons.length, 0);
  const progress = totalLessons > 0 ? Math.round(course.progress.completedLessons.length / totalLessons * 100) : 0;
  const isCompleted = selectedLesson ? course.progress.completedLessons.includes(selectedLesson.id) : false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Top bar */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <Link href="/dashboard" style={{ fontSize: 13, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, textDecoration: 'none' }}>
          ← Pansophia
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{course.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <div className="progress-bar" style={{ width: 120 }}>
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{progress}%</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><BookOpen size={13} /> {course.progress.completedLessons.length}/{totalLessons}</span>
          <span style={{ textTransform: 'capitalize' }}>{course.depth}</span>
        </div>
      </nav>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: 'calc(100vh - 65px)' }}>
        {/* Sidebar */}
        <div style={{ width: 280, flexShrink: 0, overflowY: 'auto', borderRight: '1px solid var(--border)', paddingTop: 16, paddingBottom: 24 }}>
          {course.weeks.map(week => (
            <div key={week.weekNumber}>
              <button
                onClick={() => toggleWeek(week.weekNumber)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'inherit', fontWeight: 600, textAlign: 'left' }}
              >
                <span>Week {week.weekNumber}: {week.theme}</span>
                {expandedWeeks.has(week.weekNumber) ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              {expandedWeeks.has(week.weekNumber) && (
                <div style={{ paddingBottom: 8 }}>
                  {week.lessons.map(lesson => {
                    const done = course.progress.completedLessons.includes(lesson.id);
                    const active = selectedLesson?.id === lesson.id;
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => selectLesson(lesson)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px',
                          background: active ? 'var(--accent-bg)' : 'none',
                          borderTop: 'none', borderRight: 'none', borderBottom: 'none',
                          borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                        }}
                      >
                        <span style={{ marginTop: 2, flexShrink: 0 }}>
                          {done
                            ? <CheckCircle size={14} color="var(--accent)" />
                            : <Circle size={14} color="var(--text-faint)" />}
                        </span>
                        <span style={{ fontSize: 13, color: active ? 'var(--accent)' : 'var(--text-muted)', lineHeight: 1.4 }}>
                          {lesson.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!selectedLesson ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <p style={{ color: 'var(--text-faint)' }}>Select a lesson from the sidebar</p>
            </div>
          ) : (
            <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 40px 80px' }}>
              {/* Lesson header */}
              <div style={{ marginBottom: 36 }}>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-faint)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                  <span>Week {selectedLesson.weekNumber}</span>
                  <span>·</span>
                  <span>Lesson {selectedLesson.lessonNumber}</span>
                  <span>·</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> ~{selectedLesson.estimatedMinutes} min</span>
                </div>
                <h2 style={{ fontSize: 34, marginBottom: 12 }}>{selectedLesson.title}</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 17, lineHeight: 1.65 }}>{selectedLesson.description}</p>
              </div>

              {/* Objectives */}
              {selectedLesson.objectives.length > 0 && (
                <div className="card" style={{ padding: '20px 24px', marginBottom: 32 }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 12 }}>Learning Objectives</div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {selectedLesson.objectives.map((obj, i) => (
                      <li key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        <span style={{ color: 'var(--accent)', flexShrink: 0 }}>→</span> {obj}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Activities */}
              <div style={{ marginBottom: 36 }}>
                <div style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 16 }}>
                  Activities — click to open
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selectedLesson.activities.map((act, i) => (
                    <ActivityPlayer
                      key={`${selectedLesson.id}-${i}`}
                      activity={act}
                      lessonTitle={selectedLesson.title}
                      topic={course.topic}
                      depth={course.depth}
                      objectives={selectedLesson.objectives}
                      index={i}
                    />
                  ))}
                </div>
              </div>

              {/* Lesson content */}
              <div style={{ marginBottom: 36 }}>
                <div style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 16 }}>Lesson Content</div>
                {loadingContent ? (
                  <div className="card generating" style={{ padding: 40, textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 16px' }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>Generating lesson content…</p>
                  </div>
                ) : lessonContent ? (
                  <div className="card prose-dark" style={{ padding: '28px 32px' }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(lessonContent) }}
                  />
                ) : (
                  <button className="btn-secondary" style={{ width: '100%' }} onClick={() => loadLessonContent(selectedLesson)}>
                    Load Lesson Content
                  </button>
                )}
              </div>

              {/* Homework */}
              {selectedLesson.homework && (
                <div className="card" style={{ padding: '20px 24px', marginBottom: 36, borderColor: 'var(--border-strong)' }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 10 }}>✏️ Homework</div>
                  <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.6, margin: 0 }}>{selectedLesson.homework}</p>
                </div>
              )}

              {/* Quiz */}
              <div style={{ marginBottom: 36 }}>
                {!showQuiz ? (
                  <button className="btn-secondary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    onClick={loadQuiz} disabled={loadingQuiz}>
                    {loadingQuiz ? <><div className="spinner" />Generating Quiz…</> : <><Award size={15} />Take Quiz</>}
                  </button>
                ) : quiz && (
                  <div>
                    <div style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 20 }}>Quiz</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                      {quiz.map((q, qi) => (
                        <div key={q.id} className="card" style={{ padding: '20px 24px' }}>
                          <p style={{ fontWeight: 600, marginBottom: 16, fontSize: 16 }}>{qi + 1}. {q.question}</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {q.options.map((opt, oi) => {
                              const selected = quizAnswers[q.id] === oi;
                              const correct = quizSubmitted && oi === q.correctIndex;
                              const wrong = quizSubmitted && selected && oi !== q.correctIndex;
                              return (
                                <button key={oi} disabled={quizSubmitted}
                                  onClick={() => !quizSubmitted && setQuizAnswers(a => ({ ...a, [q.id]: oi }))}
                                  style={{
                                    textAlign: 'left', padding: '12px 16px', borderRadius: 3, fontSize: 15, fontFamily: 'inherit', cursor: quizSubmitted ? 'default' : 'pointer',
                                    background: correct ? 'rgba(58,107,58,0.12)' : wrong ? 'rgba(139,44,44,0.1)' : selected ? 'var(--accent-bg)' : 'var(--bg-card)',
                                    border: `1px solid ${correct ? 'rgba(58,107,58,0.5)' : wrong ? 'rgba(139,44,44,0.4)' : selected ? 'var(--accent)' : 'var(--border)'}`,
                                    color: correct ? 'var(--success)' : wrong ? 'var(--danger)' : 'var(--text)',
                                    transition: 'all 0.15s',
                                  }}
                                >{opt}</button>
                              );
                            })}
                          </div>
                          {quizSubmitted && (
                            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 3, background: 'var(--bg-card)', fontSize: 14, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              💡 {q.explanation}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {!quizSubmitted ? (
                      <button className="btn-primary" style={{ width: '100%', marginTop: 20 }}
                        disabled={Object.keys(quizAnswers).length < quiz.length}
                        onClick={() => setQuizSubmitted(true)}>
                        Submit Quiz
                      </button>
                    ) : (
                      <div className="card" style={{ padding: '32px 24px', marginTop: 20, textAlign: 'center' }}>
                        <div style={{ fontSize: 40, marginBottom: 8 }}>{calcScore() >= 80 ? '🎉' : calcScore() >= 60 ? '👍' : '📚'}</div>
                        <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>{calcScore()}%</div>
                        <div style={{ color: 'var(--text-muted)' }}>
                          {calcScore() >= 80 ? 'Excellent work!' : calcScore() >= 60 ? 'Good effort — review and keep going.' : 'Revisit the material and try again.'}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Complete */}
              {isCompleted ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px', borderRadius: 3, background: 'var(--accent-bg)', border: '1px solid var(--border-strong)', color: 'var(--accent)', fontSize: 15 }}>
                  <CheckCircle size={17} />
                  Lesson Complete
                  {course.progress.scores[selectedLesson.id] !== undefined && (
                    <span style={{ color: 'var(--text-muted)' }}>&nbsp;· Quiz score: {course.progress.scores[selectedLesson.id]}%</span>
                  )}
                </div>
              ) : (
                <button className="btn-primary" style={{ width: '100%', fontSize: 17, padding: '13px' }} onClick={markComplete}>
                  Mark Complete &amp; Continue →
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
