import { addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

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
}) {
  if (editingId) {
    await updateDoc(getDocRef('goals', editingId), payload);
    return;
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
