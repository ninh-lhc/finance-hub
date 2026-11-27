import { describe, expect, it } from 'vitest';
import { buildSixJarPlan, DEFAULT_JAR_SETTINGS } from './sixJars.js';

const expense = (category, amount) => ({ type: 'EXPENSE', category, amount });
const salary = { type: 'INCOME', category: 'Lương', amount: 9_700_000 };
const childPayment = expense('Chi cho con', 4_000_000);
const input = {
  year: 2026,
  month: 10,
  goals: [],
  repayments: [],
  settings: DEFAULT_JAR_SETTINGS,
  previousTransactions: [],
};

describe('6 jars based on previous spending', () => {
  it('waits until there is salary and the child expense is fully paid', () => {
    expect(buildSixJarPlan({ ...input, transactions: [salary, expense('Chi cho con', 2_000_000)] }).ready).toBe(false);
    expect(buildSixJarPlan({ ...input, transactions: [childPayment] }).ready).toBe(false);
    const plan = buildSixJarPlan({ ...input, transactions: [salary, expense('Chi cho con', 2_000_000), expense('Chi cho con', 2_000_000)] });
    expect(plan).toMatchObject({ ready: true, available: 5_700_000 });
    expect(plan.jars.map(({ limit }) => limit)).toEqual([3_135_000, 570_000, 570_000, 570_000, 570_000, 285_000]);
  });

  it('adjusts by mapped spending, reserves money for unspent jars, and deducts repayments once', () => {
    const food = expense('Ăn uống', 150_000);
    const plan = buildSixJarPlan({
      ...input,
      transactions: [salary, childPayment, food],
      previousTransactions: [expense('Ăn uống', 1_000_000), expense('Giải trí', 1_000_000), expense('Chưa gán', 200_000), childPayment],
      context: { funded: (row) => row === food ? 50_000 : 0 },
      repayments: [{ kind: 'borrow', payDate: '2026-11-01', amount: 970_000 }],
    });
    expect(plan).toMatchObject({ ready: true, available: 4_730_000, previousUnassigned: 200_000 });
    expect(plan.jars[0]).toMatchObject({ limit: 2_483_250, spent: 100_000, remaining: 2_383_250 });
    expect(plan.jars[1].limit).toBe(236_500);
    expect(plan.jars.reduce((sum, jar) => sum + jar.limit, 0)).toBe(plan.available);
  });

  it('rounds allocations to the đồng without exceeding the remaining salary', () => {
    const plan = buildSixJarPlan({ ...input, transactions: [{ ...salary, amount: 4_000_007 }, childPayment] });
    expect(plan.jars.reduce((sum, jar) => sum + jar.limit, 0)).toBe(7);
  });
});
