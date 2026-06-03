import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase config is loaded from VITE_ environment variables.
// Set these in your .env.local file (never commit real keys to git).
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            as string,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        as string,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         as string,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             as string,
};

if (!firebaseConfig.apiKey) {
  console.warn('[NexusAI] Firebase env vars are missing. Check your .env.local file.');
}

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export default app;

