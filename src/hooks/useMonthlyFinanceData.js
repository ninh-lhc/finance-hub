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

    return () => { unsubTrans(); unsubGoals(); unsubBudgets(); };
  }, [user, getCollectionRef, transactionCollectionName, transactionSourceKey]);

  return { transactions, goals, budgets };
}
