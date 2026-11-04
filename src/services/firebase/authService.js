import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  initializeAuth,
  onAuthStateChanged,
} from 'firebase/auth';

export const FIREBASE_AUTH_PERSISTENCE = browserLocalPersistence;
export const FIREBASE_AUTH_POPUP_RESOLVER = browserPopupRedirectResolver;

/** @type {WeakMap<import('firebase/auth').Auth, Promise<{ auth: import('firebase/auth').Auth; user: import('firebase/auth').User | null }>>} */
const authInitializationPromises = new WeakMap();

/**
 * Resolves after Firebase restores persistence (first `onAuthStateChanged`).
 * Call before `linkWithPopup` / `signInWithPopup` to avoid auth/argument-error during HMR.
 *
 * @param {import('firebase/auth').Auth} auth
 */
export function waitForAuthInitialization(auth) {
  if (!auth) {
    return Promise.reject(
      Object.assign(new Error('Auth instance is required.'), { code: 'auth/no-auth-instance' }),
    );
  }

  const existing = authInitializationPromises.get(auth);
  if (existing) {
    return existing;
  }

  const promise = new Promise((resolve, reject) => {
    let unsubscribe = () => {};
    unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        resolve({ auth, user });
      },
      (error) => {
        unsubscribe();
        reject(error);
      },
    );
  });

  authInitializationPromises.set(auth, promise);
  return promise;
}

/**
 * @param {import('firebase/app').FirebaseApp} firebaseApp
 */
export function createFirebaseAuth(firebaseApp) {
  try {
    return initializeAuth(firebaseApp, {
      persistence: FIREBASE_AUTH_PERSISTENCE,
      popupRedirectResolver: FIREBASE_AUTH_POPUP_RESOLVER,
    });
  } catch (error) {
    if (error?.code === 'auth/already-initialized') {
      return getAuth(firebaseApp);
    }
    throw error;
  }
}
