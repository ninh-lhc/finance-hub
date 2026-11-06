import { useEffect, useState } from 'react';
import { getDocs } from 'firebase/firestore';

const COMPARISON_TABS = new Set(['dashboard', 'transactions', 'annual']);

export default function useAnnualTransactions({
  user,
  syncCode,
  activeTab,
  selectedYear,
  selectedMonth = 0,
  annualRefreshTick,
  getCollectionRef,
}) {
  const [annualTransactions, setAnnualTransactions] = useState([]);
  const [previousBoundaryTransactions, setPreviousBoundaryTransactions] = useState([]);
  const [previousYearTransactions, setPreviousYearTransactions] = useState([]);
  const [isFetchingAnnual, setIsFetchingAnnual] = useState(false);
  const [loadedKey, setLoadedKey] = useState(null);
  const [previousYearKey, setPreviousYearKey] = useState(null);

  useEffect(() => {
    if (!user || !COMPARISON_TABS.has(activeTab)) return;
    let isMounted = true;
    const requestKey = `${selectedYear}:${selectedMonth}`;

    const fetchAnnualData = async () => {
      setIsFetchingAnnual(true);
      setPreviousYearKey(null);
      const allYearTx = [];
      let boundaryTx = [];
      let previousYearTx = [];
      const includePreviousYear = activeTab === 'annual';
      try {
        const promises = [];
        for (let month = 1; month <= 12; month += 1) {
          const colName = `transactions_${selectedYear}_${String(month).padStart(2, '0')}`;
          promises.push(getDocs(getCollectionRef(colName)));
        }
        const previousYearPromises = [];
        if (includePreviousYear) {
          for (let month = 1; month <= 12; month += 1) {
            const colName = `transactions_${selectedYear - 1}_${String(month).padStart(2, '0')}`;
            previousYearPromises.push(getDocs(getCollectionRef(colName)));
          }
        }
        const [results, previousYearResults] = await Promise.all([
          Promise.all(promises),
          Promise.all(previousYearPromises),
        ]);
        results.forEach((snap) => {
          snap.forEach((docSnap) => allYearTx.push({ id: docSnap.id, ...docSnap.data() }));
        });
        previousYearResults.forEach((snap) => {
          snap.forEach((docSnap) => previousYearTx.push({ id: docSnap.id, ...docSnap.data() }));
        });

        if (selectedMonth === 0) {
          const boundarySnap = await getDocs(
            getCollectionRef(`transactions_${selectedYear - 1}_12`),
          );
          boundaryTx = boundarySnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        }

        if (isMounted) {
          setAnnualTransactions(allYearTx);
          setPreviousBoundaryTransactions(boundaryTx);
          setPreviousYearTransactions(includePreviousYear ? previousYearTx : []);
          setLoadedKey(requestKey);
          setPreviousYearKey(includePreviousYear ? String(selectedYear) : null);
          setIsFetchingAnnual(false);
        }
      } catch (err) {
        console.error('Lỗi khi tải dữ liệu năm:', err);
        if (isMounted) setIsFetchingAnnual(false);
      }
    };

    fetchAnnualData();
    return () => { isMounted = false; };
  }, [user, syncCode, activeTab, selectedYear, selectedMonth, annualRefreshTick, getCollectionRef]);

  const comparisonReady = loadedKey === `${selectedYear}:${selectedMonth}` && !isFetchingAnnual;
  const previousYearReady = activeTab === 'annual'
    && previousYearKey === String(selectedYear)
    && !isFetchingAnnual;

  return {
    annualTransactions,
    previousBoundaryTransactions,
    previousYearTransactions,
    isFetchingAnnual,
    comparisonReady,
    previousYearReady,
  };
}
