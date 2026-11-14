import { describe, expect, it } from 'vitest';
import { buildPeriodReport, inclusiveDayCount, monthsInRange } from './periodReport.js';

const tx = (partial) => ({
  id: partial.id,
  type: partial.type,
  category: partial.category,
  amount: partial.amount,
  date: partial.date,
  note: partial.note,
  wallet: partial.wallet,
  linkedWallet: partial.linkedWallet,
});

const year = [
  tx({ id: 'open', type: 'INCOME', category: 'Số dư đầu kỳ', amount: 500, date: '2026-01-01', wallet: 'Tiền mặt' }),
  tx({ id: 'pay', type: 'INCOME', category: 'Lương', amount: 100, date: '2026-07-01', wallet: 'Ngân hàng' }),
  tx({ id: 'side', type: 'INCOME', category: 'Kinh doanh', amount: 40, date: '2026-08-02', wallet: 'Tiền mặt' }),
  tx({ id: 'rent', type: 'EXPENSE', category: 'Nhà ở', amount: 50, date: '2026-07-05', wallet: 'Ngân hàng', note: 'Tiền nhà' }),
  tx({ id: 'food', type: 'EXPENSE', category: 'Ăn uống', amount: 20, date: '2026-07-08', wallet: 'Tiền mặt', note: 'Cơm' }),
  tx({ id: 'shop', type: 'EXPENSE', category: 'Mua sắm', amount: 80, date: '2026-11-05', wallet: 'Ngân hàng', linkedWallet: 'Ví điện tử', note: 'Máy giặt' }),
  tx({ id: 'move', type: 'EXPENSE', category: 'Chuyển khoản đi', amount: 999, date: '2026-07-09', wallet: 'Ngân hàng' }),
  tx({ id: 'late', type: 'EXPENSE', category: 'Ăn uống', amount: 5, date: '2026-12-01', wallet: 'Tiền mặt' }),
];

describe('range helpers', () => {
  it('counts inclusive days and calendar months', () => {
    expect(inclusiveDayCount('2026-01-01', '2026-12-31')).toBe(365);
    expect(monthsInRange('2026-07-15', '2026-09-02')).toEqual(['2026-07', '2026-08', '2026-09']);
  });
});

describe('buildPeriodReport', () => {
  it('summarizes a date range and ignores transfers and opening balances', () => {
    const report = buildPeriodReport({
      transactions: year,
      from: '2026-07-01',
      to: '2026-11-30',
    });

    expect(report.income).toBe(140);
    expect(report.expense).toBe(150);
    expect(report.surplus).toBe(-10);
    expect(report.count).toBe(5);
    expect(report.monthCount).toBe(5);
    expect(report.averageMonthlyExpense).toBe(30);
    expect(report.monthly.map((month) => month.expense)).toEqual([70, 0, 0, 0, 80]);
    expect(report.expenseCategories.map((item) => item.name)).toEqual(['Mua sắm', 'Nhà ở', 'Ăn uống']);
    expect(report.incomeCategories[0]).toMatchObject({ name: 'Lương', amount: 100 });
    expect(report.walletExpenses.find((item) => item.name === 'Ví điện tử').amount).toBe(80);
    expect(report.topExpenses[0]).toMatchObject({ id: 'shop', amount: 80, wallet: 'Ví điện tử' });
    expect(report.trends[0]).toMatchObject({ name: 'Mua sắm' });
    expect(report.trends[0].points).toHaveLength(5);
  });

  it('filters by the wallet that actually moved', () => {
    const report = buildPeriodReport({
      transactions: year,
      from: '2026-01-01',
      to: '2026-12-31',
      wallet: 'Tiền mặt',
    });

    expect(report.income).toBe(40);
    expect(report.expense).toBe(25);
    expect(report.topExpenses.map((item) => item.id)).toEqual(['food', 'late']);
  });

  it('keeps an empty month inside the chosen range', () => {
    const report = buildPeriodReport({
      transactions: year,
      from: '2026-05-01',
      to: '2026-06-30',
    });
    expect(report.monthly).toHaveLength(2);
    expect(report.income).toBe(0);
    expect(report.expense).toBe(0);
    expect(report.savingsRate).toBe(0);
  });
});
