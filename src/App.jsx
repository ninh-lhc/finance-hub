import React, { useEffect, useState, useMemo, useRef } from 'react';
import { 
  collection, addDoc, doc, deleteDoc, updateDoc, setDoc, getDoc, getDocs, writeBatch, increment, runTransaction
} from 'firebase/firestore';
import { auth, db, baseAppId } from './services/firebase/config.js';
import useAuthUser from './hooks/useAuthUser.js';
import useFirestoreRefs from './hooks/useFirestoreRefs.js';
import useFinanceSettings from './hooks/useFinanceSettings.js';
import useMonthlyFinanceData from './hooks/useMonthlyFinanceData.js';
import useAnnualTransactions from './hooks/useAnnualTransactions.js';
import AppHeader from './components/layout/AppHeader.jsx';
import MainNav from './components/layout/MainNav.jsx';
import Toast from './components/common/Toast.jsx';
import DashboardView from './features/dashboard/DashboardView.jsx';
import SixJarsPanel from './features/dashboard/SixJarsPanel.jsx';
import TransactionsView from './features/transactions/TransactionsView.jsx';
import AnnualView from './features/annual/AnnualView.jsx';
import ReportView from './features/report/ReportView.jsx';
import SettingsView from './features/settings/SettingsView.jsx';
import { applyAppearance, readAppearance } from './theme/appearance.js';
import TransactionModal from './features/transactions/TransactionModal.jsx';
import utils from './utils/format.js';
import { deriveFinanceLogic, deriveTransactionView } from './logic/deriveFinance.js';
import { buildDataSourceDiagnostics } from './logic/dataSourceDiagnostics.js';
import { calculateWalletBalances } from './logic/balanceMaintenance.js';
import { buildSixJarPlan, encodeJarSettings } from './logic/sixJars.js';
import { buildMonthComparison, filterByYearMonth, previousPeriod } from './logic/monthComparison.js';
import { buildMonthReport } from './logic/monthReport.js';
import { deleteConfirmMessage } from './logic/deleteConfirm.js';
import {
  parseFinanceCsv,
  serializeFinanceCsv,
  serializeFinanceImportSampleCsv,
  omitImportedDuplicates,
  sumImportImpact,
} from './logic/financeCsv.js';
import {
  saveTransactionToFirestore,
  deleteTransactionFromFirestore,
} from './services/finance/transactionService.js';
import {
  isBudgetFormReady,
  isGoalFormReady,
  buildBudgetPayload,
  buildGoalPayload,
} from './logic/planningEntities.js';
import {
  goalLink,
  readGoalBalanceLink,
  selectedGoalId,
  validateGoalLinks,
  goalAmountWasEdited,
} from './logic/goalMovement.js';
import {
  saveBudgetToFirestore,
  saveGoalToFirestore,
  deleteBudgetFromFirestore,
  deleteGoalFromFirestore,
  lockFundRepayment,
  lockMonthlyFundRepayment,
} from './services/finance/planningService.js';
import { buildFinanceContext, isEmergencyGoal, monthlyFundRepaymentOffers, outstandingFundLoans, transactionKey, unpaidHelpedLocks } from './logic/salaryPicture.js';
import { getTransactionMonthCollectionNames, isCategoryFormReady, hasCategoryNameConflict, hasWalletNameConflict, normalizeCategoryName, normalizeWalletName, canDeleteCategory, canDeleteWallet, canRenameOpeningBalanceCategory } from './logic/walletCategoryEntities.js';
import {
  saveWalletToFirestore,
  saveCategoryToFirestore,
  deleteCategoryFromFirestore,
  deleteWalletFromFirestore,
} from './services/finance/walletCategoryService.js';
import {
  recalculateWalletBalancesInFirestore,
  resetWalletBalanceInFirestore,
} from './services/finance/balanceMaintenanceService.js';
import {
  generateSampleDataInFirestore,
  clearSampleDataFromFirestore,
} from './services/finance/sampleDataService.js';
import {
  getLegacyMigrationReadiness,
  canStartLegacyMigrationInspect,
  toLegacyMigrationUiInspectionState,
  LEGACY_MIGRATION_INSPECT_BLOCKED_MESSAGE,
} from './logic/legacySyncMigration.js';
import {
  inspectLegacySyncMigration,
  LegacyMigrationNotReadyError,
} from './services/finance/legacySyncMigrationService.js';

function goalSaveError(result) {
  if (result.reason === 'insufficient') {
    return `${result.goalName} chỉ còn ${utils.formatVND(result.available)} để trừ.`;
  }
  if (result.reason === 'wrong-wallet') {
    return `${result.goalName} không nằm trong ví đang chọn.`;
  }
  return 'Không tìm thấy mục tiêu vừa chọn.';
}

// ==========================================
// MAIN APP COMPONENT
// ==========================================
function repaymentPlan(offers, cap) {
  let remaining = Number(cap || 0);
  return offers
    .map((offer) => {
      const amount = Math.min(offer.amount, remaining);
      remaining -= amount;
      return amount > 0 ? { ...offer, amount } : null;
    })
    .filter(Boolean);
}

async function readTransactionHistory(getCollectionRef, throughMonth) {
  return Promise.all(getTransactionMonthCollectionNames(new Date().getFullYear())
    .map((name) => ({ name, period: name.slice('transactions_'.length).replace('_', '-') }))
    .filter(({ period }) => !throughMonth || period <= throughMonth)
    .map(async ({ name, period }) => {
      const snap = await getDocs(getCollectionRef(name));
      return { period, transactions: snap.docs.map((item) => ({ id: item.id, ...item.data() })) };
    }));
}

