export type LearningStyle = 'reading' | 'listening' | 'watching' | 'practicing' | 'collaborative' | 'mixed';
export type DepthLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type TimeCommitment = '20min' | '1hour' | '2hours' | 'halfday' | 'fulltime';

export type PlanId = 'free' | 'per_course' | 'starter' | 'unlimited' | 'business';
export type OrgRole = 'manager' | 'employee';
export type MemberStatus = 'pending' | 'active';

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
  isRemediation?: boolean;  // true for auto-generated catch-up lessons
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
    scores: Record<string, number>;  // lessonId → quiz score (0–100)
  };
  // assignment metadata (set when a business manager assigns the course)
  assignmentId?: string;
  assignedBy?: string;
  dueDate?: string;
}

// ── Subscription / billing ────────────────────────────────────────────────────

export interface Subscription {
  id: string;
  userId: string;
  planId: PlanId;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  coursesCreatedThisMonth: number;
  periodStart: string | null;
  periodEnd: string | null;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  createdAt: string;
}

export const PLANS: Record<PlanId, {
  name: string;
  price: number;   // in cents; 0 = free
  interval: 'month' | 'one_time' | 'free';
  courseLimit: number | null;  // null = unlimited
  employeeLimit: number | null;
  stripePriceId: string;
}> = {
  free: {
    name: 'Free',
    price: 0,
    interval: 'free',
    courseLimit: 1,
    employeeLimit: null,
    stripePriceId: '',
  },
  per_course: {
    name: 'Pay per course',
    price: 500,
    interval: 'one_time',
    courseLimit: null,
    employeeLimit: null,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PER_COURSE ?? '',
  },
  starter: {
    name: 'Starter',
    price: 1500,
    interval: 'month',
    courseLimit: 5,
    employeeLimit: null,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER ?? '',
  },
  unlimited: {
    name: 'Unlimited',
    price: 2500,
    interval: 'month',
    courseLimit: null,
    employeeLimit: null,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_UNLIMITED ?? '',
  },
  business: {
    name: 'Business',
    price: 5000,
    interval: 'month',
    courseLimit: null,
    employeeLimit: 20,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS ?? '',
  },
};

// ── Business / organizations ──────────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  ownerUserId: string;
  stripeSubscriptionId: string | null;
  employeeLimit: number;
  createdAt: string;
}

export interface OrgMember {
  id: string;
  orgId: string;
  userId: string | null;
  inviteEmail: string;
  role: OrgRole;
  status: MemberStatus;
  joinedAt: string | null;
  createdAt: string;
  // joined fields
  userName?: string;
  userEmail?: string;
}

export interface CourseAssignment {
  id: string;
  orgId: string;
  courseId: string;
  assignedToUserId: string;
  assignedByUserId: string;
  dueDate: string | null;
  createdAt: string;
  // joined fields
  courseTitle?: string;
  assigneeName?: string;
  assigneeEmail?: string;
  progress?: number;
}
