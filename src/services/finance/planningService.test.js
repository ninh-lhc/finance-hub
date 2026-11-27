import { describe, expect, it, vi } from 'vitest';
import { lockMonthlyFundRepayment, saveGoalToFirestore } from './planningService.js';

const { transaction, runTransaction, updateDoc } = vi.hoisted(() => {
  const transaction = {
    get: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
  };
  return { transaction, runTransaction: vi.fn((_db, write) => write(transaction)), updateDoc: vi.fn() };
});

vi.mock('../firebase/config.js', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  runTransaction,
  updateDoc,
  increment: (amount) => ({ increment: amount }),
  doc: (collection) => ({ collection, id: 'new-document' }),
}));

it('preserves a legacy emergency fund classification when renaming the goal', async () => {
  const goal = { id: 'emergency', name: 'Quỹ khẩn cấp', amount: 300 };
  await saveGoalToFirestore({
    getDocRef: (collection, id) => ({ collection, id }),
    payload: { name: 'Dự phòng', amount: 300 },
    editingId: goal.id,
    previousGoal: goal,
  });
  expect(updateDoc).toHaveBeenCalledWith(
    { collection: 'goals', id: goal.id },
    { name: 'Dự phòng', amount: 300, isEmergencyFund: true },
  );
});

describe('lockMonthlyFundRepayment', () => {
  const request = {
    getCollectionRef: (name) => name,
    getDocRef: (collection, id) => ({ collection, id }),
    plan: [{ goalId: 'emergency', amount: 300, debtYear: 2026, debtMonth: 8 }],
    payDate: '2026-11-01',
    sourceWallet: 'Salary',
    goals: [{ id: 'emergency', wallet: 'Reserve' }],
  };

  it('writes repayment, transfer legs and wallet and fund changes in the same transaction', async () => {
    transaction.get.mockResolvedValue({ exists: () => false, data: () => undefined });
    await lockMonthlyFundRepayment(request);

    expect(transaction.update).toHaveBeenCalledWith({ collection: 'goals', id: 'emergency' }, { amount: { increment: 300 } });
    expect(transaction.set).toHaveBeenCalledWith(
      { collection: 'fundRepayments', id: 'borrow_2026-11' },
      expect.objectContaining({ amount: 300, sourceWallet: 'Salary', destinationWallet: 'Reserve' }),
    );
    for (const [type, wallet] of [['EXPENSE', 'Salary'], ['INCOME', 'Reserve']]) {
      expect(transaction.set).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'transactions_2026_11' }),
        expect.objectContaining({ type, wallet, amount: 300, fundRepaymentId: 'borrow_2026-11' }),
      );
    }
    expect(transaction.set).toHaveBeenCalledWith(
      { collection: 'settings', id: 'general' },
      { walletBalances: { Salary: { increment: -300 }, Reserve: { increment: 300 } } },
      { merge: true },
    );
  });

  it('avoids writing an installment if the repayment state changed while confirming', async () => {
    transaction.set.mockClear();
    transaction.update.mockClear();
    transaction.get.mockResolvedValue({ exists: () => false, data: () => ({ latestPayment: 'newer' }) });
    await expect(lockMonthlyFundRepayment(request)).rejects.toThrow('Fund repayments changed');
    expect(transaction.set).not.toHaveBeenCalled();
    expect(transaction.update).not.toHaveBeenCalled();
  });
});
