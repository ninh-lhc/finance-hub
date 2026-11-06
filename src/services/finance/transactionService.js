import { doc, writeBatch, increment, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import {
  combineBalanceImpacts,
  getTransactionBalanceImpact,
  getTransactionDeleteBalanceImpact,
  getTransactionUpdateBalanceImpact,
  getTransferBalanceImpact,
} from '../../logic/transactionBalance.js';
import { netGoalDeltas, readGoalLink } from '../../logic/goalMovement.js';

function applyWalletBalanceIncrements(batch, settingsRef, impacts) {
  const wbUpdates = {};
  for (const [w, delta] of impacts) {
    if (delta !== 0) wbUpdates[w] = increment(delta);
  }
  if (Object.keys(wbUpdates).length > 0) {
    batch.set(settingsRef, { walletBalances: wbUpdates }, { merge: true });
  }
}

function withoutGoalFormFields(payload) {
  const stored = { ...payload };
  delete stored.fromGoalId;
  delete stored.toGoalId;
  return stored;
}

function applyGoalDeltas(batch, getDocRef, previousLinks, nextLinks, goals) {
  const known = new Set((goals || []).map((goal) => goal.id));
  for (const { goalId, delta } of netGoalDeltas(previousLinks, nextLinks)) {
    if (!known.has(goalId)) continue;
    batch.update(getDocRef('goals', goalId), { amount: increment(delta) });
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
  transferGoalOut,
  transferGoalIn,
  goals,
}) {
  const [y, m] = payload.date.split('-');
  const actualCol = `transactions_${y}_${m}`;
  const settingsRef = getDocRef('settings', 'general');
  const batch = writeBatch(db);

  if (isTransferCreate) {
    const transferId = Date.now().toString();
    const outLink = transferGoalOut || { goalId: '', goalDelta: 0 };
    const inLink = transferGoalIn || { goalId: '', goalDelta: 0 };
    const stored = withoutGoalFormFields(payload);

    const txOutRef = doc(getCollectionRef(actualCol));
    batch.set(txOutRef, {
      ...stored,
      type: 'EXPENSE',
      category: 'Chuyển khoản đi',
      note: `Chuyển tới ${transferToWallet}: ${transferNote || ''}`,
      createdAt: new Date().toISOString(),
      transferId,
      goalId: outLink.goalId,
      goalDelta: outLink.goalDelta,
    });

    const txInRef = doc(getCollectionRef(actualCol));
    batch.set(txInRef, {
      ...stored,
      type: 'INCOME',
      wallet: transferToWallet,
      category: 'Chuyển khoản đến',
      note: `Nhận từ ${transferFromWallet}: ${transferNote || ''}`,
      createdAt: new Date().toISOString(),
      transferId,
      goalId: inLink.goalId,
      goalDelta: inLink.goalDelta,
    });

    const impacts = getTransferBalanceImpact({
      fromWallet: transferFromWallet,
      toWallet: transferToWallet,
      amount: payload.amount,
    });
    applyWalletBalanceIncrements(batch, settingsRef, impacts);
    applyGoalDeltas(batch, getDocRef, [], [outLink, inLink], goals);
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
  applyGoalDeltas(
    batch,
    getDocRef,
    editingTransactionId ? [readGoalLink(originalTransaction)] : [],
    [readGoalLink(payload)],
    goals,
  );
  await batch.commit();
}

export async function deleteTransactionFromFirestore({
  getCollectionRef,
  getDocRef,
  collectionName,
  documentId,
  transaction,
  goals,
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
    applyGoalDeltas(batch, getDocRef, snap.docs.map((docSnap) => readGoalLink(docSnap.data())), [], goals);
    await batch.commit();
    return { kind: 'transfer_pair' };
  }

  const impacts = getTransactionDeleteBalanceImpact(transaction);
  applyWalletBalanceIncrements(batch, settingsRef, impacts);
  applyGoalDeltas(batch, getDocRef, [readGoalLink(transaction)], [], goals);
  batch.delete(getDocRef(collectionName, documentId));
  await batch.commit();
  return { kind: 'single' };
}
