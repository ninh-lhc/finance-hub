import { describe, expect, it } from 'vitest';
import { buildBudgetSnapshot } from './budgetSnapshot.js';

const category = (name, current, previous, samePeriod) => ({ name, current, previous, samePeriod });

describe('buildBudgetSnapshot', () => {
  const budgets = [
    { id: 'food', category: 'Ăn uống', amount: 1000 },
    { id: 'move', category: 'Di chuyển', amount: 500 },
    { id: 'bill', category: 'Hóa đơn', amount: 200 },
  ];
  const expenseCategories = [
    category('Ăn uống', 800, 600, 900),
    category('Di chuyển', 500, 100, 0),
    category('Hóa đơn', 350, 200, 180),
    category('Mua sắm', 1200, 400, 0),
    category('Chuyển khoản đi', 0, 0, 0),
  ];

  it('marks a target as remaining, used up, or over, and compares both earlier periods', () => {
    const snapshot = buildBudgetSnapshot({
      budgets,
      expenseCategories,
      samePeriodReady: true,
    });

    expect(snapshot.tracked.map((item) => [item.name, item.status, item.remaining])).toEqual([
      ['Hóa đơn', 'over', -150],
      ['Di chuyển', 'used', 0],
      ['Ăn uống', 'left', 200],
    ]);
    expect(snapshot.tracked.find((item) => item.name === 'Ăn uống')).toMatchObject({
      spent: 800,
      previous: 600,
      samePeriod: 900,
      percent: 80,
    });
    expect(snapshot.tracked.find((item) => item.name === 'Ăn uống').previousDelta.percent).toBeCloseTo(33.333, 2);
    expect(snapshot.tracked.find((item) => item.name === 'Ăn uống').samePeriodDelta.percent).toBeCloseTo(-11.111, 2);
    expect(snapshot.totals).toMatchObject({
      limit: 1700,
      spent: 1650,
      remaining: 50,
      leftCount: 1,
      leftAmount: 200,
      usedCount: 1,
      overCount: 1,
      overAmount: 150,
      openCount: 1,
      openSpent: 1200,
    });
  });

  it('lists spending that has no target and waits for last year', () => {
    const snapshot = buildBudgetSnapshot({
      budgets: [{ category: 'Ăn uống', amount: 1000 }],
      expenseCategories: [
        category('Ăn uống', 100, 0, 50),
        category('Mua sắm', 0, 300, 20),
      ],
      samePeriodReady: false,
    });

    expect(snapshot.tracked[0]).toMatchObject({ status: 'left', remaining: 900, samePeriod: null, samePeriodDelta: null });
    expect(snapshot.open).toEqual([
      expect.objectContaining({ name: 'Mua sắm', spent: 0, previous: 300, samePeriod: null }),
    ]);
    expect(snapshot.totals.openCount).toBe(0);
    expect(snapshot.totals.openSpent).toBe(0);
  });

  it('keeps a target that has not been spent yet', () => {
    const snapshot = buildBudgetSnapshot({
      budgets: [{ category: 'Giải trí', amount: 400 }],
      expenseCategories: [],
      samePeriodReady: true,
    });

    expect(snapshot.tracked[0]).toMatchObject({
      status: 'left',
      spent: 0,
      remaining: 400,
      previous: 0,
      samePeriod: 0,
    });
    expect(snapshot.open).toEqual([]);
  });
});
