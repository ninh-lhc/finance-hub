import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const buttonSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'GoogleUpgradeButton.jsx'),
  'utf8',
);
const serviceSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../services/firebase/googleAuthService.js'),
  'utf8',
);

describe('GoogleUpgradeButton policy (static)', () => {
  it('does not mutate sync room or localStorage sync code', () => {
    expect(buttonSource).not.toMatch(/enableCloudSync|joinCloudSync|setSyncCode/);
    expect(buttonSource).not.toMatch(/localStorage/);
    expect(buttonSource).not.toMatch(/finance_hub_sync_code/);
  });

  it('uses link and sign-in services only', () => {
    expect(buttonSource).toMatch(/linkAnonymousUserWithGoogle/);
    expect(buttonSource).toMatch(/signInWithExistingGoogleAccount/);
    expect(buttonSource).not.toMatch(/signOut/);
  });
});

describe('googleAuthService policy (static)', () => {
  it('does not sign out or merge data on auth', () => {
    expect(serviceSource).not.toMatch(/signOut/);
    expect(serviceSource).not.toMatch(/setDoc|writeBatch|deleteDoc/);
  });
});
