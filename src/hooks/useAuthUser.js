import { useEffect, useState } from 'react';
import { signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase/config.js';

export default function useAuthUser() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const initialAuthToken = globalThis.__initial_auth_token;
        if (initialAuthToken) {
          try {
            await signInWithCustomToken(auth, initialAuthToken);
          } catch (tokenError) {
            console.warn("Custom token invalid or expired, falling back to anonymous auth", tokenError);
            await signInAnonymously(auth);
          }
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Firebase Auth Error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  return user;
}
