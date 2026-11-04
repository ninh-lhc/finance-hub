import { describe, expect, it } from 'vitest';
import {
  buildMonthComparison,
  previousPeriod,
  isCountedIncome,
  isCountedExpense,
} from './monthComparison.js';

const tx = (partial) => ({
  type: partial.type,
  category: partial.category,
  amount: partial.amount,
  date: partial.date,
});

describe('previousPeriod', () => {
  it('steps back one month inside the same year', () => {
    expect(previousPeriod(2025, 3)).toEqual({ year: 2025, month: 2 });
  });

  it('wraps January to December of the previous year', () => {
    expect(previousPeriod(2025, 0)).toEqual({ year: 2024, month: 11 });
  });
});

describe('counted transaction filters', () => {
  it('ignores opening balances and transfers', () => {
    expect(isCountedIncome(tx({ type: 'INCOME', category: 'Lương', amount: 1, date: '2025-04-05' }))).toBe(true);
    expect(isCountedIncome(tx({ type: 'INCOME', category: 'Số dư đầu kỳ', amount: 1, date: '2025-01-01' }))).toBe(false);
    expect(isCountedExpense(tx({ type: 'EXPENSE', category: 'Chuyển khoản đi', amount: 1, date: '2025-04-02' }))).toBe(false);
  });
});

describe('buildMonthComparison', () => {
  const current = [
    tx({ type: 'INCOME', category: 'Lương', amount: 100, date: '2025-04-05' }),
    tx({ type: 'INCOME', category: 'Số dư đầu kỳ', amount: 999, date: '2025-04-01' }),
    tx({ type: 'EXPENSE', category: 'Ăn uống', amount: 40, date: '2025-04-08' }),
    tx({ type: 'EXPENSE', category: 'Di chuyển', amount: 10, date: '2025-04-09' }),
  ];
  const previous = [
    tx({ type: 'INCOME', category: 'Lương', amount: 80, date: '2025-03-05' }),
    tx({ type: 'EXPENSE', category: 'Ăn uống', amount: 20, date: '2025-03-08' }),
  ];
  const year = [
    ...current,
    ...previous,
    tx({ type: 'EXPENSE', category: 'Ăn uống', amount: 20, date: '2025-02-02' }),
  ];

  it('compares income and expense with the previous month', () => {
    const result = buildMonthComparison({
      currentTransactions: current,
      previousTransactions: previous,
      yearTransactions: year,
      selectedYear: 2025,
      selectedMonth: 3,
      ready: true,
    });

    expect(result.previousMonth).toBe(2);
    expect(result.income).toBe(100);
    expect(result.expense).toBe(50);
    expect(result.incomeDelta.percent).toBe(25);
    expect(result.expenseDelta.percent).toBe(150);
    expect(result.categories[0]).toMatchObject({ name: 'Ăn uống', current: 40, previous: 20 });
  });

  it('averages a category across months that had spending', () => {
    const result = buildMonthComparison({
      currentTransactions: current,
      previousTransactions: previous,
      yearTransactions: year,
      selectedYear: 2025,
      selectedMonth: 3,
      ready: true,
    });
    const food = result.categories.find((item) => item.name === 'Ăn uống');
    expect(food.yearAverage).toBeCloseTo((40 + 20 + 20) / 3);
    expect(result.monthlyExpenses[3]).toBe(50);
    expect(result.monthlyExpenses[2]).toBe(20);
  });

  it('stays quiet until the year snapshot is ready', () => {
    const result = buildMonthComparison({
      currentTransactions: current,
      previousTransactions: [],
      yearTransactions: [],
      selectedYear: 2025,
      selectedMonth: 3,
      ready: false,
    });
    expect(result.ready).toBe(false);
  });
});
