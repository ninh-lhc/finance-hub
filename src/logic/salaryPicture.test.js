import { describe, expect, it } from 'vitest';
import {
  buildSalaryPicture,
  isEmergencyGoal,
  salaryPictureLines,
  listFlowItems,
  unpaidFundOffers,
  monthlyFundRepaymentOffers,
  outstandingFundLoans,
  buildFinanceContext,
  unpaidTransferDebt,
} from './salaryPicture.js';

const tx = (partial) => ({ amount: 0, goalId: '', goalDelta: 0, ...partial });

describe('buildSalaryPicture', () => {
  const goals = [{ id: 'emergency', name: 'Quỹ khẩn cấp' }];

  it('recognizes an emergency fund by name', () => {
    expect(isEmergencyGoal({ name: 'Quỹ khẩn cấp' })).toBe(true);
    expect(isEmergencyGoal({ name: 'Mua nhà' })).toBe(false);
  });

  it('turns the extra reimbursement into commission and drops the matched pass-through', () => {
    const picture = buildSalaryPicture({
      goals,
      transactions: [
        tx({ type: 'INCOME', category: 'Lương', amount: 9_700_000, date: '2026-11-01' }),
        tx({ type: 'INCOME', category: 'Thu nợ/Hoàn ứng', amount: 4_300_000, date: '2026-11-05' }),
        tx({ type: 'EXPENSE', category: 'Chi hộ', amount: 3_342_750, date: '2026-11-03' }),
        tx({ type: 'EXPENSE', category: 'Ăn uống', amount: 1_000_000, date: '2026-11-04' }),
      ],
    });

    expect(picture.income).toBe(9_700_000 + 957_250);
    expect(picture.expense).toBe(1_000_000);
    expect(picture.commission).toBe(957_250);
    expect(picture.matched).toBe(3_342_750);
    expect(picture.surplus).toBe(picture.income - picture.expense);
  });

  it('keeps an unpaid chi hộ out of personal spending', () => {
    const picture = buildSalaryPicture({
      transactions: [
        tx({ type: 'INCOME', category: 'Lương', amount: 100 }),
        tx({ type: 'EXPENSE', category: 'Chi hộ', amount: 40 }),
      ],
    });
    expect(picture.income).toBe(100);
    expect(picture.expense).toBe(0);
    expect(picture.unreimbursed).toBe(40);
  });

  it('treats a personal emergency-fund expense as a loan, and chi hộ from that fund as chi hộ', () => {
    const picture = buildSalaryPicture({
      goals,
      transactions: [
        tx({ type: 'EXPENSE', category: 'Hóa đơn', amount: 1_200_000, goalId: 'emergency', goalDelta: -1_200_000 }),
        tx({ type: 'EXPENSE', category: 'Chi hộ', amount: 500_000, goalId: 'emergency', goalDelta: -500_000 }),
        tx({ type: 'EXPENSE', category: 'Ăn uống', amount: 300_000, goalId: 'save', goalDelta: -300_000 }),
      ],
    });
    expect(picture.expense).toBe(300_000);
    expect(picture.fundBorrow).toBe(1_200_000);
    expect(picture.helpedFromFund).toBe(500_000);
    expect(picture.fundBorrowByGoal).toEqual({ emergency: 1_200_000 });
  });

  it('reduces the surplus by a confirmed fund repayment without treating it as spending', () => {
    const picture = buildSalaryPicture({
      repaid: 1_200_000,
      transactions: [
        tx({ type: 'INCOME', category: 'Lương', amount: 9_700_000 }),
        tx({ type: 'EXPENSE', category: 'Ăn uống', amount: 1_000_000 }),
      ],
    });
    expect(picture.expense).toBe(1_000_000);
    expect(picture.surplus).toBe(9_700_000 - 1_000_000 - 1_200_000);
  });

  it('offers only the part of last month that has not been repaid', () => {
    const offers = unpaidFundOffers({
      year: 2026,
      month: 10,
      goals,
      transactions: [
        tx({ type: 'EXPENSE', category: 'Hóa đơn', amount: 2_000_000, goalId: 'emergency', goalDelta: -2_000_000, date: '2026-11-02' }),
      ],
      repayments: [
        { goalId: 'emergency', kind: 'borrow', debtYear: 2026, debtMonth: 10, amount: 500_000 },
      ],
    });
    expect(offers).toEqual([{ goalId: 'emergency', amount: 1_500_000 }]);
  });

  it('carries installments across months and years until the balance is paid', () => {
    const history = [{
      period: '2026-11',
      transactions: [tx({
        type: 'EXPENSE', amount: 2_000_000, goalId: 'emergency', goalDelta: -2_000_000,
      })],
    }];
    const december = {
      goalId: 'emergency', kind: 'borrow', debtYear: 2026, debtMonth: 10,
      amount: 500_000, payDate: '2026-12-01',
    };
    const repayment = { history, goals, repayments: [december] };
    expect(monthlyFundRepaymentOffers({ ...repayment, payDate: '2026-12-15' })).toEqual([]);
    expect(monthlyFundRepaymentOffers({ ...repayment, payDate: '2027-01-01' })).toEqual([
      { goalId: 'emergency', amount: 1_500_000, debtYear: 2026, debtMonth: 10 },
    ]);
    expect(monthlyFundRepaymentOffers({
      ...repayment,
      repayments: [december, { ...december, amount: 1_500_000, payDate: '2027-01-01' }],
      payDate: '2027-02-01',
    })).toEqual([]);
  });

  it('shows new borrowing after a monthly payment and proposes the older balance first next month', () => {
    const borrow = (date, amount) => tx({
      type: 'EXPENSE', category: 'Mua sắm', date, amount, goalId: 'emergency', goalDelta: -amount,
    });
    const history = [
      { period: '2026-11', transactions: [borrow('2026-11-20', 4_000_000)] },
      { period: '2026-12', transactions: [borrow('2026-12-15', 1_000_000)] },
    ];
    const novemberDebt = { goalId: 'emergency', debtYear: 2026, debtMonth: 10 };
    const decemberDebt = { goalId: 'emergency', debtYear: 2026, debtMonth: 11 };
    const repayments = [{ ...novemberDebt, kind: 'borrow', amount: 2_000_000, payDate: '2026-12-05' }];
    const options = { history, goals, repayments };
    const remaining = [
      { ...novemberDebt, amount: 2_000_000 },
      { ...decemberDebt, amount: 1_000_000 },
    ];

    expect(outstandingFundLoans({ ...options, through: '2026-12-14' })).toEqual(remaining.slice(0, 1));
    expect(outstandingFundLoans({ ...options, through: '2026-12-31' })).toEqual(remaining);
    expect(monthlyFundRepaymentOffers({ ...options, payDate: '2026-12-20' })).toEqual([]);
    expect(monthlyFundRepaymentOffers({ ...options, payDate: '2027-01-05' })).toEqual(remaining);
    expect(outstandingFundLoans({
      ...options,
      through: '2027-01-05',
      repayments: [
        ...repayments,
        { ...novemberDebt, kind: 'borrow', amount: 2_000_000, payDate: '2027-01-05' },
        { ...decemberDebt, kind: 'borrow', amount: 500_000, payDate: '2027-01-05' },
      ],
    })).toEqual([{ ...decemberDebt, amount: 500_000 }]);
  });

  it('owes the full fund transfer and leaves the unspent remainder out of income', () => {
    const picture = buildSalaryPicture({
      goals,
      transactions: [
        tx({ type: 'EXPENSE', category: 'Chuyển khoản đi', amount: 1_500_000, wallet: 'Viettel Pay', goalId: 'emergency', goalDelta: -1_500_000, date: '2026-11-10', transferId: 'move-1' }),
        tx({ type: 'INCOME', category: 'Chuyển khoản đến', amount: 1_500_000, wallet: 'Agribank', date: '2026-11-10', transferId: 'move-1' }),
        tx({ type: 'EXPENSE', category: 'Ăn uống', amount: 100_000, wallet: 'Agribank', date: '2026-11-09' }),
        tx({ type: 'EXPENSE', category: 'Mua sắm', amount: 1_352_254, wallet: 'Agribank', date: '2026-11-12' }),
      ],
    });
    expect(picture.fundBorrow).toBe(1_500_000);
    expect(picture.expense).toBe(100_000);
    expect(picture.commission).toBe(0);
    expect(picture.income).toBe(0);
    expect(picture.fundedSpendByCategory).toEqual({ 'Mua sắm': 1_352_254 });
    expect(picture.fundBorrowByGoal).toEqual({});
  });

  it('reconciles old transfers, manual returns and installment records without counting a paired return twice', () => {
    const history = [
      { period: '2026-09', transactions: Object.freeze([Object.freeze(tx({
        type: 'EXPENSE', category: 'Chuyển khoản đi', date: '2026-09-01',
        goalId: 'emergency', goalDelta: -1000, amount: 1000,
      }))]) },
      { period: '2026-10', transactions: [
        tx({ type: 'INCOME', category: 'Chuyển khoản đến', date: '2026-10-01', goalId: 'emergency', goalDelta: 200, amount: 200 }),
        tx({ type: 'INCOME', category: 'Chuyển khoản đến', date: '2026-10-05', goalId: 'emergency', goalDelta: 300, amount: 300, fundRepaymentId: 'installment' }),
      ] },
    ];
    const repayments = [
      { kind: 'borrow', goalId: 'emergency', debtYear: 2026, debtMonth: 8, amount: 300, payDate: '2026-10-05' },
    ];
    const options = { history, goals, repayments };
    expect(outstandingFundLoans({ ...options, through: '2026-10-02' })[0].amount).toBe(800);
    expect(monthlyFundRepaymentOffers({ ...options, payDate: '2026-11-01' })[0].amount).toBe(500);
    expect(monthlyFundRepaymentOffers({
      ...options,
      payDate: '2026-10-02',
      repayments: [{ ...repayments[0], amount: 800 }],
    })).toEqual([]);
    expect(buildSalaryPicture({ transactions: history[1].transactions, goals, repaid: 300 }).repaid).toBe(500);
  });

  it('settles several advances and attributes only the excess to each receiving wallet', () => {
    const advances = [70, 45].map((amount, i) => tx({ id: String(i), type: 'EXPENSE',
      category: 'Chi hộ', amount, date: '2026-11-01', wallet: 'A' }));
    const receipt = (id, date, amount, wallet) => tx({ id, date, amount, wallet,
      type: 'INCOME', category: 'Thu nợ/Hoàn ứng' });
    const receipts = [receipt('a', '2026-11-02', 50, 'B'), receipt('b', '2026-11-03', 80, 'A'),
      receipt('c', '2026-11-04', 20, 'B')];
    const transactions = [...receipts, ...advances];
    const context = buildFinanceContext(transactions, []);
    expect(context.reconcile(transactions)).toMatchObject({ matched: 115, commission: 35, unreimbursed: 0 });
    expect(context.reconcile(advances, '2026-11-02').unreimbursed).toBe(65);
    expect(receipts.map((item) => context.receipt(item).commission)).toEqual([0, 15, 20]);
    expect(context.reconcile(transactions.filter((item) => item.wallet === 'B')).commission).toBe(20);
  });

  it('settles equal advances oldest first unless a receipt is explicitly linked', () => {
    const first = tx({ id: 'first', type: 'EXPENSE', category: 'Chi hộ', date: '2026-10-01', amount: 100 });
    const second = tx({ id: 'second', type: 'EXPENSE', category: 'Chi hộ', date: '2026-10-02', amount: 100 });
    const receipt = tx({ id: 'receipt', type: 'INCOME', category: 'Thu nợ/Hoàn ứng', date: '2026-11-01', amount: 100 });
    const context = buildFinanceContext([first, second, receipt], goals);
    expect(buildSalaryPicture({ transactions: [receipt], context })).toMatchObject({
      commission: 0, matched: 100, unmatchedReimbursement: 0,
    });
    expect(context.receipt(receipt).allocations).toEqual([{ expense: first, amount: 100 }]);
    const linked = buildFinanceContext([first, second, receipt], goals, [{ receiptKey: 'receipt', expenseKey: 'second' }]);
    expect(buildSalaryPicture({ transactions: [receipt], context: linked })).toMatchObject({
      commission: 0, matched: 100, unmatchedReimbursement: 0,
    });
    expect(buildSalaryPicture({ transactions: [second], context: linked }).unreimbursed).toBe(100);
  });

  it('uses one receipt for multiple advances even when a newer one matches its note and amount', () => {
    const first = tx({ id: 'old', date: '2026-11-30', type: 'EXPENSE', category: 'Chi hộ', amount: 60 });
    const second = tx({ id: 'new', date: '2026-12-01', type: 'EXPENSE', category: 'Chi hộ', amount: 100, note: 'Đi chợ' });
    const payment = tx({ id: 'receipt', date: '2026-12-02', type: 'INCOME', category: 'Thu nợ/Hoàn ứng', amount: 100, note: 'Đi chợ' });
    const last = { ...payment, id: 'last', date: '2026-12-03', amount: 80 };
    const context = buildFinanceContext([last, second, payment, first], goals);
    expect(context.receipt(payment)).toMatchObject({ commission: 0, allocations: [
      { expense: first, amount: 60 }, { expense: second, amount: 40 },
    ] });
    expect(context.receipt(last)).toMatchObject({ matched: 60, commission: 20 });
  });

  it('allows correcting automatic allocations after later same-day payments', () => {
    const expense = (id) => tx({ id, date: '2026-11-30', type: 'EXPENSE', category: 'Chi hộ', amount: 100 });
    const first = expense('x');
    const second = expense('y');
    const receipt = (id, amount) => tx({ id, date: '2026-12-01', type: 'INCOME', category: 'Thu nợ/Hoàn ứng', amount });
    const early = receipt('a', 100);
    const late = receipt('b', 200);
    const rows = [late, first, early, second];
    const auto = buildFinanceContext(rows, goals);
    expect(auto.candidates(early)).toEqual([first, second]);
    expect(auto.candidates(late)).toEqual([second]);
    const linked = buildFinanceContext(rows, goals, [{ receiptKey: 'a', expenseKey: 'y' }]);
    expect(linked.candidates(late)).toEqual([first]);
    const flow = listFlowItems([early, late], goals, linked);
    expect(flow.reimbursements.find(({ id }) => id === 'a')).toMatchObject({
      linkedExpenseKey: 'y', allocations: [{ expense: second, amount: 100 }],
    });
    expect(linked.reconcile(rows)).toMatchObject({ matched: 200, commission: 100, unreimbursed: 0 });
    expect(linked.reconcile([first, second], '2026-11-30').unreimbursed).toBe(200);
  });

  it('applies the remainder of a targeted repayment to later open borrowing from the same fund', () => {
    const borrow = (date) => tx({ type: 'EXPENSE', category: 'Mua sắm', date, goalId: 'emergency', goalDelta: -100, amount: 100 });
    const history = [
      { period: '2026-10', transactions: [borrow('2026-10-01')] },
      { period: '2026-11', transactions: [
        borrow('2026-11-01'),
        tx({ type: 'INCOME', category: 'Chuyển khoản đến', date: '2026-11-05', goalId: 'emergency', goalDelta: 100, amount: 100 }),
      ] },
    ];
    const repayments = [{ kind: 'borrow', goalId: 'emergency', debtYear: 2026, debtMonth: 9, amount: 100, payDate: '2026-11-10' }];
    expect(outstandingFundLoans({ history, goals, repayments, through: '2026-11-30' })).toEqual([]);
  });

  it('keeps an earlier automatic partial match when a later receipt is explicitly linked', () => {
    const spent = tx({ id: 'help', type: 'EXPENSE', category: 'Chi hộ', date: '2026-10-01', amount: 100, note: 'Order 1' });
    const first = tx({ id: 'first', type: 'INCOME', category: 'Thu nợ/Hoàn ứng', date: '2026-10-02', amount: 40, note: 'Order 1' });
    const second = tx({ id: 'second', type: 'INCOME', category: 'Thu nợ/Hoàn ứng', date: '2026-10-03', amount: 60 });
    const transactions = [spent, first, second];
    const context = buildFinanceContext(transactions, goals, [{ receiptKey: 'second', expenseKey: 'help' }]);
    expect(context.reconcile(transactions)).toMatchObject({ matched: 100, unreimbursed: 0, unmatchedReimbursement: 0 });
  });

  it('counts a transfer back into the fund as the repayment', () => {
    const picture = buildSalaryPicture({
      goals,
      transactions: [
        tx({ type: 'INCOME', category: 'Lương', amount: 9_700_000, date: '2026-12-01' }),
        tx({ type: 'EXPENSE', category: 'Chuyển khoản đi', amount: 1_500_000, wallet: 'Agribank', date: '2026-12-02', transferId: 'back-1' }),
        tx({ type: 'INCOME', category: 'Chuyển khoản đến', amount: 1_500_000, wallet: 'Viettel Pay', goalId: 'emergency', goalDelta: 1_500_000, date: '2026-12-02', transferId: 'back-1' }),
      ],
    });
    expect(picture.income).toBe(9_700_000);
    expect(picture.expense).toBe(0);
    expect(picture.repaid).toBe(1_500_000);
    expect(picture.surplus).toBe(9_700_000 - 1_500_000);
  });

  it('clears the carried fund transfer once the money returns', () => {
    const past = [
      tx({ id: 'out', type: 'EXPENSE', category: 'Chuyển khoản đi', amount: 1_500_000, wallet: 'Viettel Pay', goalId: 'emergency', goalDelta: -1_500_000, date: '2026-11-10', transferId: 'move-1' }),
    ];
    const returned = [
      tx({ id: 'back', type: 'INCOME', category: 'Chuyển khoản đến', amount: 1_500_000, wallet: 'Viettel Pay', goalId: 'emergency', goalDelta: 1_500_000, date: '2026-12-02', transferId: 'back-1' }),
    ];
    expect(unpaidTransferDebt({ pastTransactions: past, laterTransactions: [], goals, year: 2026, month: 11 })).toBe(1_500_000);
    expect(unpaidTransferDebt({ pastTransactions: past, laterTransactions: returned, goals, year: 2026, month: 11 })).toBe(0);
  });

  it('lists the chi hộ lines and the fund transfer that paid for later spending', () => {
    const goals = [{ id: 'emergency', name: 'Quỹ khẩn cấp' }];
    const shopee = tx({ id: 'shop', type: 'EXPENSE', category: 'Mua sắm', amount: 1_352_254, wallet: 'Agribank', date: '2026-11-12', note: 'Shopee' });
    const flow = listFlowItems([
      tx({ id: 'out', type: 'EXPENSE', category: 'Chuyển khoản đi', amount: 1_500_000, wallet: 'Viettel Pay', goalId: 'emergency', goalDelta: -1_500_000, date: '2026-11-10', transferId: 'move-1' }),
      tx({ id: 'in', type: 'INCOME', category: 'Chuyển khoản đến', amount: 1_500_000, wallet: 'Agribank', date: '2026-11-10', transferId: 'move-1' }),
      tx({ id: 'help', type: 'EXPENSE', category: 'Chi hộ', amount: 3_342_750, wallet: 'Viettel Pay', date: '2026-11-03' }),
      tx({ id: 'back', type: 'INCOME', category: 'Thu nợ/Hoàn ứng', amount: 4_300_000, wallet: 'Viettel Pay', date: '2026-11-05' }),
      shopee,
    ], goals);
    expect(flow.helped.map((item) => item.amount)).toEqual([3_342_750]);
    expect(flow.reimbursements.map((item) => item.amount)).toEqual([4_300_000]);
    expect(flow.transfers[0].toWallet).toBe('Agribank');
    expect(flow.spends.map((item) => item.amount)).toEqual([1_352_254]);
    expect(flow.spent).toBe(1_352_254);
    expect(flow.remainder).toBe(1_500_000 - 1_352_254);
  });

  it('writes the glance lines', () => {
    const lines = salaryPictureLines({
      matched: 100,
      commission: 20,
      unreimbursed: 0,
      fundBorrow: 50,
      outstandingBorrow: 80,
      repaid: 0,
    });
    expect(lines[0]).toMatch(/Chi hộ/);
    expect(lines[1]).toMatch(/Hoa hồng/);
    expect(lines[2]).toMatch(/Mượn quỹ/);
    expect(lines[3]).toMatch(/Còn nợ quỹ/);
  });
});
