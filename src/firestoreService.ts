/**
 * Firebase Firestore service for persisting chat sessions.
 * Uses a guest-session approach (no login required) — sessions are keyed
 * by a locally generated device ID stored in localStorage.
 */
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { ChatSession, Message, UserProfile } from '../types';
import { getUserProfile } from './userService';
import { getDoc } from 'firebase/firestore';

// ── Device ID ──────────────────────────────────────────────────────────────

export function getDeviceId(): string {
  const profile = getUserProfile();
  if (!profile || !profile.username) {
    throw new Error('User profile not found. Cannot perform Firestore operations.');
  }
  return profile.username;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function sessionsCol(deviceId: string) {
  return collection(db, 'guestSessions', deviceId, 'sessions');
}

function serializeMessages(messages: Message[]) {
  return messages.map(m => {
    const serialized: any = {
      id: m.id,
      role: m.role,
      text: m.text,
      timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
    };
    if (m.isError !== undefined) serialized.isError = m.isError;
    if (m.model !== undefined) serialized.model = m.model;
    return serialized;
  });
}

function deserializeMessages(messages: any[]): Message[] {
  return (messages || []).map((m: any) => ({
    ...m,
    timestamp: new Date(m.timestamp),
  }));
}

// ── CRUD ───────────────────────────────────────────────────────────────────

/** Check if a username exists in userProfiles collection */
export async function checkUsernameExists(username: string): Promise<boolean> {
  try {
    const profileRef = doc(db, 'userProfiles', username);
    const snap = await getDoc(profileRef);
    return snap.exists();
  } catch (err) {
    console.error('Error checking username:', err);
    return false;
  }
}

/** Save user profile to Firestore */
export async function saveProfileToFirestore(profile: UserProfile): Promise<void> {
  try {
    const profileRef = doc(db, 'userProfiles', profile.username);
    await setDoc(profileRef, profile);
  } catch (err) {
    console.error('Error saving profile to Firestore:', err);
  }
}

/** Load user profile from Firestore */
export async function loadProfileFromFirestore(username: string): Promise<UserProfile | null> {
  try {
    const profileRef = doc(db, 'userProfiles', username);
    const snap = await getDoc(profileRef);
    return snap.exists() ? (snap.data() as UserProfile) : null;
  } catch (err) {
    console.error('Error loading profile from Firestore:', err);
    return null;
  }
}

/** Save or update a single session in Firestore */
export async function saveSession(session: ChatSession): Promise<void> {
  const deviceId = getDeviceId();
  const ref = doc(sessionsCol(deviceId), session.id);
  await setDoc(ref, {
    id: session.id,
    title: session.title,
    model: session.model || null,
    updatedAt: serverTimestamp(),
    messages: serializeMessages(session.messages),
  });
}

/** Load all sessions for this device, sorted newest first */
export async function loadSessionsFromFirestore(): Promise<ChatSession[]> {
  const deviceId = getDeviceId();
  const q = query(sessionsCol(deviceId), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);

  return snap.docs
    .map(d => {
      const data = d.data();
      return {
        id: data.id || d.id,
        title: data.title || 'New Chat',
        updatedAt: data.updatedAt instanceof Timestamp
          ? data.updatedAt.toMillis()
          : Date.now(),
        messages: deserializeMessages(data.messages || []),
        model: data.model,
      } as ChatSession;
    })
    .filter(s => s.messages.length > 0)
    .slice(0, 50);
}

/** Delete a single session */
export async function deleteSessionFromFirestore(id: string): Promise<void> {
  const deviceId = getDeviceId();
  const ref = doc(sessionsCol(deviceId), id);
  await deleteDoc(ref);
}
