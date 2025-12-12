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
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  systemInstruction: string;
  icon: LucideIcon;
}