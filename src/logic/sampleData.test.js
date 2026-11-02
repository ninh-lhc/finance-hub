import { describe, it, expect } from 'vitest';
import {
  SAMPLE_DATA_YEAR,
  SAMPLE_EXPENSE_CATEGORIES,
  isSampleEntity,
  applySampleTransactionToBalanceImpact,
  buildSampleGenerationPlan,
  computeReverseImpactForSampleDocument,
  aggregateClearSampleImpacts,
  getClearSampleScanCollectionIds,
} from './sampleData.js';

describe('isSampleEntity', () => {
  it('detects isSample true', () => {
    expect(isSampleEntity({ isSample: true })).toBe(true);
  });

  it('rejects false or missing marker', () => {
    expect(isSampleEntity({ isSample: false })).toBe(false);
    expect(isSampleEntity({})).toBe(false);
  });
});

describe('buildSampleGenerationPlan', () => {
  const wallets = ['Tiền mặt', 'Ví ngân hàng'];
  let seq = 0;
  const random = () => {
    seq += 1;
    return (seq % 10) / 10;
  };

  it('creates opening balance plus 12 months of samples', () => {
    const plan = buildSampleGenerationPlan({
      wallets,
      createdAt: '2025-01-01T00:00:00.000Z',
      random,
    });
    expect(plan.writes).toHaveLength(wallets.length + 12 * 8);
    expect(plan.sampleYear).toBe(SAMPLE_DATA_YEAR);
  });

  it('marks every payload as sample', () => {
    const plan = buildSampleGenerationPlan({ wallets, createdAt: 'x', random: () => 0 });
    expect(plan.writes.every(({ payload }) => payload.isSample === true)).toBe(true);
  });

  it('uses hard-coded year 2025 collections', () => {
    const plan = buildSampleGenerationPlan({ wallets, createdAt: 'x', random: () => 0 });
    expect(plan.writes[0].collectionId).toBe('transactions_2025_01');
    expect(plan.writes.some((w) => w.collectionId === 'transactions_2025_12')).toBe(true);
  });

  it('opening balance amounts follow wallet index pattern', () => {
    const plan = buildSampleGenerationPlan({ wallets, createdAt: 'x', random: () => 0 });
    const opening = plan.writes.filter((w) => w.payload.category === 'Số dư đầu kỳ');
    expect(opening[0].payload.amount).toBe(10000000);
    expect(opening[1].payload.amount).toBe(15000000);
  });

  it('does not mutate wallets input', () => {
    const copy = [...wallets];
    buildSampleGenerationPlan({ wallets, createdAt: 'x', random: () => 0 });
    expect(wallets).toEqual(copy);
  });

  it('returns fresh plan objects each call', () => {
    const a = buildSampleGenerationPlan({ wallets, createdAt: 'x', random: () => 0 });
    const b = buildSampleGenerationPlan({ wallets, createdAt: 'x', random: () => 0 });
    expect(a).not.toBe(b);
    expect(a.writes).not.toBe(b.writes);
  });
});

describe('applySampleTransactionToBalanceImpact', () => {
  it('increases on INCOME', () => {
    expect(
      applySampleTransactionToBalanceImpact(
        {},
        { type: 'INCOME', wallet: 'A', amount: 100 },
      ),
    ).toEqual({ A: 100 });
  });

  it('decreases on EXPENSE', () => {
    expect(
      applySampleTransactionToBalanceImpact(
        { A: 100 },
        { type: 'EXPENSE', wallet: 'A', amount: 40 },
      ),
    ).toEqual({ A: 60 });
  });

  it('uses linkedWallet on EXPENSE', () => {
    expect(
      applySampleTransactionToBalanceImpact(
        { A: 100, B: 50 },
        { type: 'EXPENSE', wallet: 'A', linkedWallet: 'B', amount: 10 },
      ),
    ).toEqual({ A: 100, B: 40 });
  });
});

describe('computeReverseImpactForSampleDocument', () => {
  it('reverses INCOME sample', () => {
    expect(
      computeReverseImpactForSampleDocument({
        isSample: true,
        type: 'INCOME',
        wallet: 'A',
        amount: 50,
      }),
    ).toEqual({ A: -50 });
  });

  it('reverses EXPENSE sample', () => {
    expect(
      computeReverseImpactForSampleDocument({
        isSample: true,
        type: 'EXPENSE',
        wallet: 'A',
        amount: 30,
      }),
    ).toEqual({ A: 30 });
  });

  it('ignores non-sample', () => {
    expect(
      computeReverseImpactForSampleDocument({
        isSample: false,
        type: 'INCOME',
        wallet: 'A',
        amount: 50,
      }),
    ).toEqual({});
  });
});

describe('aggregateClearSampleImpacts', () => {
  it('combines reverse impacts', () => {
    const impact = aggregateClearSampleImpacts([
      { isSample: true, type: 'INCOME', wallet: 'A', amount: 100 },
      { isSample: true, type: 'EXPENSE', wallet: 'A', amount: 40 },
    ]);
    expect(impact).toEqual({ A: -60 });
  });
});

describe('getClearSampleScanCollectionIds', () => {
  it('includes 84 transaction months plus goals and budgets', () => {
    const ids = getClearSampleScanCollectionIds(2026);
    expect(ids).toHaveLength(84 + 2);
    expect(ids).toContain('goals');
    expect(ids).toContain('budgets');
  });
});

describe('SAMPLE_EXPENSE_CATEGORIES', () => {
  it('matches App fixture list', () => {
    expect(SAMPLE_EXPENSE_CATEGORIES).toEqual([
      'Ăn uống',
      'Di chuyển',
      'Mua sắm',
      'Hóa đơn',
    ]);
  });
});
