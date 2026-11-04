import { useEffect, useState } from 'react';
import { signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase/config.js';

async function ensureGuestSession() {
  const initialAuthToken = globalThis.__initial_auth_token;
  if (initialAuthToken) {
    try {
      await signInWithCustomToken(auth, initialAuthToken);
      return;
    } catch (tokenError) {
      console.warn('Custom token invalid or expired, falling back to anonymous auth', tokenError);
    }
  }
  await signInAnonymously(auth);
}

export default function useAuthUser() {
  const [user, setUser] = useState(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    let guestSignInStarted = false;
    let receivedInitialAuthState = false;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (!receivedInitialAuthState) {
        receivedInitialAuthState = true;
        setAuthInitialized(true);
      }

      if (firebaseUser || guestSignInStarted) {
        return;
      }

      guestSignInStarted = true;
      try {
        await ensureGuestSession();
      } catch (error) {
        console.error('Firebase Auth Error:', error);
        guestSignInStarted = false;
      }
    });

    return () => {
      unsubscribe();
      setAuthInitialized(false);
    };
  }, []);

  return { user, authInitialized };
}
