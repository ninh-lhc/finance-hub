import { describe, it, expect, vi, beforeEach } from 'vitest';

const { linkWithPopup, signInWithPopup } = vi.hoisted(() => ({
  linkWithPopup: vi.fn(),
  signInWithPopup: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class MockGoogleAuthProvider {
    setCustomParameters = vi.fn();
  },
  linkWithPopup,
  signInWithPopup,
}));

import {
  linkAnonymousUserWithGoogle,
  signInWithExistingGoogleAccount,
} from './googleAuthService.js';

describe('linkAnonymousUserWithGoogle', () => {
  const auth = { currentUser: { uid: 'anon-1', isAnonymous: true } };
  const currentUser = { uid: 'anon-1', isAnonymous: true };

  beforeEach(() => {
    vi.clearAllMocks();
    auth.currentUser = { uid: 'anon-1', isAnonymous: true };
  });

  it('calls linkWithPopup with the anonymous current user', async () => {
    linkWithPopup.mockResolvedValue({ user: { uid: 'anon-1' } });
    const result = await linkAnonymousUserWithGoogle({ auth, currentUser });
    expect(linkWithPopup).toHaveBeenCalledTimes(1);
    expect(linkWithPopup.mock.calls[0][0]).toBe(currentUser);
    expect(signInWithPopup).not.toHaveBeenCalled();
    expect(result.user.uid).toBe('anon-1');
  });

  it('accepts when UID before and after link match', async () => {
    linkWithPopup.mockResolvedValue({ user: { uid: 'anon-1' } });
    await expect(linkAnonymousUserWithGoogle({ auth, currentUser })).resolves.toBeDefined();
  });

  it('throws when UID changes after link', async () => {
    linkWithPopup.mockResolvedValue({ user: { uid: 'other-uid' } });
    await expect(linkAnonymousUserWithGoogle({ auth, currentUser })).rejects.toMatchObject({
      code: 'auth/uid-changed-after-link',
    });
  });

  it('throws when current user is missing', async () => {
    await expect(linkAnonymousUserWithGoogle({ auth, currentUser: null })).rejects.toMatchObject({
      code: 'auth/no-current-user',
    });
    expect(linkWithPopup).not.toHaveBeenCalled();
  });

  it('throws when current user is not anonymous', async () => {
    const signedInUser = { uid: 'user-1', isAnonymous: false };
    auth.currentUser = signedInUser;
    await expect(
      linkAnonymousUserWithGoogle({ auth, currentUser: signedInUser }),
    ).rejects.toMatchObject({ code: 'auth/not-anonymous' });
    expect(linkWithPopup).not.toHaveBeenCalled();
  });

  it('propagates Firebase link errors', async () => {
    const firebaseError = new Error('Credential already in use');
    firebaseError.code = 'auth/credential-already-in-use';
    linkWithPopup.mockRejectedValue(firebaseError);
    await expect(linkAnonymousUserWithGoogle({ auth, currentUser })).rejects.toBe(firebaseError);
    expect(signInWithPopup).not.toHaveBeenCalled();
  });
});

describe('signInWithExistingGoogleAccount', () => {
  const auth = {};

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls signInWithPopup with auth', async () => {
    const result = { user: { uid: 'google-linked-uid' } };
    signInWithPopup.mockResolvedValue(result);
    await expect(signInWithExistingGoogleAccount({ auth })).resolves.toBe(result);
    expect(signInWithPopup).toHaveBeenCalledTimes(1);
    expect(signInWithPopup.mock.calls[0][0]).toBe(auth);
    expect(linkWithPopup).not.toHaveBeenCalled();
  });

  it('propagates Firebase sign-in errors', async () => {
    const firebaseError = new Error('Popup closed');
    firebaseError.code = 'auth/popup-closed-by-user';
    signInWithPopup.mockRejectedValue(firebaseError);
    await expect(signInWithExistingGoogleAccount({ auth })).rejects.toBe(firebaseError);
  });

  it('throws when auth is missing', async () => {
    await expect(signInWithExistingGoogleAccount({ auth: null })).rejects.toMatchObject({
      code: 'auth/no-auth-instance',
    });
    expect(signInWithPopup).not.toHaveBeenCalled();
  });
});
