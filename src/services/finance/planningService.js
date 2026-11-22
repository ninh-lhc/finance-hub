import { addDoc, updateDoc, deleteDoc, getDocs, writeBatch, doc, increment } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { getTransactionMonthCollectionNames } from '../../logic/walletCategoryEntities.js';
import { goalLinkDetachPatch } from '../../logic/goalMovement.js';

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
  currentYear = new Date().getFullYear(),
}) {
  if (editingId) {
    await updateDoc(getDocRef('goals', editingId), payload);
    if (!detachLinks) return { detached: 0 };
    const detached = await detachGoalLinks({ getCollectionRef, goalId: editingId, currentYear });
    return { detached };
  }
  await addDoc(getCollectionRef('goals'), {
    ...payload,
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
}) {
  const batch = writeBatch(db);
  batch.update(getDocRef('goals', goalId), { amount: increment(Number(amount || 0)) });
  batch.set(doc(getCollectionRef('fundRepayments')), {
    goalId,
    amount: Number(amount || 0),
    debtYear,
    debtMonth,
    payDate,
    kind,
    createdAt: new Date().toISOString(),
  });
  await batch.commit();
}
