import React, { useState } from 'react';
import { generateUsername, saveUserProfile } from '../src/userService';
import { checkUsernameExists, saveProfileToFirestore, loadProfileFromFirestore } from '../src/firestoreService';
import { UserProfile } from '../types';
import { User, LogIn, ArrowRight, UserPlus } from 'lucide-react';

interface AuthModalProps {
  onComplete: (profile: UserProfile) => void;
}

/** Race a promise against a timeout — resolves with null if it times out */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>(resolve => setTimeout(() => resolve(null), ms)),
  ]);
}

export default function AuthModal({ onComplete }: AuthModalProps) {
  const [mode, setMode] = useState<'create' | 'login'>('create');
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setError('');
    const val = inputValue.trim();

    if (!val) {
      setError('This field is required');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'create') {
        const username = generateUsername(val);
        const profile: UserProfile = {
          displayName: val,
          username,
          createdAt: Date.now(),
        };

        // Save locally FIRST — this is instant and always works
        saveUserProfile(profile);

        // Fire-and-forget Firestore save with a 4s timeout
        // If it times out or fails, user is still created locally
        withTimeout(saveProfileToFirestore(profile), 4000).catch(err => {
          console.warn('Firestore save failed or timed out:', err);
        });

        // Proceed immediately — don't wait for Firestore
        onComplete(profile);

      } else {
        // Login — we NEED Firestore to verify the username exists
        const result = await withTimeout(
          (async () => {
            const exists = await checkUsernameExists(val);
            if (!exists) return { exists: false, profile: null };
            const profile = await loadProfileFromFirestore(val);
            return { exists: true, profile };
          })(),
          6000
        );

        if (result === null) {
          setError('Connection timed out. Please check your internet and try again.');
          setIsLoading(false);
          return;
        }

        if (!result.exists) {
          setError('Username not found. Please check and try again, or create a new account.');
          setIsLoading(false);
          return;
        }

        if (result.profile) {
          saveUserProfile(result.profile);
          onComplete(result.profile);
        } else {
          setError('Failed to load your profile. Please try again.');
        }
      }
    } catch (err) {
      console.error(err);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-fade-in">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-[#10a37f]/20 text-[#10a37f] rounded-full flex items-center justify-center">
            {mode === 'create' ? <UserPlus size={32} /> : <LogIn size={32} />}
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white text-center mb-2">
          {mode === 'create' ? 'Welcome to NexusAI' : 'Welcome back'}
        </h2>
        <p className="text-gray-400 text-center mb-8 text-sm">
          {mode === 'create'
            ? 'Enter your name to get started. No sign up required.'
            : 'Enter your unique username to access your chats.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              {mode === 'create' ? 'Your Name' : 'Username'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User size={18} className="text-gray-500" />
              </div>
              <input
                type="text"
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={mode === 'create' ? 'e.g., Alex' : 'e.g., alex_x7a9'}
                className="w-full pl-10 pr-4 py-3 bg-[#2a2a2a] border border-white/10 focus:border-[#10a37f] rounded-xl text-white outline-none transition-colors"
              />
            </div>
            {error && <p className="text-red-400 text-xs mt-1.5">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-[#10a37f] hover:bg-[#0e906f] text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : (mode === 'create' ? 'Continue' : 'Login')}
            {!isLoading && <ArrowRight size={18} />}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setMode(mode === 'create' ? 'login' : 'create');
              setInputValue('');
              setError('');
            }}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            {mode === 'create'
              ? 'Already have a username? Login here'
              : "Don't have a username? Create one"}
          </button>
        </div>
      </div>
    </div>
  );
}
