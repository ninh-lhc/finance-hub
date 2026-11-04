import { describe, expect, it, vi, beforeEach } from 'vitest';

const initializeAuthMock = vi.fn();
const getAuthMock = vi.fn();
const onAuthStateChangedMock = vi.fn();

vi.mock('firebase/auth', () => ({
  browserLocalPersistence: 'local',
  browserPopupRedirectResolver: 'popup-resolver',
  initializeAuth: (...args) => initializeAuthMock(...args),
  getAuth: (...args) => getAuthMock(...args),
  onAuthStateChanged: (...args) => onAuthStateChangedMock(...args),
}));

describe('createFirebaseAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    initializeAuthMock.mockReturnValue({ kind: 'initialized' });
    getAuthMock.mockReturnValue({ kind: 'existing' });
  });

  it('uses browserLocalPersistence on first init', async () => {
    const { createFirebaseAuth, FIREBASE_AUTH_PERSISTENCE } = await import('./authService.js');
    const app = { name: '[DEFAULT]' };

    const auth = createFirebaseAuth(app);

    expect(initializeAuthMock).toHaveBeenCalledWith(app, {
      persistence: FIREBASE_AUTH_PERSISTENCE,
      popupRedirectResolver: 'popup-resolver',
    });
    expect(FIREBASE_AUTH_PERSISTENCE).toBe('local');
    expect(auth).toEqual({ kind: 'initialized' });
  });

  it('falls back to getAuth when auth is already initialized', async () => {
    const { createFirebaseAuth } = await import('./authService.js');
    const app = { name: '[DEFAULT]' };
    initializeAuthMock.mockImplementation(() => {
      const error = new Error('already');
      error.code = 'auth/already-initialized';
      throw error;
    });

    const auth = createFirebaseAuth(app);

    expect(getAuthMock).toHaveBeenCalledWith(app);
    expect(auth).toEqual({ kind: 'existing' });
  });
});

describe('waitForAuthInitialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('resolves after first onAuthStateChanged before popup flows', async () => {
    onAuthStateChangedMock.mockImplementation((_auth, next) => {
      next({ uid: 'anon-1', isAnonymous: true });
      return () => {};
    });

    const { waitForAuthInitialization } = await import('./authService.js');
    const auth = { app: { name: '[DEFAULT]' } };

    await expect(waitForAuthInitialization(auth)).resolves.toEqual({
      auth,
      user: { uid: 'anon-1', isAnonymous: true },
    });
    expect(onAuthStateChangedMock).toHaveBeenCalledWith(auth, expect.any(Function), expect.any(Function));
  });
});
