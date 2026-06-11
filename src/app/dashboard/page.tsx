'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Trash2, BookOpen } from 'lucide-react';
import { Course } from '@/types';
import { getCoursesRemote, deleteCourseRemote, getCoursesLocal, deleteCourseLocal, saveCourseRemote, clearLocalCourses } from '@/lib/courseStorage';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [importing, setImporting] = useState(false);
  const [localCount, setLocalCount] = useState(0);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin?callbackUrl=/dashboard');
      return;
    }
    if (status === 'authenticated') {
      // Auto-sync any locally-cached courses into the DB silently
      const local = getCoursesLocal();
      if (local.length > 0) {
        Promise.all(local.map(c => saveCourseRemote(c)))
          .then(() => { clearLocalCourses(); setLocalCount(0); })
          .finally(() => loadCourses());
      } else {
        loadCourses();
      }
    }
  }, [status]);

  const loadCourses = async () => {
    const data = await getCoursesRemote();
    setCourses(data);
  };

  const importLocalCourses = async () => {
    setImporting(true);
    const local = getCoursesLocal();
    for (const course of local) {
      await saveCourseRemote(course);
    }
    clearLocalCourses();
    setLocalCount(0);
    await loadCourses();
    setImporting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this course?')) return;
    await deleteCourseRemote(id);
    setCourses(c => c.filter(x => x.id !== id));
  };

  const getProgress = (course: Course) => {
    const total = course.weeks.reduce((acc, w) => acc + w.lessons.length, 0);
    return total > 0 ? Math.round((course.progress.completedLessons.length / total) * 100) : 0;
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between px-10 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <Link href="/" style={{ fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, textDecoration: 'none' }}>
          Pansophia
        </Link>
        <div className="flex items-center gap-4">
          <span style={{ fontSize: 15, color: 'var(--text-muted)' }}>{session?.user?.name}</span>
          <Link href="/onboarding">
            <button className="btn-primary" style={{ padding: '8px 18px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={15} />
              New Course
            </button>
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '60px 40px' }}>
        <h1 style={{ fontSize: 42, marginBottom: 8 }}>My Courses</h1>
        <p style={{ color: 'var(--text-faint)', marginBottom: localCount > 0 ? 24 : 48, fontSize: 16 }}>
          {courses.length} course{courses.length !== 1 ? 's' : ''} saved to your account
        </p>

        {localCount > 0 && (
          <div className="card" style={{ padding: '20px 24px', marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderColor: 'var(--border-strong)' }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {localCount} course{localCount !== 1 ? 's' : ''} found on this device
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Import them to save permanently to your account.</div>
            </div>
            <button className="btn-primary" style={{ padding: '8px 18px', fontSize: 15 }} onClick={importLocalCourses} disabled={importing}>
              {importing ? 'Importing…' : 'Import'}
            </button>
          </div>
        )}

        {courses.length === 0 ? (
          <div className="card" style={{ padding: 64, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
            <h2 style={{ fontSize: 26, marginBottom: 12 }}>No courses yet</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: 17 }}>Create your first AI-generated course to get started.</p>
            <Link href="/onboarding">
              <button className="btn-primary">Build My First Course</button>
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
            {courses.map(course => {
              const progress = getProgress(course);
              const totalLessons = course.weeks.reduce((acc, w) => acc + w.lessons.length, 0);
              return (
                <div key={course.id} className="card" style={{ padding: 24, position: 'relative' }}>
                  <button
                    onClick={() => handleDelete(course.id)}
                    style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', opacity: 0, transition: 'opacity 0.15s', padding: 4 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                  >
                    <Trash2 size={14} />
                  </button>

                  <div style={{ marginBottom: 12 }}>
                    <h3 style={{ fontSize: 20, marginBottom: 4, lineHeight: 1.3, paddingRight: 24 }}>{course.title}</h3>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-faint)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      <span className="capitalize">{course.depth}</span>
                      <span>·</span>
                      <span>{course.totalWeeks} weeks</span>
                      {course.creditHours && <><span>·</span><span>{course.creditHours} credit hrs</span></>}
                    </div>
                  </div>

                  <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.55, marginBottom: 16 }}>
                    {course.description.slice(0, 110)}{course.description.length > 110 ? '…' : ''}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13, color: 'var(--text-faint)' }}>
                    <BookOpen size={12} />
                    <span>{course.progress.completedLessons.length}/{totalLessons} lessons complete</span>
                  </div>

                  <div className="progress-bar" style={{ marginBottom: 20 }}>
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                      {new Date(course.createdAt).toLocaleDateString()}
                    </span>
                    <Link href={`/course/${course.id}`}>
                      <button className="btn-primary" style={{ padding: '7px 16px', fontSize: 14 }}>
                        {progress === 0 ? 'Start' : progress === 100 ? 'Review' : 'Continue'} &rarr;
                      </button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
