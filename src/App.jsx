import React, { useState, useMemo } from 'react';
import { 
  collection, addDoc, doc, deleteDoc, updateDoc, setDoc, getDoc, getDocs, writeBatch, increment
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
import TransactionsView from './features/transactions/TransactionsView.jsx';
import AnnualView from './features/annual/AnnualView.jsx';
import SettingsView from './features/settings/SettingsView.jsx';
import TransactionModal from './features/transactions/TransactionModal.jsx';
import utils from './utils/format.js';
import { deriveFinanceLogic, deriveTransactionView } from './logic/deriveFinance.js';
import { buildDataSourceDiagnostics } from './logic/dataSourceDiagnostics.js';
import {
  parseFinanceCsv,
  serializeFinanceCsv,
  serializeFinanceImportSampleCsv,
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
  saveBudgetToFirestore,
  saveGoalToFirestore,
  deleteBudgetFromFirestore,
  deleteGoalFromFirestore,
} from './services/finance/planningService.js';
import { isWalletFormReady, isCategoryFormReady } from './logic/walletCategoryEntities.js';
import {
  saveWalletToFirestore,
  saveCategoryToFirestore,
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

// ==========================================
// MAIN APP COMPONENT
// ==========================================
export default function App() {
  const user = useAuthUser();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('TRANSACTION');
  const [showBalance, setShowBalance] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeSettingTab, setActiveSettingTab] = useState('sync');
  
  const [syncCode, setSyncCode] = useState(localStorage.getItem('finance_hub_sync_code') || '');
  const { getCollectionRef, getDocRef } = useFirestoreRefs({ user, syncCode });
  const [inputSyncCode, setInputSyncCode] = useState('');

  const [formData, setFormData] = useState({});
  const [editingTxId, setEditingTxId] = useState(null);
  const [settingsForm, setSettingsForm] = useState({ budgetAmount: '', budgetCategory: '', walletName: '', categoryName: '', categoryType: 'INCOME', goalName: '', goalAmount: '', goalCurrentAmount: '' });
  const [editingId, setEditingId] = useState(null);
  const [useLinkedWallet, setUseLinkedWallet] = useState(false);
  
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [legacyMigrationInspection, setLegacyMigrationInspection] = useState(null);
  const [isInspectingLegacyMigration, setIsInspectingLegacyMigration] = useState(false);

  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState(null);
  const [, setExpandedTxId] = useState(null);
  const [walletView, setWalletView] = useState('list'); 
  const [selectedWalletDetail, setSelectedWalletDetail] = useState(null);
  const [annualSelectedMonth, setAnnualSelectedMonth] = useState('ALL');
  const [annualSelectedExpenseCategory, setAnnualSelectedExpenseCategory] = useState(null);
  const [annualExpandedTxId, setAnnualExpandedTxId] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterWallet, setFilterWallet] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [annualRefreshTick, setAnnualRefreshTick] = useState(0);

  const { categories, wallets, walletBalances } = useFinanceSettings({ user, getDocRef, syncCode });
  const { transactions, goals, budgets } = useMonthlyFinanceData({
    user,
    syncCode,
    selectedYear,
    selectedMonth,
    getCollectionRef,
  });
  const { annualTransactions, isFetchingAnnual } = useAnnualTransactions({
    user,
    syncCode,
    activeTab,
    selectedYear,
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
  
  const coreLogic = useMemo(
    () =>
      deriveFinanceLogic({
        transactions,
        annualTransactions,
        walletBalances,
        selectedMonth,
        selectedYear,
        wallets,
        categories,
        annualSelectedMonth,
        goals,
        budgets,
      }),
    [transactions, annualTransactions, walletBalances, selectedMonth, selectedYear, wallets, categories, annualSelectedMonth, goals, budgets],
  );

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
        if (activeTab === 'annual') setAnnualRefreshTick(v => v + 1);
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
          if (activeTab === 'annual') setAnnualRefreshTick(v => v + 1);
      } catch (error) {
          console.error(error);
          showToast('Lỗi khi dọn dẹp dữ liệu mẫu!', 'error');
      }
      setIsProcessing(false);
    },

    saveTransaction: async () => {
      if (!user) return;
      if (modalType === 'TRANSACTION') {
          if (!formData.amount || Number(formData.amount) <= 0) { showToast('Vui lòng nhập số tiền hợp lệ!', 'warning'); return; }
          if (formData.type !== 'TRANSFER' && !formData.category) { showToast('Vui lòng chọn danh mục!', 'warning'); return; }
          if (formData.type === 'TRANSFER' && (!formData.toWallet || formData.wallet === formData.toWallet)) { showToast('Ví nguồn và ví đích không được trùng nhau!', 'warning'); return; }
      }

      const colName = modalType === 'TRANSACTION' ? 'transactions' : modalType === 'GOAL' ? 'goals' : 'budgets';
      let payload = { ...formData, amount: Number(formData.amount || 0), target: Number(formData.target || 0), isSample: false };
      
      const originalTx = payload.originalTx;
      delete payload.originalTx;
      
      if (modalType === 'TRANSACTION') {
          if (!payload.date) payload.date = utils.getLocalYMD();
          if (!payload.wallet) payload.wallet = wallets[0];
          if (useLinkedWallet && formData.linkedWallet && formData.type === 'EXPENSE') payload.linkedWallet = formData.linkedWallet;
          else payload.linkedWallet = ''; 
          
          if (formData.type === 'TRANSFER' && !editingTxId) {
              await saveTransactionToFirestore({
                getCollectionRef,
                getDocRef,
                payload,
                isTransferCreate: true,
                transferFromWallet: formData.wallet,
                transferToWallet: formData.toWallet,
                transferNote: formData.note,
              });
              handleCloseModal();
              showToast('Đã luân chuyển tiền thành công!', 'success');
              if (activeTab === 'annual') setAnnualRefreshTick(v => v + 1); 
              return;
          }
          
          await saveTransactionToFirestore({
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
      
      showToast('Đã lưu thành công!', 'success');
      handleCloseModal();
      if (activeTab === 'annual') setAnnualRefreshTick(v => v + 1);
    },
    
    deleteItem: async (col, id, txObj) => {
      if (isProcessing) return;
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
               transaction: txObj,
             });
             if (deleteResult.kind === 'transfer_pair') {
                 showToast('Đã xóa toàn bộ phiếu luân chuyển!', 'success');
             } else {
                 showToast('Đã xóa dữ liệu', 'success');
             }
             if (activeTab === 'annual') setAnnualRefreshTick(v => v + 1);
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
        const currentYearObj = new Date().getFullYear();
        const payloads = [];
        
        for(let y = currentYearObj - 5; y <= currentYearObj + 1; y++) {
            for(let m = 1; m <= 12; m++) {
                const mStr = String(m).padStart(2,'0');
                const snap = await getDocs(collection(db, 'artifacts', baseAppId, 'users', user.uid, `transactions_${y}_${mStr}`));
                snap.docs.forEach(doc => {
                    payloads.push(setDoc(doc(db, 'artifacts', baseAppId, 'public', 'data', `sync_${newCode}_transactions_${y}_${mStr}`, doc.id), doc.data()));
                });
            }
        }
        
        const gSnap = await getDocs(collection(db, 'artifacts', baseAppId, 'users', user.uid, 'goals'));
        gSnap.docs.forEach(d => payloads.push(setDoc(doc(db, 'artifacts', baseAppId, 'public', 'data', `sync_${newCode}_goals`, d.id), d.data())));
        
        const bSnap = await getDocs(collection(db, 'artifacts', baseAppId, 'users', user.uid, 'budgets'));
        bSnap.docs.forEach(d => payloads.push(setDoc(doc(db, 'artifacts', baseAppId, 'public', 'data', `sync_${newCode}_budgets`, d.id), d.data())));

        payloads.push(setDoc(doc(db, 'artifacts', baseAppId, 'public', 'data', `sync_${newCode}_settings`, 'general'), { categories, wallets, walletBalances }));

        const chunkSize = 50;
        for (let i = 0; i < payloads.length; i += chunkSize) {
            await Promise.all(payloads.slice(i, i + chunkSize));
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
  const cancelEdit = () => { setEditingId(null); setSettingsForm({ budgetAmount: '', budgetCategory: '', walletName: '', categoryName: '', categoryType: 'INCOME', goalName: '', goalAmount: '', goalCurrentAmount: '' }); };

  const handleExportCSV = () => {
    const isAnnualExport = activeTab === 'annual';
    const sourceData = isAnnualExport ? annualTransactions : logic.filteredTransactions;
    if (sourceData.length === 0) { showToast('Không có dữ liệu để xuất!', 'warning'); return; }

    const csvContent = serializeFinanceCsv({ transactions: sourceData });
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
              const firstError = parsed.errors[0]?.message || 'Không có dữ liệu hợp lệ';
              throw new Error(firstError);
            }

            const payloads = parsed.rows;
            const { totalImpact, validCount, lastImportedDate, newWallets, newIncCats, newExpCats } = parsed;

            const chunkSize = 450;
            for (let i = 0; i < payloads.length; i += chunkSize) {
                const chunk = payloads.slice(i, i + chunkSize);
                const batch = writeBatch(db);
                chunk.forEach(p => {
                    const docRef = doc(getCollectionRef(p.col));
                    batch.set(docRef, p.data);
                });
                await batch.commit();
            }

            const walletUpdates = {};
            Object.keys(totalImpact).forEach(w => {
                if (totalImpact[w] !== 0) walletUpdates[w] = increment(totalImpact[w]);
            });

            const wbUpdates = {
                wallets: newWallets,
                categories: { INCOME: newIncCats, EXPENSE: newExpCats },
            };
            
            if (Object.keys(walletUpdates).length > 0) {
                wbUpdates.walletBalances = walletUpdates;
            }
            
            await setDoc(getDocRef('settings', 'general'), wbUpdates, { merge: true });

            if (lastImportedDate) {
                const [lastY, lastM] = lastImportedDate.split('-');
                setSelectedYear(parseInt(lastY));
                setSelectedMonth(parseInt(lastM) - 1);
            }

            showToast(`Đã nhập thành công ${validCount} giao dịch!`, 'success');
            if (activeTab === 'annual') setAnnualRefreshTick(v => v + 1);
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
    setFormData({ type: tx.type, amount: tx.amount, note: tx.note, wallet: tx.wallet, category: tx.category, date: tx.date, linkedWallet: tx.linkedWallet || '', originalTx: tx });
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
     if (!isWalletFormReady(settingsForm)) return;
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

  const handleSaveCategory = async () => {
     if (!isCategoryFormReady(settingsForm)) return;
     const result = await saveCategoryToFirestore({
       getCollectionRef,
       getDocRef,
       categories,
       form: settingsForm,
       editingId,
     });
     cancelEdit();
     showToast(
       result.outcome === 'renamed' ? 'Cập nhật danh mục thành công!' : 'Đã lưu danh mục mới!',
       'success',
     );
  };

  const handleSaveGoal = async () => {
     if (!user || !isGoalFormReady(settingsForm)) return;
     const payload = buildGoalPayload({ form: settingsForm });
     await saveGoalToFirestore({ getCollectionRef, getDocRef, payload, editingId });
     cancelEdit(); showToast('Đã lưu kế hoạch tích lũy', 'success');
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

  return (
    <div className="min-h-screen bg-[#F4F7FE] text-[#2B3674] font-sans selection:bg-[#4318FF]/10 relative [-webkit-tap-highlight-color:transparent]">
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
      <main className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-6 pb-24 lg:pb-8">
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
              annualExpandedTxId={annualExpandedTxId}
              setAnnualExpandedTxId={setAnnualExpandedTxId}
              isFetchingAnnual={isFetchingAnnual}
              handleExportCSV={handleExportCSV}
              generateAnnualAIAdvice={generateAnnualAIAdvice}
              handleEditTransaction={handleEditTransaction}
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
              handleSaveCategory={handleSaveCategory}
              handleSaveGoal={handleSaveGoal}
              resetWalletBalance={resetWalletBalance}
              dataSourceDiagnostics={dataSourceDiagnostics}
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
            />
      )}
    </div>
  );
}
