const OPENING_BALANCE = 'Số dư đầu kỳ';
const TRANSFER_IN = 'Chuyển khoản đến';
const TRANSFER_OUT = 'Chuyển khoản đi';

export function isCountedIncome(transaction) {
  return transaction?.type === 'INCOME'
    && transaction.category !== TRANSFER_IN
    && transaction.category !== OPENING_BALANCE;
}

export function isCountedExpense(transaction) {
  return transaction?.type === 'EXPENSE' && transaction.category !== TRANSFER_OUT;
}

export function sumAmounts(transactions, predicate) {
  return (transactions || [])
    .filter(predicate)
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
}

export function expenseByCategory(transactions) {
  const totals = {};
  (transactions || []).filter(isCountedExpense).forEach((transaction) => {
    const name = transaction.category || 'Khác';
    totals[name] = (totals[name] || 0) + Number(transaction.amount || 0);
  });
  return totals;
}

export function previousPeriod(selectedYear, selectedMonth) {
  if (selectedMonth <= 0) {
    return { year: selectedYear - 1, month: 11 };
  }
  return { year: selectedYear, month: selectedMonth - 1 };
}

export function filterByYearMonth(transactions, year, month) {
  return (transactions || []).filter((transaction) => {
    if (!transaction?.date) return false;
    const [yearText, monthText] = String(transaction.date).split('-');
    return Number(yearText) === year && Number(monthText) - 1 === month;
  });
}

export function summarizeCounted(transactions) {
  const income = sumAmounts(transactions, isCountedIncome);
  const expense = sumAmounts(transactions, isCountedExpense);
  return { income, expense, surplus: income - expense };
}

export function buildAmountDelta(current, previous) {
  const amount = current - previous;
  if (!previous) {
    return {
      amount,
      percent: null,
      direction: current > 0 ? 'up' : current < 0 ? 'down' : 'flat',
    };
  }
  const percent = (amount / previous) * 100;
  return {
    amount,
    percent,
    direction: amount > 0 ? 'up' : amount < 0 ? 'down' : 'flat',
  };
}

export function buildMonthComparison({
  currentTransactions = [],
  previousTransactions = [],
  yearTransactions = [],
  selectedYear,
  selectedMonth,
  ready = false,
}) {
  const previous = previousPeriod(selectedYear, selectedMonth);
  const income = sumAmounts(currentTransactions, isCountedIncome);
  const expense = sumAmounts(currentTransactions, isCountedExpense);
  const previousIncome = sumAmounts(previousTransactions, isCountedIncome);
  const previousExpense = sumAmounts(previousTransactions, isCountedExpense);

  const monthlyExpenses = Array.from({ length: 12 }, (_, month) => (
    sumAmounts(filterByYearMonth(yearTransactions, selectedYear, month), isCountedExpense)
  ));
  const monthsWithExpense = monthlyExpenses.filter((value) => value > 0).length;
  const averageDivisor = Math.max(monthsWithExpense, 1);

  const yearCategoryTotals = expenseByCategory(
    (yearTransactions || []).filter((transaction) => {
      if (!transaction?.date) return false;
      return Number(String(transaction.date).split('-')[0]) === selectedYear;
    }),
  );
  const currentCategories = expenseByCategory(currentTransactions);
  const previousCategories = expenseByCategory(previousTransactions);
  const names = new Set([
    ...Object.keys(currentCategories),
    ...Object.keys(previousCategories),
  ]);

  const categories = [...names].map((name) => ({
    name,
    current: currentCategories[name] || 0,
    previous: previousCategories[name] || 0,
    yearAverage: (yearCategoryTotals[name] || 0) / averageDivisor,
  })).sort((left, right) => right.current - left.current || right.previous - left.previous);

  return {
    ready: Boolean(ready),
    previousMonth: previous.month,
    previousYear: previous.year,
    income,
    expense,
    surplus: income - expense,
    previousIncome,
    previousExpense,
    previousSurplus: previousIncome - previousExpense,
    incomeDelta: buildAmountDelta(income, previousIncome),
    expenseDelta: buildAmountDelta(expense, previousExpense),
    surplusDelta: buildAmountDelta(income - expense, previousIncome - previousExpense),
    monthlyExpenses,
    maxMonthlyExpense: Math.max(...monthlyExpenses, 1),
    categories,
  };
}