async function offerFundAdjustment({ payload, goals, fundRepayments, reimbursementLinks, getCollectionRef, getDocRef }) {
  const date = String(payload.date || '');
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7)) - 1;
  if (!year || month < 0) return;

  if (payload.category === 'Lương') {
    if (!goals.some(isEmergencyGoal)) return;
    const repaymentSnapshot = await getDocs(getCollectionRef('fundRepayments'));
    const repayments = repaymentSnapshot.docs.map((item) => item.data());
    const payMonth = date.slice(0, 7);
    if (repayments.some((item) => item.kind === 'borrow' && item.payDate?.slice(0, 7) === payMonth)) return;
    const repaymentVersion = repaymentSnapshot.docs.find((item) => item.id === 'borrow_state')?.data().latestPayment;
    const history = await readTransactionHistory(getCollectionRef);
    const offers = monthlyFundRepaymentOffers({ history, goals, repayments, payDate: date });
    const outstanding = offers.reduce((sum, item) => sum + item.amount, 0);
    const maximum = Math.floor(Math.min(outstanding, Number(payload.amount)));
    if (maximum < 1) return;

    const suggested = Math.min(maximum, Math.max(1, Math.floor(Number(payload.amount) * 0.1)));
    const destinationWallets = [...new Set(offers.map((offer) => goals.find((goal) => goal.id === offer.goalId)?.wallet).filter((wallet) => wallet && wallet !== payload.wallet))];
    const transferMessage = destinationWallets.length ? ` Nếu hoàn vào quỹ ở ví khác, tiền sẽ chuyển từ ${payload.wallet} sang ví quỹ (${destinationWallets.join(', ')}).` : '';
    let message = `Còn nợ quỹ khẩn cấp ${utils.formatVND(outstanding)}. Nhập số tiền muốn hoàn tháng này (tối đa ${utils.formatVND(maximum)}, chỉ nhập chữ số).${transferMessage}`;
    for (;;) {
      const input = window.prompt(message, String(suggested))?.trim();
      if (!input) return;
      const amount = Number(input);
      if (/^\d+$/.test(input) && Number.isSafeInteger(amount) && amount >= 1 && amount <= maximum) {
        await lockMonthlyFundRepayment({
          getCollectionRef, getDocRef, repaymentVersion,
          plan: repaymentPlan(offers, amount), payDate: date, sourceWallet: payload.wallet,
        });
        return;
      }
      message = `Số tiền hoàn quỹ phải từ 1 đến ${utils.formatVND(maximum)} và chỉ gồm chữ số.`;
    }
  }

  if (payload.category !== 'Thu nợ/Hoàn ứng' || !goals.some(isEmergencyGoal)) return;
  const history = await readTransactionHistory(getCollectionRef, date.slice(0, 7));
  const known = history.flatMap((entry) => entry.transactions).filter((transaction) => transaction.date <= date);
  const receipt = buildFinanceContext(known, goals, reimbursementLinks).receipt(payload);
  if (!receipt?.matched) return;
  const unpaid = unpaidHelpedLocks({ transactions: known, goals, repayments: fundRepayments });
  for (const goal of goals.filter(isEmergencyGoal)) {
    const principal = receipt.allocations.reduce((sum, { expense, amount }) =>
      sum + (expense.goalId === goal.id && expense.goalDelta < 0 ? amount : 0), 0);
    const amount = Math.min(principal, unpaid.find((item) => item.goalId === goal.id)?.amount || 0);
    if (amount <= 0) continue;
    const destinationWallet = goal.wallet || payload.wallet;
    const movement = destinationWallet === payload.wallet ? '' : ` Chuyển từ ${payload.wallet} sang ${destinationWallet}.`;
    if (!window.confirm(`Hoàn ${utils.formatVND(amount)} đã chi hộ từ ${goal.name}?${movement}`)) continue;
    await lockFundRepayment({
      getCollectionRef, getDocRef, goalId: goal.id, amount, debtYear: year, debtMonth: month,
      payDate: date, kind: 'helped', receiptId: `${payload.id}_${goal.id}`, sourceWallet: payload.wallet, destinationWallet,
    });
  }
}

