/**
 * Auth-aware course storage.
 * When signed in → persists to SQLite via API.
 * When guest → falls back to localStorage.
 */

import { Course } from '@/types';

async function isSignedIn(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/session');
    const data = await res.json();
    return !!data?.user;
  } catch {
    return false;
  }
}

export async function saveCourseRemote(course: Course): Promise<void> {
  await fetch('/api/courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(course),
  });
}

export async function updateCourseRemote(course: Course): Promise<void> {
  await fetch(`/api/courses/${course.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(course),
  });
}

export async function deleteCourseRemote(id: string): Promise<void> {
  await fetch(`/api/courses/${id}`, { method: 'DELETE' });
}

export async function getCoursesRemote(): Promise<Course[]> {
  const res = await fetch('/api/courses');
  if (!res.ok) return [];
  return res.json();
}

export async function getCourseRemote(id: string): Promise<Course | null> {
  const res = await fetch(`/api/courses/${id}`);
  if (!res.ok) return null;
  return res.json();
}

// localStorage helpers (guest mode)
const LS_KEY = 'pansophia_courses';

export function getCoursesLocal(): Course[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]'); } catch { return []; }
}

export function saveCourseLocal(course: Course): void {
  const courses = getCoursesLocal();
  const idx = courses.findIndex(c => c.id === course.id);
  if (idx >= 0) courses[idx] = course; else courses.push(course);
  localStorage.setItem(LS_KEY, JSON.stringify(courses));
}

export function deleteCourseLocal(id: string): void {
  localStorage.setItem(LS_KEY, JSON.stringify(getCoursesLocal().filter(c => c.id !== id)));
}

export function getCourseLocal(id: string): Course | null {
  return getCoursesLocal().find(c => c.id === id) ?? null;
}

export function clearLocalCourses(): void {
  localStorage.removeItem(LS_KEY);
}
