import { useEffect, useState } from 'react';
import { getDocs } from 'firebase/firestore';

export default function useAnnualTransactions({
  user,
  syncCode,
  activeTab,
  selectedYear,
  annualRefreshTick,
  getCollectionRef,
}) {
  const [annualTransactions, setAnnualTransactions] = useState([]);
  const [isFetchingAnnual, setIsFetchingAnnual] = useState(false);

  useEffect(() => {
    if (!user || activeTab !== 'annual') return;
    let isMounted = true;

    const fetchAnnualData = async () => {
      setIsFetchingAnnual(true);
      let allYearTx = [];
      try {
        const promises = [];
        for (let m = 1; m <= 12; m++) {
          const colName = `transactions_${selectedYear}_${String(m).padStart(2, '0')}`;
          promises.push(getDocs(getCollectionRef(colName)));
        }
        const results = await Promise.all(promises);
        results.forEach(snap => {
          snap.forEach(d => allYearTx.push({ id: d.id, ...d.data() }));
        });

        if (isMounted) {
          setAnnualTransactions(allYearTx);
          setIsFetchingAnnual(false);
        }
      } catch (err) {
        console.error("Lỗi khi tải dữ liệu năm:", err);
        if (isMounted) setIsFetchingAnnual(false);
      }
    };

    fetchAnnualData();
    return () => { isMounted = false; };
  }, [user, syncCode, activeTab, selectedYear, annualRefreshTick, getCollectionRef]);

  return { annualTransactions, isFetchingAnnual };
}
