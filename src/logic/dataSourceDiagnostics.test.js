import { describe, it, expect } from 'vitest';
import {
  buildDataSourceDiagnostics,
  maskUid,
  maskSyncCode,
  resolveAuthMode,
  resolveDataSourceMode,
} from './dataSourceDiagnostics.js';

const mockUser = (overrides = {}) => ({
  uid: 'abcdefghijklmnopqrstuvwxyz012345',
  isAnonymous: false,
  providerData: [],
  ...overrides,
});

describe('resolveAuthMode', () => {
  it('returns not-authenticated when user is missing', () => {
    expect(resolveAuthMode(null)).toBe('not-authenticated');
    expect(resolveAuthMode(undefined)).toBe('not-authenticated');
  });

  it('returns anonymous for anonymous user', () => {
    expect(resolveAuthMode(mockUser({ isAnonymous: true }))).toBe('anonymous');
  });

  it('returns google when google.com is in providerData', () => {
    expect(
      resolveAuthMode(
        mockUser({
          isAnonymous: false,
          providerData: [{ providerId: 'google.com' }],
        }),
      ),
    ).toBe('google');
  });

  it('returns authenticated-other for non-google authenticated user', () => {
    expect(
      resolveAuthMode(
        mockUser({
          isAnonymous: false,
          providerData: [{ providerId: 'password' }],
        }),
      ),
    ).toBe('authenticated-other');
  });
});

describe('resolveDataSourceMode', () => {
  it('legacy-public-sync when syncCode is set with anonymous user', () => {
    expect(resolveDataSourceMode(mockUser({ isAnonymous: true }), 'ABC123')).toBe(
      'legacy-public-sync',
    );
  });

  it('legacy-public-sync when syncCode is set with Google user', () => {
    expect(
      resolveDataSourceMode(
        mockUser({ providerData: [{ providerId: 'google.com' }] }),
        'ROOM01',
      ),
    ).toBe('legacy-public-sync');
  });

  it('uid-owned when no syncCode but user has uid', () => {
    expect(resolveDataSourceMode(mockUser(), '')).toBe('uid-owned');
    expect(resolveDataSourceMode(mockUser(), '   ')).toBe('uid-owned');
  });

  it('not-ready when no user', () => {
    expect(resolveDataSourceMode(null, '')).toBe('not-ready');
  });
});

describe('maskUid', () => {
  it('masks long uid with head and tail segments', () => {
    expect(maskUid('abcdefghijklmnopqrstuvwxyz')).toBe('abcd…wxyz');
  });

  it('masks short uid without exposing full value', () => {
    expect(maskUid('abcdefgh')).toBe('ab…gh');
    expect(maskUid('abcd')).toBe('••••');
  });

  it('handles empty uid safely', () => {
    expect(maskUid('')).toBe(null);
    expect(maskUid('   ')).toBe(null);
    expect(maskUid(null)).toBe(null);
  });
});

describe('maskSyncCode', () => {
  it('masks 6-character sync code', () => {
    expect(maskSyncCode('ABCDEF')).toBe('AB••••');
  });

  it('returns null for empty sync code', () => {
    expect(maskSyncCode('')).toBe(null);
    expect(maskSyncCode('  ')).toBe(null);
  });
});

describe('buildDataSourceDiagnostics counts', () => {
  it('counts loaded entities for selected month session', () => {
    const result = buildDataSourceDiagnostics({
      user: mockUser({ isAnonymous: true }),
      syncCode: '',
      selectedYear: 2026,
      selectedMonth: 0,
      transactions: [{ id: '1' }, { id: '2' }],
      wallets: [{ id: 'w1' }],
      categories: { INCOME: ['A'], EXPENSE: ['B', 'C'] },
      walletBalances: { Cash: 100, Bank: 200 },
      goals: [{ id: 'g1' }],
      budgets: [],
    });

    expect(result.selectedPeriod).toBe('2026-01');
    expect(result.loadedCounts).toEqual({
      transactions: 2,
      wallets: 1,
      categories: 3,
      goals: 1,
      budgets: 0,
    });
    expect(result.loadedWalletBalanceCount).toBe(2);
  });

  it('does not mutate input arrays or objects', () => {
    const transactions = [{ id: 't1' }];
    const wallets = [{ id: 'w1' }];
    const categories = { INCOME: ['X'], EXPENSE: [] };
    const walletBalances = { A: 1 };
    const goals = [{ id: 'g1' }];
    const budgets = [{ id: 'b1' }];

    const txSnap = JSON.stringify(transactions);
    const wSnap = JSON.stringify(wallets);
    const cSnap = JSON.stringify(categories);
    const wbSnap = JSON.stringify(walletBalances);

    buildDataSourceDiagnostics({
      user: mockUser({ isAnonymous: true }),
      syncCode: '',
      selectedYear: 2026,
      selectedMonth: 5,
      transactions,
      wallets,
      categories,
      walletBalances,
      goals,
      budgets,
    });

    expect(JSON.stringify(transactions)).toBe(txSnap);
    expect(JSON.stringify(wallets)).toBe(wSnap);
    expect(JSON.stringify(categories)).toBe(cSnap);
    expect(JSON.stringify(walletBalances)).toBe(wbSnap);
  });
});

