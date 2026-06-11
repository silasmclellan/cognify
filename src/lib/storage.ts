import { Course, OnboardingData } from '@/types';

const COURSES_KEY = 'cognify_courses';

export function saveCourse(course: Course): void {
  const courses = getCourses();
  const existing = courses.findIndex(c => c.id === course.id);
  if (existing >= 0) {
    courses[existing] = course;
  } else {
    courses.push(course);
  }
  localStorage.setItem(COURSES_KEY, JSON.stringify(courses));
}

export function getCourses(): Course[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(COURSES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function getCourse(id: string): Course | null {
  return getCourses().find(c => c.id === id) ?? null;
}

export function deleteCourse(id: string): void {
  const courses = getCourses().filter(c => c.id !== id);
  localStorage.setItem(COURSES_KEY, JSON.stringify(courses));
}

export function generateCourseId(): string {
  return `course_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
