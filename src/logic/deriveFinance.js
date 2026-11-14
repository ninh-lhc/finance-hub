import utils from '../utils/format.js';
import { THEME, CHART_COLORS } from '../constants/theme.js';
import { isCountedExpense, isCountedIncome } from './monthComparison.js';
import { locksForWallet } from './planningEntities.js';

function weekExpenseIdentity(transaction) {
  return transaction.id || `${transaction.date}|${transaction.amount}|${transaction.category}|${transaction.note || ''}`;
}

function shiftDate(dateStr, days) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${nextMonth}-${nextDay}`;
}

function buildWeekInsight({ weeklyExpenses, isCurrentMonthView, sources }) {
  const categoryTotals = {};
  weeklyExpenses.forEach((bucket) => {
    (bucket.items || []).forEach((transaction) => {
      const name = transaction.category || 'Khác';
      categoryTotals[name] = (categoryTotals[name] || 0) + Number(transaction.amount || 0);
    });
  });
  const topCategories = Object.entries(categoryTotals)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([name, amount]) => ({ name, amount }));
  const peak = weeklyExpenses.reduce((best, bucket) => (bucket.total > best.total ? bucket : best), weeklyExpenses[0] || { total: 0, label: '' });
  let previousTotal = null;
  if (isCurrentMonthView && weeklyExpenses[0]?.dateStr) {
    const previousStart = shiftDate(weeklyExpenses[0].dateStr, -7);
    const previousEnd = shiftDate(weeklyExpenses[0].dateStr, -1);
    const seen = new Set();
    previousTotal = 0;
    sources.forEach((list) => {
      (list || []).forEach((transaction) => {
        if (!isCountedExpense(transaction)) return;
        const identity = weekExpenseIdentity(transaction);
        if (seen.has(identity)) return;
        seen.add(identity);
        if (transaction.date >= previousStart && transaction.date <= previousEnd) {
          previousTotal += Number(transaction.amount || 0);
        }
      });
    });
  }
  return {
    previousTotal,
    topCategories,
    peakLabel: peak.total > 0 ? peak.label : '',
    peakTotal: peak.total || 0,
  };
}
export const deriveFinanceLogic = ({
  transactions,
  annualTransactions,
  boundaryTransactions = [],
  walletBalances,
  selectedMonth,
  selectedYear,
  wallets,
  categories,
  annualSelectedMonth,
  goals,
  budgets,
}) => {
  const getCategoryColor = (catName) => {
    if (!catName || typeof catName !== 'string') return '#A3AED0';
    if (catName.includes('Chuyển khoản')) return '#4318FF';
    const allCats = [...(categories?.INCOME || []), ...(categories?.EXPENSE || [])];
    const idx = allCats.indexOf(catName);
    if (idx === -1) {
        let hash = 0;
        for (let i = 0; i < catName.length; i++) hash = catName.charCodeAt(i) + ((hash << 5) - hash);
        return CHART_COLORS[Math.abs(hash) % CHART_COLORS.length];
    }
    return CHART_COLORS[idx % CHART_COLORS.length];
  };

  const getWalletColor = (wName) => {
    if (!wName || typeof wName !== 'string') return '#A3AED0';
    const idx = (wallets || []).indexOf(wName);
    if (idx === -1) {
        let hash = 0;
        for (let i = 0; i < wName.length; i++) hash = wName.charCodeAt(i) + ((hash << 5) - hash);
        return CHART_COLORS[Math.abs(hash) % CHART_COLORS.length];
    }
    return CHART_COLORS[idx % CHART_COLORS.length];
  };

  const monthData = [...transactions].sort((a,b) => {
     const dateDiff = new Date(b.date) - new Date(a.date);
     if (dateDiff !== 0) return dateDiff;
     return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  const income = monthData.filter(t => t.type === 'INCOME' && t.category !== 'Chuyển khoản đến' && t.category !== 'Số dư đầu kỳ').reduce((s, t) => s + Number(t.amount || 0), 0);
  const expense = monthData.filter(t => t.type === 'EXPENSE' && t.category !== 'Chuyển khoản đi').reduce((s, t) => s + Number(t.amount || 0), 0);

  // ĐÃ SỬA: Chỉ tính tổng tiền của những ví đang hiện hữu (Bỏ qua các ví đã bị xóa)
  const globalBal = (wallets || []).reduce((s, w) => s + Number(walletBalances[w] || 0), 0);

  const expenseCats = {};
  monthData.filter(t => t.type === 'EXPENSE' && t.category !== 'Chuyển khoản đi').forEach(t => expenseCats[t.category] = (expenseCats[t.category] || 0) + Number(t.amount || 0));
  const expenseChart = Object.entries(expenseCats).sort((a,b) => b[1] - a[1]).map(([name, value]) => ({ name, value, color: getCategoryColor(name) }));

  const fullWalletList = (wallets || []).map((w) => {
      const bal = Number(walletBalances[w] || 0);
      const locks = locksForWallet(goals, w);
      const locked = locks.reduce((sum, lock) => sum + lock.amount, 0);
      return { name: w, value: bal, locked, spendable: bal - locked, locks, color: getWalletColor(w) };
  });
  const walletChart = fullWalletList.filter(d => d.value > 0);

  let priorityGoal = null;
  if (goals.length > 0) {
    priorityGoal = goals.reduce((prev, current) => {
       const prevPercent = prev.target > 0 ? prev.amount / prev.target : 0;
       const currPercent = current.target > 0 ? current.amount / current.target : 0;
       return currPercent > prevPercent ? current : prev;
    });
  }

  const budgetProgress = (budgets || []).map(b => {
    const currentSpent = monthData.filter(t => t.type === 'EXPENSE' && t.category === b.category).reduce((s, t) => s + Number(t.amount), 0);
    const percent = b.amount > 0 ? (currentSpent / b.amount) * 100 : 0;
    let statusColor = THEME.success;
    if (percent >= 90) statusColor = THEME.error;
    else if (percent >= 75) statusColor = THEME.warning;
    return { ...b, currentSpent, percent, statusColor };
  }).sort((a, b) => b.percent - a.percent);

  const currentRealDate = new Date();
  const isCurrentMonthView = selectedYear === currentRealDate.getFullYear() && selectedMonth === currentRealDate.getMonth();

  let weeklyExpenses = [];

  if (isCurrentMonthView) {
      // NẾU LÀ THÁNG HIỆN TẠI: Hiển thị 7 ngày gần nhất
      weeklyExpenses = Array.from({length: 7}, (_, i) => {
          const d = new Date(currentRealDate);
          d.setDate(d.getDate() - (6 - i));
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const dayStr = String(d.getDate()).padStart(2, '0');
          const dateStr = `${d.getFullYear()}-${m}-${dayStr}`;
          let dayName = utils.getDayOfWeekVN(dateStr);
          if (i === 6) dayName = 'Hôm nay';
          return { dateStr, label: dayName, total: 0, items: [], incomes: [] };
      });

      const countedExpenseIds = new Set();
      const countedIncomeIds = new Set();
      const addWeekExpense = (transaction) => {
          if (!isCountedExpense(transaction)) return;
          const identity = weekExpenseIdentity(transaction);
          if (countedExpenseIds.has(identity)) return;
          countedExpenseIds.add(identity);
          const dayObj = weeklyExpenses.find(d => d.dateStr === transaction.date);
          if (!dayObj) return;
          dayObj.total += Number(transaction.amount || 0);
          dayObj.items.push(transaction);
      };
      const addWeekIncome = (transaction) => {
          if (!isCountedIncome(transaction)) return;
          const identity = weekExpenseIdentity(transaction);
          if (countedIncomeIds.has(identity)) return;
          countedIncomeIds.add(identity);
          const dayObj = weeklyExpenses.find(d => d.dateStr === transaction.date);
          if (!dayObj) return;
          dayObj.incomes.push(transaction);
      };
      monthData.forEach(addWeekExpense);
      monthData.forEach(addWeekIncome);
      (annualTransactions || []).forEach(addWeekExpense);
      (annualTransactions || []).forEach(addWeekIncome);
      (boundaryTransactions || []).forEach(addWeekExpense);
      (boundaryTransactions || []).forEach(addWeekIncome);
  } else {
      // NẾU LÀ THÁNG TRONG QUÁ KHỨ: Hiển thị tổng hợp theo 4 Tuần
      weeklyExpenses = [
          { label: 'Tuần 1', start: 1, end: 7, total: 0, items: [], incomes: [] },
          { label: 'Tuần 2', start: 8, end: 14, total: 0, items: [], incomes: [] },
          { label: 'Tuần 3', start: 15, end: 21, total: 0, items: [], incomes: [] },
          { label: 'Tuần 4', start: 22, end: 31, total: 0, items: [], incomes: [] }
      ];

      monthData.forEach(t => {
          if (!t.date) return;
          const day = parseInt(t.date.split('-')[2], 10);
          const bucket = day <= 7 ? weeklyExpenses[0] : day <= 14 ? weeklyExpenses[1] : day <= 21 ? weeklyExpenses[2] : weeklyExpenses[3];
          if (isCountedExpense(t)) {
            bucket.total += Number(t.amount || 0);
            bucket.items.push(t);
          } else if (isCountedIncome(t)) {
            bucket.incomes.push(t);
          }
      });
  }

  const weekInsight = buildWeekInsight({
    weeklyExpenses,
    isCurrentMonthView,
    sources: [monthData, annualTransactions, boundaryTransactions],
  });

  const maxWeeklyExpense = Math.max(...weeklyExpenses.map(d => d.total), 1);
  const topWallet = walletChart.length > 0 ? walletChart.reduce((prev, curr) => (prev.value > curr.value) ? prev : curr) : { name: 'Chưa có ví', value: 0 };

  const yearSummary = Array.from({ length: 12 }, (_, i) => {
      const mTrans = annualTransactions.filter(t => {
          if (!t.date) return false;
          const [y, m] = t.date.split('-');
          return parseInt(m) - 1 === i && parseInt(y) === selectedYear;
      });
      const inc = mTrans.filter(t => t.type === 'INCOME' && t.category !== 'Chuyển khoản đến' && t.category !== 'Số dư đầu kỳ').reduce((s,t) => s + Number(t.amount || 0), 0);
      const exp = mTrans.filter(t => t.type === 'EXPENSE' && t.category !== 'Chuyển khoản đi').reduce((s,t) => s + Number(t.amount || 0), 0);
      return { month: i, income: inc, expense: exp, surplus: inc - exp };
  });

  const yearlyTotalExpense = yearSummary.reduce((s, m) => s + m.expense, 0);
  let activeMonths = 12;
  if (selectedYear === currentRealDate.getFullYear()) activeMonths = Math.max(1, currentRealDate.getMonth() + 1);
  else if (selectedYear > currentRealDate.getFullYear()) activeMonths = 1;
  const avgMonthlyExpense = yearlyTotalExpense / activeMonths;

  const annualScopeData = annualTransactions.filter(t => {
      if (!t.date) return false;
      const [y, m] = t.date.split('-');
      if (parseInt(y) !== selectedYear) return false;
      if (annualSelectedMonth !== 'ALL' && parseInt(m) - 1 !== parseInt(annualSelectedMonth)) return false;
      return true;
  });

  const scopeIncome = annualScopeData.filter(t => t.type === 'INCOME' && t.category !== 'Chuyển khoản đến' && t.category !== 'Số dư đầu kỳ').reduce((s, t) => s + Number(t.amount || 0), 0);
  const scopeExpense = annualScopeData.filter(t => t.type === 'EXPENSE' && t.category !== 'Chuyển khoản đi').reduce((s, t) => s + Number(t.amount || 0), 0);
  const scopeSurplus = scopeIncome - scopeExpense;

  // TÍNH TOÁN LƯỢNG TIỀN GỐC BAN ĐẦU ĐỂ GIẢI THÍCH SỰ CHÊNH LỆCH
  const scopeInitialBalance = annualScopeData.filter(t => t.type === 'INCOME' && t.category === 'Số dư đầu kỳ').reduce((s, t) => s + Number(t.amount || 0), 0);

  const scopeExpenseCats = {};
  annualScopeData.filter(t => t.type === 'EXPENSE' && t.category !== 'Chuyển khoản đi').forEach(t => {
      scopeExpenseCats[t.category] = (scopeExpenseCats[t.category] || 0) + Number(t.amount || 0);
  });
  const scopeExpenseChart = Object.entries(scopeExpenseCats).sort((a,b) => b[1] - a[1]).map(([name, value]) => ({ name, value, color: getCategoryColor(name) }));

  const activeWallets = new Set(wallets || []);
  const totalGoalsAmount = (goals || []).reduce((sum, goal) => {
    if (!goal?.wallet || !activeWallets.has(goal.wallet)) return sum;
    return sum + Number(goal.amount || 0);
  }, 0);
  const spendableBal = globalBal - totalGoalsAmount;

  return {
    monthData, yearSummary, income, expense, globalBal, expenseChart, walletChart, fullWalletList, priorityGoal, budgetProgress,
    weeklyExpenses, maxWeeklyExpense, weekInsight, topWallet, getCategoryColor, getWalletColor,
    totalGoalsAmount, spendableBal, isCurrentMonthView,
    annualData: { scopeIncome, scopeExpense, scopeSurplus, scopeInitialBalance, scopeExpenseChart, avgMonthlyExpense, scopeTransactions: annualScopeData }
  };
};

export const deriveTransactionView = ({
  transactions,
  searchQuery,
  filterType,
  filterWallet,
  filterCategory,
}) => {
  const filteredTransactions = transactions.filter(t => {
      const searchStr = searchQuery.toLowerCase();
      const searchNum = searchStr.replace(/[^0-9]/g, '');
      const matchSearch = (t.note || "").toLowerCase().includes(searchStr) ||
                          (t.category || "").toLowerCase().includes(searchStr) ||
                          (searchNum.length > 0 && String(t.amount).includes(searchNum));

      const matchType = filterType === 'ALL' || t.type === filterType;
      const matchWallet = filterWallet === 'ALL' || t.wallet === filterWallet || t.linkedWallet === filterWallet;
      const matchCat = filterCategory === 'ALL' || t.category === filterCategory;
      return matchSearch && matchType && matchWallet && matchCat;
  }).sort((a,b) => {
     const dateDiff = new Date(b.date) - new Date(a.date);
     if (dateDiff !== 0) return dateDiff;
     return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  return { filteredTransactions };
};
