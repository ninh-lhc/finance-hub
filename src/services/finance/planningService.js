import { addDoc, updateDoc, deleteDoc, getDocs, writeBatch, doc, increment, runTransaction } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { getTransactionMonthCollectionNames } from '../../logic/walletCategoryEntities.js';
import { goalLinkDetachPatch } from '../../logic/goalMovement.js';
import { isEmergencyGoal } from '../../logic/salaryPicture.js';

const GOAL_DETACH_BATCH_SIZE = 400;

async function detachGoalLinks({ getCollectionRef, goalId, currentYear }) {
  const collectionNames = getTransactionMonthCollectionNames(currentYear);
  const snaps = await Promise.all(collectionNames.map((name) => getDocs(getCollectionRef(name))));
  const updates = [];
  snaps.forEach((snap) => {
    snap.docs.forEach((docSnap) => {
      const patch = goalLinkDetachPatch(docSnap.data(), goalId);
      if (patch) updates.push({ ref: docSnap.ref, patch });
    });
  });
  for (let index = 0; index < updates.length; index += GOAL_DETACH_BATCH_SIZE) {
    const batch = writeBatch(db);
    updates.slice(index, index + GOAL_DETACH_BATCH_SIZE).forEach(({ ref, patch }) => {
      batch.update(ref, patch);
    });
    await batch.commit();
  }
  return updates.length;
}

export async function saveBudgetToFirestore({
  getCollectionRef,
  getDocRef,
  payload,
  editingId,
}) {
  if (editingId) {
    await updateDoc(getDocRef('budgets', editingId), payload);
    return;
  }
  await addDoc(getCollectionRef('budgets'), payload);
}

export async function saveGoalToFirestore({
  getCollectionRef,
  getDocRef,
  payload,
  editingId,
  detachLinks = false,
  previousGoal,
  currentYear = new Date().getFullYear(),
}) {
  const goalPayload = isEmergencyGoal(previousGoal) || isEmergencyGoal(payload)
    ? { ...payload, isEmergencyFund: true }
    : payload;
  if (editingId) {
    await updateDoc(getDocRef('goals', editingId), goalPayload);
    if (!detachLinks) return { detached: 0 };
    const detached = await detachGoalLinks({ getCollectionRef, goalId: editingId, currentYear });
    return { detached };
  }
  await addDoc(getCollectionRef('goals'), {
    ...goalPayload,
    createdAt: new Date().toISOString(),
  });
}

export async function deleteBudgetFromFirestore({ getDocRef, id }) {
  await deleteDoc(getDocRef('budgets', id));
}

export async function deleteGoalFromFirestore({ getDocRef, id }) {
  await deleteDoc(getDocRef('goals', id));
}

export async function lockFundRepayment({
  getCollectionRef,
  getDocRef,
  goalId,
  amount,
  debtYear,
  debtMonth,
  payDate,
  kind,
  sourceWallet,
  destinationWallet,
  receiptId,
}) {
  const repaymentRef = getDocRef('fundRepayments', `helped_${receiptId}`);
  return runTransaction(db, async (transaction) => {
    if ((await transaction.get(repaymentRef)).exists()) return;
    writeFundPayment(transaction, {
      getCollectionRef, getDocRef, repaymentRef, goalId, amount, debtYear, debtMonth, payDate,
      kind, sourceWallet, destinationWallet, createdAt: new Date().toISOString(),
    });
  });
}

function writeFundPayment(transaction, {
  getCollectionRef, getDocRef, repaymentRef, goalId, amount, debtYear, debtMonth,
  payDate, kind, sourceWallet, destinationWallet, createdAt,
}) {
  transaction.update(getDocRef('goals', goalId), { amount: increment(amount) });
  transaction.set(repaymentRef, {
    goalId, amount, debtYear, debtMonth, payDate, kind, sourceWallet, destinationWallet, createdAt,
  });
  if (sourceWallet === destinationWallet) return;

  const collectionRef = getCollectionRef(`transactions_${payDate.slice(0, 7).replace('-', '_')}`);
  const transfer = { amount, date: payDate, createdAt, transferId: repaymentRef.id, fundRepaymentId: repaymentRef.id, note: 'Hoàn quỹ khẩn cấp' };
  transaction.set(doc(collectionRef), {
    ...transfer, type: 'EXPENSE', category: 'Chuyển khoản đi', wallet: sourceWallet,
  });
  transaction.set(doc(collectionRef), {
    ...transfer, type: 'INCOME', category: 'Chuyển khoản đến', wallet: destinationWallet,
    goalId, goalDelta: amount,
  });
  transaction.set(getDocRef('settings', 'general'), {
    walletBalances: { [sourceWallet]: increment(-amount), [destinationWallet]: increment(amount) },
  }, { merge: true });
}

export async function lockMonthlyFundRepayment({ getCollectionRef, getDocRef, plan, payDate, repaymentVersion, sourceWallet, goals }) {
  const monthlyRef = getDocRef('fundRepayments', `borrow_${payDate.slice(0, 7)}`);
  const stateRef = getDocRef('fundRepayments', 'borrow_state');
  const createdAt = new Date().toISOString();
  return runTransaction(db, async (transaction) => {
    if ((await transaction.get(monthlyRef)).exists()) return;
    const state = await transaction.get(stateRef);
    if (state.data()?.latestPayment !== repaymentVersion) {
      throw new Error('Fund repayments changed while confirming this payment');
    }

    plan.forEach((item, index) => {
      const repaymentRef = index === 0 ? monthlyRef : doc(getCollectionRef('fundRepayments'));
      const destinationWallet = goals.find((goal) => goal.id === item.goalId)?.wallet || sourceWallet;
      writeFundPayment(transaction, {
        getCollectionRef, getDocRef, repaymentRef, ...item, payDate, kind: 'borrow',
        sourceWallet, destinationWallet, createdAt,
      });
    });
    transaction.set(stateRef, { latestPayment: monthlyRef.id });
  });
}
