import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDePocjUVXcoX4pYQuLWDLOZP2UxHgWmsI",
  authDomain: "gen-lang-client-0279971321.firebaseapp.com",
  projectId: "gen-lang-client-0279971321",
  storageBucket: "gen-lang-client-0279971321.firebasestorage.app",
  messagingSenderId: "645379446760",
  appId: "1:645379446760:web:444b6c72efdcc587e6765d",
  measurementId: "G-XQP62GK54D",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
