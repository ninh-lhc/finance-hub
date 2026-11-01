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
import GoogleUpgradeButton from './components/GoogleUpgradeButton.jsx';
import NavbarItem from './components/layout/NavbarItem.jsx';
import DashboardView from './features/dashboard/DashboardView.jsx';
import TransactionsView from './features/transactions/TransactionsView.jsx';
import AnnualView from './features/annual/AnnualView.jsx';
import utils from './utils/format.js';
import { THEME } from './constants/theme.js';
import { deriveFinanceLogic, deriveTransactionView } from './logic/deriveFinance.js';
import { 
  LayoutDashboard, ArrowRightLeft, Wallet, PieChart, Target, 
  Plus, Search, Filter, ChevronDown, Bell, Settings, 
  TrendingUp, TrendingDown, Calendar, Trash2, Zap, 
  BarChart3, Lightbulb, Clock, CheckCircle2, MoreHorizontal,
  List, PiggyBank, X, CreditCard, Edit2, Save, RotateCcw, Database, Loader2,
  Landmark, ArrowUpRight, ArrowDownLeft, Info, Eye, EyeOff, TrendingUp as TrendIcon,
  ChevronRight, ChevronLeft, Download, Link2, Activity, AlertTriangle, Cloud, Smartphone, Laptop, Unlink, Sparkles, Upload, FileDown
} from 'lucide-react';

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

      {/* Thông báo Toast */}
      {toast.show && (
         <div className={`fixed top-5 right-5 z-[60] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-right-5 fade-in duration-300 ${toast.type === 'warning' || toast.type === 'error' ? 'bg-[#EE5D50] text-white' : 'bg-[#05CD99] text-white'}`}>
            {toast.type === 'warning' || toast.type === 'error' ? <AlertTriangle size={20}/> : <CheckCircle2 size={20}/>}
            <span className="text-xs font-black tracking-wide">{toast.message}</span>
         </div>
      )}

      {/* --- HEADER --- */}
      <header className="bg-white/80 backdrop-blur-xl sticky top-0 z-30 shadow-sm border-b border-gray-100/50 px-4 md:px-8 transition-all">
         <div className="max-w-[1400px] mx-auto">
            <div className="flex justify-between items-center py-4 gap-4">
               <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 bg-[#4318FF] rounded-[14px] flex items-center justify-center text-white shadow-xl shadow-indigo-100 relative">
                     <Zap size={22} fill="white" />
                     {syncCode && <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#05CD99] border-2 border-white rounded-full animate-pulse" title="Đang đồng bộ"></div>}
                  </div>
                  <div>
                     <h1 className="text-xl font-black italic tracking-tighter uppercase leading-none">Finance<span className="text-[#4318FF]">Hub</span></h1>
                     <p className="text-[10px] text-gray-400 font-bold mt-1 tracking-widest uppercase">{greeting} 👋</p>
                  </div>
               </div>

               <div className="flex items-center gap-2 md:gap-3">
                  <button onClick={() => { setEditingTxId(null); setModalType('TRANSACTION'); setFormData({ type: 'INCOME', wallet: wallets?.[0] || '', category: categories?.INCOME?.[0] || '' }); setShowModal(true); }} className="bg-[#05CD99] text-white px-4 md:px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:opacity-90 shadow-lg shadow-green-100 transition-all active:scale-95 flex items-center gap-1.5 touch-manipulation"><Plus size={14} strokeWidth={3}/> <span className="hidden sm:inline">Thu</span></button>
                  <button onClick={() => { setEditingTxId(null); setModalType('TRANSACTION'); setFormData({ type: 'EXPENSE', wallet: wallets?.[0] || '', category: categories?.EXPENSE?.[0] || '' }); setShowModal(true); }} className="bg-[#EE5D50] text-white px-4 md:px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:opacity-90 shadow-lg shadow-red-100 transition-all active:scale-95 flex items-center gap-1.5 touch-manipulation"><Plus size={14} strokeWidth={3}/> <span className="hidden sm:inline">Chi</span></button>
                  <div className="w-px h-6 bg-gray-200 mx-1 hidden sm:block"></div>
                  <button onClick={() => {setActiveTab('settings'); setActiveSettingTab('sync');}} className={`p-2.5 rounded-full transition-all relative touch-manipulation ${activeTab === 'settings' ? 'bg-[#4318FF] text-white shadow-xl shadow-indigo-100 scale-105' : 'bg-[#F4F7FE] text-[#A3AED0] hover:text-[#4318FF]'}`}>
                     <Settings size={20} />
                     {syncCode && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#05CD99] rounded-full border-2 border-white"></span>}
                  </button>
               </div>
            </div>
            <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1">
               <NavbarItem id="dashboard" icon={LayoutDashboard} label="TỔNG QUAN" activeTab={activeTab} setActiveTab={setActiveTab} />
               <NavbarItem id="transactions" icon={ArrowRightLeft} label="GIAO DỊCH" activeTab={activeTab} setActiveTab={setActiveTab} />
               <NavbarItem id="annual" icon={BarChart3} label="TỔNG KẾT NĂM" activeTab={activeTab} setActiveTab={setActiveTab} />
            </nav>
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
            <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in">
                <div className="w-full lg:w-56 flex flex-row lg:flex-col gap-2 overflow-x-auto no-scrollbar pb-2 lg:pb-0">
                    {[{id: 'sync', icon: Link2, label: 'ĐỒNG BỘ'}, {id: 'budget', icon: Target, label: 'NGÂN SÁCH'}, {id: 'wallet', icon: Wallet, label: 'VÍ TIỀN'}, {id: 'category', icon: List, label: 'DANH MỤC'}, {id: 'goal', icon: PiggyBank, label: 'MỤC TIÊU'}].map(item => (
                        <button key={item.id} onClick={() => { setActiveSettingTab(item.id); cancelEdit(); }} className={`flex items-center justify-center lg:justify-start gap-3 px-5 py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${activeSettingTab === item.id ? 'bg-[#4318FF] text-white shadow-xl scale-105' : 'bg-white text-[#A3AED0] hover:text-[#4318FF] border border-gray-50'}`}>
                           <item.icon size={16}/>{item.label}
                        </button>
                    ))}
                </div>
                <div className="flex-1 bg-white rounded-[32px] p-6 lg:p-10 shadow-sm border border-gray-100 min-h-[500px]">
                    {/* ĐỒNG BỘ */}
                    {activeSettingTab === 'sync' && (
                       <div className="space-y-8 animate-in fade-in">
                           <div className="space-y-1"><h3 className="text-base font-black uppercase tracking-widest text-[#1B2559]">Đồng bộ đa thiết bị</h3><p className="text-[10px] text-gray-400 font-bold uppercase italic">Dùng chung dữ liệu mà không cần tạo tài khoản mật khẩu</p></div>

                           <GoogleUpgradeButton auth={auth} user={user} onToast={showToast} disabled={isProcessing} />
                           
                           <div className="p-6 bg-indigo-50/50 rounded-[24px] border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                              <div>
                                 <h4 className="text-sm font-black text-[#1B2559] uppercase">Dữ liệu thử nghiệm</h4>
                                 <p className="text-xs text-gray-500 mt-1">Nạp các giao dịch mẫu năm 2025 để kiểm tra tính năng biểu đồ.</p>
                              </div>
                              <button onClick={dbActions.generateSampleData} disabled={isProcessing} className="py-3 px-6 bg-[#4318FF] text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-transform active:scale-95 whitespace-nowrap">
                                 {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <><Sparkles size={16}/> NẠP MẪU</>}
                              </button>
                           </div>
                           
                           <div className="p-6 bg-red-50/50 rounded-[24px] border border-red-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                              <div>
                                 <h4 className="text-sm font-black text-[#1B2559] uppercase">Xóa dữ liệu mẫu</h4>
                                 <p className="text-xs text-gray-500 mt-1">Dọn dẹp sạch sẽ toàn bộ các giao dịch thử nghiệm.</p>
                              </div>
                              <button onClick={dbActions.clearSampleData} disabled={isProcessing} className="py-3 px-6 bg-[#EE5D50] text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-red-200 flex items-center justify-center gap-2 transition-transform active:scale-95 whitespace-nowrap">
                                 {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <><Trash2 size={16}/> XÓA SẠCH</>}
                              </button>
                           </div>

                           {syncCode ? (
                              <div className="bg-[#111C44] rounded-[32px] p-10 text-center relative overflow-hidden shadow-2xl">
                                 <Cloud size={48} className="text-[#05CD99] mx-auto mb-4" />
                                 <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">Mã phòng hiện tại</p>
                                 <div className="text-4xl md:text-5xl font-black text-white tracking-[0.2em] my-6 bg-white/10 py-4 px-8 rounded-3xl inline-block border border-white/20">{syncCode}</div>
                                 <p className="text-[11px] text-gray-300 font-medium max-w-sm mx-auto mb-8">Hãy nhập mã này trên thiết bị khác để dùng chung dữ liệu.</p>
                                 <button onClick={() => { localStorage.removeItem('finance_hub_sync_code'); setSyncCode(''); showToast('Đã ngắt kết nối đồng bộ', 'success'); }} className="text-red-400 hover:text-white border border-red-400/20 px-6 py-3 rounded-2xl text-[9px] font-black uppercase">Ngắt kết nối phòng</button>
                              </div>
                           ) : (
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                 <div className="bg-[#F8F9FA] rounded-[32px] p-8 border border-gray-100 flex flex-col justify-between">
                                    <div><Laptop size={24} className="text-[#4318FF] mb-4"/><h4 className="text-sm font-black text-[#1B2559] uppercase tracking-widest mb-3">Tạo mới mã phòng</h4><p className="text-xs text-gray-500 mb-6 leading-relaxed">Hệ thống sẽ tải toàn bộ lịch sử 5 năm lên Đám mây để các thiết bị khác tải về.</p></div>
                                    <button onClick={dbActions.enableCloudSync} disabled={isProcessing} className="w-full py-4 bg-[#4318FF] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg flex items-center justify-center gap-2">{isProcessing ? <Loader2 size={16} className="animate-spin" /> : <><Cloud size={16}/> TẠO MÃ ĐỒNG BỘ</>}</button>
                                 </div>
                                 <div className="bg-[#F8F9FA] rounded-[32px] p-8 border border-gray-100 flex flex-col justify-between">
                                    <div><Smartphone size={24} className="text-[#05CD99] mb-4"/><h4 className="text-sm font-black text-[#1B2559] uppercase tracking-widest mb-3">Kết nối mã có sẵn</h4><p className="text-xs text-gray-500 mb-6 leading-relaxed">Nếu bạn đã có mã phòng từ máy tính, hãy nhập vào đây để đồng bộ ngay lập tức.</p></div>
                                    <div><input type="text" placeholder="Nhập mã phòng..." className="w-full p-4 mb-3 bg-white rounded-2xl font-black text-center uppercase tracking-[0.2em] outline-none text-[#1B2559]" value={inputSyncCode} onChange={(e) => setInputSyncCode(e.target.value)} maxLength={6} /><button onClick={dbActions.joinCloudSync} className="w-full py-4 bg-[#05CD99] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg">KẾT NỐI NGAY</button></div>
                                 </div>
                              </div>
                           )}
                       </div>
                    )}

                    {/* NGÂN SÁCH */}
                    {activeSettingTab === 'budget' && (
                       <div className="space-y-8 animate-in fade-in">
                           <div className="space-y-1"><h3 className="text-base font-black uppercase tracking-widest text-[#1B2559]">Quản lý Ngân sách</h3><p className="text-[10px] text-gray-400 font-bold uppercase italic">Thiết lập hạn mức chi tiêu để kiểm soát tài chính tốt hơn</p></div>
                           <div className="flex flex-col md:flex-row gap-4 p-5 bg-[#F8F9FA] rounded-[24px] border border-gray-100">
                              <select className="bg-transparent font-black text-[#1B2559] outline-none flex-1 text-xs py-2" value={settingsForm.budgetCategory} onChange={(e) => setSettingsForm({...settingsForm, budgetCategory: e.target.value})}>
                                 <option value="">Chọn danh mục...</option>
                                 {(categories?.EXPENSE || []).map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              <input type="text" inputMode="numeric" placeholder="Số tiền tối đa..." className="bg-transparent font-black text-[#1B2559] outline-none w-full md:w-48 text-xs border-l-2 border-gray-100 pl-4 py-2" value={utils.formatInputNumber(settingsForm.budgetAmount)} onChange={(e) => setSettingsForm({...settingsForm, budgetAmount: utils.parseInputNumber(e.target.value)})} />
                              <button onClick={handleSaveBudget} className={`w-full md:w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg transition-all ${editingId ? 'bg-[#05CD99]' : 'bg-[#4318FF]'}`}>
                                 {editingId ? <Save size={20}/> : <Plus size={20}/>}
                              </button>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {budgets.map(b => (
                                 <div key={b.id} className="p-6 bg-[#F8F9FA] rounded-[24px] flex justify-between items-center border border-transparent hover:border-indigo-100">
                                    <div className="space-y-1"><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{b.category}</p><p className="font-black text-[#1B2559] text-base">{utils.formatVND(b.amount)}</p></div>
                                    <div className="flex gap-2"><button onClick={() => { setEditingId(b.id); setSettingsForm({...settingsForm, budgetCategory: b.category, budgetAmount: b.amount}); }} className="text-gray-400 hover:text-[#4318FF]"><Edit2 size={16}/></button><button onClick={() => dbActions.deleteItem('budgets', b.id)} className="text-gray-400 hover:text-[#EE5D50]"><Trash2 size={16}/></button></div>
                                 </div>
                              ))}
                           </div>
                       </div>
                    )}

                    {/* VÍ TIỀN */}
                    {activeSettingTab === 'wallet' && (
                       <div className="space-y-8 animate-in fade-in">
                           <div className="space-y-1"><h3 className="text-base font-black uppercase tracking-widest text-[#1B2559]">Danh sách Ví & Tài khoản</h3></div>
                           
                           {/* Nút Đồng Bộ & Tính toán lại số dư */}
                           <div className="flex flex-col sm:flex-row gap-4 p-5 bg-indigo-50/50 rounded-[24px] border border-indigo-100 items-start sm:items-center justify-between mb-4">
                              <div>
                                 <h4 className="text-sm font-black text-[#1B2559] uppercase">Đồng bộ & Tính toán lại</h4>
                                 <p className="text-[10px] text-gray-500 mt-1">Quét toàn bộ lịch sử 5 năm để sửa lỗi lệch số dư ví (nếu có).</p>
                              </div>
                              <button onClick={dbActions.recalculateAllBalances} disabled={isProcessing} className="px-6 py-3 bg-[#4318FF] text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-indigo-200 transition-transform active:scale-95 flex items-center gap-2 whitespace-nowrap">
                                 {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <><RotateCcw size={16}/> SỬA LỖI SỐ DƯ</>}
                              </button>
                           </div>

                           <div className="flex gap-4 p-5 bg-[#F8F9FA] rounded-[24px] border border-gray-100">
                              <input type="text" placeholder="Tên ví mới (VD: Ví Momo, Techcombank...)" className="bg-transparent font-black text-[#1B2559] outline-none flex-1 text-xs" value={settingsForm.walletName} onChange={(e) => setSettingsForm({...settingsForm, walletName: e.target.value})} />
                              <button onClick={handleSaveWallet} className="w-12 h-12 bg-[#4318FF] rounded-xl flex items-center justify-center text-white shadow-xl transition-all"><Plus size={20}/></button>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {(wallets || []).map((w, i) => (
                                 <div key={i} className="p-6 bg-[#F8F9FA] rounded-[24px] flex justify-between items-center border border-transparent hover:border-indigo-100">
                                    <div className="flex items-center gap-4"><div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-[#1B2559]"><Landmark size={20}/></div><div><h4 className="text-xs font-black text-[#1B2559] uppercase">{w}</h4><p className="text-[10px] font-bold text-gray-400">{utils.formatVND(walletBalances[w] || 0)}</p></div></div>
                                    <div className="flex gap-2">
                                       <button onClick={() => resetWalletBalance(w)} title="Reset về 0đ" className="text-gray-400 hover:text-[#05CD99] p-2 rounded-xl transition-all"><RotateCcw size={16}/></button>
                                       <button onClick={() => { setEditingId(i); setSettingsForm({...settingsForm, walletName: w}); }} className="text-gray-400 hover:text-[#4318FF] p-2 rounded-xl transition-all"><Edit2 size={16}/></button>
                                    </div>
                                 </div>
                              ))}
                           </div>
                       </div>
                    )}

                    {/* DANH MỤC */}
                    {activeSettingTab === 'category' && (
                       <div className="space-y-8 animate-in fade-in">
                           <div className="flex justify-between items-center">
                              <h3 className="text-base font-black uppercase tracking-widest text-[#1B2559]">Phân loại Danh mục</h3>
                              <div className="flex bg-[#F8F9FA] p-1 rounded-xl">
                                 <button onClick={() => setSettingsForm({...settingsForm, categoryType: 'INCOME', categoryName: ''})} className={`px-4 py-2 rounded-lg text-[9px] font-black transition-all ${settingsForm.categoryType === 'INCOME' ? 'bg-white text-[#05CD99] shadow-sm' : 'text-gray-400'}`}>THU</button>
                                 <button onClick={() => setSettingsForm({...settingsForm, categoryType: 'EXPENSE', categoryName: ''})} className={`px-4 py-2 rounded-lg text-[9px] font-black transition-all ${settingsForm.categoryType === 'EXPENSE' ? 'bg-white text-[#EE5D50] shadow-sm' : 'text-gray-400'}`}>CHI</button>
                              </div>
                           </div>
                           <div className="flex gap-4 p-5 bg-[#F8F9FA] rounded-[24px] border border-gray-100">
                              <input type="text" placeholder="Nhập tên hạng mục..." className="bg-transparent font-black text-[#1B2559] outline-none flex-1 text-xs" value={settingsForm.categoryName} onChange={(e) => setSettingsForm({...settingsForm, categoryName: e.target.value})} />
                              <button onClick={handleSaveCategory} className="px-8 py-3 bg-[#1B2559] text-white rounded-xl text-[10px] font-black shadow-lg">LƯU</button>
                           </div>
                           <div className="flex flex-wrap gap-3">
                              {(categories[settingsForm.categoryType] || []).map((cat, i) => (
                                 <div key={i} className="px-5 py-3 rounded-2xl bg-[#F8F9FA] border border-gray-100 flex items-center gap-3 group">
                                    <span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: logic.getCategoryColor(cat)}}></span>
                                    <span className="text-xs font-black text-[#111C44] uppercase tracking-tighter">{cat}</span>
                                    <button onClick={() => { setEditingId(i); setSettingsForm({...settingsForm, categoryName: cat}); }} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-indigo-600"><Edit2 size={12}/></button>
                                 </div>
                              ))}
                           </div>
                       </div>
                    )}

                    {/* MỤC TIÊU */}
                    {activeSettingTab === 'goal' && (
                       <div className="space-y-8 animate-in fade-in">
                           <div className="space-y-1"><h3 className="text-base font-black uppercase tracking-widest text-[#1B2559]">Ước mơ & Tích lũy</h3></div>
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-[#F8F9FA] rounded-[32px]">
                              <input type="text" placeholder="Tên mục tiêu..." className="p-4 bg-white rounded-2xl font-black text-[#1B2559] outline-none text-xs" value={settingsForm.goalName} onChange={(e) => setSettingsForm({...settingsForm, goalName: e.target.value})} />
                              <input type="text" inputMode="numeric" placeholder="Đã tích lũy..." className="p-4 bg-white rounded-2xl font-black text-[#1B2559] outline-none text-xs" value={utils.formatInputNumber(settingsForm.goalCurrentAmount)} onChange={(e) => setSettingsForm({...settingsForm, goalCurrentAmount: utils.parseInputNumber(e.target.value)})} />
                              <input type="text" inputMode="numeric" placeholder="Số tiền đích..." className="p-4 bg-white rounded-2xl font-black text-[#1B2559] outline-none text-xs" value={utils.formatInputNumber(settingsForm.goalAmount)} onChange={(e) => setSettingsForm({...settingsForm, goalAmount: utils.parseInputNumber(e.target.value)})} />
                              <button onClick={handleSaveGoal} className="col-span-1 md:col-span-3 py-4 bg-[#FFA800] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-orange-100">Xác nhận kế hoạch</button>
                           </div>
                           <div className="space-y-4">
                              {goals.map(g => (
                                 <div key={g.id} className="p-8 bg-[#F8F9FA] rounded-[32px] flex justify-between items-center hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-gray-100">
                                    <div className="space-y-1">
                                       <h4 className="text-xl font-black text-[#1B2559] italic tracking-tighter uppercase">{g.name}</h4>
                                       <div className="flex gap-4 text-[10px] font-bold tracking-widest mt-1">
                                          <span className="text-[#05CD99]">CÓ: {utils.formatVND(g.amount)}</span>
                                          <span className="text-gray-400">ĐÍCH: {utils.formatVND(g.target)}</span>
                                       </div>
                                    </div>
                                    <div className="flex gap-2">
                                       <button onClick={() => { setEditingId(g.id); setSettingsForm({...settingsForm, goalName: g.name, goalAmount: g.target, goalCurrentAmount: g.amount}); }} className="p-3 bg-white rounded-2xl text-gray-400 hover:text-[#4318FF] shadow-sm"><Edit2 size={18}/></button>
                                       <button onClick={() => dbActions.deleteItem('goals', g.id)} className="p-3 bg-white rounded-2xl text-gray-400 hover:text-[#EE5D50] shadow-sm"><Trash2 size={18}/></button>
                                    </div>
                                 </div>
                              ))}
                           </div>
                       </div>
                    )}
                </div>
            </div>
         )}
      </main>

      {/* --- GIAO DIỆN NHẬP GIAO DỊCH (MODAL) --- */}
      {showModal && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111C44]/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl p-6 sm:p-8 border border-gray-100 animate-in zoom-in-95 max-h-[92vh] overflow-y-auto custom-scrollbar overscroll-contain flex flex-col">
               
               <div className="flex justify-between items-center mb-6 flex-shrink-0">
                  <h3 className="text-xs font-black text-[#1B2559] uppercase tracking-widest italic">
                     {editingTxId ? 'Cập nhật giao dịch' : formData.type === 'INCOME' ? 'Thêm thu nhập' : formData.type === 'EXPENSE' ? 'Ghi khoản chi' : 'Chuyển khoản nội bộ'}
                  </h3>
                  <button onClick={handleCloseModal} className="p-2.5 bg-gray-50 rounded-full text-gray-400 hover:text-gray-600 transition-all"><X size={18}/></button>
               </div>

               {!editingTxId && (
                  <div className="flex bg-[#F4F7FE] p-1.5 rounded-[16px] mb-6">
                     <button onClick={() => setFormData({...formData, type: 'INCOME', category: categories?.INCOME?.[0] || ''})} className={`flex-1 py-2.5 rounded-[12px] text-[9px] font-black uppercase tracking-widest transition-all ${formData.type === 'INCOME' ? 'bg-white shadow text-[#05CD99]' : 'text-gray-400'}`}>Thu</button>
                     <button onClick={() => setFormData({...formData, type: 'EXPENSE', category: categories?.EXPENSE?.[0] || ''})} className={`flex-1 py-2.5 rounded-[12px] text-[9px] font-black uppercase tracking-widest transition-all ${formData.type === 'EXPENSE' ? 'bg-white shadow text-[#EE5D50]' : 'text-gray-400'}`}>Chi</button>
                     <button onClick={() => setFormData({...formData, type: 'TRANSFER', category: ''})} className={`flex-1 py-2.5 rounded-[12px] text-[9px] font-black uppercase tracking-widest transition-all ${formData.type === 'TRANSFER' ? 'bg-white shadow text-[#4318FF]' : 'text-gray-400'}`}>Chuyển</button>
                  </div>
               )}

               <div className="space-y-5">
                  <div className="space-y-1.5">
                     <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Số tiền (VND)</label>
                     <div className="relative">
                        <input type="text" inputMode="numeric" className="w-full h-14 bg-[#F4F7FE] rounded-2xl px-6 text-3xl font-black text-[#2B3674] outline-none border-2 border-transparent focus:border-[#4318FF]/20 transition-all" placeholder="0" autoFocus value={utils.formatInputNumber(formData.amount)} onChange={e => setFormData({...formData, amount: utils.parseInputNumber(e.target.value)})} />
                     </div>
                  </div>

                  <div className="space-y-1.5">
                     <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Nội dung</label>
                     <input type="text" className="w-full p-4 bg-[#F4F7FE] rounded-2xl font-black text-xs text-[#2B3674] outline-none border-2 border-transparent focus:border-[#4318FF]/20" placeholder="Mua sắm, ăn sáng..." value={formData.note || ''} onChange={e => setFormData({...formData, note: e.target.value})} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">{formData.type === 'TRANSFER' ? 'Từ ví' : 'Nguồn tiền'}</label>
                        <select className="w-full p-4 bg-[#F4F7FE] rounded-2xl text-[10px] font-black outline-none cursor-pointer border-2 border-transparent focus:border-[#4318FF]/20" value={formData.wallet || wallets[0]} onChange={e => setFormData({...formData, wallet: e.target.value})}>
                           {(wallets || []).map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                     </div>
                     {formData.type === 'TRANSFER' ? (
                        <div className="space-y-1.5">
                           <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Đến ví</label>
                           <select className="w-full p-4 bg-[#F4F7FE] rounded-2xl text-[10px] font-black outline-none cursor-pointer border-2 border-transparent focus:border-[#4318FF]/20" value={formData.toWallet || ''} onChange={e => setFormData({...formData, toWallet: e.target.value})}>
                              <option value="">Chọn...</option>
                              {(wallets || []).filter(w => w !== formData.wallet).map(w => <option key={w} value={w}>{w}</option>)}
                           </select>
                        </div>
                     ) : (
                        <div className="space-y-1.5">
                           <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Danh mục</label>
                           <select className="w-full p-4 bg-[#F4F7FE] rounded-2xl text-[10px] font-black outline-none cursor-pointer border-2 border-transparent focus:border-[#4318FF]/20" value={formData.category || ''} onChange={e => setFormData({...formData, category: e.target.value})}>
                              {(categories[formData.type === 'INCOME' ? 'INCOME' : 'EXPENSE'] || []).map(c => <option key={c} value={c}>{c}</option>)}
                           </select>
                        </div>
                     )}
                  </div>

                  {formData.type === 'EXPENSE' && (
                     <div className="space-y-2 bg-[#F4F7FE] p-3 rounded-2xl border border-gray-100">
                        <label className="flex items-center gap-2 cursor-pointer">
                           <input type="checkbox" className="w-4 h-4 rounded text-[#4318FF] focus:ring-0" checked={useLinkedWallet} onChange={(e) => setUseLinkedWallet(e.target.checked)} />
                           <span className="text-[10px] font-bold text-[#1B2559] uppercase">Trừ tiền thực tế từ nguồn khác?</span>
                        </label>
                        {useLinkedWallet && (
                           <div className="pl-6 pt-1 animate-in slide-in-from-top-1">
                              <p className="text-[9px] text-gray-400 mb-1 italic">Chọn ví để trừ tiền thực tế:</p>
                              <select className="w-full p-3 bg-white rounded-xl text-[10px] font-black outline-none border-2 border-transparent focus:border-[#4318FF]/20" value={formData.linkedWallet || ''} onChange={e => setFormData({...formData, linkedWallet: e.target.value})}>
                                 <option value="">Chọn...</option>
                                 {(wallets || []).filter(w => w !== formData.wallet).map(w => <option key={w} value={w}>{w}</option>)}
                              </select>
                           </div>
                        )}
                     </div>
                  )}

                  <div className="space-y-1.5">
                     <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Thời gian</label>
                     <input type="date" className="w-full p-4 bg-[#F4F7FE] rounded-2xl text-[10px] font-black outline-none border-2 border-transparent focus:border-[#4318FF]/20" value={formData.date || utils.getLocalYMD()} onChange={e => setFormData({...formData, date: e.target.value})} />
                  </div>
                  
                  <button onClick={dbActions.saveTransaction} className={`w-full py-5 rounded-2xl font-black text-[10px] text-white shadow-xl uppercase tracking-[0.3em] active:scale-95 transition-all mt-4 ${editingTxId ? 'bg-[#05CD99]' : formData.type === 'INCOME' ? 'bg-[#05CD99]' : formData.type === 'EXPENSE' ? 'bg-[#EE5D50]' : 'bg-[#4318FF]'}`}>
                     {editingTxId ? 'Lưu thay đổi' : 'Xác nhận giao dịch'}
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}