import React, { useState, useMemo } from 'react';
import { 
  collection, addDoc, doc, deleteDoc, updateDoc, setDoc, getDoc, getDocs, query, where, writeBatch, increment
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

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const resetWalletBalance = async (wName) => {
    if (!user || isProcessing) return;
    setIsProcessing(true);
    showToast('Đang kiểm tra lịch sử giao dịch...', 'success');
    try {
      const currentYearObj = new Date().getFullYear();
      const promises = [];
      for(let y = currentYearObj - 5; y <= currentYearObj + 1; y++) {
          for(let m = 1; m <= 12; m++) {
              promises.push(getDocs(getCollectionRef(`transactions_${y}_${String(m).padStart(2,'0')}`)));
          }
      }
      const results = await Promise.all(promises);
      let hasTx = false;
      for (const snap of results) {
          if (snap.docs.some(doc => doc.data().wallet === wName || doc.data().linkedWallet === wName)) {
              hasTx = true;
              break;
          }
      }

      if (hasTx) {
          showToast(`Lỗi: Ví "${wName}" đang chứa giao dịch. Không thể đưa về 0đ!`, 'warning');
          setIsProcessing(false);
          return;
      }

      await setDoc(getDocRef('settings', 'general'), { walletBalances: { [wName]: 0 } }, { merge: true });
      showToast(`Đã đưa số dư ${wName} về 0đ`, 'success');
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
          const currentYearObj = new Date().getFullYear();
          const promisesToFetch = [];
          for(let y = currentYearObj - 5; y <= currentYearObj + 1; y++) {
              for(let m = 1; m <= 12; m++) {
                  promisesToFetch.push(getDocs(getCollectionRef(`transactions_${y}_${String(m).padStart(2,'0')}`)));
              }
          }
          const allSnaps = await Promise.all(promisesToFetch);
          
          const exactBalances = {};

          allSnaps.forEach(snap => {
              snap.docs.forEach(doc => {
                  const data = doc.data();
                  const wIn = data.type === 'INCOME' ? data.wallet : null;
                  const wOut = data.type === 'EXPENSE' ? (data.linkedWallet || data.wallet) : null;
                  
                  if (wIn) exactBalances[wIn] = (exactBalances[wIn] || 0) + Number(data.amount || 0);
                  if (wOut) exactBalances[wOut] = (exactBalances[wOut] || 0) - Number(data.amount || 0);
              });
          });

          // Đảm bảo tất cả các ví hiện tại đều có mặt trong danh sách cập nhật
          (wallets || []).forEach(w => {
              if (exactBalances[w] === undefined) exactBalances[w] = 0;
          });

          const settingsRef = getDocRef('settings', 'general');
          const snapSettings = await getDoc(settingsRef);
          
          if (snapSettings.exists()) {
              // Ghi đè hoàn toàn để xóa triệt để số dư của các ví "bóng ma" đã bị xóa
              await updateDoc(settingsRef, { walletBalances: exactBalances });
          } else {
              await setDoc(settingsRef, { walletBalances: exactBalances }, { merge: true });
          }

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
      const batch = writeBatch(db);
      try {
        const expenses = ['Ăn uống', 'Di chuyển', 'Mua sắm', 'Hóa đơn'];
        let totalImpact = {};
        wallets.forEach(w => totalImpact[w] = 0);

        // Khởi tạo số dư đầu kỳ cho các ví
        const colJan = getCollectionRef('transactions_2025_01');
        wallets.forEach((w, i) => {
          const amt = 10000000 + (i * 5000000); // Khởi tạo 10tr, 15tr, 20tr... để tránh âm ví
          totalImpact[w] += amt;
          batch.set(doc(colJan), {
            type: 'INCOME', category: 'Số dư đầu kỳ', amount: amt, wallet: w,
            date: '2025-01-01', note: `Khởi tạo số dư ví ${w}`, createdAt: new Date().toISOString(), isSample: true
          });
        });

        for (let m = 1; m <= 12; m++) {
          const mStr = String(m).padStart(2, '0');
          const colRef = getCollectionRef(`transactions_2025_${mStr}`);
          
          // Tạo thu nhập chính (Lương) đổ vào Ví thứ 2 (Ví ngân hàng)
          const incomeBank = wallets.length > 1 ? wallets[1] : wallets[0];
          const salary = 15000000 + Math.floor(Math.random() * 5000000);
          totalImpact[incomeBank] = (totalImpact[incomeBank] || 0) + salary;
          batch.set(doc(colRef), {
            type: 'INCOME', category: 'Lương', amount: salary, wallet: incomeBank,
            date: `2025-${mStr}-05`, note: `Lương tháng ${m}`, createdAt: new Date().toISOString(), isSample: true
          });

          // Tạo thu nhập phụ (Thưởng) đổ vào Tiền mặt
          const incomeCash = wallets[0];
          const extraInc = 2000000 + Math.floor(Math.random() * 3000000);
          totalImpact[incomeCash] = (totalImpact[incomeCash] || 0) + extraInc;
          batch.set(doc(colRef), {
            type: 'INCOME', category: 'Thưởng', amount: extraInc, wallet: incomeCash,
            date: `2025-${mStr}-12`, note: `Thu nhập phụ tháng ${m}`, createdAt: new Date().toISOString(), isSample: true
          });

          // Tạo chi tiêu ngẫu nhiên
          for (let i = 0; i < 6; i++) {
            const amt = 50000 + Math.floor(Math.random() * 1000000);
            const targetW = wallets[Math.floor(Math.random() * wallets.length)];
            const cat = expenses[Math.floor(Math.random() * expenses.length)];
            const day = String(Math.floor(Math.random() * 25) + 1).padStart(2, '0');
            totalImpact[targetW] = (totalImpact[targetW] || 0) - amt;
            batch.set(doc(colRef), {
              type: 'EXPENSE', category: cat, amount: amt, wallet: targetW,
              date: `2025-${mStr}-${day}`, note: `Chi tiêu mẫu ${i+1}`, createdAt: new Date().toISOString(), isSample: true
            });
          }
        }

        // Cập nhật số dư 1 lần duy nhất bằng setDoc với merge true
        const settingsRef = getDocRef('settings', 'general');
        const wbUpdates = {};
        Object.entries(totalImpact).forEach(([w, val]) => {
           if (val !== 0) wbUpdates[w] = increment(val);
        });
        if (Object.keys(wbUpdates).length > 0) {
            batch.set(settingsRef, { walletBalances: wbUpdates }, { merge: true });
        }

        await batch.commit();
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
          const currentYearObj = new Date().getFullYear();
          const promisesToFetch = [];
          
          for(let y = currentYearObj - 5; y <= currentYearObj + 1; y++) {
              for(let m = 1; m <= 12; m++) {
                  promisesToFetch.push(getDocs(getCollectionRef(`transactions_${y}_${String(m).padStart(2,'0')}`)));
              }
          }
          
          promisesToFetch.push(getDocs(getCollectionRef('goals')));
          promisesToFetch.push(getDocs(getCollectionRef('budgets')));

          const allSnaps = await Promise.all(promisesToFetch);
          const refsToDelete = [];
          const impactToReverse = {};
          
          allSnaps.forEach(snap => {
              snap.docs.forEach(doc => {
                  const data = doc.data();
                  if (data.isSample) {
                      refsToDelete.push(doc.ref);
                      if (data.type === 'INCOME' && data.wallet) {
                          impactToReverse[data.wallet] = (impactToReverse[data.wallet] || 0) - Number(data.amount || 0);
                      } else if (data.type === 'EXPENSE') {
                          const w = data.linkedWallet || data.wallet;
                          if (w) impactToReverse[w] = (impactToReverse[w] || 0) + Number(data.amount || 0);
                      }
                  }
              });
          });

          if (refsToDelete.length === 0) {
              showToast('Không có dữ liệu mẫu nào để xóa!', 'warning');
              setIsProcessing(false);
              return;
          }

          const chunkSize = 450;
          for (let i = 0; i < refsToDelete.length; i += chunkSize) {
              const chunk = refsToDelete.slice(i, i + chunkSize);
              const batch = writeBatch(db);
              chunk.forEach(ref => batch.delete(ref));
              await batch.commit();
          }
          
          const wbUpdates = {};
          Object.keys(impactToReverse).forEach(w => { 
              if (impactToReverse[w] !== 0) wbUpdates[w] = increment(impactToReverse[w]); 
          });
          
          if (Object.keys(wbUpdates).length > 0) {
              await setDoc(getDocRef('settings', 'general'), { walletBalances: wbUpdates }, { merge: true });
          }
          
          showToast(`Đã xóa sạch ${refsToDelete.length} dữ liệu mẫu!`, 'success');
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
      
      const batch = writeBatch(db);
      
      if (modalType === 'TRANSACTION') {
          if (!payload.date) payload.date = utils.getLocalYMD();
          if (!payload.wallet) payload.wallet = wallets[0];
          if (useLinkedWallet && formData.linkedWallet && formData.type === 'EXPENSE') payload.linkedWallet = formData.linkedWallet;
          else payload.linkedWallet = ''; 
          
          const [y, m] = payload.date.split('-');
          const actualCol = `transactions_${y}_${m}`;
          const settingsRef = getDocRef('settings', 'general');
          
          const impacts = {};
          const addImpact = (w, amt) => { if(w) impacts[w] = (impacts[w] || 0) + amt; };
          
          // Case 1: Chuyển khoản (Luân chuyển tiền)
          if (formData.type === 'TRANSFER' && !editingTxId) {
              const transferId = Date.now().toString(); 
              
              const txOutRef = doc(getCollectionRef(actualCol));
              batch.set(txOutRef, { ...payload, type: 'EXPENSE', category: 'Chuyển khoản đi', note: `Chuyển tới ${formData.toWallet}: ${formData.note || ''}`, createdAt: new Date().toISOString(), transferId });
              
              const txInRef = doc(getCollectionRef(actualCol));
              batch.set(txInRef, { ...payload, type: 'INCOME', wallet: formData.toWallet, category: 'Chuyển khoản đến', note: `Nhận từ ${formData.wallet}: ${formData.note || ''}`, createdAt: new Date().toISOString(), transferId });
              
              addImpact(formData.wallet, -payload.amount);
              addImpact(formData.toWallet, payload.amount);
              
              const wbUpdates = {};
              Object.keys(impacts).forEach(w => { if (impacts[w] !== 0) wbUpdates[w] = increment(impacts[w]); });
              if (Object.keys(wbUpdates).length > 0) batch.set(settingsRef, { walletBalances: wbUpdates }, { merge: true });
              
              await batch.commit();
              handleCloseModal();
              showToast('Đã luân chuyển tiền thành công!', 'success');
              if (activeTab === 'annual') setAnnualRefreshTick(v => v + 1); 
              return;
          }
          
          // Case 2: Thu/Chi bình thường (Có hỗ trợ Sửa)
          if (editingTxId && originalTx) {
             const oldW = originalTx.type === 'EXPENSE' ? (originalTx.linkedWallet || originalTx.wallet) : originalTx.wallet;
             const oldAmt = originalTx.type === 'EXPENSE' ? originalTx.amount : -originalTx.amount;
             addImpact(oldW, oldAmt); // Hoàn tiền cũ
          }
          
          const newW = payload.type === 'EXPENSE' ? (payload.linkedWallet || payload.wallet) : payload.wallet;
          const newAmt = payload.type === 'EXPENSE' ? -payload.amount : payload.amount;
          addImpact(newW, newAmt); // Trừ/Cộng tiền mới

          if (editingTxId) {
             const [oldY, oldM] = (originalTx?.date || '').split('-');
             if (originalTx && `${oldY}_${oldM}` !== `${y}_${m}`) {
                 batch.delete(getDocRef(`transactions_${oldY}_${oldM}`, editingTxId));
                 batch.set(getDocRef(actualCol, editingTxId), payload);
             } else {
                 batch.update(getDocRef(actualCol, editingTxId), payload);
             }
          } else {
             payload.createdAt = new Date().toISOString();
             const newTxRef = doc(getCollectionRef(actualCol));
             batch.set(newTxRef, payload);
          }
          
          const wbUpdates = {};
          Object.keys(impacts).forEach(w => { if (impacts[w] !== 0) wbUpdates[w] = increment(impacts[w]); });
          if (Object.keys(wbUpdates).length > 0) batch.set(settingsRef, { walletBalances: wbUpdates }, { merge: true }); 
          
          await batch.commit();
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
             
             const batch = writeBatch(db);
             const settingsRef = getDocRef('settings', 'general');
             const impacts = {};
             const addImpact = (w, amt) => { if(w) impacts[w] = (impacts[w] || 0) + amt; };
             
             if (txObj.transferId) {
                 const q = query(getCollectionRef(actualCol), where("transferId", "==", txObj.transferId));
                 const snap = await getDocs(q);
                 snap.docs.forEach(docSnap => {
                     const rt = docSnap.data();
                     const w = rt.type === 'EXPENSE' ? (rt.linkedWallet || rt.wallet) : rt.wallet;
                     const amt = rt.type === 'EXPENSE' ? rt.amount : -rt.amount;
                     addImpact(w, amt);
                     batch.delete(docSnap.ref);
                 });
                 
                 const wbUpdates = {};
                 Object.keys(impacts).forEach(w => { if (impacts[w] !== 0) wbUpdates[w] = increment(impacts[w]); });
                 if (Object.keys(wbUpdates).length > 0) batch.set(settingsRef, { walletBalances: wbUpdates }, { merge: true });
                 
                 await batch.commit();
                 showToast('Đã xóa toàn bộ phiếu luân chuyển!', 'success');
             } else {
                 const w = txObj.type === 'EXPENSE' ? (txObj.linkedWallet || txObj.wallet) : txObj.wallet;
                 const amt = txObj.type === 'EXPENSE' ? txObj.amount : -txObj.amount;
                 addImpact(w, amt);
                 
                 const wbUpdates = {};
                 Object.keys(impacts).forEach(w => { if (impacts[w] !== 0) wbUpdates[w] = increment(impacts[w]); });
                 if (Object.keys(wbUpdates).length > 0) batch.set(settingsRef, { walletBalances: wbUpdates }, { merge: true });
                 
                 batch.delete(getDocRef(actualCol, id));
                 await batch.commit();
                 showToast('Đã xóa dữ liệu', 'success');
             }
             if (activeTab === 'annual') setAnnualRefreshTick(v => v + 1);
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

    const headers = ['Ngày', 'Nội dung', 'Phân loại', 'Danh mục', 'Nguồn tiền', 'Số tiền (VND)'];
    const rows = [...sourceData].sort((a,b) => new Date(b.date) - new Date(a.date)).map(t => {
      return [utils.formatDisplayDate(t.date), `"${(t.note || '').replace(/"/g, '""')}"`, t.type === 'INCOME' ? 'Thu nhập' : 'Chi tiêu', t.category, t.linkedWallet || t.wallet, t.amount];
    });
    
    const csvContent = '\uFEFF' + [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; 
    link.setAttribute('download', isAnnualExport ? `FinanceHub_BaoCao_Nam_${selectedYear}.csv` : `FinanceHub_T${selectedMonth+1}_${selectedYear}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    showToast('Tải báo cáo thành công!', 'success');
  };

  const handleDownloadSampleCSV = () => {
    const headers = ['Ngày (DD/MM/YYYY)', 'Nội dung', 'Phân loại (Thu nhập/Chi tiêu)', 'Danh mục', 'Nguồn tiền', 'Số tiền (VND)'];
    const sampleRows = [
        ['01/02/2025', 'Nạp tiền gốc', 'Thu nhập', 'Số dư đầu kỳ', 'Ví ngân hàng', '5000000'],
        ['25/02/2025', 'Lương tháng 2', 'Thu nhập', 'Lương', 'Tiền mặt', '15000000'],
        ['26/02/2025', 'Mua sắm siêu thị', 'Chi tiêu', 'Mua sắm', 'Ví ngân hàng', '500000']
    ];
    const csvContent = '\uFEFF' + [headers, ...sampleRows].map(e => e.map(i => `"${i}"`).join(',')).join('\n');
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
            const rows = text.split('\n').filter(row => row.trim() !== '');
            if (rows.length < 2) throw new Error("File trống");

            const payloads = [];
            const totalImpact = {};
            let validCount = 0;
            let lastImportedDate = null; 
            
            const newWalletsSet = new Set(wallets || []);
            const newIncCats = new Set(categories?.INCOME || []);
            const newExpCats = new Set(categories?.EXPENSE || []);

            const parseCSVLine = (line) => {
                let cols = [], cur = '', inQuotes = false;
                for (let i = 0; i < line.length; i++) {
                    if (line[i] === '"') inQuotes = !inQuotes;
                    else if (line[i] === ',' && !inQuotes) { cols.push(cur.trim()); cur = ''; }
                    else cur += line[i];
                }
                cols.push(cur.trim().replace(/^"|"$/g, ''));
                return cols.map(c => c.replace(/^"|"$/g, ''));
            };

            for (let i = 1; i < rows.length; i++) {
                const cols = parseCSVLine(rows[i]);
                if (cols.length < 6) continue;
                
                let [dateStr, note, typeStr, category, wallet, amountStr] = cols;
                
                let date = dateStr;
                if (dateStr.includes('/')) {
                   const parts = dateStr.split('/');
                   if (parts.length === 3) date = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
                } else if (dateStr.includes('-')) {
                   const parts = dateStr.split('-');
                   if (parts[0].length !== 4 && parts.length === 3) date = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
                }
                if (!date || date.length !== 10) continue; 

                const type = String(typeStr).toLowerCase().includes('thu') ? 'INCOME' : 'EXPENSE';
                const amount = Number(String(amountStr).replace(/[^0-9]/g, ''));
                category = category || 'Khác';
                wallet = wallet || 'Tiền mặt';
                
                if (isNaN(amount) || amount <= 0) continue;

                const [y, m] = date.split('-');
                const colName = `transactions_${y}_${m}`;

                payloads.push({
                    col: colName,
                    data: {
                        type, category, amount, wallet, date, note: note || '',
                        createdAt: new Date().toISOString(), isSample: false
                    }
                });

                if (type === 'INCOME') {
                    totalImpact[wallet] = (totalImpact[wallet] || 0) + amount;
                    newIncCats.add(category);
                } else {
                    totalImpact[wallet] = (totalImpact[wallet] || 0) - amount;
                    newExpCats.add(category);
                }
                newWalletsSet.add(wallet);
                validCount++;
                lastImportedDate = date; 
            }

            if (validCount === 0) throw new Error("Không có dữ liệu hợp lệ");

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
                wallets: Array.from(newWalletsSet),
                categories: { INCOME: Array.from(newIncCats), EXPENSE: Array.from(newExpCats) }
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
     if (!user || !settingsForm.budgetCategory || !settingsForm.budgetAmount) return;
     const data = { category: settingsForm.budgetCategory, amount: Number(settingsForm.budgetAmount), isSample: false };
     if (editingId) await updateDoc(getDocRef('budgets', editingId), data); else await addDoc(getCollectionRef('budgets'), data);
     cancelEdit(); showToast('Đã lưu hạn mức ngân sách', 'success');
  };

  const handleSaveWallet = async () => {
     if(!settingsForm.walletName) return;
     const cleanName = settingsForm.walletName.trim();
     let newWallets = editingId !== null ? [...(wallets||[])] : [...(wallets||[]), cleanName];
     
     if(editingId !== null) {
         const oldName = wallets[editingId];
         newWallets[editingId] = cleanName;
         if (oldName !== cleanName) {
             const currentYearObj = new Date().getFullYear();
             const promises = [];
             for(let y = currentYearObj - 5; y <= currentYearObj + 1; y++) {
                 for(let m = 1; m <= 12; m++) {
                     promises.push(getDocs(getCollectionRef(`transactions_${y}_${String(m).padStart(2,'0')}`)));
                 }
             }
             const results = await Promise.all(promises);
             const batch = writeBatch(db);
             
             let transferredBal = walletBalances[oldName] || 0;
             batch.set(getDocRef('settings', 'general'), { 
                 wallets: newWallets,
                 walletBalances: {
                     [oldName]: increment(-transferredBal),
                     [cleanName]: increment(transferredBal)
                 }
             }, { merge: true });

             results.forEach(snap => {
                 snap.docs.forEach(doc => {
                     let updates = {};
                     if (doc.data().wallet === oldName) updates.wallet = cleanName;
                     if (doc.data().linkedWallet === oldName) updates.linkedWallet = cleanName;
                     if (Object.keys(updates).length > 0) batch.update(doc.ref, updates);
                 });
             });
             await batch.commit();
             cancelEdit(); showToast('Cập nhật tên ví thành công!', 'success');
             return;
         }
     }
     
     await setDoc(getDocRef('settings', 'general'), { wallets: newWallets }, { merge: true });
     cancelEdit(); showToast('Đã thêm ví mới!', 'success');
  };

  const handleSaveCategory = async () => {
     if(!settingsForm.categoryName) return;
     const cleanName = settingsForm.categoryName.trim();
     const type = settingsForm.categoryType;
     let newCatsList = editingId !== null ? [...(categories[type]||[])] : [...(categories[type]||[]), cleanName];
     
     if(editingId !== null) {
         const oldName = categories[type][editingId];
         newCatsList[editingId] = cleanName;
         if (oldName !== cleanName) {
             const currentYearObj = new Date().getFullYear();
             const promises = [];
             for(let y = currentYearObj - 5; y <= currentYearObj + 1; y++) {
                 for(let m = 1; m <= 12; m++) {
                     promises.push(getDocs(getCollectionRef(`transactions_${y}_${String(m).padStart(2,'0')}`)));
                 }
             }
             const results = await Promise.all(promises);
             const batch = writeBatch(db);
             results.forEach(snap => {
                 snap.docs.forEach(doc => {
                     if (doc.data().category === oldName && doc.data().type === type) batch.update(doc.ref, { category: cleanName });
                 });
             });
             const newCategories = { ...categories, [type]: newCatsList };
             batch.set(getDocRef('settings', 'general'), { categories: newCategories }, { merge: true });
             await batch.commit();
             cancelEdit(); showToast('Cập nhật danh mục thành công!', 'success');
             return;
         }
     }
     
     const newCategories = { ...categories, [type]: newCatsList };
     await setDoc(getDocRef('settings', 'general'), { categories: newCategories }, { merge: true }); cancelEdit();
     showToast('Đã lưu danh mục mới!', 'success');
  };

  const handleSaveGoal = async () => {
     if (!user || !settingsForm.goalName) return;
     const data = { name: settingsForm.goalName, target: Number(settingsForm.goalAmount), amount: Number(settingsForm.goalCurrentAmount) || 0, isSample: false };
     if (editingId) await updateDoc(getDocRef('goals', editingId), data); else await addDoc(getCollectionRef('goals'), { ...data, createdAt: new Date().toISOString() });
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
