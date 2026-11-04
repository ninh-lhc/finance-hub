import { describe, it, expect } from 'vitest';
import {
  canStartGoogleAuthAction,
  getGoogleLinkSuccessMessage,
  getGoogleSignInSuccessMessage,
  verifyLinkPreservesUid,
  verifySyncCodeUnchanged,
  GOOGLE_IDENTITY_ONLY_NOTE,
  EXISTING_GOOGLE_SIGN_IN_CONFIRM,
} from './googleAuthFlow.js';

describe('canStartGoogleAuthAction', () => {
  it('blocks when user is missing', () => {
    expect(
      canStartGoogleAuthAction({ user: null, disabled: false, processingAction: null, authInitialized: false }),
    ).toBe(false);

    expect(canStartGoogleAuthAction({ user: null, disabled: false, processingAction: null })).toBe(
      false,
    );
  });

  it('blocks when disabled or already processing', () => {
    const user = { uid: 'u1' };
    expect(canStartGoogleAuthAction({ user, disabled: true, processingAction: null })).toBe(false);
    expect(canStartGoogleAuthAction({ user, disabled: false, processingAction: 'link' })).toBe(
      false,
    );
  });

  it('allows when user is ready and idle', () => {
    expect(
      canStartGoogleAuthAction({ user: { uid: 'u1' }, disabled: false, processingAction: null }),
    ).toBe(true);
  });
});

describe('success messages', () => {
  it('states identity-only and sync room for link', () => {
    expect(getGoogleLinkSuccessMessage()).toMatch(/UID giữ nguyên/i);
    expect(getGoogleLinkSuccessMessage()).toContain(GOOGLE_IDENTITY_ONLY_NOTE);
  });

  it('states identity-only for sign-in', () => {
    expect(getGoogleSignInSuccessMessage()).toContain(GOOGLE_IDENTITY_ONLY_NOTE);
  });

  it('confirm copy mentions sync room not Google sync', () => {
    expect(EXISTING_GOOGLE_SIGN_IN_CONFIRM).toMatch(/mã phòng/i);
    expect(EXISTING_GOOGLE_SIGN_IN_CONFIRM).not.toMatch(/AIza/);
  });
});

describe('session invariants', () => {
  it('verifyLinkPreservesUid when UID unchanged', () => {
    expect(verifyLinkPreservesUid({ uidBefore: 'anon-1', uidAfter: 'anon-1' })).toBe(true);
    expect(verifyLinkPreservesUid({ uidBefore: 'anon-1', uidAfter: 'other' })).toBe(false);
  });

  it('verifySyncCodeUnchanged when local sync code untouched', () => {
    expect(verifySyncCodeUnchanged('ABC123', 'ABC123')).toBe(true);
    expect(verifySyncCodeUnchanged('ABC123', '')).toBe(false);
    expect(verifySyncCodeUnchanged(undefined, undefined)).toBe(true);
  });

  it('models successful link leaving syncCode unchanged (App contract)', () => {
    const syncBefore = 'ROOM01';
    const uidBefore = 'anon-1';
    const uidAfter = 'anon-1';
    const syncAfter = syncBefore;
    expect(verifyLinkPreservesUid({ uidBefore, uidAfter })).toBe(true);
    expect(verifySyncCodeUnchanged(syncBefore, syncAfter)).toBe(true);
  });
});
