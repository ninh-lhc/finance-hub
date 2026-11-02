/**
 * Pure wallet balance maintenance from transaction history (no Firestore/React).
 */

export function getBalanceHistoryCollectionNames(currentYear) {
  const names = [];
  for (let y = currentYear - 5; y <= currentYear + 1; y += 1) {
    for (let m = 1; m <= 12; m += 1) {
      names.push(`transactions_${y}_${String(m).padStart(2, '0')}`);
    }
  }
  return names;
}

export function applyTransactionToWalletBalances(balances, transaction) {
  const data = transaction;
  const next = { ...balances };
  const wIn = data.type === 'INCOME' ? data.wallet : null;
  const wOut = data.type === 'EXPENSE' ? (data.linkedWallet || data.wallet) : null;
  const amount = Number(data.amount || 0);

  if (wIn) {
    next[wIn] = (next[wIn] || 0) + amount;
  }
  if (wOut) {
    next[wOut] = (next[wOut] || 0) - amount;
  }
  return next;
}

export function calculateWalletBalances({ wallets, transactions }) {
  let exactBalances = {};
  for (const data of transactions) {
    exactBalances = applyTransactionToWalletBalances(exactBalances, data);
  }
  (wallets || []).forEach((w) => {
    if (exactBalances[w] === undefined) {
      exactBalances[w] = 0;
    }
  });
  return exactBalances;
}

export function transactionReferencesWallet({ transaction, walletName }) {
  if (!transaction) return false;
  return transaction.wallet === walletName || transaction.linkedWallet === walletName;
}

export function historyHasWalletReferences({ transactions, walletName }) {
  for (const tx of transactions) {
    if (transactionReferencesWallet({ transaction: tx, walletName })) {
      return true;
    }
  }
  return false;
}
