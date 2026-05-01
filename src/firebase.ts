import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCLcWl6Bb4oJEDoF-Y0AyeCfnf33HcPbtQ",
  authDomain: "nexusais.firebaseapp.com",
  projectId: "nexusais",
  storageBucket: "nexusais.firebasestorage.app",
  messagingSenderId: "391224641476",
  appId: "1:391224641476:web:334165c8f764f91225c691",
  measurementId: "G-508TWF9M3S"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
