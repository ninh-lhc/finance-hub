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
    expect(report.drilldown.expense['Mua sắm'].map((item) => item.id)).toEqual(['shop']);
    expect(report.drilldown.income['Lương'].map((item) => item.amount)).toEqual([100]);
    expect(report.drilldown.wallet['Ví điện tử'].map((item) => item.id)).toEqual(['shop']);
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

  it('uses the same historical funding and repayment filters for totals, charts and details', () => {
    const goal = { id: 'e', name: 'Quỹ khẩn cấp', wallet: 'A' };
    const outgoing = { id: 'out', type: 'EXPENSE', category: 'Chuyển khoản đi', date: '2026-10-01', amount: 100, wallet: 'A', transferId: 't', goalId: 'e', goalDelta: -100 };
    const incoming = { id: 'in', type: 'INCOME', category: 'Chuyển khoản đến', date: '2026-10-01', amount: 100, wallet: 'B', transferId: 't' };
    const spend = { id: 'spend', type: 'EXPENSE', category: 'Mua sắm', date: '2026-11-20', amount: 150, wallet: 'B' };
    const history = [{ period: '2026-10', transactions: [outgoing, incoming] }, { period: '2026-11', transactions: [spend] }];
    const repayments = [
      { kind: 'borrow', payDate: '2026-11-01', amount: 20, sourceWallet: 'B' },
      { kind: 'borrow', payDate: '2026-11-21', amount: 20, sourceWallet: 'A' },
    ];
    const report = buildPeriodReport({
      transactions: [spend], history, goals: [goal], repayments, wallet: 'B', from: '2026-11-15', to: '2026-11-30',
    });
    expect(report).toMatchObject({ expense: 50, surplus: -50, topExpenses: [{ id: 'spend', amount: 50 }] });
    expect(report.monthly[0]).toMatchObject({ expense: 50, surplus: -50 });
    expect(report.drilldown.wallet.B[0].amount).toBe(50);
  });
});
