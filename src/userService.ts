import { UserProfile } from '../types';

const USER_KEY = 'nexus_user_profile';

export function getUserProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveUserProfile(profile: UserProfile): void {
  localStorage.setItem(USER_KEY, JSON.stringify(profile));
}

export function generateUsername(displayName: string): string {
  // Remove non-alphanumeric characters, convert to lowercase
  let cleanName = displayName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (!cleanName) cleanName = 'user';
  // Generate a random 4-character string
  const randomStr = Math.random().toString(36).substring(2, 6);
  return `${cleanName}_${randomStr}`;
}

export function logoutUser(): void {
  localStorage.removeItem(USER_KEY);
  window.location.reload();
}
