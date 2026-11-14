import {
  expenseByCategory,
  isCountedExpense,
  isCountedIncome,
  summarizeCounted,
} from './monthComparison.js';

const TREND_LIMIT = 6;
const TOP_EXPENSE_LIMIT = 10;

export function transactionWallet(transaction) {
  return transaction?.linkedWallet || transaction?.wallet || 'Không rõ ví';
}

export function inclusiveDayCount(from, to) {
  const start = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  const end = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  if (Number.isNaN(start) || Number.isNaN(end)) return 1;
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

export function monthsInRange(from, to) {
  const start = new Date(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, 1);
  const end = new Date(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, 1);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  const months = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    months.push(key);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function orderedRange(from, to) {
  if (from && to && from > to) return { from: to, to: from };
  return { from, to };
}

function inRange(transaction, from, to) {
  const date = transaction?.date;
  if (!date || !from || !to) return false;
  return date >= from && date <= to;
}

function shareRows(totals, total) {
  return Object.entries(totals)
    .map(([name, amount]) => ({
      name,
      amount,
      share: total > 0 ? amount / total : 0,
    }))
    .sort((left, right) => right.amount - left.amount || left.name.localeCompare(right.name, 'vi'));
}

function totalsBy(transactions, predicate, keyOf) {
  const totals = {};
  (transactions || []).filter(predicate).forEach((transaction) => {
    const name = keyOf(transaction);
    totals[name] = (totals[name] || 0) + Number(transaction.amount || 0);
  });
  return totals;
}

export function buildPeriodReport({
  transactions = [],
  from,
  to,
  wallet = 'ALL',
} = {}) {
  const range = orderedRange(from, to);
  const period = (transactions || []).filter((transaction) => {
    if (!inRange(transaction, range.from, range.to)) return false;
    if (wallet && wallet !== 'ALL' && transactionWallet(transaction) !== wallet) return false;
    return true;
  });
  const summary = summarizeCounted(period);
  const months = monthsInRange(range.from, range.to);
  const monthly = months.map((key) => {
    const monthSummary = summarizeCounted(period.filter((transaction) => String(transaction.date || '').startsWith(key)));
    return {
      key,
      label: `${key.slice(5)}/${key.slice(2, 4)}`,
      ...monthSummary,
    };
  });
  const monthCount = Math.max(months.length, 1);
  const dayCount = inclusiveDayCount(range.from, range.to);
  const expenseCategories = shareRows(expenseByCategory(period), summary.expense);
  const incomeCategories = shareRows(
    totalsBy(period, isCountedIncome, (transaction) => transaction.category || 'Khác'),
    summary.income,
  );
  const walletExpenses = shareRows(
    totalsBy(period, isCountedExpense, transactionWallet),
    summary.expense,
  );
  const trendNames = expenseCategories.slice(0, TREND_LIMIT).map((item) => item.name);
  const trends = trendNames.map((name) => ({
    name,
    points: months.map((key) => period
      .filter((transaction) => isCountedExpense(transaction)
        && String(transaction.date || '').startsWith(key)
        && (transaction.category || 'Khác') === name)
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)),
  }));
  const topExpenses = period
    .filter(isCountedExpense)
    .slice()
    .sort((left, right) => Number(right.amount || 0) - Number(left.amount || 0)
      || String(right.date || '').localeCompare(String(left.date || '')))
    .slice(0, TOP_EXPENSE_LIMIT)
    .map((transaction) => ({
      id: transaction.id,
      date: transaction.date,
      note: transaction.note || '',
      category: transaction.category || 'Khác',
      wallet: transactionWallet(transaction),
      amount: Number(transaction.amount || 0),
      transaction,
    }));

  return {
    from: range.from,
    to: range.to,
    wallet: wallet || 'ALL',
    income: summary.income,
    expense: summary.expense,
    surplus: summary.surplus,
    count: period.filter((transaction) => isCountedIncome(transaction) || isCountedExpense(transaction)).length,
    dayCount,
    monthCount,
    averagePerDay: summary.expense / dayCount,
    averageMonthlyExpense: summary.expense / monthCount,
    savingsRate: summary.income > 0 ? summary.surplus / summary.income : 0,
    monthly,
    maxMonthly: Math.max(...monthly.map((month) => Math.max(month.income, month.expense)), 1),
    expenseCategories,
    incomeCategories,
    walletExpenses,
    trends,
    maxTrend: Math.max(...trends.flatMap((trend) => trend.points), 1),
    topExpenses,
  };
}
