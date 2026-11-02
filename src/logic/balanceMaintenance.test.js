import { describe, it, expect } from 'vitest';
import {
  getBalanceHistoryCollectionNames,
  applyTransactionToWalletBalances,
  calculateWalletBalances,
  transactionReferencesWallet,
  historyHasWalletReferences,
} from './balanceMaintenance.js';

describe('getBalanceHistoryCollectionNames', () => {
  it('returns 84 collections for 7 years x 12 months', () => {
    expect(getBalanceHistoryCollectionNames(2026)).toHaveLength(84);
  });

  it('starts at currentYear - 5', () => {
    expect(getBalanceHistoryCollectionNames(2026)[0]).toBe('transactions_2021_01');
  });

  it('ends at currentYear + 1 December', () => {
    const names = getBalanceHistoryCollectionNames(2026);
    expect(names[names.length - 1]).toBe('transactions_2027_12');
  });

  it('zero-pads months', () => {
    const names = getBalanceHistoryCollectionNames(2020);
    expect(names).toContain('transactions_2015_09');
    expect(names).toContain('transactions_2021_12');
  });
});

describe('applyTransactionToWalletBalances', () => {
  it('INCOME increases wallet', () => {
    expect(
      applyTransactionToWalletBalances({}, {
        type: 'INCOME',
        wallet: 'A',
        amount: 100,
      }),
    ).toEqual({ A: 100 });
  });

  it('EXPENSE decreases wallet', () => {
    expect(
      applyTransactionToWalletBalances({ A: 100 }, {
        type: 'EXPENSE',
        wallet: 'A',
        amount: 40,
      }),
    ).toEqual({ A: 60 });
  });

  it('EXPENSE uses linkedWallet when set', () => {
    expect(
      applyTransactionToWalletBalances({ A: 100, B: 50 }, {
        type: 'EXPENSE',
        wallet: 'A',
        linkedWallet: 'B',
        amount: 30,
      }),
    ).toEqual({ A: 100, B: 20 });
  });

  it('handles amount 0', () => {
    expect(
      applyTransactionToWalletBalances({ A: 5 }, {
        type: 'INCOME',
        wallet: 'A',
        amount: 0,
      }),
    ).toEqual({ A: 5 });
  });

  it('does not mutate input balances', () => {
    const balances = { A: 1 };
    applyTransactionToWalletBalances(balances, {
      type: 'INCOME',
      wallet: 'A',
      amount: 1,
    });
    expect(balances).toEqual({ A: 1 });
  });
});

describe('calculateWalletBalances', () => {
  it('accumulates multiple transactions on same wallet', () => {
    const txs = [
      { type: 'INCOME', wallet: 'A', amount: 100 },
      { type: 'EXPENSE', wallet: 'A', amount: 30 },
    ];
    expect(calculateWalletBalances({ wallets: ['A'], transactions: txs })).toEqual({
      A: 70,
    });
  });

  it('initializes listed wallets to 0 when no transactions', () => {
    expect(
      calculateWalletBalances({ wallets: ['A', 'B'], transactions: [] }),
    ).toEqual({ A: 0, B: 0 });
  });

  it('handles empty wallets list', () => {
    expect(calculateWalletBalances({ wallets: [], transactions: [] })).toEqual({});
  });

  it('transfer legs net across wallets', () => {
    const txs = [
      { type: 'EXPENSE', wallet: 'A', category: 'Chuyển khoản đi', amount: 500 },
      { type: 'INCOME', wallet: 'B', category: 'Chuyển khoản đến', amount: 500 },
    ];
    expect(calculateWalletBalances({ wallets: ['A', 'B'], transactions: txs })).toEqual({
      A: -500,
      B: 500,
    });
  });

  it('opening balance as INCOME', () => {
    const txs = [
      { type: 'INCOME', wallet: 'A', category: 'Số dư đầu kỳ', amount: 1000000 },
    ];
    expect(calculateWalletBalances({ wallets: ['A'], transactions: txs })).toEqual({
      A: 1000000,
    });
  });

  it('keeps ghost wallet keys from transactions not in wallet list', () => {
    const txs = [{ type: 'INCOME', wallet: 'Ghost', amount: 10 }];
    expect(calculateWalletBalances({ wallets: ['A'], transactions: txs })).toEqual({
      Ghost: 10,
      A: 0,
    });
  });

  it('does not mutate transactions array', () => {
    const txs = [{ type: 'INCOME', wallet: 'A', amount: 1 }];
    const copy = [...txs];
    calculateWalletBalances({ wallets: ['A'], transactions: txs });
    expect(txs).toEqual(copy);
  });
});

describe('transactionReferencesWallet', () => {
  it('matches wallet field', () => {
    expect(
      transactionReferencesWallet({
        transaction: { wallet: 'X', linkedWallet: '' },
        walletName: 'X',
      }),
    ).toBe(true);
  });

  it('matches linkedWallet field', () => {
    expect(
      transactionReferencesWallet({
        transaction: { wallet: 'A', linkedWallet: 'X' },
        walletName: 'X',
      }),
    ).toBe(true);
  });

  it('returns false when no match', () => {
    expect(
      transactionReferencesWallet({
        transaction: { wallet: 'A', linkedWallet: 'B' },
        walletName: 'C',
      }),
    ).toBe(false);
  });

  it('does not mutate transaction', () => {
    const transaction = { wallet: 'A' };
    const copy = { ...transaction };
    transactionReferencesWallet({ transaction, walletName: 'A' });
    expect(transaction).toEqual(copy);
  });
});

describe('historyHasWalletReferences', () => {
  it('detects reference in list', () => {
    expect(
      historyHasWalletReferences({
        transactions: [{ wallet: 'W', linkedWallet: '' }],
        walletName: 'W',
      }),
    ).toBe(true);
  });

  it('returns false when empty', () => {
    expect(
      historyHasWalletReferences({ transactions: [], walletName: 'W' }),
    ).toBe(false);
  });
});
