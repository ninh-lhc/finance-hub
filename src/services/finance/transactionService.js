import { doc, writeBatch, increment, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import {
  combineBalanceImpacts,
  getTransactionBalanceImpact,
  getTransactionDeleteBalanceImpact,
  getTransactionUpdateBalanceImpact,
  getTransferBalanceImpact,
} from '../../logic/transactionBalance.js';

function applyWalletBalanceIncrements(batch, settingsRef, impacts) {
  const wbUpdates = {};
  for (const [w, delta] of impacts) {
    if (delta !== 0) wbUpdates[w] = increment(delta);
  }
  if (Object.keys(wbUpdates).length > 0) {
    batch.set(settingsRef, { walletBalances: wbUpdates }, { merge: true });
  }
}

export async function saveTransactionToFirestore({
  getCollectionRef,
  getDocRef,
  payload,
  editingTransactionId,
  originalTransaction,
  isTransferCreate,
  transferFromWallet,
  transferToWallet,
  transferNote,
}) {
  const [y, m] = payload.date.split('-');
  const actualCol = `transactions_${y}_${m}`;
  const settingsRef = getDocRef('settings', 'general');
  const batch = writeBatch(db);

  if (isTransferCreate) {
    const transferId = Date.now().toString();

    const txOutRef = doc(getCollectionRef(actualCol));
    batch.set(txOutRef, {
      ...payload,
      type: 'EXPENSE',
      category: 'Chuyển khoản đi',
      note: `Chuyển tới ${transferToWallet}: ${transferNote || ''}`,
      createdAt: new Date().toISOString(),
      transferId,
    });

    const txInRef = doc(getCollectionRef(actualCol));
    batch.set(txInRef, {
      ...payload,
      type: 'INCOME',
      wallet: transferToWallet,
      category: 'Chuyển khoản đến',
      note: `Nhận từ ${transferFromWallet}: ${transferNote || ''}`,
      createdAt: new Date().toISOString(),
      transferId,
    });

    const impacts = getTransferBalanceImpact({
      fromWallet: transferFromWallet,
      toWallet: transferToWallet,
      amount: payload.amount,
    });
    applyWalletBalanceIncrements(batch, settingsRef, impacts);
    await batch.commit();
    return;
  }

  const impacts =
    editingTransactionId && originalTransaction
      ? getTransactionUpdateBalanceImpact({
          previousTransaction: originalTransaction,
          nextTransaction: payload,
        })
      : getTransactionBalanceImpact(payload);

  if (editingTransactionId) {
    const [oldY, oldM] = (originalTransaction?.date || '').split('-');
    if (originalTransaction && `${oldY}_${oldM}` !== `${y}_${m}`) {
      batch.delete(getDocRef(`transactions_${oldY}_${oldM}`, editingTransactionId));
      batch.set(getDocRef(actualCol, editingTransactionId), payload);
    } else {
      batch.update(getDocRef(actualCol, editingTransactionId), payload);
    }
  } else {
    payload.createdAt = new Date().toISOString();
    const newTxRef = doc(getCollectionRef(actualCol));
    batch.set(newTxRef, payload);
  }

  applyWalletBalanceIncrements(batch, settingsRef, impacts);
  await batch.commit();
}

export async function deleteTransactionFromFirestore({
  getCollectionRef,
  getDocRef,
  collectionName,
  documentId,
  transaction,
}) {
  const batch = writeBatch(db);
  const settingsRef = getDocRef('settings', 'general');

  if (transaction.transferId) {
    const q = query(getCollectionRef(collectionName), where('transferId', '==', transaction.transferId));
    const snap = await getDocs(q);
    let impacts = combineBalanceImpacts();
    snap.docs.forEach((docSnap) => {
      impacts = combineBalanceImpacts(impacts, getTransactionDeleteBalanceImpact(docSnap.data()));
      batch.delete(docSnap.ref);
    });

    applyWalletBalanceIncrements(batch, settingsRef, impacts);
    await batch.commit();
    return { kind: 'transfer_pair' };
  }

  const impacts = getTransactionDeleteBalanceImpact(transaction);
  applyWalletBalanceIncrements(batch, settingsRef, impacts);
  batch.delete(getDocRef(collectionName, documentId));
  await batch.commit();
  return { kind: 'single' };
}
