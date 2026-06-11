export type LearningStyle = 'reading' | 'listening' | 'watching' | 'practicing' | 'collaborative' | 'mixed';
export type DepthLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type TimeCommitment = '20min' | '1hour' | '2hours' | 'halfday' | 'fulltime';

export interface OnboardingData {
  topic: string;
  depth: DepthLevel;
  timeCommitment: TimeCommitment;
  learningStyles: LearningStyle[];
  goals?: string;
  background?: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface LessonActivity {
  type: 'reading' | 'video' | 'audio' | 'exercise' | 'discussion' | 'practice';
  title: string;
  description: string;
  estimatedMinutes: number;
}

export interface Lesson {
  id: string;
  weekNumber: number;
  lessonNumber: number;
  title: string;
  description: string;
  objectives: string[];
  activities: LessonActivity[];
  homework?: string;
  estimatedMinutes: number;
  quiz?: QuizQuestion[];
  content?: string;
  completed?: boolean;
  score?: number;
}

export interface Week {
  weekNumber: number;
  theme: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  topic: string;
  depth: DepthLevel;
  totalWeeks: number;
  creditHours?: number;
  learningObjectives: string[];
  prerequisites: string[];
  weeks: Week[];
  createdAt: string;
  onboardingData: OnboardingData;
  progress: {
    completedLessons: string[];
    scores: Record<string, number>;
  };
}
