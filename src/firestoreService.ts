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
  type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import { ChatSession, Message } from '../types';

// ── Device ID ──────────────────────────────────────────────────────────────

export function getDeviceId(): string {
  let deviceId = localStorage.getItem('nexus_device_id');
  if (!deviceId) {
    deviceId = 'guest_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('nexus_device_id', deviceId);
  }
  return deviceId;
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
    if (m.imageUrl !== undefined) serialized.imageUrl = m.imageUrl;
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
    .map((d) => {
      const data = d.data() as DocumentData;
      return {
        id: (data['id'] as string) || d.id,
        title: (data['title'] as string) || 'New Chat',
        updatedAt: data['updatedAt'] instanceof Timestamp
          ? (data['updatedAt'] as Timestamp).toMillis()
          : Date.now(),
        messages: deserializeMessages((data['messages'] as any[]) || []),
        model: data['model'] as string | undefined,
      } as ChatSession;
    })
    .filter((s: ChatSession) => s.messages.length > 0)
    .slice(0, 50);
}

/** Delete a single session */
export async function deleteSessionFromFirestore(id: string): Promise<void> {
  const deviceId = getDeviceId();
  const ref = doc(sessionsCol(deviceId), id);
  await deleteDoc(ref);
}
