import { describe, it, expect } from 'vitest';
import {
  getLegacyMigrationReadiness,
  canStartLegacyMigrationInspect,
  toLegacyMigrationUiInspectionState,
  getMigrationCollectionNames,
  buildSettingsInventorySlice,
  buildTransactionsInventorySlice,
  buildEntityListInventorySlice,
  buildLegacyMigrationInventory,
  buildLegacyMigrationDryRunSummary,
  FIXED_RANGE_WARNING,
  MIGRATION_SCAN_YEARS_BEFORE,
  MIGRATION_SCAN_YEARS_AFTER,
} from './legacySyncMigration.js';

const FIXTURE_SYNC = 'ABC123XYZ';
const FIXTURE_UID = 'google-user-uid-abcdef123456';

describe('getLegacyMigrationReadiness', () => {
  it('returns AUTH_NOT_READY when user is missing', () => {
    const result = getLegacyMigrationReadiness({ user: null, syncCode: FIXTURE_SYNC });
    expect(result.ready).toBe(false);
    expect(result.blockers.some((b) => b.code === 'AUTH_NOT_READY')).toBe(true);
  });

  it('returns GOOGLE_AUTH_REQUIRED for anonymous user with sync code', () => {
    const user = { uid: 'anon-1', isAnonymous: true };
    const result = getLegacyMigrationReadiness({ user, syncCode: FIXTURE_SYNC });
    expect(result.ready).toBe(false);
    expect(result.blockers.some((b) => b.code === 'GOOGLE_AUTH_REQUIRED')).toBe(true);
  });

  it('returns SYNC_CODE_REQUIRED for signed-in user without sync code', () => {
    const user = { uid: FIXTURE_UID, isAnonymous: false };
    const result = getLegacyMigrationReadiness({ user, syncCode: '' });
    expect(result.ready).toBe(false);
    expect(result.blockers.some((b) => b.code === 'SYNC_CODE_REQUIRED')).toBe(true);
  });

  it('returns ready for Google user with sync code', () => {
    const user = { uid: FIXTURE_UID, isAnonymous: false };
    const result = getLegacyMigrationReadiness({ user, syncCode: FIXTURE_SYNC });
    expect(result.ready).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it('does not mutate user object', () => {
    const user = { uid: FIXTURE_UID, isAnonymous: false };
    const frozen = { ...user };
    getLegacyMigrationReadiness({ user, syncCode: FIXTURE_SYNC });
    expect(user).toEqual(frozen);
  });

  it('readiness output does not contain full sync code', () => {
    const user = { uid: FIXTURE_UID, isAnonymous: false };
    const json = JSON.stringify(getLegacyMigrationReadiness({ user, syncCode: FIXTURE_SYNC }));
    expect(json.includes(FIXTURE_SYNC)).toBe(false);
  });
});

describe('canStartLegacyMigrationInspect', () => {
  it('blocks when readiness is not ready', () => {
    const readiness = getLegacyMigrationReadiness({
      user: { uid: 'u1', isAnonymous: true },
      syncCode: FIXTURE_SYNC,
    });
    expect(canStartLegacyMigrationInspect({ user: { uid: 'u1' }, readiness, isInspecting: false })).toEqual({
      allowed: false,
      reason: 'not-ready',
    });
  });

  it('blocks while inspection is in progress', () => {
    const readiness = getLegacyMigrationReadiness({
      user: { uid: FIXTURE_UID, isAnonymous: false },
      syncCode: FIXTURE_SYNC,
    });
    expect(
      canStartLegacyMigrationInspect({
        user: { uid: FIXTURE_UID, isAnonymous: false },
        readiness,
        isInspecting: true,
      }),
    ).toEqual({ allowed: false, reason: 'in-progress' });
  });

  it('allows when user and readiness are satisfied', () => {
    const user = { uid: FIXTURE_UID, isAnonymous: false };
    const readiness = getLegacyMigrationReadiness({ user, syncCode: FIXTURE_SYNC });
    expect(canStartLegacyMigrationInspect({ user, readiness, isInspecting: false })).toEqual({
      allowed: true,
      reason: null,
    });
  });
});

describe('toLegacyMigrationUiInspectionState', () => {
  it('keeps only summary for UI state', () => {
    const ui = toLegacyMigrationUiInspectionState({
      readiness: { ready: true, blockers: [] },
      inventory: {
        source: { transactions: { ids: ['tx-sensitive'] } },
        conflicts: { transactionIds: ['tx-sensitive'] },
      },
      summary: {
        sourceCounts: { transactions: 1 },
        conflictCounts: { total: 0 },
      },
    });
    expect(ui).toEqual({
      summary: {
        sourceCounts: { transactions: 1 },
        conflictCounts: { total: 0 },
      },
    });
    expect(JSON.stringify(ui)).not.toContain('tx-sensitive');
  });

  it('returns null when summary is missing', () => {
    expect(toLegacyMigrationUiInspectionState({ inventory: {} })).toBeNull();
  });
});

describe('getMigrationCollectionNames', () => {
  it('includes 84 transaction collections', () => {
    const names = getMigrationCollectionNames({ currentYear: 2026 });
    expect(names.transactionCollectionNames).toHaveLength(84);
    expect(names.transactionCollectionCount).toBe(84);
  });

  it('uses correct year start and end', () => {
    const names = getMigrationCollectionNames({ currentYear: 2026 });
    expect(names.yearStart).toBe(2026 - MIGRATION_SCAN_YEARS_BEFORE);
    expect(names.yearEnd).toBe(2026 + MIGRATION_SCAN_YEARS_AFTER);
    expect(names.transactionCollectionNames[0]).toBe(
      `transactions_${names.yearStart}_01`,
    );
    const last = names.transactionCollectionNames[names.transactionCollectionNames.length - 1];
    expect(last).toBe(`transactions_${names.yearEnd}_12`);
  });

  it('pads months with two digits', () => {
    const names = getMigrationCollectionNames({ currentYear: 2026 });
    expect(names.transactionCollectionNames).toContain('transactions_2026_09');
    expect(names.transactionCollectionNames.every((n) => /_\d{2}$/.test(n))).toBe(true);
  });

  it('includes settings, goals, and budgets descriptors', () => {
    const names = getMigrationCollectionNames({ currentYear: 2026 });
    expect(names.settingsCollectionName).toBe('settings');
    expect(names.settingsDocumentId).toBe('general');
    expect(names.goalsCollectionName).toBe('goals');
    expect(names.budgetsCollectionName).toBe('budgets');
  });

  it('does not mutate options object', () => {
    const options = { currentYear: 2025 };
    const copy = { ...options };
    getMigrationCollectionNames(options);
    expect(options).toEqual(copy);
  });
});

describe('buildLegacyMigrationInventory', () => {
  const emptySide = () => ({
    settings: buildSettingsInventorySlice({ exists: false }),
    transactions: buildTransactionsInventorySlice([]),
    goals: buildEntityListInventorySlice({ docIds: [] }),
    budgets: buildEntityListInventorySlice({ docIds: [] }),
  });

  it('handles source-only data', () => {
    const source = emptySide();
    source.transactions = buildTransactionsInventorySlice([
      { collectionId: 'transactions_2026_01', docIds: ['t1'], dates: ['2026-01-05'] },
    ]);
    source.settings = buildSettingsInventorySlice({
      exists: true,
      data: { wallets: ['A'], categories: { INCOME: ['L'], EXPENSE: [] }, walletBalances: { A: 1 } },
    });
    const inventory = buildLegacyMigrationInventory({ source, target: emptySide() });
    expect(inventory.source.transactions.totalCount).toBe(1);
    expect(inventory.target.transactions.totalCount).toBe(0);
    expect(inventory.conflicts.transactionIds).toHaveLength(0);
  });

  it('detects transaction ID conflicts', () => {
    const source = emptySide();
    const target = emptySide();
    source.transactions = buildTransactionsInventorySlice([
      { collectionId: 'transactions_2026_01', docIds: ['shared', 's-only'], dates: ['2026-01-01', '2026-01-02'] },
    ]);
    target.transactions = buildTransactionsInventorySlice([
      { collectionId: 'transactions_2026_01', docIds: ['shared'], dates: ['2026-01-01'] },
    ]);
    const { conflicts } = buildLegacyMigrationInventory({ source, target });
    expect(conflicts.transactionIds).toEqual(['shared']);
  });

  it('detects goal and budget conflicts', () => {
    const source = emptySide();
    const target = emptySide();
    source.goals = buildEntityListInventorySlice({ docIds: ['g1', 'g2'] });
    target.goals = buildEntityListInventorySlice({ docIds: ['g2'] });
    source.budgets = buildEntityListInventorySlice({ docIds: ['b1'] });
    target.budgets = buildEntityListInventorySlice({ docIds: ['b1', 'b2'] });
    const { conflicts } = buildLegacyMigrationInventory({ source, target });
    expect(conflicts.goalIds).toEqual(['g2']);
    expect(conflicts.budgetIds).toEqual(['b1']);
  });

  it('flags settings when both exist and shape differs', () => {
    const source = emptySide();
    const target = emptySide();
    source.settings = buildSettingsInventorySlice({
      exists: true,
      data: { wallets: ['A', 'B'], categories: { INCOME: [], EXPENSE: ['X'] } },
    });
    target.settings = buildSettingsInventorySlice({
      exists: true,
      data: { wallets: ['A'], categories: { INCOME: [], EXPENSE: ['X'] } },
    });
    const { conflicts } = buildLegacyMigrationInventory({ source, target });
    expect(conflicts.settingsBothExist).toBe(true);
    expect(conflicts.settingsShapeMismatch).toBe(true);
  });

  it('computes earliest and latest dates', () => {
    const slice = buildTransactionsInventorySlice([
      { collectionId: 'transactions_2026_03', docIds: ['a'], dates: ['2026-03-15'] },
      { collectionId: 'transactions_2026_01', docIds: ['b'], dates: ['2026-01-01'] },
    ]);
    expect(slice.earliestDate).toBe('2026-01-01');
    expect(slice.latestDate).toBe('2026-03-15');
    expect(slice.collectionCounts['transactions_2026_03']).toBe(1);
  });

  it('handles empty inventories', () => {
    const inventory = buildLegacyMigrationInventory({
      source: emptySide(),
      target: emptySide(),
    });
    expect(inventory.conflicts.transactionIds).toHaveLength(0);
    expect(inventory.conflicts.settingsBothExist).toBe(false);
  });

  it('does not mutate source or target', () => {
    const source = emptySide();
    const target = emptySide();
    source.goals = buildEntityListInventorySlice({ docIds: ['g1'] });
    const sourceCopy = JSON.stringify(source);
    const targetCopy = JSON.stringify(target);
    buildLegacyMigrationInventory({ source, target });
    expect(JSON.stringify(source)).toBe(sourceCopy);
    expect(JSON.stringify(target)).toBe(targetCopy);
  });
});

describe('buildLegacyMigrationDryRunSummary', () => {
  const baseInventory = () =>
    buildLegacyMigrationInventory({
      source: {
        settings: buildSettingsInventorySlice({ exists: true, data: { wallets: ['W'] } }),
        transactions: buildTransactionsInventorySlice([
          { collectionId: 'transactions_2026_01', docIds: ['t1'], dates: ['2026-01-10'] },
        ]),
        goals: buildEntityListInventorySlice({ docIds: ['g1'] }),
        budgets: buildEntityListInventorySlice({ docIds: [] }),
      },
      target: {
        settings: buildSettingsInventorySlice({ exists: false }),
        transactions: buildTransactionsInventorySlice([]),
        goals: buildEntityListInventorySlice({ docIds: [] }),
        budgets: buildEntityListInventorySlice({ docIds: ['b1'] }),
      },
    });

  it('aggregates source and target counts', () => {
    const summary = buildLegacyMigrationDryRunSummary({
      inventory: baseInventory(),
      scanMeta: { yearStart: 2021, yearEnd: 2027, transactionCollectionCount: 84 },
      maskedUid: 'abcd…1234',
      maskedSyncCode: 'AB•••••',
    });
    expect(summary.sourceCounts.transactions).toBe(1);
    expect(summary.targetCounts.budgets).toBe(1);
    expect(summary.scanRange.transactionCollectionCount).toBe(84);
  });

  it('includes conflict counts', () => {
    const inventory = baseInventory();
    inventory.conflicts.transactionIds = ['t1'];
    const summary = buildLegacyMigrationDryRunSummary({
      inventory,
      scanMeta: { yearStart: 2021, yearEnd: 2027, transactionCollectionCount: 84 },
    });
    expect(summary.conflictCounts.transactions).toBe(1);
    expect(summary.conflictCounts.total).toBeGreaterThanOrEqual(1);
  });

  it('includes fixed range warning', () => {
    const summary = buildLegacyMigrationDryRunSummary({
      inventory: baseInventory(),
      scanMeta: { yearStart: 2021, yearEnd: 2027, transactionCollectionCount: 84 },
    });
    expect(summary.warnings.some((w) => w === FIXED_RANGE_WARNING)).toBe(true);
  });

  it('does not expose full UID in summary JSON', () => {
    const summary = buildLegacyMigrationDryRunSummary({
      inventory: baseInventory(),
      scanMeta: { yearStart: 2021, yearEnd: 2027, transactionCollectionCount: 84 },
      maskedUid: 'abcd…1234',
      maskedSyncCode: 'AB•••••',
    });
    const json = JSON.stringify(summary);
    expect(json.includes(FIXTURE_UID)).toBe(false);
    expect(json.includes(FIXTURE_SYNC)).toBe(false);
  });

  it('does not include transaction notes or amounts', () => {
    const summary = buildLegacyMigrationDryRunSummary({
      inventory: baseInventory(),
      scanMeta: { yearStart: 2021, yearEnd: 2027, transactionCollectionCount: 84 },
    });
    const json = JSON.stringify(summary);
    expect(json).not.toMatch(/"note"\s*:/);
    expect(json).not.toMatch(/"amount"\s*:/);
  });
});
