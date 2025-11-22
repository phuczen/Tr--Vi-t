
// types.ts

export enum Language {
  EN = 'English',
  VI = 'Tiếng Việt',
  ZH = '中国人',
  FR = 'Français',
}

export enum UserRole {
  STUDENT = 'student',
  TEACHER = 'teacher',
}

export enum AdminRole {
    SUPER_ADMIN = 'super_admin',
    ADMIN = 'admin',
}

export interface AdminLog {
    id: string;
    adminUsername: string;
    action: 'lock_user' | 'unlock_user' | 'delete_user' | 'restore_user' | 'create_admin' | 'delete_admin' | 'update_admin' | 'login';
    target: string; // Username of user or admin targeted
    timestamp: number;
    details?: string;
}

export interface AdminUser {
    username: string;
    password: string;
    role: AdminRole;
    lastLogin: number;
    logs: AdminLog[];
    currentActivity?: string;
}

export enum StudentGoal {
    GOOD = 'good_student',
    EXCELLENT = 'excellent_student',
    OUTSTANDING = 'outstanding_student',
}

export interface Flashcard {
  question: string;
  answer: string;
}

export interface MindMapNode {
  title: string;
  children?: MindMapNode[];
}

export enum Subject {
    MATH = 'math',
    LITERATURE = 'literature',
    PHYSICS = 'physics',
    CHEMISTRY = 'chemistry',
    BIOLOGY = 'biology',
    HISTORY = 'history',
    GEOGRAPHY = 'geography',
    ENGLISH = 'english',
    TECHNOLOGY = 'technology',
    CIVIC_EDUCATION = 'civic_education',
    INFORMATICS = 'informatics',
    NATURAL_SCIENCES = 'natural_sciences',
}

export interface Lesson {
    topic: string;
    completed: boolean;
}

export interface ChatFile {
  base64Data: string;
  mimeType: string;
  name: string;
}

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    file?: ChatFile;
}

export enum Dialect {
    NORTH = 'north',
    CENTRAL = 'central',
    SOUTH = 'south',
}

export enum DifficultyLevel {
    RECOGNITION = 'recognition',
    COMPREHENSION = 'comprehension',
    APPLICATION = 'application',
}

export enum LibraryItemType {
    SUMMARY = 'summary',
    EXAM = 'exam',
    REVIEW_EXERCISES = 'review_exercises',
    SIMILAR_EXERCISES = 'similar_exercises',
}

export interface LibraryItem {
    id: string;
    name: string;
    type: LibraryItemType;
    content: any; // string for markdown, object for summary
    timestamp: number;
}

export type ViolationSeverity = 'mild' | 'severe';

export interface User {
    username: string;
    password: string; // In a real app, this should be hashed
    isLocked: boolean;
    lockUntil: number | null;
    lockReason: string | null;
    lockedBy?: string; // Username of the admin who locked the user
    isDeleted?: boolean; // Soft delete flag
    deletedBy?: string; // Who deleted the user
    createdAt: number;
    lastLogin: number;
    currentFeature?: string; // What tab they are on
    lastActivity?: string;   // Specific action (e.g., "Generating Math Exam")
}