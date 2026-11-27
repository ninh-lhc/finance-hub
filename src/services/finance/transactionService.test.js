import { expect, it, vi } from 'vitest';
import { saveTransactionToFirestore } from './transactionService.js';

const { transaction, runTransaction } = vi.hoisted(() => {
  const transaction = { get: vi.fn(), set: vi.fn(), update: vi.fn() };
  return { transaction, runTransaction: vi.fn((_db, write) => write(transaction)) };
});

vi.mock('../firebase/config.js', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  runTransaction,
  increment: (amount) => ({ increment: amount }),
}));

it('calculates an edit from the current stored row when the editing device has an older amount', async () => {
  const original = { type: 'EXPENSE', wallet: 'Cash', date: '2026-11-01', amount: 100 };
  transaction.get.mockResolvedValue({ data: () => ({ ...original, amount: 120 }) });
  await saveTransactionToFirestore({
    getDocRef: (collection, id) => ({ collection, id }),
    payload: { ...original, amount: 130 },
    editingTransactionId: 'receipt',
    originalTransaction: original,
  });
  expect(transaction.set).toHaveBeenCalledWith(
    { collection: 'settings', id: 'general' },
    { walletBalances: { Cash: { increment: -10 } } },
    { merge: true },
  );
});

it('keeps a pre-reset fund link for reporting when correcting the recorded amount', async () => {
  transaction.update.mockClear();
  const original = { type: 'EXPENSE', wallet: 'Cash', date: '2026-11-01', amount: 100, goalId: 'goal', goalDelta: -100 };
  transaction.get.mockImplementation(async ({ collection }) => collection === 'goals'
    ? { exists: () => true, data: () => ({ amount: 20, balanceRevision: 'reset' }) }
    : { data: () => original });
  await saveTransactionToFirestore({
    getDocRef: (collection, id) => ({ collection, id }),
    payload: { ...original, amount: 90, goalDelta: -90 },
    editingTransactionId: 'receipt',
    originalTransaction: original,
  });
  expect(transaction.update).not.toHaveBeenCalled();
  expect(transaction.set).toHaveBeenCalledWith(
    { collection: 'transactions_2026_11', id: 'receipt' },
    expect.objectContaining({ amount: 90, goalId: 'goal', goalDelta: -90, goalBalanceRevision: '' }),
  );
});
