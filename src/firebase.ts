import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCLcWl6Bb4oJEDoF-Y0AyeCfnf33HcPbtQ",
  authDomain: "nexusais.firebaseapp.com",
  projectId: "nexusais",
  storageBucket: "nexusais.firebasestorage.app",
  messagingSenderId: "391224641476",
  appId: "1:391224641476:web:334165c8f764f91225c691",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export default app;
