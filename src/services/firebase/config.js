import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * Firebase Web client config (public). Defaults match project tai-chinh-cua-toi;
 * VITE_FIREBASE_* in .env.local or Vercel env override when set.
 */
const DEFAULT_FIREBASE_WEB_CONFIG = {
  apiKey: 'AIzaSyAxf7IZZp3QoK4VTb3yeqztQeeJ8itzuOo',
  authDomain: 'tai-chinh-cua-toi.firebaseapp.com',
  projectId: 'tai-chinh-cua-toi',
  storageBucket: 'tai-chinh-cua-toi.firebasestorage.app',
  messagingSenderId: '201177266866',
  appId: '1:201177266866:web:d539f9300f46a0d45567ab',
};

function resolveFirebaseConfigValue(envValue, defaultValue) {
  if (typeof envValue === 'string' && envValue.trim().length > 0) {
    return envValue.trim();
  }
  if (typeof defaultValue === 'string' && defaultValue.trim().length > 0) {
    return defaultValue.trim();
  }
  return null;
}

const firebaseConfig = {
  apiKey: resolveFirebaseConfigValue(
    import.meta.env.VITE_FIREBASE_API_KEY,
    DEFAULT_FIREBASE_WEB_CONFIG.apiKey,
  ),
  authDomain: resolveFirebaseConfigValue(
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    DEFAULT_FIREBASE_WEB_CONFIG.authDomain,
  ),
  projectId: resolveFirebaseConfigValue(
    import.meta.env.VITE_FIREBASE_PROJECT_ID,
    DEFAULT_FIREBASE_WEB_CONFIG.projectId,
  ),
  storageBucket: resolveFirebaseConfigValue(
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    DEFAULT_FIREBASE_WEB_CONFIG.storageBucket,
  ),
  messagingSenderId: resolveFirebaseConfigValue(
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    DEFAULT_FIREBASE_WEB_CONFIG.messagingSenderId,
  ),
  appId: resolveFirebaseConfigValue(
    import.meta.env.VITE_FIREBASE_APP_ID,
    DEFAULT_FIREBASE_WEB_CONFIG.appId,
  ),
};

const missingFirebaseFields = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingFirebaseFields.length > 0) {
  throw new Error(
    `Missing Firebase configuration for: ${missingFirebaseFields.join(', ')}. Set VITE_FIREBASE_* or defaults in config.`,
  );
}

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const baseAppId = 'tai-chinh-cua-toi';

export { firebaseApp, auth, db, baseAppId };
