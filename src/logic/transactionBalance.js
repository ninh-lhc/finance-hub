/**
 * Pure wallet balance deltas. Positive = balance increases, negative = decreases.
 * Representation: Map<walletName, number>
 */

export function combineBalanceImpacts(...impacts) {
  const merged = new Map();
  for (const impact of impacts) {
    if (!impact) continue;
    for (const [wallet, delta] of impact) {
      merged.set(wallet, (merged.get(wallet) || 0) + delta);
    }
  }
  return merged;
}

function withDelta(impact, wallet, amount) {
  if (!wallet) return new Map(impact);
  const next = new Map(impact);
  next.set(wallet, (next.get(wallet) || 0) + amount);
  return next;
}

/** Apply balance effect of one persisted INCOME/EXPENSE transaction (not transfer pair). */
export function getTransactionBalanceImpact(transaction) {
  const amount = Number(transaction?.amount || 0);
  let impact = new Map();
  if (transaction?.type === 'INCOME') {
    impact = withDelta(impact, transaction.wallet, amount);
  } else if (transaction?.type === 'EXPENSE') {
    const wallet = transaction.linkedWallet || transaction.wallet;
    impact = withDelta(impact, wallet, -amount);
  }
  return impact;
}

/** Reverse one transaction (edit undo / delete), matching App addImpact on delete. */
export function getTransactionDeleteBalanceImpact(transaction) {
  const amount = Number(transaction?.amount || 0);
  const wallet =
    transaction?.type === 'EXPENSE'
      ? transaction.linkedWallet || transaction.wallet
      : transaction.wallet;
  const delta = transaction?.type === 'EXPENSE' ? amount : -amount;
  return withDelta(new Map(), wallet, delta);
}

/** Undo previous transaction and apply next (edit save path). */
export function getTransactionUpdateBalanceImpact({ previousTransaction, nextTransaction }) {
  let impact = new Map();

  if (previousTransaction) {
    const oldWallet =
      previousTransaction.type === 'EXPENSE'
        ? previousTransaction.linkedWallet || previousTransaction.wallet
        : previousTransaction.wallet;
    const oldDelta =
      previousTransaction.type === 'EXPENSE'
        ? Number(previousTransaction.amount || 0)
        : -Number(previousTransaction.amount || 0);
    impact = withDelta(impact, oldWallet, oldDelta);
  }

  const newWallet =
    nextTransaction.type === 'EXPENSE'
      ? nextTransaction.linkedWallet || nextTransaction.wallet
      : nextTransaction.wallet;
  const newDelta =
    nextTransaction.type === 'EXPENSE'
      ? -Number(nextTransaction.amount || 0)
      : Number(nextTransaction.amount || 0);
  impact = withDelta(impact, newWallet, newDelta);

  return impact;
}

/** Internal transfer: fromWallet decreases, toWallet increases. */
export function getTransferBalanceImpact({ fromWallet, toWallet, amount }) {
  const value = Number(amount || 0);
  let impact = new Map();
  impact = withDelta(impact, fromWallet, -value);
  impact = withDelta(impact, toWallet, value);
  return impact;
}