describe('buildDataSourceDiagnostics warnings and notes', () => {
  it('includes legacy public sync warnings', () => {
    const { warnings, dataSourceMode } = buildDataSourceDiagnostics({
      user: mockUser({ isAnonymous: true }),
      syncCode: 'ABC123',
      selectedYear: 2026,
      selectedMonth: 0,
      transactions: [],
      wallets: [],
      categories: { INCOME: [], EXPENSE: [] },
      walletBalances: {},
      goals: [],
      budgets: [],
    });

    expect(dataSourceMode).toBe('legacy-public-sync');
    expect(warnings.some((w) => w.includes('phòng đồng bộ công khai'))).toBe(true);
    expect(warnings.some((w) => w.includes('Security Rules'))).toBe(true);
  });

  it('includes anonymous uid-owned device warning', () => {
    const { warnings, authMode } = buildDataSourceDiagnostics({
      user: mockUser({ isAnonymous: true }),
      syncCode: '',
      selectedYear: 2026,
      selectedMonth: 0,
      transactions: [],
      wallets: [],
      categories: { INCOME: [], EXPENSE: [] },
      walletBalances: {},
      goals: [],
      budgets: [],
    });

    expect(authMode).toBe('anonymous');
    expect(warnings.some((w) => w.includes('UID ẩn danh'))).toBe(true);
  });

  it('does not attach anonymous warnings to google uid-owned session', () => {
    const { warnings, notes, authMode } = buildDataSourceDiagnostics({
      user: mockUser({
        isAnonymous: false,
        providerData: [{ providerId: 'google.com' }],
      }),
      syncCode: '',
      selectedYear: 2026,
      selectedMonth: 0,
      transactions: [],
      wallets: [],
      categories: { INCOME: [], EXPENSE: [] },
      walletBalances: {},
      goals: [],
      budgets: [],
    });

    expect(authMode).toBe('google');
    expect(warnings.some((w) => w.includes('UID ẩn danh'))).toBe(false);
    expect(notes.some((n) => n.includes('Google'))).toBe(true);
  });

  it('never claims backup or migration is already complete', () => {
    const cases = [
      { syncCode: 'X', user: mockUser({ isAnonymous: true }) },
      { syncCode: '', user: mockUser({ isAnonymous: true }) },
      {
        syncCode: '',
        user: mockUser({ providerData: [{ providerId: 'google.com' }] }),
      },
    ];

    for (const { syncCode, user } of cases) {
      const { warnings, notes } = buildDataSourceDiagnostics({
        user,
        syncCode,
        selectedYear: 2026,
        selectedMonth: 0,
        transactions: [],
        wallets: [],
        categories: { INCOME: [], EXPENSE: [] },
        walletBalances: {},
        goals: [],
        budgets: [],
      });

      const allText = [...warnings, ...notes].join(' ');
      expect(allText).not.toMatch(/đã\s*(backup|sao lưu|migrate|di chuyển)/i);
      expect(allText).not.toMatch(/migration\s*đã\s*hoàn/i);
    }
  });

  it('exposes masked sync code only when hasSyncCode', () => {
    const withCode = buildDataSourceDiagnostics({
      user: mockUser(),
      syncCode: 'ABCDEF',
      selectedYear: 2026,
      selectedMonth: 0,
      transactions: [],
      wallets: [],
      categories: { INCOME: [], EXPENSE: [] },
      walletBalances: {},
      goals: [],
      budgets: [],
    });
    expect(withCode.hasSyncCode).toBe(true);
    expect(withCode.maskedSyncCode).toBe('AB••••');
    expect(withCode.maskedSyncCode).not.toBe('ABCDEF');

    const without = buildDataSourceDiagnostics({
      user: mockUser(),
      syncCode: '',
      selectedYear: 2026,
      selectedMonth: 0,
      transactions: [],
      wallets: [],
      categories: { INCOME: [], EXPENSE: [] },
      walletBalances: {},
      goals: [],
      budgets: [],
    });
    expect(without.hasSyncCode).toBe(false);
    expect(without.maskedSyncCode).toBe(null);
  });
});