export default function App() {
  const { user, authInitialized } = useAuthUser();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('TRANSACTION');
  const [showBalance, setShowBalance] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingTransaction, setIsSavingTransaction] = useState(false);
  const saveTransactionLock = useRef(false);
  const [activeSettingTab, setActiveSettingTab] = useState('sync');
  const [appearance, setAppearance] = useState(readAppearance);
  
  const [syncCode, setSyncCode] = useState(localStorage.getItem('finance_hub_sync_code') || '');
  const { getCollectionRef, getDocRef } = useFirestoreRefs({ user, syncCode });
  const [inputSyncCode, setInputSyncCode] = useState('');

  const [formData, setFormData] = useState({});
  const [editingTxId, setEditingTxId] = useState(null);
  const [settingsForm, setSettingsForm] = useState({ budgetAmount: '', budgetCategory: '', walletName: '', categoryName: '', categoryType: 'INCOME', goalName: '', goalAmount: '', goalCurrentAmount: '', goalWallet: '' });
  const [editingId, setEditingId] = useState(null);
  const [useLinkedWallet, setUseLinkedWallet] = useState(false);
  
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [legacyMigrationInspection, setLegacyMigrationInspection] = useState(null);
  const [isInspectingLegacyMigration, setIsInspectingLegacyMigration] = useState(false);

  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState(null);
  const [, setExpandedTxId] = useState(null);
  const [walletView, setWalletView] = useState('chart'); 
  const [selectedWalletDetail, setSelectedWalletDetail] = useState(null);
  const [annualSelectedMonth, setAnnualSelectedMonth] = useState('ALL');
  const [annualSelectedExpenseCategory, setAnnualSelectedExpenseCategory] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterWallet, setFilterWallet] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [annualRefreshTick, setAnnualRefreshTick] = useState(0);

  const { categories, wallets, walletBalances, sixJars } = useFinanceSettings({ user, getDocRef, syncCode });
  const { transactions, transactionsReady, goals, budgets, fundRepayments, reimbursementLinks } = useMonthlyFinanceData({
    user,
    syncCode,
    selectedYear,
    selectedMonth,
    getCollectionRef,
  });
  const {
    annualTransactions,
    previousBoundaryTransactions,
    previousYearTransactions,
    samePeriodTransactions,
    isFetchingAnnual,
    comparisonReady,
    previousYearReady,
    samePeriodReady,
  } = useAnnualTransactions({
    user,
    syncCode,
    activeTab,
    selectedYear,
    selectedMonth,
    annualRefreshTick,
    getCollectionRef,
  });

  const dataSourceDiagnostics = useMemo(
    () =>
      buildDataSourceDiagnostics({
        user,
        syncCode,
        selectedYear,
        selectedMonth,
        transactions,
        wallets,
        categories,
        walletBalances,
        goals,
        budgets,
      }),
    [
      user,
      syncCode,
      selectedYear,
      selectedMonth,
      transactions,
      wallets,
      categories,
      walletBalances,
      goals,
      budgets,
    ],
  );

  const legacyMigrationReadiness = useMemo(
    () => getLegacyMigrationReadiness({ user, syncCode }),
    [user, syncCode],
  );

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const handleInspectLegacyMigration = async () => {
    const inspectGate = canStartLegacyMigrationInspect({
      user,
      readiness: legacyMigrationReadiness,
      isInspecting: isInspectingLegacyMigration,
    });
    if (!inspectGate.allowed) {
      if (inspectGate.reason === 'not-ready') {
        setLegacyMigrationInspection({
          error: true,
          message: LEGACY_MIGRATION_INSPECT_BLOCKED_MESSAGE,
        });
        showToast(LEGACY_MIGRATION_INSPECT_BLOCKED_MESSAGE, 'warning');
      }
      return;
    }

    setIsInspectingLegacyMigration(true);
    setLegacyMigrationInspection(null);
    try {
      const result = await inspectLegacySyncMigration({
        user,
        syncCode,
        currentYear: selectedYear,
      });
      setLegacyMigrationInspection(toLegacyMigrationUiInspectionState(result));
      showToast('Đã hoàn tất kiểm tra migration (chỉ đọc).', 'success');
    } catch (err) {
      if (err instanceof LegacyMigrationNotReadyError) {
        setLegacyMigrationInspection({
          error: true,
          message: LEGACY_MIGRATION_INSPECT_BLOCKED_MESSAGE,
        });
      } else if (err?.code === 'permission-denied') {
        setLegacyMigrationInspection({
          error: true,
          message: 'Firestore từ chối quyền đọc. Kiểm tra đăng nhập và quy tắc bảo mật.',
        });
      } else {
        setLegacyMigrationInspection({
          error: true,
          message: 'Không thể hoàn tất kiểm tra. Thử lại sau.',
        });
      }
      showToast('Không thể kiểm tra dữ liệu cũ.', 'warning');
    } finally {
      setIsInspectingLegacyMigration(false);
    }
  };

  const resetWalletBalance = async (wName) => {
    if (!user || isProcessing) return;
    setIsProcessing(true);
    showToast('Đang kiểm tra lịch sử giao dịch...', 'success');
    try {
      const result = await resetWalletBalanceInFirestore({
        getCollectionRef,
        getDocRef,
        walletName: wName,
      });
      if (result.hasReferences) {
        showToast(`Lỗi: Ví "${wName}" đang chứa giao dịch. Không thể đưa về 0đ!`, 'warning');
        setIsProcessing(false);
        return;
      }
      if (result.reset) {
        showToast(`Đã đưa số dư ${wName} về 0đ`, 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi thiết lập lại ví', 'error');
    }
    setIsProcessing(false);
  };

  // ==========================================
  // 6. BUSINESS LOGIC (USEMEMO)
  // ==========================================
  const [transactionHistory, setTransactionHistory] = useState(null);
  useEffect(() => {
    if (!user) return;
    let active = true;
    readTransactionHistory(getCollectionRef).then((history) => {
      if (active) setTransactionHistory({ source: getCollectionRef, history });
    }).catch((error) => console.error('Không tải được lịch sử giao dịch', error));
    return () => { active = false; };
  }, [user, getCollectionRef, annualRefreshTick]);

  const history = useMemo(() => {
    if (transactionHistory?.source !== getCollectionRef) return null;
    if (!transactionsReady) return transactionHistory.history;
    const period = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    return transactionHistory.history.map((entry) => entry.period === period ? { period, transactions } : entry);
  }, [transactionHistory, getCollectionRef, selectedYear, selectedMonth, transactionsReady, transactions]);
  const financeContext = useMemo(() => history
    ? buildFinanceContext(history.flatMap((entry) => entry.transactions), goals, reimbursementLinks)
    : undefined, [history, goals, reimbursementLinks]);
  const sixJarPlan = useMemo(() => {
    if (!sixJars || !history || !transactionsReady) return null;
    const previous = previousPeriod(selectedYear, selectedMonth);
    const previousKey = `${previous.year}-${String(previous.month + 1).padStart(2, '0')}`;
    return buildSixJarPlan({
      settings: sixJars,
      transactions,
      previousTransactions: history.find(({ period }) => period === previousKey)?.transactions || [],
      goals,
      context: financeContext,
      repayments: fundRepayments,
      budgets,
      year: selectedYear,
      month: selectedMonth,
    });
  }, [sixJars, history, transactionsReady, transactions, goals, financeContext, fundRepayments, selectedYear, selectedMonth, budgets]);
  const outstandingBorrow = useMemo(() => {
    if (!history) return undefined;
    const period = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    const today = utils.getLocalYMD();
    const through = period === today.slice(0, 7) ? today : `${period}-31`;
    return outstandingFundLoans({ history, goals, repayments: fundRepayments, through })
      .reduce((sum, item) => sum + item.amount, 0);
  }, [history, goals, fundRepayments, selectedYear, selectedMonth]);
  const walletBalanceDifferences = useMemo(() => {
    if (activeTab !== 'settings' || !history) return [];
    const ledger = calculateWalletBalances({ wallets, transactions: history.flatMap((entry) => entry.transactions) });
    return wallets.flatMap((wallet) => {
      const stored = Number(walletBalances[wallet] || 0);
      const expected = ledger[wallet];
      return stored === expected ? [] : [{ wallet, stored, expected }];
    });
  }, [activeTab, history, wallets, walletBalances]);
  
  const coreLogic = useMemo(
    () =>
      deriveFinanceLogic({
        transactions,
        annualTransactions,
        boundaryTransactions: previousBoundaryTransactions,
        walletBalances,
        selectedMonth,
        selectedYear,
        wallets,
        categories,
        annualSelectedMonth,
        goals,
        budgets,
        fundRepayments,
        outstandingBorrow,
        context: financeContext,
      }),
    [transactions, annualTransactions, previousBoundaryTransactions, walletBalances, selectedMonth, selectedYear, wallets, categories, annualSelectedMonth, goals, budgets, fundRepayments, outstandingBorrow, financeContext],
  );

  const monthComparison = useMemo(() => {
    const previous = previousPeriod(selectedYear, selectedMonth);
    const previousTransactions = selectedMonth === 0
      ? previousBoundaryTransactions
      : filterByYearMonth(annualTransactions, previous.year, previous.month);
    return buildMonthComparison({
      currentTransactions: transactions,
      previousTransactions,
      yearTransactions: annualTransactions,
      selectedYear,
      selectedMonth,
      ready: comparisonReady,
      goals,
      repayments: fundRepayments,
      outstandingBorrow,
      context: financeContext,
    });
  }, [
    transactions,
    annualTransactions,
    previousBoundaryTransactions,
    selectedYear,
    selectedMonth,
    comparisonReady,
    goals,
    fundRepayments,
    outstandingBorrow,
    financeContext,
  ]);

  const monthReport = useMemo(() => {
    const previous = previousPeriod(selectedYear, selectedMonth);
    const previousTransactions = selectedMonth === 0
      ? previousBoundaryTransactions
      : filterByYearMonth(annualTransactions, previous.year, previous.month);
    return buildMonthReport({
      currentTransactions: transactions,
      previousTransactions,
      samePeriodTransactions: samePeriodReady ? samePeriodTransactions : [],
      selectedYear,
      selectedMonth,
      ready: comparisonReady,
      samePeriodReady,
      goals,
      repayments: fundRepayments,
      context: financeContext,
    });
  }, [
    transactions,
    annualTransactions,
    previousBoundaryTransactions,
    goals,
    fundRepayments,
    samePeriodTransactions,
    selectedYear,
    selectedMonth,
    comparisonReady,
    samePeriodReady,
    financeContext,
  ]);

  const viewLogic = useMemo(
    () =>
      deriveTransactionView({
        transactions,
        searchQuery,
        filterType,
        filterWallet,
        filterCategory,
      }),
    [transactions, searchQuery, filterType, filterWallet, filterCategory],
  );

  const logic = { ...coreLogic, ...viewLogic };

  // AI Cố vấn
  const generateDashboardAdvice = () => {
    const rate = logic.income > 0 ? (logic.expense / logic.income * 100) : 0;
    if (logic.income === 0 && logic.expense > 0) return "Cảnh báo! Bạn đang chi tiêu mà chưa ghi nhận nguồn thu nào trong tháng này.";
    if (logic.income > 0) {
      if (rate < 50) return "Tài chính cực kỳ khỏe mạnh! Hãy tiếp tục duy trì tỷ suất tiết kiệm tuyệt vời này nhé.";
      if (rate <= 80) return "Chi tiêu đang ở mức hợp lý. Chú ý các khoản phát sinh nhỏ để tối ưu thêm tích lũy.";
      return "Cảnh báo khẩn! Tốc độ tiêu tiền của bạn đang quá nhanh so với thu nhập. Hãy rà soát lại ngay!";
    }
    return "Hãy ghi nhận giao dịch đầu tiên để AI bắt đầu phân tích sức khỏe tài chính của bạn nhé.";
  };

  const generateAnnualAIAdvice = () => {
     const { scopeIncome, scopeExpense, scopeSurplus, scopeExpenseChart, avgMonthlyExpense } = logic.annualData;
     if (scopeIncome === 0 && scopeExpense === 0) return "Chưa có đủ dữ liệu để chuyên gia AI phân tích xu hướng chi tiêu.";
     const topCat = scopeExpenseChart.length > 0 ? scopeExpenseChart[0] : null;
     const topCatPercent = topCat && scopeExpense > 0 ? ((topCat.value / scopeExpense) * 100).toFixed(0) : 0;
     const saveRate = scopeIncome > 0 ? ((scopeSurplus / scopeIncome) * 100).toFixed(0) : 0;

     if (annualSelectedMonth === 'ALL') {
        return `Trong năm ${selectedYear}, bạn đã tích lũy được ${saveRate}% tổng thu nhập. Hạng mục tiêu tốn nhiều ngân sách nhất là "${topCat?.name || 'N/A'}" (${topCatPercent}%).`;
     } else {
        const diff = scopeExpense - avgMonthlyExpense;
        const diffPercent = avgMonthlyExpense > 0 ? (Math.abs(diff) / avgMonthlyExpense * 100).toFixed(0) : 0;
        return `Tháng ${annualSelectedMonth + 1} này, bạn chi tiêu ${diff > 0 ? `cao hơn ${diffPercent}%` : `thấp hơn ${diffPercent}%`} so với mức trung bình năm. Khoản chi lớn: "${topCat?.name || 'N/A'}" (${topCatPercent}%).`;
     }
  };

  // ==========================================
  // 7. ACTIONS (CRUD & SYNC)
  // ==========================================
  
  const handleCloseModal = () => {
      setShowModal(false);
      setEditingTxId(null);
      setFormData({});
      setUseLinkedWallet(false);
  };

  const dbActions = {
    // TÍNH NĂNG MỚI: TỰ ĐỘNG CHỮA LỖI SỐ DƯ
    recalculateAllBalances: async () => {
      if (!user || isProcessing) return;
      setIsProcessing(true);
      showToast('Đang quét và tính toán lại toàn bộ số dư...', 'success');
      try {
          await recalculateWalletBalancesInFirestore({
            getCollectionRef,
            getDocRef,
            wallets,
          });
          showToast('Đã tính toán lại số dư chuẩn xác 100%!', 'success');
      } catch (error) {
          console.error(error);
          showToast('Lỗi khi tính toán số dư!', 'error');
      }
      setIsProcessing(false);
    },

    generateSampleData: async () => {
      if (!user || isProcessing) return;
      setIsProcessing(true);
      try {
        await generateSampleDataInFirestore({
          getCollectionRef,
          getDocRef,
          wallets,
        });
        showToast('Đã nạp dữ liệu mẫu 12 tháng năm 2025!', 'success');
        setSelectedYear(2025);
        setAnnualRefreshTick(v => v + 1);
      } catch (e) {
        console.error(e);
        showToast('Lỗi khi nạp dữ liệu', 'error');
      }
      setIsProcessing(false);
    },

    clearSampleData: async () => {
      if (!user || isProcessing) return;
      setIsProcessing(true);
      showToast('Đang dọn dẹp dữ liệu mẫu...', 'success');
      try {
          const result = await clearSampleDataFromFirestore({
            getCollectionRef,
            getDocRef,
          });
          if (!result.hadSamples) {
              showToast('Không có dữ liệu mẫu nào để xóa!', 'warning');
              setIsProcessing(false);
              return;
          }
          showToast(`Đã xóa sạch ${result.deletedCount} dữ liệu mẫu!`, 'success');
          setAnnualRefreshTick(v => v + 1);
      } catch (error) {
          console.error(error);
          showToast('Lỗi khi dọn dẹp dữ liệu mẫu!', 'error');
      }
      setIsProcessing(false);
    },

    saveTransaction: async () => {
      if (!user || saveTransactionLock.current) return;
      let transferGoalOut = { goalId: '', goalDelta: 0 };
      let transferGoalIn = { goalId: '', goalDelta: 0 };
      if (modalType === 'TRANSACTION') {
          if (!formData.amount || Number(formData.amount) <= 0) { showToast('Vui lòng nhập số tiền hợp lệ!', 'warning'); return; }
          if (formData.type !== 'TRANSFER' && !formData.category) { showToast('Vui lòng chọn danh mục!', 'warning'); return; }
          if (formData.type === 'TRANSFER' && (!formData.toWallet || formData.wallet === formData.toWallet)) { showToast('Ví nguồn và ví đích không được trùng nhau!', 'warning'); return; }
          if (formData.type === 'EXPENSE') {
              const chargedWallet = (useLinkedWallet && formData.linkedWallet) ? formData.linkedWallet : formData.wallet;
              const link = goalLink(selectedGoalId(goals, chargedWallet, formData.goalId), formData.amount, 'decrease');
              const previousGoal = goals.find((goal) => goal.id === formData.originalTx?.goalId);
              const previousLinks = editingTxId ? [readGoalBalanceLink(formData.originalTx, previousGoal)] : [];
              const historicalLink = editingTxId && link.goalId && link.goalId === formData.originalTx?.goalId
                && !previousLinks[0].goalId;
              const check = validateGoalLinks({
                goals,
                walletByGoalId: link.goalId ? { [link.goalId]: chargedWallet } : {},
                previousLinks,
                nextLinks: historicalLink ? [] : [link],
              });
              if (!check.ok) { showToast(goalSaveError(check), 'warning'); return; }
          }
          if (formData.type === 'TRANSFER' && !editingTxId) {
              transferGoalOut = goalLink(selectedGoalId(goals, formData.wallet, formData.fromGoalId), formData.amount, 'decrease');
              transferGoalIn = goalLink(selectedGoalId(goals, formData.toWallet, formData.toGoalId), formData.amount, 'increase');
              const walletByGoalId = {};
              if (transferGoalOut.goalId) walletByGoalId[transferGoalOut.goalId] = formData.wallet;
              if (transferGoalIn.goalId) walletByGoalId[transferGoalIn.goalId] = formData.toWallet;
              const check = validateGoalLinks({
                goals,
                walletByGoalId,
                nextLinks: [transferGoalOut, transferGoalIn],
              });
              if (!check.ok) { showToast(goalSaveError(check), 'warning'); return; }
          }
      }

      saveTransactionLock.current = true;
      setIsSavingTransaction(true);
      try {
      const colName = modalType === 'TRANSACTION' ? 'transactions' : modalType === 'GOAL' ? 'goals' : 'budgets';
      let payload = { ...formData, amount: Number(formData.amount || 0), target: Number(formData.target || 0), isSample: false };
      
      const originalTx = payload.originalTx;
      let savedTransactionId;
      delete payload.originalTx;
      
      if (modalType === 'TRANSACTION') {
          if (!payload.date) payload.date = utils.getLocalYMD();
          if (!payload.wallet) payload.wallet = wallets[0];
          if (useLinkedWallet && formData.linkedWallet && formData.type === 'EXPENSE') payload.linkedWallet = formData.linkedWallet;
          else payload.linkedWallet = '';
          delete payload.fromGoalId;
          delete payload.toGoalId;
          if (payload.type !== 'TRANSFER') delete payload.toWallet;
          if (payload.type === 'EXPENSE') {
              const chargedWallet = payload.linkedWallet || payload.wallet;
              const link = goalLink(selectedGoalId(goals, chargedWallet, formData.goalId), payload.amount, 'decrease');
              payload.goalId = link.goalId;
              payload.goalDelta = link.goalDelta;
          } else if (payload.type !== 'TRANSFER') {
              payload.goalId = '';
              payload.goalDelta = 0;
          }
          
          if (formData.type === 'TRANSFER' && !editingTxId) {
              await saveTransactionToFirestore({
                getCollectionRef,
                getDocRef,
                payload,
                isTransferCreate: true,
                transferFromWallet: formData.wallet,
                transferToWallet: formData.toWallet,
                transferNote: formData.note,
                transferGoalOut,
                transferGoalIn,
              });
              handleCloseModal();
              showToast('Đã luân chuyển tiền thành công!', 'success');
              setAnnualRefreshTick(v => v + 1); 
              return;
          }
          
          savedTransactionId = await saveTransactionToFirestore({
            getCollectionRef,
            getDocRef,
            payload,
            editingTransactionId: editingTxId,
            originalTransaction: originalTx,
            isTransferCreate: false,
          });
      } else {
         if (editingTxId) await updateDoc(getDocRef(colName, editingTxId), payload);
         else { payload.createdAt = new Date().toISOString(); await addDoc(getCollectionRef(colName), payload); }
      }
      
      if (modalType === 'TRANSACTION' && !editingTxId && payload.type === 'INCOME') {
        try {
          await offerFundAdjustment({
            payload: { ...payload, id: savedTransactionId },
            goals,
            fundRepayments,
            reimbursementLinks,
            getCollectionRef,
            getDocRef,
          });
        } catch (error) {
          console.error(error);
          showToast('Đã lưu giao dịch, chưa khóa được quỹ', 'warning');
        }
      }
      showToast('Đã lưu thành công!', 'success');
      handleCloseModal();
      setAnnualRefreshTick(v => v + 1);
      } catch (error) {
          console.error(error);
          showToast('Lỗi khi lưu giao dịch!', 'error');
      } finally {
          saveTransactionLock.current = false;
          setIsSavingTransaction(false);
      }
    },
    
    deleteItem: async (col, id, txObj) => {
      if (isProcessing) return;
      const item = col === 'budgets'
        ? (budgets || []).find((entry) => entry.id === id)
        : col === 'goals'
          ? (goals || []).find((entry) => entry.id === id)
          : null;
      const confirmMessage = deleteConfirmMessage({ collection: col, transaction: txObj, item });
      if (confirmMessage && !window.confirm(confirmMessage)) return;
      setIsProcessing(true);
      try {
          let actualCol = col;
          if (col === 'transactions' && txObj) {
             const [y, m] = txObj.date.split('-');
             actualCol = `transactions_${y}_${m}`;
             
             const docRefCheck = getDocRef(actualCol, id);
             const snapCheck = await getDoc(docRefCheck);
             if (!snapCheck.exists()) {
                 showToast('Giao dịch không tồn tại hoặc đã xóa!', 'warning');
                 setIsProcessing(false);
                 return; 
             }
             
             const deleteResult = await deleteTransactionFromFirestore({
               getCollectionRef,
               getDocRef,
               collectionName: actualCol,
               documentId: id,
               transaction: { ...txObj, ...snapCheck.data() },
             });
             if (deleteResult.kind === 'transfer_pair') {
                 showToast('Đã xóa toàn bộ phiếu luân chuyển!', 'success');
             } else {
                 showToast('Đã xóa dữ liệu', 'success');
             }
             setAnnualRefreshTick(v => v + 1);
          } else if (col === 'budgets') {
              await deleteBudgetFromFirestore({ getDocRef, id });
              showToast('Đã xóa dữ liệu', 'success');
          } else if (col === 'goals') {
              await deleteGoalFromFirestore({ getDocRef, id });
              showToast('Đã xóa dữ liệu', 'success');
          } else {
              await deleteDoc(getDocRef(actualCol, id));
              showToast('Đã xóa dữ liệu', 'success');
          }
      } catch (e) {
          console.error(e);
          showToast('Lỗi khi xóa dữ liệu!', 'error');
      }
      setIsProcessing(false);
    },

    enableCloudSync: async () => {
      if (!user || isProcessing) return;
      setIsProcessing(true);
      const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      try {
        const collectionNames = [
          ...getTransactionMonthCollectionNames(new Date().getFullYear()),
          'goals', 'budgets', 'fundRepayments', 'reimbursementLinks',
        ];
        const snapshots = await Promise.all(collectionNames.map(async (name) => ({
          name, snapshot: await getDocs(collection(db, 'artifacts', baseAppId, 'users', user.uid, name)),
        })));
        const copies = snapshots.flatMap(({ name, snapshot }) => snapshot.docs.map((item) => ({
          name, id: item.id, data: item.data(),
        })));
        copies.push({ name: 'settings', id: 'general', data: { categories, wallets, walletBalances, ...(sixJars ? { sixJars: encodeJarSettings(sixJars) } : {}) } });

        const chunkSize = 400;
        for (let i = 0; i < copies.length; i += chunkSize) {
          const batch = writeBatch(db);
          for (const { name, id, data } of copies.slice(i, i + chunkSize)) {
            batch.set(doc(db, 'artifacts', baseAppId, 'public', 'data', `sync_${newCode}_${name}`, id), data);
          }
          await batch.commit();
        }

        localStorage.setItem('finance_hub_sync_code', newCode);
        setSyncCode(newCode);
        showToast(`Đã tạo phòng đồng bộ: ${newCode}`, 'success');
      } catch (error) {
        console.error(error);
        showToast('Lỗi khi tải dữ liệu lên đám mây!', 'warning');
      }
      setIsProcessing(false);
    },
    
    joinCloudSync: () => {
      if (!inputSyncCode.trim()) return;
      const code = inputSyncCode.trim().toUpperCase();
      localStorage.setItem('finance_hub_sync_code', code);
      setSyncCode(code); 
      setInputSyncCode('');
      showToast(`Đã kết nối tới phòng: ${code}`, 'success');
    }
  };

  // Các hàm quản lý Cài đặt
  const cancelEdit = () => { setEditingId(null); setSettingsForm({ budgetAmount: '', budgetCategory: '', walletName: '', categoryName: '', categoryType: 'INCOME', goalName: '', goalAmount: '', goalCurrentAmount: '', goalWallet: '' }); };

  const handleExportCSV = () => {
    const isAnnualExport = activeTab === 'annual';
    const sourceData = isAnnualExport ? annualTransactions : transactions;
    if (sourceData.length === 0) { showToast('Không có dữ liệu để xuất!', 'warning'); return; }

    const exportedMonths = new Set(sourceData.map((row) => row.date.slice(0, 7)));
    const repayments = fundRepayments.filter((item) => item.payDate && exportedMonths.has(item.payDate.slice(0, 7)));
    const referencedGoals = new Set([...sourceData, ...repayments].map((item) => item.goalId).filter(Boolean));
    const csvContent = serializeFinanceCsv({
      transactions: sourceData,
      goals: goals.filter((goal) => referencedGoals.has(goal.id)),
      repayments,
      reimbursementLinks,
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; 
    link.setAttribute('download', isAnnualExport ? `FinanceHub_BaoCao_Nam_${selectedYear}.csv` : `FinanceHub_T${selectedMonth+1}_${selectedYear}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    showToast('Tải báo cáo thành công!', 'success');
  };

  const handleDownloadSampleCSV = () => {
    const csvContent = serializeFinanceImportSampleCsv();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; 
    link.setAttribute('download', 'FinanceHub_MauNhapLieu.csv');
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleImportCSV = async (event) => {
    const file = event.target.files[0];
    if (!file || !user) return;
    
    setIsProcessing(true);
    showToast('Đang phân tích dữ liệu Excel...', 'success');
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const text = e.target.result;
            const parsed = parseFinanceCsv(text, { wallets, categories });
            if (parsed.validCount === 0) {
              showToast(parsed.errors[0]?.message || 'Không có dữ liệu hợp lệ', 'error');
              return;
            }

            const collectionNames = [...new Set(parsed.rows.map((row) => row.col))];
            const existingSnaps = await Promise.all(
              collectionNames.map((name) => getDocs(getCollectionRef(name))),
            );
            const existingTransactions = existingSnaps.flatMap((snap) => snap.docs.map((docSnap) => ({ ...docSnap.data(), id: docSnap.id })));
            const deduped = omitImportedDuplicates(parsed.rows, existingTransactions);

            const payloads = deduped.rows;
            const { newWallets, newIncCats, newExpCats } = parsed;
            let validCount = 0;
            const lastImportedDate = payloads.reduce((latest, row) => {
              const date = row.data.date;
              return !latest || date > latest ? date : latest;
            }, null);

            const chunkSize = 200;
            for (let i = 0; i < payloads.length; i += chunkSize) {
                const chunk = payloads.slice(i, i + chunkSize);
                const refs = chunk.map(({ col, id }) => id ? getDocRef(col, id) : doc(getCollectionRef(col)));
                validCount += await runTransaction(db, async (batch) => {
                  const existing = await Promise.all(chunk.map(({ id }, index) => id ? batch.get(refs[index]) : null));
                  const inserted = chunk.filter((row, index) => {
                    if (existing[index]?.exists()) return false;
                    batch.set(refs[index], row.data);
                    return true;
                  });
                  if (!inserted.length) return 0;
                  const walletBalances = Object.fromEntries(Object.entries(sumImportImpact(inserted))
                  .filter(([, delta]) => delta !== 0)
                  .map(([wallet, delta]) => [wallet, increment(delta)]));
                  batch.set(getDocRef('settings', 'general'), {
                    wallets: newWallets,
                    categories: { INCOME: newIncCats, EXPENSE: newExpCats },
                    ...(Object.keys(walletBalances).length ? { walletBalances } : {}),
                  }, { merge: true });
                  return inserted.length;
                });
            }

            const metadata = [
              ...parsed.ledgerGoals.map(({ id, ...data }) => ({ ref: getDocRef('goals', id), data })),
              ...parsed.ledgerRepayments.map(({ id, ...data }) => ({ ref: getDocRef('fundRepayments', id), data })),
              ...parsed.reimbursementLinks.map((data) => ({ ref: getDocRef('reimbursementLinks', data.receiptKey), data })),
            ];
            for (let i = 0; i < metadata.length; i += chunkSize) {
              const chunk = metadata.slice(i, i + chunkSize);
              await runTransaction(db, async (batch) => {
                const existing = await Promise.all(chunk.map(({ ref }) => batch.get(ref)));
                chunk.forEach(({ ref, data }, index) => {
                  if (!existing[index].exists()) batch.set(ref, data);
                });
              });
            }
            if (!validCount && !metadata.length) {
              showToast('Các dòng này đã có trong sổ.', 'warning');
              return;
            }

            if (lastImportedDate) {
                const [lastY, lastM] = lastImportedDate.split('-');
                setSelectedYear(parseInt(lastY));
                setSelectedMonth(parseInt(lastM) - 1);
            }

            const skippedErrors = parsed.errors.length;
            let importMessage = `Đã nhập ${validCount} giao dịch.`;
            if (deduped.skipped > 0) importMessage += ` Bỏ qua ${deduped.skipped} dòng trùng.`;
            if (skippedErrors > 0) importMessage += ` Bỏ qua ${skippedErrors} dòng lỗi.`;
            showToast(importMessage, skippedErrors > 0 ? 'warning' : 'success');
            setAnnualRefreshTick(v => v + 1);
        } catch (err) {
            console.error(err);
            showToast('Lỗi đọc file: Vui lòng tải Mẫu và điền đúng định dạng!', 'error');
        } finally {
            setIsProcessing(false);
            event.target.value = ''; 
        }
    };
    reader.readAsText(file);
  };

  const handleEditTransaction = (tx) => {
    setModalType('TRANSACTION');
    setEditingTxId(tx.id);
    if (tx.category.includes('Chuyển khoản')) { showToast('Hãy xóa và tạo lại đối với giao dịch luân chuyển tiền.', 'warning'); return; }
    setFormData({ type: tx.type, amount: tx.amount, note: tx.note, wallet: tx.wallet, category: tx.category, date: tx.date, linkedWallet: tx.linkedWallet || '', goalId: tx.goalId || '', originalTx: tx });
    setUseLinkedWallet(!!tx.linkedWallet);
    setShowModal(true);
  };

  const handleSaveBudget = async () => {
     if (!user || !isBudgetFormReady(settingsForm)) return;
     const payload = buildBudgetPayload({ form: settingsForm });
     await saveBudgetToFirestore({ getCollectionRef, getDocRef, payload, editingId });
     cancelEdit(); showToast('Đã lưu hạn mức ngân sách', 'success');
  };

  const handleSaveWallet = async () => {
     const cleanName = normalizeWalletName(settingsForm.walletName);
     if (!cleanName) return;
     if (hasWalletNameConflict({ wallets, cleanName, editingId })) {
       showToast('Ví này đã có.', 'warning');
       return;
     }
     const result = await saveWalletToFirestore({
       getCollectionRef,
       getDocRef,
       wallets,
       walletBalances,
       form: settingsForm,
       editingId,
     });
     cancelEdit();
     showToast(
       result.outcome === 'renamed' ? 'Cập nhật tên ví thành công!' : 'Đã thêm ví mới!',
       'success',
     );
  };

  const handleDeleteWallet = async (index) => {
    if (!user) return;
    if (!canDeleteWallet({ wallets })) {
      showToast('Cần giữ lại ít nhất một ví.', 'warning');
      return;
    }
    const name = wallets?.[index];
    if (!name) return;
    const balance = Number(walletBalances?.[name] || 0);
    const balanceNote = balance !== 0
      ? ` Số dư ${utils.formatVND(balance)} sẽ không còn tính vào thực tế.`
      : '';
    if (!window.confirm(`Xóa ví "${name}"? Giao dịch cũ vẫn giữ tên ví này.${balanceNote}`)) return;
    await deleteWalletFromFirestore({
      getDocRef,
      wallets,
      index,
      walletName: name,
    });
    setEditingId(null);
    setSettingsForm((form) => ({ ...form, walletName: '' }));
    showToast('Đã xóa ví', 'success');
  };

  const handleSaveCategory = async () => {
     if (!isCategoryFormReady(settingsForm)) return;
     const cleanName = normalizeCategoryName(settingsForm.categoryName);
     if (!cleanName) return;
     if (!canRenameOpeningBalanceCategory({
       categories,
       categoryType: settingsForm.categoryType,
       editingId,
       cleanName,
     })) {
       showToast('Không đổi tên danh mục Số dư đầu kỳ.', 'warning');
       return;
     }
     if (hasCategoryNameConflict({
       categories,
       categoryType: settingsForm.categoryType,
       cleanName,
       editingId,
     })) {
       showToast('Danh mục này đã có.', 'warning');
       return;
     }
     const result = await saveCategoryToFirestore({
       getCollectionRef,
       getDocRef,
       categories,
       form: settingsForm,
       editingId,
       sixJars,
     });
     if (result.outcome === 'renamed') setAnnualRefreshTick((value) => value + 1);
     cancelEdit();
     showToast(
       result.outcome === 'renamed' ? 'Cập nhật danh mục thành công!' : 'Đã lưu danh mục mới!',
       'success',
     );
  };

  const handleDeleteCategory = async (index) => {
    if (!user) return;
    const categoryType = settingsForm.categoryType;
    if (!canDeleteCategory({ categories, categoryType, index })) {
      showToast('Cần giữ lại danh mục Số dư đầu kỳ.', 'warning');
      return;
    }
    const name = categories?.[categoryType]?.[index];
    if (!name) return;
    if (!window.confirm(`Xóa danh mục "${name}"? Giao dịch cũ vẫn giữ tên này.`)) return;
    await deleteCategoryFromFirestore({
      getDocRef,
      categories,
      categoryType,
      index,
    });
    setEditingId(null);
    setSettingsForm((form) => ({ ...form, categoryName: '' }));
    showToast('Đã xóa danh mục', 'success');
  };

  const handleSaveGoal = async () => {
     if (!user || !isGoalFormReady(settingsForm)) return;
     const payload = buildGoalPayload({ form: settingsForm });
     const previousGoal = editingId ? (goals || []).find((goal) => goal.id === editingId) : null;
     const amountEdited = previousGoal
       ? goalAmountWasEdited(previousGoal.amount, payload.amount)
       : false;
     await saveGoalToFirestore({
       getCollectionRef,
       getDocRef,
       payload,
       editingId,
       previousGoal,
       resetBalance: amountEdited,
     });
     cancelEdit();
     showToast(
       amountEdited
         ? 'Đã lưu số quỹ. Xóa giao dịch cũ sẽ không cộng trừ lại quỹ này.'
         : 'Đã lưu kế hoạch tích lũy',
       'success',
     );
  };

  useEffect(() => {
    applyAppearance(appearance);
  }, [appearance]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

  return (
    <div className="app-shell min-h-screen bg-[#F4F7FE] text-[#2B3674] font-sans selection:bg-[#4318FF]/10 relative [-webkit-tap-highlight-color:transparent]">
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E1E9F8; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #A3AED0; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      <Toast toast={toast} />

      {/* --- HEADER --- */}
      <header className="bg-white/80 backdrop-blur-xl sticky top-0 z-30 shadow-sm border-b border-gray-100/50 px-4 md:px-8 transition-all">
         <div className="max-w-[1400px] mx-auto">
            <AppHeader
              greeting={greeting}
              syncCode={syncCode}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              setActiveSettingTab={setActiveSettingTab}
              wallets={wallets}
              categories={categories}
              setEditingTxId={setEditingTxId}
              setModalType={setModalType}
              setFormData={setFormData}
              setShowModal={setShowModal}
            />
            <MainNav activeTab={activeTab} setActiveTab={setActiveTab} />
         </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-6 pb-24 lg:pb-8 overflow-x-hidden">
         {/* --- DASHBOARD TAB --- */}
         {activeTab === 'dashboard' && (
            <DashboardView
              logic={logic}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              setSelectedMonth={setSelectedMonth}
              setSelectedYear={setSelectedYear}
              showBalance={showBalance}
              setShowBalance={setShowBalance}
              selectedExpenseCategory={selectedExpenseCategory}
              setSelectedExpenseCategory={setSelectedExpenseCategory}
              setExpandedTxId={setExpandedTxId}
              walletView={walletView}
              setWalletView={setWalletView}
              selectedWalletDetail={selectedWalletDetail}
              setSelectedWalletDetail={setSelectedWalletDetail}
              budgets={budgets}
              setActiveTab={setActiveTab}
              setActiveSettingTab={setActiveSettingTab}
              cancelEdit={cancelEdit}
              generateDashboardAdvice={generateDashboardAdvice}
              monthComparison={monthComparison}
              comparisonReady={comparisonReady}
              combinedBudgetReady={sixJarPlan?.ready}
              sixJarsPanel={user ? (
                <SixJarsPanel
                  key={syncCode || user.uid}
                  settings={sixJars}
                  categories={categories.EXPENSE}
                  plan={sixJarPlan}
                  budgetProgress={logic.budgetProgress}
                  transactions={logic.monthData}
                  onOpenTransaction={handleEditTransaction}
                  onOpenBudgets={() => {
                    setActiveTab('settings');
                    setActiveSettingTab('budget');
                    cancelEdit();
                  }}
                  onSave={async (settings) => {
                    try {
                      const settingsRef = getDocRef('settings', 'general');
                      await runTransaction(db, async (transaction) => {
                        const stored = (await transaction.get(settingsRef)).data()?.categories || categories;
                        const expenseCategories = stored.EXPENSE || [];
                        transaction.set(settingsRef, {
                          sixJars: encodeJarSettings(settings),
                          categories: {
                            ...stored,
                            EXPENSE: [...new Set([...expenseCategories, settings.childCategory])],
                          },
                        }, { merge: true });
                      });
                    } catch (error) {
                      showToast('Chưa lưu được thiết lập 6 hũ.', 'error');
                      throw error;
                    }
                    showToast('Đã lưu thiết lập 6 hũ.', 'success');
                  }}
                />
              ) : null}
              setFilterType={setFilterType}
              setFilterCategory={setFilterCategory}
              setFilterWallet={setFilterWallet}
              setSearchQuery={setSearchQuery}
              handleEditTransaction={handleEditTransaction}
            />
         )}

         {activeTab === 'transactions' && (
            <TransactionsView
              logic={logic}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              setSelectedMonth={setSelectedMonth}
              setSelectedYear={setSelectedYear}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              filterType={filterType}
              setFilterType={setFilterType}
              filterWallet={filterWallet}
              setFilterWallet={setFilterWallet}
              filterCategory={filterCategory}
              setFilterCategory={setFilterCategory}
              wallets={wallets}
              categories={categories}
              isProcessing={isProcessing}
              handleDownloadSampleCSV={handleDownloadSampleCSV}
              handleImportCSV={handleImportCSV}
              handleExportCSV={handleExportCSV}
              handleEditTransaction={handleEditTransaction}
              dbActions={dbActions}
              monthComparison={monthComparison}
            />
         )}

         {activeTab === 'report' && (
            <ReportView
              report={monthReport}
              transactions={transactions}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              setSelectedMonth={setSelectedMonth}
              setSelectedYear={setSelectedYear}
              handleEditTransaction={handleEditTransaction}
              yearTransactions={annualTransactions}
              history={history}
              reimbursementLinks={reimbursementLinks}
              onMatchReimbursement={async (receipt, expense) => {
                const receiptKey = transactionKey(receipt);
                try {
                  const ref = getDocRef('reimbursementLinks', receiptKey);
                  if (expense) await setDoc(ref, { receiptKey, expenseKey: transactionKey(expense) });
                  else await deleteDoc(ref);
                  showToast('Đã đối chiếu khoản hoàn ứng.', 'success');
                } catch (error) {
                  console.error(error);
                  showToast('Chưa lưu được liên kết hoàn ứng.', 'error');
                }
              }}
              wallets={wallets}
              budgets={budgets}
              goals={goals}
              fundRepayments={fundRepayments}
              onOpenBudgets={() => {
                setActiveTab('settings');
                setActiveSettingTab('budget');
                cancelEdit();
              }}
              onOpenLedger={(type, category) => {
                setFilterType(type);
                setFilterCategory(category);
                setFilterWallet('ALL');
                setSearchQuery('');
                setActiveTab('transactions');
              }}
            />
         )}

         {activeTab === 'annual' && (
            <AnnualView
              logic={logic}
              selectedYear={selectedYear}
              setSelectedYear={setSelectedYear}
              annualSelectedMonth={annualSelectedMonth}
              setAnnualSelectedMonth={setAnnualSelectedMonth}
              annualSelectedExpenseCategory={annualSelectedExpenseCategory}
              setAnnualSelectedExpenseCategory={setAnnualSelectedExpenseCategory}
              isFetchingAnnual={isFetchingAnnual}
              handleExportCSV={handleExportCSV}
              generateAnnualAIAdvice={generateAnnualAIAdvice}
              handleEditTransaction={handleEditTransaction}
              previousYearTransactions={previousYearTransactions}
              previousYearReady={previousYearReady}
              context={financeContext}
              goals={goals}
              fundRepayments={fundRepayments}
            />
         )}

         {/* --- SETTINGS TAB --- */}
         {activeTab === 'settings' && (
            <SettingsView
              activeSettingTab={activeSettingTab}
              setActiveSettingTab={setActiveSettingTab}
              cancelEdit={cancelEdit}
              auth={auth}
              user={user}
              authInitialized={authInitialized}
              showToast={showToast}
              isProcessing={isProcessing}
              syncCode={syncCode}
              setSyncCode={setSyncCode}
              inputSyncCode={inputSyncCode}
              setInputSyncCode={setInputSyncCode}
              dbActions={dbActions}
              settingsForm={settingsForm}
              setSettingsForm={setSettingsForm}
              editingId={editingId}
              setEditingId={setEditingId}
              budgets={budgets}
              wallets={wallets}
              walletBalances={walletBalances}
              categories={categories}
              goals={goals}
              logic={logic}
              handleSaveBudget={handleSaveBudget}
              handleSaveWallet={handleSaveWallet}
              handleDeleteWallet={handleDeleteWallet}
              handleSaveCategory={handleSaveCategory}
              handleDeleteCategory={handleDeleteCategory}
              handleSaveGoal={handleSaveGoal}
              resetWalletBalance={resetWalletBalance}
              appearance={appearance}
              setAppearance={setAppearance}
              dataSourceDiagnostics={dataSourceDiagnostics}
              walletBalanceDifferences={walletBalanceDifferences}
              legacyMigrationReadiness={legacyMigrationReadiness}
              legacyMigrationInspection={legacyMigrationInspection}
              isInspectingLegacyMigration={isInspectingLegacyMigration}
              onInspectLegacyMigration={handleInspectLegacyMigration}
            />
         )}
      </main>

      {/* --- GIAO DIỆN NHẬP GIAO DỊCH (MODAL) --- */}
      {showModal && (
            <TransactionModal
              editingTxId={editingTxId}
              formData={formData}
              setFormData={setFormData}
              categories={categories}
              wallets={wallets}
              useLinkedWallet={useLinkedWallet}
              setUseLinkedWallet={setUseLinkedWallet}
              handleCloseModal={handleCloseModal}
              onSaveTransaction={dbActions.saveTransaction}
              isSavingTransaction={isSavingTransaction}
              goals={goals}
              walletBalances={walletBalances}
            />
      )}
    </div>
  );
}
