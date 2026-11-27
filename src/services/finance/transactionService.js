import { doc, runTransaction, increment, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import {
  combineBalanceImpacts,
  getTransactionBalanceImpact,
  getTransactionDeleteBalanceImpact,
  getTransactionUpdateBalanceImpact,
  getTransferBalanceImpact,
} from '../../logic/transactionBalance.js';
import { netGoalDeltas, readGoalBalanceLink } from '../../logic/goalMovement.js';

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

async function readLinkedGoals(transaction, getDocRef, rows) {
  const ids = [...new Set(rows.map((row) => row.goalId).filter(Boolean))];
  const snapshots = await Promise.all(ids.map((id) => transaction.get(getDocRef('goals', id))));
  return new Map(ids.flatMap((id, index) => snapshots[index].exists() ? [[id, snapshots[index].data()]] : []));
}

function stampGoalRevision(row, goals) {
  return { ...row, goalBalanceRevision: goals.get(row.goalId)?.balanceRevision || '' };
}

function applyGoalDeltas(batch, getDocRef, previousRows, nextRows, goals) {
  const previous = previousRows.map((row) => readGoalBalanceLink(row, goals.get(row.goalId)));
  for (const row of nextRows) {
    if (row.goalId && !goals.has(row.goalId)) throw new Error('Linked goal no longer exists');
  }
  const next = nextRows.map((row) => readGoalBalanceLink(row, goals.get(row.goalId)));
  for (const { goalId, delta } of netGoalDeltas(previous, next)) {
    if (!goals.has(goalId)) continue;
    if (nextRows.some((row) => row.goalId === goalId && row.goalDelta < 0)
      && Number(goals.get(goalId).amount || 0) + delta < 0) {
      throw new Error('Insufficient goal balance');
    }
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
}) {
  const [y, m] = payload.date.split('-');
  const actualCol = `transactions_${y}_${m}`;
  const settingsRef = getDocRef('settings', 'general');
  if (isTransferCreate) {
    const outLink = transferGoalOut || { goalId: '', goalDelta: 0 };
    const inLink = transferGoalIn || { goalId: '', goalDelta: 0 };
    const stored = withoutGoalFormFields(payload);

    const txOutRef = doc(getCollectionRef(actualCol));
    const txInRef = doc(getCollectionRef(actualCol));
    const transferId = txOutRef.id;
    const createdAt = new Date().toISOString();
    const outgoing = {
      ...stored,
      type: 'EXPENSE',
      category: 'Chuyển khoản đi',
      note: `Chuyển tới ${transferToWallet}: ${transferNote || ''}`,
      createdAt,
      transferId,
      goalId: outLink.goalId,
      goalDelta: outLink.goalDelta,
    };

    const incoming = {
      ...stored,
      type: 'INCOME',
      wallet: transferToWallet,
      category: 'Chuyển khoản đến',
      note: `Nhận từ ${transferFromWallet}: ${transferNote || ''}`,
      createdAt,
      transferId,
      goalId: inLink.goalId,
      goalDelta: inLink.goalDelta,
    };

    const impacts = getTransferBalanceImpact({
      fromWallet: transferFromWallet,
      toWallet: transferToWallet,
      amount: payload.amount,
    });
    await runTransaction(db, async (transaction) => {
      const goals = await readLinkedGoals(transaction, getDocRef, [outgoing, incoming]);
      transaction.set(txOutRef, stampGoalRevision(outgoing, goals));
      transaction.set(txInRef, stampGoalRevision(incoming, goals));
      applyWalletBalanceIncrements(transaction, settingsRef, impacts);
      applyGoalDeltas(transaction, getDocRef, [], [stampGoalRevision(outgoing, goals), stampGoalRevision(incoming, goals)], goals);
    });
    return;
  }

  const destinationRef = editingTransactionId
    ? getDocRef(actualCol, editingTransactionId)
    : doc(getCollectionRef(actualCol));
  const previousCollection = originalTransaction?.date
    ? `transactions_${originalTransaction.date.slice(0, 7).replace('-', '_')}`
    : actualCol;
  const originalRef = editingTransactionId ? getDocRef(previousCollection, editingTransactionId) : null;
  const createdAt = new Date().toISOString();
  await runTransaction(db, async (transaction) => {
    const previous = originalRef ? (await transaction.get(originalRef)).data() : null;
    if (originalRef && !previous) throw new Error('Transaction was moved or deleted');
    const goals = await readLinkedGoals(transaction, getDocRef, previous ? [previous, payload] : [payload]);
    const next = stampGoalRevision({ ...previous, ...payload, createdAt: previous?.createdAt || createdAt }, goals);
    if (next.goalId && previous?.goalId === next.goalId) {
      next.goalBalanceRevision = previous.goalBalanceRevision || '';
    }
    if (originalRef && previousCollection !== actualCol) transaction.delete(originalRef);
    transaction.set(destinationRef, next);
    const impacts = previous
      ? getTransactionUpdateBalanceImpact({ previousTransaction: previous, nextTransaction: next })
      : getTransactionBalanceImpact(next);
    applyWalletBalanceIncrements(transaction, settingsRef, impacts);
    applyGoalDeltas(transaction, getDocRef, previous ? [previous] : [], [next], goals);
  });
  return destinationRef.id;
}

export async function deleteTransactionFromFirestore({
  getCollectionRef,
  getDocRef,
  collectionName,
  documentId,
  transaction,
}) {
  const settingsRef = getDocRef('settings', 'general');
  const refs = transaction.transferId
    ? (await getDocs(query(getCollectionRef(collectionName), where('transferId', '==', transaction.transferId)))).docs.map((item) => item.ref)
    : [getDocRef(collectionName, documentId)];
  await runTransaction(db, async (batch) => {
    const snapshots = (await Promise.all(refs.map((ref) => batch.get(ref)))).filter((snapshot) => snapshot.exists());
    const rows = snapshots.map((snapshot) => snapshot.data());
    const goals = await readLinkedGoals(batch, getDocRef, rows);
    for (const snapshot of snapshots) batch.delete(snapshot.ref);
    const repaymentId = rows.find((row) => row.fundRepaymentId)?.fundRepaymentId;
    if (repaymentId) {
      batch.delete(getDocRef('fundRepayments', repaymentId));
      batch.set(getDocRef('fundRepayments', 'borrow_state'), {
        latestPayment: doc(getCollectionRef('fundRepayments')).id,
      });
    }

    applyWalletBalanceIncrements(batch, settingsRef, combineBalanceImpacts(...rows.map(getTransactionDeleteBalanceImpact)));
    applyGoalDeltas(batch, getDocRef, rows, [], goals);
  });
  return { kind: transaction.transferId ? 'transfer_pair' : 'single' };
}
