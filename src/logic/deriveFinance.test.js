import { describe, it, expect, vi, afterEach } from 'vitest';
import { deriveFinanceLogic, deriveTransactionView } from './deriveFinance.js';
import { THEME } from '../constants/theme.js';

const FIXED_NOW = new Date('2026-06-15T12:00:00');

const createBaseInput = (overrides = {}) => ({
  transactions: [],
  annualTransactions: [],
  walletBalances: {},
  selectedMonth: 5,
  selectedYear: 2026,
  wallets: [],
  categories: { INCOME: ['Lương'], EXPENSE: ['Ăn uống', 'Di chuyển'] },
  annualSelectedMonth: 'ALL',
  goals: [],
  budgets: [],
  ...overrides,
});

const tx = (partial) => ({
  id: partial.id,
  type: partial.type,
  category: partial.category,
  amount: partial.amount,
  date: partial.date,
  wallet: partial.wallet ?? 'Tiền mặt',
  note: partial.note ?? '',
  createdAt: partial.createdAt ?? `${partial.date}T08:00:00.000Z`,
});

describe('deriveFinanceLogic', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('month income and expense invariants', () => {
    it('sums regular income/expense and excludes transfer and opening balance categories', () => {
      vi.useFakeTimers();
      vi.setSystemTime(FIXED_NOW);

      const transactions = [
        tx({ id: 'inc1', type: 'INCOME', category: 'Lương', amount: 10_000, date: '2026-06-10' }),
        tx({ id: 'exp1', type: 'EXPENSE', category: 'Ăn uống', amount: 2_000, date: '2026-06-11' }),
        tx({ id: 'xfer-in', type: 'INCOME', category: 'Chuyển khoản đến', amount: 5_000, date: '2026-06-12' }),
        tx({ id: 'xfer-out', type: 'EXPENSE', category: 'Chuyển khoản đi', amount: 3_000, date: '2026-06-12' }),
        tx({ id: 'open', type: 'INCOME', category: 'Số dư đầu kỳ', amount: 99_999, date: '2026-06-01' }),
      ];
      const input = createBaseInput({ transactions });
      const result = deriveFinanceLogic(input);

      expect(result.income).toBe(10_000);
      expect(result.expense).toBe(2_000);
    });

    it('does not mutate the transactions array passed in', () => {
      vi.useFakeTimers();
      vi.setSystemTime(FIXED_NOW);

      const transactions = [
        tx({ id: 'a', type: 'EXPENSE', category: 'Ăn uống', amount: 100, date: '2026-06-05' }),
        tx({ id: 'b', type: 'INCOME', category: 'Lương', amount: 200, date: '2026-06-06' }),
      ];
      const snapshot = JSON.stringify(transactions);
      deriveFinanceLogic(createBaseInput({ transactions }));
      expect(JSON.stringify(transactions)).toBe(snapshot);
    });
  });

  describe('wallet balances and spendable balance', () => {
    it('sums globalBal only for wallets in the active wallet list', () => {
      const result = deriveFinanceLogic(createBaseInput({
        wallets: ['Tiền mặt', 'Ngân hàng'],
        walletBalances: { 'Tiền mặt': 1_000, 'Ngân hàng': 500, 'Ví cũ': 9_999 },
      }));

      expect(result.globalBal).toBe(1_500);
    });

    it('computes spendableBal as globalBal minus locked goal amounts', () => {
      const result = deriveFinanceLogic(createBaseInput({
        wallets: ['Tiền mặt'],
        walletBalances: { 'Tiền mặt': 10_000 },
        goals: [
          { id: 'g1', name: 'A', target: 20_000, amount: 3_000 },
          { id: 'g2', name: 'B', target: 10_000, amount: 2_000 },
        ],
      }));

      expect(result.totalGoalsAmount).toBe(5_000);
      expect(result.spendableBal).toBe(5_000);
    });

    it('shows locked goal money on the wallet that holds it', () => {
      const result = deriveFinanceLogic(createBaseInput({
        wallets: ['Agribank', 'ViettelPay'],
        walletBalances: { Agribank: 20_000_000, ViettelPay: 12_000_000 },
        goals: [
          { id: 'g1', name: 'Tiết kiệm', target: 50_000_000, amount: 8_000_000, wallet: 'ViettelPay' },
          { id: 'g2', name: 'Quỹ khẩn cấp', target: 4_000_000, amount: 4_000_000, wallet: 'ViettelPay' },
        ],
      }));
      const viettel = result.fullWalletList.find((wallet) => wallet.name === 'ViettelPay');
      expect(viettel.locked).toBe(12_000_000);
      expect(viettel.spendable).toBe(0);
      expect(viettel.locks.map((lock) => lock.name)).toEqual(['Tiết kiệm', 'Quỹ khẩn cấp']);
      expect(result.fullWalletList.find((wallet) => wallet.name === 'Agribank').locked).toBe(0);
    });
  });

  describe('charts and grouping', () => {
    it('groups expense chart by category excluding transfers out', () => {
      vi.useFakeTimers();
      vi.setSystemTime(FIXED_NOW);

      const transactions = [
        tx({ id: 'e1', type: 'EXPENSE', category: 'Ăn uống', amount: 300, date: '2026-06-10' }),
        tx({ id: 'e2', type: 'EXPENSE', category: 'Ăn uống', amount: 200, date: '2026-06-11' }),
        tx({ id: 'e3', type: 'EXPENSE', category: 'Di chuyển', amount: 100, date: '2026-06-12' }),
        tx({ id: 'xfer', type: 'EXPENSE', category: 'Chuyển khoản đi', amount: 999, date: '2026-06-12' }),
      ];
      const result = deriveFinanceLogic(createBaseInput({ transactions }));

      expect(result.expenseChart).toHaveLength(2);
      expect(result.expenseChart[0]).toMatchObject({ name: 'Ăn uống', value: 500 });
      expect(result.expenseChart[1]).toMatchObject({ name: 'Di chuyển', value: 100 });
    });

    it('builds full wallet list from wallet names and balances', () => {
      const result = deriveFinanceLogic(createBaseInput({
        wallets: ['Tiền mặt', 'Ngân hàng'],
        walletBalances: { 'Tiền mặt': 800, 'Ngân hàng': 0 },
      }));

      expect(result.fullWalletList).toHaveLength(2);
      expect(result.fullWalletList.find((w) => w.name === 'Tiền mặt').value).toBe(800);
      expect(result.fullWalletList.find((w) => w.name === 'Tiền mặt').locked).toBe(0);
      expect(result.walletChart).toHaveLength(1);
      expect(result.walletChart[0].name).toBe('Tiền mặt');
    });
  });

  describe('goals and budgets', () => {
    it('selects priority goal with highest progress ratio', () => {
      const result = deriveFinanceLogic(createBaseInput({
        goals: [
          { id: 'g1', name: 'Low', target: 100, amount: 10 },
          { id: 'g2', name: 'High', target: 100, amount: 80 },
        ],
      }));

      expect(result.priorityGoal.name).toBe('High');
    });

    it('computes budget progress and warning status color', () => {
      vi.useFakeTimers();
      vi.setSystemTime(FIXED_NOW);

      const transactions = [
        tx({ id: 'e1', type: 'EXPENSE', category: 'Ăn uống', amount: 800, date: '2026-06-10' }),
      ];
      const result = deriveFinanceLogic(createBaseInput({
        transactions,
        budgets: [{ id: 'b1', category: 'Ăn uống', amount: 1_000 }],
      }));

      expect(result.budgetProgress[0].currentSpent).toBe(800);
      expect(result.budgetProgress[0].percent).toBe(80);
      expect(result.budgetProgress[0].statusColor).toBe(THEME.warning);
    });
  });

  describe('annualData scope', () => {
    it('aggregates annual scope totals and excludes transfer/opening balance from income/expense', () => {
      vi.useFakeTimers();
      vi.setSystemTime(FIXED_NOW);

      const annualTransactions = [
        tx({ id: 'a1', type: 'INCOME', category: 'Lương', amount: 5_000, date: '2026-03-10' }),
        tx({ id: 'a2', type: 'EXPENSE', category: 'Ăn uống', amount: 1_000, date: '2026-03-15' }),
        tx({ id: 'a3', type: 'INCOME', category: 'Số dư đầu kỳ', amount: 2_000, date: '2026-01-01' }),
        tx({ id: 'a4', type: 'EXPENSE', category: 'Chuyển khoản đi', amount: 500, date: '2026-04-01' }),
        tx({ id: 'a5', type: 'INCOME', category: 'Lương', amount: 3_000, date: '2025-12-01' }),
      ];

      const result = deriveFinanceLogic(createBaseInput({
        selectedYear: 2026,
        annualTransactions,
        annualSelectedMonth: 'ALL',
      }));

      expect(result.annualData.scopeIncome).toBe(5_000);
      expect(result.annualData.scopeExpense).toBe(1_000);
      expect(result.annualData.scopeSurplus).toBe(4_000);
      expect(result.annualData.scopeInitialBalance).toBe(2_000);
    });

    it('filters annual scope to a selected month index', () => {
      vi.useFakeTimers();
      vi.setSystemTime(FIXED_NOW);

      const annualTransactions = [
        tx({ id: 'm3', type: 'INCOME', category: 'Lương', amount: 1_000, date: '2026-03-10' }),
        tx({ id: 'm4', type: 'INCOME', category: 'Lương', amount: 2_000, date: '2026-04-10' }),
      ];

      const result = deriveFinanceLogic(createBaseInput({
        annualTransactions,
        annualSelectedMonth: 2,
      }));

      expect(result.annualData.scopeIncome).toBe(1_000);
      expect(result.annualData.scopeTransactions).toHaveLength(1);
      expect(result.annualData.scopeTransactions[0].id).toBe('m3');
    });
  });

  describe('current month weekly expenses', () => {
    it('marks last day label as Hôm nay and sums expenses for matching dates', () => {
      vi.useFakeTimers();
      vi.setSystemTime(FIXED_NOW);

      const transactions = [
        tx({ id: 'd1', type: 'EXPENSE', category: 'Ăn uống', amount: 100, date: '2026-06-15' }),
        tx({ id: 'd2', type: 'EXPENSE', category: 'Ăn uống', amount: 50, date: '2026-06-14' }),
      ];

      const result = deriveFinanceLogic(createBaseInput({ transactions }));

      expect(result.isCurrentMonthView).toBe(true);
      expect(result.weeklyExpenses).toHaveLength(7);
      expect(result.weeklyExpenses.at(-1).label).toBe('Hôm nay');
      expect(result.weeklyExpenses.at(-1).total).toBe(100);
    });
  });
});

