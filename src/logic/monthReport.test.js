import { describe, expect, it } from 'vitest';
import { buildMonthReport, transactionsForCategory } from './monthReport.js';

const tx = (partial) => ({
  id: partial.id,
  type: partial.type,
  category: partial.category,
  amount: partial.amount,
  date: partial.date,
  note: partial.note,
});

describe('buildMonthReport', () => {
  const current = [
    tx({ id: 'in', type: 'INCOME', category: 'Lương', amount: 100, date: '2026-11-01' }),
    tx({ id: 'open', type: 'INCOME', category: 'Số dư đầu kỳ', amount: 999, date: '2026-11-01' }),
    tx({ id: 'food', type: 'EXPENSE', category: 'Ăn uống', amount: 40, date: '2026-11-02', note: 'Cơm' }),
    tx({ id: 'food-2', type: 'EXPENSE', category: 'Ăn uống', amount: 10, date: '2026-11-03', note: 'Cafe' }),
    tx({ id: 'move', type: 'EXPENSE', category: 'Chuyển khoản đi', amount: 70, date: '2026-11-04' }),
  ];
  const previous = [
    tx({ id: 'p-in', type: 'INCOME', category: 'Lương', amount: 80, date: '2026-10-01' }),
    tx({ id: 'p-food', type: 'EXPENSE', category: 'Ăn uống', amount: 20, date: '2026-10-02' }),
  ];
  const samePeriod = [
    tx({ id: 'y-in', type: 'INCOME', category: 'Lương', amount: 90, date: '2025-11-01' }),
    tx({ id: 'y-food', type: 'EXPENSE', category: 'Ăn uống', amount: 25, date: '2025-11-02' }),
    tx({ id: 'y-bill', type: 'EXPENSE', category: 'Hóa đơn', amount: 15, date: '2025-11-03' }),
  ];

  it('compares totals with the previous month and the same month last year', () => {
    const report = buildMonthReport({
      currentTransactions: current,
      previousTransactions: previous,
      samePeriodTransactions: samePeriod,
      selectedYear: 2026,
      selectedMonth: 10,
      ready: true,
      samePeriodReady: true,
    });

    expect(report.income).toBe(100);
    expect(report.expense).toBe(50);
    expect(report.surplus).toBe(50);
    expect(report.previousMonth).toBe(9);
    expect(report.samePeriodYear).toBe(2025);
    expect(report.incomeDelta.percent).toBe(25);
    expect(report.expenseDelta.percent).toBe(150);
    expect(report.incomeSamePeriodDelta.percent).toBeCloseTo(11.111, 2);
    expect(report.samePeriodExpense).toBe(40);
    expect(report.expenseCategories.find((item) => item.name === 'Ăn uống')).toMatchObject({
      current: 50,
      previous: 20,
      samePeriod: 25,
    });
    expect(report.incomeCategories.map((item) => item.name)).toEqual(['Lương']);
    expect(report.expenseCategories.some((item) => item.name === 'Chuyển khoản đi')).toBe(false);
  });

  it('hides same-period figures until that month is ready', () => {
    const report = buildMonthReport({
      currentTransactions: current,
      previousTransactions: previous,
      samePeriodTransactions: samePeriod,
      selectedYear: 2026,
      selectedMonth: 10,
      ready: true,
      samePeriodReady: false,
    });

    expect(report.samePeriodIncome).toBeNull();
    expect(report.incomeSamePeriodDelta).toBeNull();
    expect(report.expenseCategories.find((item) => item.name === 'Ăn uống').samePeriod).toBe(0);
    expect(report.issues.some((issue) => issue.id === 'income-same-period')).toBe(false);
  });

  it('flags an income drop, a spending-rate jump, and a category that grew', () => {
    const report = buildMonthReport({
      currentTransactions: [
        tx({ id: 'in', type: 'INCOME', category: 'Lương', amount: 80, date: '2026-11-01' }),
        tx({ id: 'food', type: 'EXPENSE', category: 'Ăn uống', amount: 40, date: '2026-11-02' }),
        tx({ id: 'food-2', type: 'EXPENSE', category: 'Ăn uống', amount: 24, date: '2026-11-03' }),
      ],
      previousTransactions: [
        tx({ id: 'p-in', type: 'INCOME', category: 'Lương', amount: 100, date: '2026-10-01' }),
        tx({ id: 'p-food', type: 'EXPENSE', category: 'Ăn uống', amount: 40, date: '2026-10-02' }),
      ],
      samePeriodTransactions: [],
      selectedYear: 2026,
      selectedMonth: 10,
      ready: true,
      samePeriodReady: true,
    });

    expect(report.issues.map((issue) => issue.id)).toEqual(expect.arrayContaining([
      'income-previous',
      'expense-ratio',
      'expense-previous-Ăn uống',
    ]));
  });

  it('flags a new category only when it is a meaningful share of spending', () => {
    const report = buildMonthReport({
      currentTransactions: [
        tx({ id: 'in', type: 'INCOME', category: 'Lương', amount: 100, date: '2026-11-01' }),
        tx({ id: 'rent', type: 'EXPENSE', category: 'Nhà', amount: 20, date: '2026-11-02' }),
        tx({ id: 'snack', type: 'EXPENSE', category: 'Ăn vặt', amount: 2, date: '2026-11-03' }),
      ],
      previousTransactions: [
        tx({ id: 'p-in', type: 'INCOME', category: 'Lương', amount: 100, date: '2026-10-01' }),
      ],
      samePeriodTransactions: [],
      selectedYear: 2026,
      selectedMonth: 10,
      ready: true,
      samePeriodReady: true,
    });

    expect(report.issues.some((issue) => issue.id === 'expense-new-Nhà')).toBe(true);
    expect(report.issues.some((issue) => issue.id === 'expense-new-Ăn vặt')).toBe(false);
  });

  it('flags a same-period category jump when the previous month did not', () => {
    const report = buildMonthReport({
      currentTransactions: [
        tx({ id: 'food', type: 'EXPENSE', category: 'Ăn uống', amount: 40, date: '2026-11-02' }),
      ],
      previousTransactions: [
        tx({ id: 'p-food', type: 'EXPENSE', category: 'Ăn uống', amount: 36, date: '2026-10-02' }),
      ],
      samePeriodTransactions: [
        tx({ id: 'y-food', type: 'EXPENSE', category: 'Ăn uống', amount: 20, date: '2025-11-02' }),
      ],
      selectedYear: 2026,
      selectedMonth: 10,
      ready: true,
      samePeriodReady: true,
    });

    expect(report.issues.map((issue) => issue.id)).toContain('expense-same-period-Ăn uống');
    expect(report.issues.some((issue) => issue.id === 'expense-previous-Ăn uống')).toBe(false);
  });

  it('flags one transaction that dominates its category, and a lone large expense', () => {
    const shared = buildMonthReport({
      currentTransactions: [
        tx({ id: 'big', type: 'EXPENSE', category: 'Ăn uống', amount: 70, date: '2026-11-02', note: 'Nhà hàng' }),
        tx({ id: 'small', type: 'EXPENSE', category: 'Ăn uống', amount: 30, date: '2026-11-03', note: 'Cơm' }),
      ],
      previousTransactions: [],
      samePeriodTransactions: [],
      selectedYear: 2026,
      selectedMonth: 10,
      ready: true,
      samePeriodReady: true,
    });
    expect(shared.issues.some((issue) => issue.id === 'dominant-big')).toBe(true);
    expect(shared.issues.some((issue) => issue.id === 'dominant-month-big')).toBe(false);

    const lone = buildMonthReport({
      currentTransactions: [
        tx({ id: 'rent', type: 'EXPENSE', category: 'Nhà', amount: 40, date: '2026-11-02', note: 'Thuê nhà' }),
        tx({ id: 'food', type: 'EXPENSE', category: 'Ăn uống', amount: 60, date: '2026-11-03' }),
      ],
      previousTransactions: [],
      samePeriodTransactions: [],
      selectedYear: 2026,
      selectedMonth: 10,
      ready: true,
      samePeriodReady: true,
    });
    expect(lone.issues.some((issue) => issue.id === 'dominant-month-food')).toBe(true);
    expect(lone.issues.some((issue) => issue.id.startsWith('dominant-food'))).toBe(false);

    const steady = buildMonthReport({
      currentTransactions: [
        tx({ id: 'rent', type: 'EXPENSE', category: 'Nhà', amount: 40, date: '2026-11-02', note: 'Thuê nhà' }),
        tx({ id: 'food', type: 'EXPENSE', category: 'Ăn uống', amount: 10, date: '2026-11-03' }),
      ],
      previousTransactions: [
        tx({ id: 'p-rent', type: 'EXPENSE', category: 'Nhà', amount: 40, date: '2026-10-02' }),
        tx({ id: 'p-food', type: 'EXPENSE', category: 'Ăn uống', amount: 10, date: '2026-10-03' }),
      ],
      samePeriodTransactions: [],
      selectedYear: 2026,
      selectedMonth: 10,
      ready: true,
      samePeriodReady: true,
    });
    expect(steady.issues.some((issue) => issue.id.startsWith('dominant'))).toBe(false);
  });

  it('keeps the six largest issues', () => {
    const currentTransactions = [
      tx({ id: 'in', type: 'INCOME', category: 'Lương', amount: 100000, date: '2026-11-01' }),
      ...Array.from({ length: 8 }, (_, index) => tx({
        id: `c-${index}`,
        type: 'EXPENSE',
        category: `Mục ${index}`,
        amount: (index + 1) * 100,
        date: '2026-11-02',
      })),
    ];
    const previousTransactions = [
      tx({ id: 'p-in', type: 'INCOME', category: 'Lương', amount: 100000, date: '2026-10-01' }),
      ...Array.from({ length: 8 }, (_, index) => tx({
        id: `p-${index}`,
        type: 'EXPENSE',
        category: `Mục ${index}`,
        amount: 10,
        date: '2026-10-02',
      })),
    ];
    const report = buildMonthReport({
      currentTransactions,
      previousTransactions,
      samePeriodTransactions: [],
      selectedYear: 2026,
      selectedMonth: 10,
      ready: true,
      samePeriodReady: true,
    });

    expect(report.issues).toHaveLength(6);
    expect(report.issues[0].category).toBe('Mục 7');
  });

  it('stays quiet until the month snapshot is ready', () => {
    const report = buildMonthReport({
      currentTransactions: current,
      previousTransactions: previous,
      samePeriodTransactions: samePeriod,
      selectedYear: 2026,
      selectedMonth: 10,
      ready: false,
      samePeriodReady: false,
    });
    expect(report.ready).toBe(false);
    expect(report.issues).toEqual([]);
  });
});

describe('transactionsForCategory', () => {
  it('returns counted transactions for one category, newest first', () => {
    const rows = transactionsForCategory([
      tx({ id: 'a', type: 'EXPENSE', category: 'Ăn uống', amount: 10, date: '2026-11-01' }),
      tx({ id: 'b', type: 'EXPENSE', category: 'Ăn uống', amount: 30, date: '2026-11-03' }),
      tx({ id: 'c', type: 'EXPENSE', category: 'Nhà', amount: 40, date: '2026-11-02' }),
      tx({ id: 'd', type: 'EXPENSE', category: 'Chuyển khoản đi', amount: 90, date: '2026-11-04' }),
    ], 'EXPENSE', 'Ăn uống');
    expect(rows.map((row) => row.id)).toEqual(['b', 'a']);
  });
});
