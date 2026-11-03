import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getDoc, getDocs, collection, doc } = vi.hoisted(() => ({
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  getDoc,
  getDocs,
  collection,
  doc,
}));

vi.mock('../firebase/config.js', () => ({
  db: { kind: 'mock-db' },
  baseAppId: 'tai-chinh-cua-toi',
}));

import {
  inspectLegacySyncMigration,
  LegacyMigrationNotReadyError,
} from './legacySyncMigrationService.js';

const FIXTURE_CODE = 'ABC123';
const FIXTURE_UID = 'uid-google-999';

function emptySnap() {
  return { exists: () => false, docs: [], data: () => ({}) };
}

function settingsSnap(wallets = []) {
  return {
    exists: () => true,
    data: () => ({
      wallets,
      categories: { INCOME: [], EXPENSE: [] },
      walletBalances: {},
    }),
  };
}

function docsSnap(ids) {
  return {
    docs: ids.map((id) => ({
      id,
      data: () => ({ date: '2026-05-01' }),
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  collection.mockImplementation((dbRef, ...segments) => ({
    path: segments.join('/'),
    segments,
  }));
  doc.mockImplementation((dbRef, ...segments) => ({
    path: segments.join('/'),
    segments,
  }));
  getDoc.mockResolvedValue(emptySnap());
  getDocs.mockResolvedValue(emptySnap());
});

describe('inspectLegacySyncMigration', () => {
  it('does not call getDoc/getDocs for anonymous user', async () => {
    await expect(
      inspectLegacySyncMigration({
        user: { uid: 'anon', isAnonymous: true },
        syncCode: FIXTURE_CODE,
        currentYear: 2026,
      }),
    ).rejects.toBeInstanceOf(LegacyMigrationNotReadyError);
    expect(getDoc).not.toHaveBeenCalled();
    expect(getDocs).not.toHaveBeenCalled();
  });

  it('does not call reads when sync code is missing', async () => {
    await expect(
      inspectLegacySyncMigration({
        user: { uid: FIXTURE_UID, isAnonymous: false },
        syncCode: '',
        currentYear: 2026,
      }),
    ).rejects.toBeInstanceOf(LegacyMigrationNotReadyError);
    expect(getDoc).not.toHaveBeenCalled();
    expect(getDocs).not.toHaveBeenCalled();
  });

  it('reads settings and 84 transaction collections per side', async () => {
    getDoc.mockResolvedValue(settingsSnap(['Ví']));
    getDocs.mockResolvedValue(docsSnap(['tx1']));

    await inspectLegacySyncMigration({
      user: { uid: FIXTURE_UID, isAnonymous: false },
      syncCode: FIXTURE_CODE,
      currentYear: 2026,
    });

    expect(getDoc).toHaveBeenCalledTimes(2);
    expect(getDocs).toHaveBeenCalledTimes(84 * 2 + 2 * 2);
  });

  it('builds public sync and uid collection paths', async () => {
    await inspectLegacySyncMigration({
      user: { uid: FIXTURE_UID, isAnonymous: false },
      syncCode: FIXTURE_CODE,
      currentYear: 2026,
    });

    const collectionPaths = collection.mock.calls.map((call) => call.slice(1).join('/'));
    expect(
      collectionPaths.some((p) => p.includes(`sync_${FIXTURE_CODE}_transactions_2026_01`)),
    ).toBe(true);
    expect(
      collectionPaths.some((p) => p.includes(`users/${FIXTURE_UID}/transactions_2026_01`)),
    ).toBe(true);
    expect(collectionPaths.some((p) => p.includes(`sync_${FIXTURE_CODE}_goals`))).toBe(true);
    expect(collectionPaths.some((p) => p.includes(`users/${FIXTURE_UID}/budgets`))).toBe(true);
  });

  it('returns inventory counts in summary', async () => {
    getDoc.mockResolvedValue(settingsSnap(['A']));
    getDocs.mockImplementation(() => Promise.resolve(docsSnap(['a', 'b'])));

    const result = await inspectLegacySyncMigration({
      user: { uid: FIXTURE_UID, isAnonymous: false },
      syncCode: FIXTURE_CODE,
      currentYear: 2026,
    });

    expect(result.summary.sourceCounts.transactions).toBeGreaterThan(0);
    expect(result.readiness.ready).toBe(true);
    expect(result.summary.migrationPerformed).toBe(false);
  });

  it('propagates permission errors without sync code in message', async () => {
    const err = new Error('Permission denied');
    err.code = 'permission-denied';
    getDoc.mockRejectedValue(err);

    await expect(
      inspectLegacySyncMigration({
        user: { uid: FIXTURE_UID, isAnonymous: false },
        syncCode: FIXTURE_CODE,
        currentYear: 2026,
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' });

    expect(String(err.message).includes(FIXTURE_CODE)).toBe(false);
  });

  it('does not mutate input user', async () => {
    const user = { uid: FIXTURE_UID, isAnonymous: false };
    const before = { ...user };
    await inspectLegacySyncMigration({
      user,
      syncCode: FIXTURE_CODE,
      currentYear: 2026,
    });
    expect(user).toEqual(before);
  });

  it('masked sync code in summary is not full code', async () => {
    const result = await inspectLegacySyncMigration({
      user: { uid: FIXTURE_UID, isAnonymous: false },
      syncCode: FIXTURE_CODE,
      currentYear: 2026,
    });
    expect(result.summary.maskedSyncCode).not.toBe(FIXTURE_CODE);
    expect(JSON.stringify(result.summary).includes(FIXTURE_CODE)).toBe(false);
  });
});
