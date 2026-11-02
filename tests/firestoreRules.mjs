import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-finance-hub-rules-test';
const APP_ID = 'tai-chinh-cua-toi';
const SYNC_CODE = 'ABC123';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rulesPath = path.join(__dirname, '..', 'firestore.rules');

let passed = 0;
let failed = 0;

async function runCase(name, callback) {
  try {
    await callback();
    passed += 1;
    console.log(`PASS: ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL: ${name}`);
    console.error(error?.message || error);
  }
}

async function main() {
  const rules = await readFile(rulesPath, 'utf8');
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules },
  });

  try {
    await runCase('unauthenticated cannot read own-looking settings', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      const ref = doc(db, 'artifacts', APP_ID, 'users', 'user-a', 'settings', 'general');
      await assertFails(getDoc(ref));
    });

    await runCase('unauthenticated cannot write own-looking settings', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      const ref = doc(db, 'artifacts', APP_ID, 'users', 'user-a', 'settings', 'general');
      await assertFails(setDoc(ref, { wallets: [] }));
    });

    await runCase('user A can write settings/general', async () => {
      const db = testEnv.authenticatedContext('user-a').firestore();
      const ref = doc(db, 'artifacts', APP_ID, 'users', 'user-a', 'settings', 'general');
      await assertSucceeds(setDoc(ref, { wallets: ['Tiền mặt'] }, { merge: true }));
    });

    await runCase('user A can read settings/general', async () => {
      const db = testEnv.authenticatedContext('user-a').firestore();
      const ref = doc(db, 'artifacts', APP_ID, 'users', 'user-a', 'settings', 'general');
      await assertSucceeds(getDoc(ref));
    });

    await runCase('user A can write monthly transaction', async () => {
      const db = testEnv.authenticatedContext('user-a').firestore();
      const ref = doc(
        db,
        'artifacts',
        APP_ID,
        'users',
        'user-a',
        'transactions_2026_01',
        'tx-1',
      );
      await assertSucceeds(setDoc(ref, { type: 'EXPENSE', amount: 100 }));
    });

    await runCase('user A can read nested transaction', async () => {
      const db = testEnv.authenticatedContext('user-a').firestore();
      const ref = doc(
        db,
        'artifacts',
        APP_ID,
        'users',
        'user-a',
        'transactions_2026_01',
        'tx-1',
      );
      await assertSucceeds(getDoc(ref));
    });

    await runCase('user A can write goals', async () => {
      const db = testEnv.authenticatedContext('user-a').firestore();
      const ref = doc(db, 'artifacts', APP_ID, 'users', 'user-a', 'goals', 'goal-1');
      await assertSucceeds(setDoc(ref, { name: 'Mục tiêu', target: 1000 }));
    });

    await runCase('user A can read goals', async () => {
      const db = testEnv.authenticatedContext('user-a').firestore();
      const ref = doc(db, 'artifacts', APP_ID, 'users', 'user-a', 'goals', 'goal-1');
      await assertSucceeds(getDoc(ref));
    });

    await runCase('user A can write budgets', async () => {
      const db = testEnv.authenticatedContext('user-a').firestore();
      const ref = doc(db, 'artifacts', APP_ID, 'users', 'user-a', 'budgets', 'budget-1');
      await assertSucceeds(setDoc(ref, { category: 'Ăn uống', amount: 500 }));
    });

    await runCase('user A can read budgets', async () => {
      const db = testEnv.authenticatedContext('user-a').firestore();
      const ref = doc(db, 'artifacts', APP_ID, 'users', 'user-a', 'budgets', 'budget-1');
      await assertSucceeds(getDoc(ref));
    });

    await runCase('user A cannot read user B settings', async () => {
      const db = testEnv.authenticatedContext('user-a').firestore();
      const ref = doc(db, 'artifacts', APP_ID, 'users', 'user-b', 'settings', 'general');
      await assertFails(getDoc(ref));
    });

    await runCase('user A cannot write user B settings', async () => {
      const db = testEnv.authenticatedContext('user-a').firestore();
      const ref = doc(db, 'artifacts', APP_ID, 'users', 'user-b', 'settings', 'general');
      await assertFails(setDoc(ref, { wallets: [] }));
    });

    await runCase('user A cannot read user B transaction', async () => {
      const db = testEnv.authenticatedContext('user-a').firestore();
      const ref = doc(
        db,
        'artifacts',
        APP_ID,
        'users',
        'user-b',
        'transactions_2026_01',
        'tx-1',
      );
      await assertFails(getDoc(ref));
    });

    await runCase('user A cannot write user B transaction', async () => {
      const db = testEnv.authenticatedContext('user-a').firestore();
      const ref = doc(
        db,
        'artifacts',
        APP_ID,
        'users',
        'user-b',
        'transactions_2026_01',
        'tx-2',
      );
      await assertFails(setDoc(ref, { type: 'INCOME', amount: 1 }));
    });

    await runCase('user B cannot read user A settings', async () => {
      const db = testEnv.authenticatedContext('user-b').firestore();
      const ref = doc(db, 'artifacts', APP_ID, 'users', 'user-a', 'settings', 'general');
      await assertFails(getDoc(ref));
    });

    await runCase('anonymous authenticated UID can read/write own path', async () => {
      const anonUid = 'anon-device-b';
      const db = testEnv.authenticatedContext(anonUid).firestore();
      const ref = doc(db, 'artifacts', APP_ID, 'users', anonUid, 'settings', 'general');
      await assertSucceeds(setDoc(ref, { wallets: ['Ví'] }, { merge: true }));
      await assertSucceeds(getDoc(ref));
    });

    await runCase('anonymous authenticated UID cannot access other UID', async () => {
      const anonUid = 'anon-device-b';
      const db = testEnv.authenticatedContext(anonUid).firestore();
      const ref = doc(db, 'artifacts', APP_ID, 'users', 'user-a', 'settings', 'general');
      await assertFails(getDoc(ref));
      await assertFails(setDoc(ref, { wallets: [] }));
    });

    await runCase('user A cannot read wrong app namespace', async () => {
      const db = testEnv.authenticatedContext('user-a').firestore();
      const ref = doc(db, 'artifacts', 'other-app', 'users', 'user-a', 'settings', 'general');
      await assertFails(getDoc(ref));
    });

    await runCase('user A cannot write wrong app namespace', async () => {
      const db = testEnv.authenticatedContext('user-a').firestore();
      const ref = doc(db, 'artifacts', 'other-app', 'users', 'user-a', 'settings', 'general');
      await assertFails(setDoc(ref, { wallets: [] }));
    });

    await runCase('unauthenticated cannot read public sync settings', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      const ref = doc(
        db,
        'artifacts',
        APP_ID,
        'public',
        'data',
        `sync_${SYNC_CODE}_settings`,
        'general',
      );
      await assertFails(getDoc(ref));
    });

    await runCase('unauthenticated cannot write public sync transaction', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      const ref = doc(
        db,
        'artifacts',
        APP_ID,
        'public',
        'data',
        `sync_${SYNC_CODE}_transactions_2026_01`,
        'tx-1',
      );
      await assertFails(setDoc(ref, { amount: 1 }));
    });

    await runCase('authenticated user A cannot read public sync settings', async () => {
      const db = testEnv.authenticatedContext('user-a').firestore();
      const ref = doc(
        db,
        'artifacts',
        APP_ID,
        'public',
        'data',
        `sync_${SYNC_CODE}_settings`,
        'general',
      );
      await assertFails(getDoc(ref));
    });

    await runCase('authenticated user A cannot write public sync settings', async () => {
      const db = testEnv.authenticatedContext('user-a').firestore();
      const ref = doc(
        db,
        'artifacts',
        APP_ID,
        'public',
        'data',
        `sync_${SYNC_CODE}_settings`,
        'general',
      );
      await assertFails(setDoc(ref, { wallets: [] }));
    });

    await runCase('anonymous authenticated UID cannot read public sync', async () => {
      const db = testEnv.authenticatedContext('anon-device-b').firestore();
      const ref = doc(
        db,
        'artifacts',
        APP_ID,
        'public',
        'data',
        `sync_${SYNC_CODE}_goals`,
        'goal-1',
      );
      await assertFails(getDoc(ref));
    });

    await runCase('anonymous authenticated UID cannot write public sync', async () => {
      const db = testEnv.authenticatedContext('anon-device-b').firestore();
      const ref = doc(
        db,
        'artifacts',
        APP_ID,
        'public',
        'data',
        `sync_${SYNC_CODE}_budgets`,
        'budget-1',
      );
      await assertFails(setDoc(ref, { amount: 1 }));
    });

    await runCase('authenticated user cannot read root collection outside artifacts', async () => {
      const db = testEnv.authenticatedContext('user-a').firestore();
      const ref = doc(db, 'other-root', 'doc-1');
      await assertFails(getDoc(ref));
    });

    await runCase('authenticated user cannot write artifacts/other path', async () => {
      const db = testEnv.authenticatedContext('user-a').firestore();
      const ref = doc(db, 'artifacts', APP_ID, 'other', 'leafDoc');
      await assertFails(setDoc(ref, { x: 1 }));
    });
  } finally {
    await testEnv.cleanup();
  }

  const total = passed + failed;
  console.log(`\nFirestore rules tests: ${passed}/${total} passed, ${failed} failed`);
  assert.equal(failed, 0, `${failed} Firestore rules test(s) failed`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