describe('deriveTransactionView', () => {
  const baseTransactions = [
    tx({ id: 't1', type: 'INCOME', category: 'Lương', amount: 5000, date: '2026-06-10', note: 'salary june', wallet: 'Ngân hàng' }),
    tx({ id: 't2', type: 'EXPENSE', category: 'Ăn uống', amount: 120, date: '2026-06-09', note: 'cafe', wallet: 'Tiền mặt' }),
    tx({ id: 't3', type: 'EXPENSE', category: 'Di chuyển', amount: 45000, date: '2026-06-08', note: 'grab', wallet: 'Tiền mặt', createdAt: '2026-06-08T10:00:00.000Z' }),
    tx({ id: 't4', type: 'EXPENSE', category: 'Ăn uống', amount: 45000, date: '2026-06-08', note: 'market', wallet: 'Ngân hàng', createdAt: '2026-06-08T09:00:00.000Z' }),
  ];

  const viewDefaults = {
    searchQuery: '',
    filterType: 'ALL',
    filterWallet: 'ALL',
    filterCategory: 'ALL',
  };

  it('searches by note, category, and numeric amount substring', () => {
    const byNote = deriveTransactionView({ transactions: baseTransactions, ...viewDefaults, searchQuery: 'cafe' });
    expect(byNote.filteredTransactions.map((t) => t.id)).toEqual(['t2']);

    const byCategory = deriveTransactionView({ transactions: baseTransactions, ...viewDefaults, searchQuery: 'di chuyển' });
    expect(byCategory.filteredTransactions.map((t) => t.id)).toEqual(['t3']);

    const byAmount = deriveTransactionView({ transactions: baseTransactions, ...viewDefaults, searchQuery: '45000' });
    expect(byAmount.filteredTransactions.map((t) => t.id).sort()).toEqual(['t3', 't4']);
  });

  it('filters by type, wallet, and category', () => {
    const byType = deriveTransactionView({ transactions: baseTransactions, ...viewDefaults, filterType: 'INCOME' });
    expect(byType.filteredTransactions.map((t) => t.id)).toEqual(['t1']);

    const byWallet = deriveTransactionView({ transactions: baseTransactions, ...viewDefaults, filterWallet: 'Ngân hàng' });
    expect(byWallet.filteredTransactions.map((t) => t.id).sort()).toEqual(['t1', 't4']);

    const byCategory = deriveTransactionView({ transactions: baseTransactions, ...viewDefaults, filterCategory: 'Ăn uống' });
    expect(byCategory.filteredTransactions.map((t) => t.id).sort()).toEqual(['t2', 't4']);
  });

  it('combines filters and search', () => {
    const result = deriveTransactionView({
      transactions: baseTransactions,
      searchQuery: '45',
      filterType: 'EXPENSE',
      filterWallet: 'Tiền mặt',
      filterCategory: 'ALL',
    });

    expect(result.filteredTransactions.map((t) => t.id)).toEqual(['t3']);
  });

  it('sorts by date desc then createdAt desc', () => {
    const result = deriveTransactionView({ transactions: baseTransactions, ...viewDefaults });
    expect(result.filteredTransactions.map((t) => t.id)).toEqual(['t1', 't2', 't3', 't4']);
  });

  it('does not mutate the source transactions array', () => {
    const transactions = [...baseTransactions];
    const snapshot = JSON.stringify(transactions);
    deriveTransactionView({ transactions, ...viewDefaults });
    expect(JSON.stringify(transactions)).toBe(snapshot);
  });
});
