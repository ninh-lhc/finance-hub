import { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';

export default function useMonthlyFinanceData({
  user,
  syncCode,
  selectedYear,
  selectedMonth,
  getCollectionRef,
}) {
  const [transactionSnapshot, setTransactionSnapshot] = useState({
    sourceKey: null,
    items: [],
  });
  const [goals, setGoals] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [fundRepayments, setFundRepayments] = useState([]);
  const [reimbursementLinks, setReimbursementLinks] = useState([]);

  const monthStr = String(selectedMonth + 1).padStart(2, '0');
  const transactionCollectionName = `transactions_${selectedYear}_${monthStr}`;

  const transactionSourceKey = useMemo(() => {
    if (!user) return null;
    const sourceOwner = syncCode
      ? `sync:${syncCode}`
      : `user:${user.uid}`;
    return `${sourceOwner}:${transactionCollectionName}`;
  }, [user, syncCode, transactionCollectionName]);

  const transactions =
    transactionSnapshot.sourceKey === transactionSourceKey
      ? transactionSnapshot.items
      : [];

  useEffect(() => {
    if (!user) return;

    const capturedSourceKey = transactionSourceKey;

    const unsubTrans = onSnapshot(
      getCollectionRef(transactionCollectionName),
      (s) => {
        setTransactionSnapshot({
          sourceKey: capturedSourceKey,
          items: s.docs.map(d => ({ id: d.id, ...d.data() })),
        });
      },
      (err) => console.error("Lỗi tải giao dịch tháng:", err)
    );

    const unsubGoals = onSnapshot(getCollectionRef('goals'), (s) => setGoals(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubBudgets = onSnapshot(getCollectionRef('budgets'), (s) => setBudgets(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubRepayments = onSnapshot(getCollectionRef('fundRepayments'), (s) => setFundRepayments(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubLinks = onSnapshot(getCollectionRef('reimbursementLinks'), (s) => setReimbursementLinks(s.docs.map(d => d.data())));

    return () => { unsubTrans(); unsubGoals(); unsubBudgets(); unsubRepayments(); unsubLinks(); };
  }, [user, getCollectionRef, transactionCollectionName, transactionSourceKey]);

  const transactionsReady = transactionSnapshot.sourceKey === transactionSourceKey;
  return { transactions, transactionsReady, goals, budgets, fundRepayments, reimbursementLinks };
}
