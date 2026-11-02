import { getDocs, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import {
  getBalanceHistoryCollectionNames,
  calculateWalletBalances,
  historyHasWalletReferences,
} from '../../logic/balanceMaintenance.js';

async function fetchAllHistoryTransactions(getCollectionRef, currentYear) {
  const collectionNames = getBalanceHistoryCollectionNames(currentYear);
  const allSnaps = await Promise.all(
    collectionNames.map((name) => getDocs(getCollectionRef(name))),
  );
  const transactions = [];
  allSnaps.forEach((snap) => {
    snap.docs.forEach((docSnap) => {
      transactions.push(docSnap.data());
    });
  });
  return { transactions, collectionCount: collectionNames.length };
}

export async function recalculateWalletBalancesInFirestore({
  getCollectionRef,
  getDocRef,
  wallets,
  currentYear = new Date().getFullYear(),
}) {
  const { transactions, collectionCount } = await fetchAllHistoryTransactions(
    getCollectionRef,
    currentYear,
  );

  const walletBalances = calculateWalletBalances({ wallets, transactions });
  const settingsRef = getDocRef('settings', 'general');
  const snapSettings = await getDoc(settingsRef);

  if (snapSettings.exists()) {
    await updateDoc(settingsRef, { walletBalances });
  } else {
    await setDoc(settingsRef, { walletBalances }, { merge: true });
  }

  return {
    walletBalances,
    transactionCount: transactions.length,
    collectionCount,
  };
}

export async function resetWalletBalanceInFirestore({
  getCollectionRef,
  getDocRef,
  walletName,
  currentYear = new Date().getFullYear(),
}) {
  const { transactions } = await fetchAllHistoryTransactions(
    getCollectionRef,
    currentYear,
  );

  if (historyHasWalletReferences({ transactions, walletName })) {
    return { reset: false, hasReferences: true };
  }

  await setDoc(
    getDocRef('settings', 'general'),
    { walletBalances: { [walletName]: 0 } },
    { merge: true },
  );
  return { reset: true, hasReferences: false };
}
