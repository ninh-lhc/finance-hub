import { addDoc, updateDoc, deleteDoc, doc, increment, runTransaction } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { isEmergencyGoal } from '../../logic/salaryPicture.js';

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
  resetBalance = false,
  previousGoal,
}) {
  const goalPayload = isEmergencyGoal(previousGoal) || isEmergencyGoal(payload)
    ? { ...payload, isEmergencyFund: true }
    : payload;
  if (editingId) {
    const changes = { ...goalPayload };
    if (resetBalance) changes.balanceRevision = doc(getCollectionRef('goals')).id;
    else if (previousGoal?.amount != null) delete changes.amount;
    await updateDoc(getDocRef('goals', editingId), changes);
    return;
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
    const goal = (await transaction.get(getDocRef('goals', goalId))).data();
    if (!goal) throw new Error('Repayment goal no longer exists');
    writeFundPayment(transaction, {
      getCollectionRef, getDocRef, repaymentRef, goalId, amount, debtYear, debtMonth, payDate,
      kind, sourceWallet, destinationWallet: goal.wallet || destinationWallet, createdAt: new Date().toISOString(),
      goalBalanceRevision: goal.balanceRevision || '',
    });
  });
}

function writeFundPayment(transaction, {
  getCollectionRef, getDocRef, repaymentRef, goalId, amount, debtYear, debtMonth,
  payDate, kind, sourceWallet, destinationWallet, createdAt,
  goalBalanceRevision,
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
    goalId, goalDelta: amount, goalBalanceRevision,
  });
  transaction.set(getDocRef('settings', 'general'), {
    walletBalances: { [sourceWallet]: increment(-amount), [destinationWallet]: increment(amount) },
  }, { merge: true });
}

export async function lockMonthlyFundRepayment({ getCollectionRef, getDocRef, plan, payDate, repaymentVersion, sourceWallet }) {
  const monthlyRef = getDocRef('fundRepayments', `borrow_${payDate.slice(0, 7)}`);
  const stateRef = getDocRef('fundRepayments', 'borrow_state');
  const createdAt = new Date().toISOString();
  return runTransaction(db, async (transaction) => {
    if ((await transaction.get(monthlyRef)).exists()) return;
    const state = await transaction.get(stateRef);
    if (state.data()?.latestPayment !== repaymentVersion) {
      throw new Error('Fund repayments changed while confirming this payment');
    }

    const goalIds = [...new Set(plan.map((item) => item.goalId))];
    const goals = await Promise.all(goalIds.map(async (id) => (await transaction.get(getDocRef('goals', id))).data()));
    const goalById = new Map(goalIds.map((id, index) => [id, goals[index]]));
    plan.forEach((item, index) => {
      const repaymentRef = index === 0 ? monthlyRef : doc(getCollectionRef('fundRepayments'));
      const goal = goalById.get(item.goalId);
      if (!goal) throw new Error('Repayment goal no longer exists');
      writeFundPayment(transaction, {
        getCollectionRef, getDocRef, repaymentRef, ...item, payDate, kind: 'borrow',
        sourceWallet, destinationWallet: goal.wallet || sourceWallet, createdAt,
        goalBalanceRevision: goal.balanceRevision || '',
      });
    });
    transaction.set(stateRef, { latestPayment: monthlyRef.id });
  });
}
