import { useEffect, useRef, useState } from 'react';
import { getDocs } from 'firebase/firestore';

const COMPARISON_TABS = new Set(['dashboard', 'transactions', 'annual', 'report']);

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
  const [samePeriodTransactions, setSamePeriodTransactions] = useState([]);
  const [isFetchingAnnual, setIsFetchingAnnual] = useState(false);
  const [loadedKey, setLoadedKey] = useState(null);
  const [previousYearKey, setPreviousYearKey] = useState(null);
  const [samePeriodKey, setSamePeriodKey] = useState(null);
  const loadedViewRef = useRef(null);

  useEffect(() => {
    if (!user || !COMPARISON_TABS.has(activeTab)) return;
    let isMounted = true;
    const requestKey = `${selectedYear}:${selectedMonth}`;
    const viewKey = `${user.uid}:${syncCode || ''}:${requestKey}`;

    const fetchAnnualData = async () => {
      const keepCurrentChart = loadedViewRef.current === viewKey;
      if (!keepCurrentChart) {
        setIsFetchingAnnual(true);
        setPreviousYearKey(null);
        setSamePeriodKey(null);
      }
      const allYearTx = [];
      let boundaryTx = [];
      let previousYearTx = [];
      let samePeriodTx = [];
      const includePreviousYear = activeTab === 'annual';
      const includeSamePeriod = activeTab === 'report';
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
        const samePeriodPromise = includeSamePeriod
          ? getDocs(getCollectionRef(`transactions_${selectedYear - 1}_${String(selectedMonth + 1).padStart(2, '0')}`))
          : Promise.resolve(null);
        const [results, previousYearResults, samePeriodSnap] = await Promise.all([
          Promise.all(promises),
          Promise.all(previousYearPromises),
          samePeriodPromise,
        ]);
        results.forEach((snap) => {
          snap.forEach((docSnap) => allYearTx.push({ id: docSnap.id, ...docSnap.data() }));
        });
        previousYearResults.forEach((snap) => {
          snap.forEach((docSnap) => previousYearTx.push({ id: docSnap.id, ...docSnap.data() }));
        });
        samePeriodSnap?.forEach((docSnap) => {
          samePeriodTx.push({ id: docSnap.id, ...docSnap.data() });
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
          setSamePeriodTransactions(includeSamePeriod ? samePeriodTx : []);
          loadedViewRef.current = viewKey;
          setLoadedKey(requestKey);
          setPreviousYearKey(includePreviousYear ? String(selectedYear) : null);
          setSamePeriodKey(includeSamePeriod ? requestKey : null);
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
  const samePeriodReady = activeTab === 'report'
    && samePeriodKey === `${selectedYear}:${selectedMonth}`
    && !isFetchingAnnual;

  return {
    annualTransactions,
    previousBoundaryTransactions,
    previousYearTransactions,
    samePeriodTransactions,
    isFetchingAnnual,
    comparisonReady,
    previousYearReady,
    samePeriodReady,
  };
}
