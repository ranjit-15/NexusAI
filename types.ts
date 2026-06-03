import { LucideIcon } from 'lucide-react';

export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: Date;
  isError?: boolean;
  model?: string;
  imageUrl?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: number;
  messages: Message[];
  model?: string;
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  systemInstruction: string;
  icon: LucideIcon;
}

export interface ModelOption {
  id: string;
  name: string;
  description?: string;
  capabilities?: string[];
}

// NOTE: UserProfile is not yet implemented (app uses guest sessions).
// Uncomment and extend this when user authentication is added.
// export interface UserProfile {
//   displayName: string;
//   username: string;
//   createdAt: number;
//   theme?: string;
//   apiKey?: string;
// }