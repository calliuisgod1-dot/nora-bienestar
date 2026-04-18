export type MoodType = 'despejado' | 'nublado' | 'lluvia' | 'tormenta';

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'nora';
  timestamp: Date;
  imageUrl?: string;
  audioUrl?: string;
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  category: 'gym' | 'self-care' | 'legal' | 'home' | 'other';
}

export interface UserProfile {
  name: string;
  email: string;
  photoURL?: string;
  onboardingCompleted: boolean;
  preferences: {
    theme: 'pastel';
  };
}
