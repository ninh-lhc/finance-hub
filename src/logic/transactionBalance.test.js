import { describe, it, expect } from 'vitest';
import {
  combineBalanceImpacts,
  getTransactionBalanceImpact,
  getTransactionDeleteBalanceImpact,
  getTransactionUpdateBalanceImpact,
  getTransferBalanceImpact,
} from './transactionBalance.js';

const toObject = (map) => Object.fromEntries(map);

describe('combineBalanceImpacts', () => {
  it('merges separate wallets', () => {
    const a = new Map([['A', 100]]);
    const b = new Map([['B', -50]]);
    expect(toObject(combineBalanceImpacts(a, b))).toEqual({ A: 100, B: -50 });
  });

  it('nets deltas on the same wallet', () => {
    const a = new Map([['A', 100]]);
    const b = new Map([['A', -30]]);
    expect(toObject(combineBalanceImpacts(a, b))).toEqual({ A: 70 });
  });

  it('returns empty map when no impacts provided', () => {
    expect(combineBalanceImpacts().size).toBe(0);
  });

  it('does not mutate input maps', () => {
    const a = new Map([['A', 10]]);
    const snapshot = toObject(a);
    combineBalanceImpacts(a, new Map([['A', 5]]));
    expect(toObject(a)).toEqual(snapshot);
  });
});

describe('getTransactionBalanceImpact', () => {
  it('increases wallet for INCOME', () => {
    const tx = { type: 'INCOME', wallet: 'Tiền mặt', amount: 1000 };
    expect(toObject(getTransactionBalanceImpact(tx))).toEqual({ 'Tiền mặt': 1000 });
  });

  it('decreases wallet for EXPENSE', () => {
    const tx = { type: 'EXPENSE', wallet: 'Tiền mặt', amount: 500 };
    expect(toObject(getTransactionBalanceImpact(tx))).toEqual({ 'Tiền mặt': -500 });
  });

  it('uses linkedWallet for EXPENSE when set', () => {
    const tx = { type: 'EXPENSE', wallet: 'Tiền mặt', linkedWallet: 'Ngân hàng', amount: 300 };
    expect(toObject(getTransactionBalanceImpact(tx))).toEqual({ 'Ngân hàng': -300 });
  });

  it('does not mutate input transaction', () => {
    const tx = { type: 'INCOME', wallet: 'A', amount: 1 };
    const copy = { ...tx };
    getTransactionBalanceImpact(tx);
    expect(tx).toEqual(copy);
  });
});

describe('getTransactionUpdateBalanceImpact', () => {
  it('adjusts amount on same INCOME wallet', () => {
    const prev = { type: 'INCOME', wallet: 'A', amount: 1000 };
    const next = { type: 'INCOME', wallet: 'A', amount: 1500 };
    expect(toObject(getTransactionUpdateBalanceImpact({ previousTransaction: prev, nextTransaction: next }))).toEqual({ A: 500 });
  });

  it('adjusts amount on same EXPENSE wallet', () => {
    const prev = { type: 'EXPENSE', wallet: 'A', amount: 200 };
    const next = { type: 'EXPENSE', wallet: 'A', amount: 500 };
    expect(toObject(getTransactionUpdateBalanceImpact({ previousTransaction: prev, nextTransaction: next }))).toEqual({ A: -300 });
  });

  it('handles wallet change', () => {
    const prev = { type: 'EXPENSE', wallet: 'A', amount: 100 };
    const next = { type: 'EXPENSE', wallet: 'B', amount: 100 };
    expect(toObject(getTransactionUpdateBalanceImpact({ previousTransaction: prev, nextTransaction: next }))).toEqual({ A: 100, B: -100 });
  });

  it('handles INCOME to EXPENSE', () => {
    const prev = { type: 'INCOME', wallet: 'A', amount: 1000 };
    const next = { type: 'EXPENSE', wallet: 'A', amount: 400 };
    expect(toObject(getTransactionUpdateBalanceImpact({ previousTransaction: prev, nextTransaction: next }))).toEqual({ A: -1400 });
  });

  it('handles EXPENSE to INCOME', () => {
    const prev = { type: 'EXPENSE', wallet: 'A', amount: 400 };
    const next = { type: 'INCOME', wallet: 'A', amount: 1000 };
    expect(toObject(getTransactionUpdateBalanceImpact({ previousTransaction: prev, nextTransaction: next }))).toEqual({ A: 1400 });
  });

  it('handles linked wallet change on EXPENSE', () => {
    const prev = { type: 'EXPENSE', wallet: 'A', linkedWallet: 'B', amount: 100 };
    const next = { type: 'EXPENSE', wallet: 'A', linkedWallet: 'C', amount: 100 };
    expect(toObject(getTransactionUpdateBalanceImpact({ previousTransaction: prev, nextTransaction: next }))).toEqual({ B: 100, C: -100 });
  });

  it('applies only next transaction when previous is absent', () => {
    const next = { type: 'INCOME', wallet: 'A', amount: 250 };
    expect(toObject(getTransactionUpdateBalanceImpact({ previousTransaction: null, nextTransaction: next }))).toEqual({ A: 250 });
  });
});

describe('getTransactionDeleteBalanceImpact', () => {
  it('reverses INCOME', () => {
    const tx = { type: 'INCOME', wallet: 'A', amount: 800 };
    expect(toObject(getTransactionDeleteBalanceImpact(tx))).toEqual({ A: -800 });
  });

  it('reverses EXPENSE', () => {
    const tx = { type: 'EXPENSE', wallet: 'A', amount: 300 };
    expect(toObject(getTransactionDeleteBalanceImpact(tx))).toEqual({ A: 300 });
  });

  it('reverses EXPENSE with linked wallet', () => {
    const tx = { type: 'EXPENSE', wallet: 'A', linkedWallet: 'B', amount: 300 };
    expect(toObject(getTransactionDeleteBalanceImpact(tx))).toEqual({ B: 300 });
  });
});

describe('getTransferBalanceImpact', () => {
  it('moves amount from source to destination', () => {
    expect(toObject(getTransferBalanceImpact({ fromWallet: 'A', toWallet: 'B', amount: 1000 }))).toEqual({ A: -1000, B: 1000 });
  });

  it('nets to zero across wallets', () => {
    const impact = getTransferBalanceImpact({ fromWallet: 'A', toWallet: 'B', amount: 500 });
    const total = [...impact.values()].reduce((s, v) => s + v, 0);
    expect(total).toBe(0);
  });

  it('nets same wallet to zero when from and to match', () => {
    expect(toObject(getTransferBalanceImpact({ fromWallet: 'A', toWallet: 'A', amount: 500 }))).toEqual({ A: 0 });
  });
});
