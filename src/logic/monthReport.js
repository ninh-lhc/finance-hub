import {
  buildAmountDelta,
  expenseByCategory,
  isCountedExpense,
  isCountedIncome,
  previousPeriod,
} from './monthComparison.js';
import { buildSalaryPicture, repaymentTotal } from './salaryPicture.js';

const INCOME_DROP_PERCENT = 15;
const EXPENSE_JUMP_PERCENT = 25;
const NEW_CATEGORY_SHARE = 0.15;
const RATIO_WORSE_POINTS = 10;
const DOMINANT_CATEGORY_SHARE = 0.6;
const DOMINANT_MONTH_SHARE = 0.35;
const MAX_ISSUES = 6;

export function incomeByCategory(transactions) {
  const totals = {};
  (transactions || []).filter(isCountedIncome).forEach((transaction) => {
    const name = transaction.category || 'Khác';
    totals[name] = (totals[name] || 0) + Number(transaction.amount || 0);
  });
  return totals;
}

export function transactionsForCategory(transactions, type, category) {
  const counted = type === 'INCOME' ? isCountedIncome : isCountedExpense;
  return (transactions || [])
    .filter((transaction) => counted(transaction) && (transaction.category || 'Khác') === category)
    .sort((left, right) => String(right.date || '').localeCompare(String(left.date || ''))
      || Number(right.amount || 0) - Number(left.amount || 0));
}

function mergeCategories(currentMap, previousMap, samePeriodMap) {
  const names = new Set([
    ...Object.keys(currentMap),
    ...Object.keys(previousMap),
    ...Object.keys(samePeriodMap),
  ]);
  return [...names].map((name) => ({
    name,
    current: currentMap[name] || 0,
    previous: previousMap[name] || 0,
    samePeriod: samePeriodMap[name] || 0,
  })).sort((left, right) => right.current - left.current
    || right.previous - left.previous
    || right.samePeriod - left.samePeriod
    || left.name.localeCompare(right.name));
}

function transactionKey(transaction, category) {
  if (transaction?.id) return String(transaction.id);
  return `${category}:${transaction?.date || ''}:${transaction?.amount || 0}:${transaction?.note || ''}`;
}

function buildIssues({ current, previous, samePeriod, expenseCategories, currentTransactions }) {
  const issues = [];

  if (previous.income > 0) {
    const delta = buildAmountDelta(current.income, previous.income);
    if (delta.percent != null && delta.percent <= -INCOME_DROP_PERCENT) {
      issues.push({
        id: 'income-previous',
        tone: 'bad',
        amount: Math.abs(delta.amount),
        category: null,
        type: null,
        title: 'Thu nhập giảm so với tháng trước',
        detail: `Thấp hơn ${Math.round(Math.abs(delta.percent))}% so với tháng liền trước.`,
      });
    }
  }

  if (samePeriod && samePeriod.income > 0) {
    const delta = buildAmountDelta(current.income, samePeriod.income);
    if (delta.percent != null && delta.percent <= -INCOME_DROP_PERCENT) {
      issues.push({
        id: 'income-same-period',
        tone: 'bad',
        amount: Math.abs(delta.amount),
        category: null,
        type: null,
        title: 'Thu nhập giảm so với cùng kỳ',
        detail: `Thấp hơn ${Math.round(Math.abs(delta.percent))}% so với tháng này năm trước.`,
      });
    }
  }

  if (current.income === 0 && current.expense > 0) {
    issues.push({
      id: 'spending-without-income',
      tone: 'bad',
      amount: current.expense,
      category: null,
      type: null,
      title: 'Có chi nhưng chưa có thu',
      detail: 'Tháng này có khoản chi nhưng chưa ghi nhận thu nhập.',
    });
  } else if (current.income > 0 && previous.income > 0) {
    const currentRate = (current.expense / current.income) * 100;
    const previousRate = (previous.expense / previous.income) * 100;
    if (currentRate - previousRate >= RATIO_WORSE_POINTS) {
      issues.push({
        id: 'expense-ratio',
        tone: 'bad',
        amount: Math.max(0, Math.round(current.expense - (previousRate / 100) * current.income)),
        category: null,
        type: null,
        title: 'Chi đang chiếm nhiều thu hơn',
        detail: `Tỷ lệ chi/thu là ${Math.round(currentRate)}%, tháng trước là ${Math.round(previousRate)}%.`,
      });
    }
  }

  expenseCategories.forEach((category) => {
    if (category.previous > 0) {
      const delta = buildAmountDelta(category.current, category.previous);
      if (delta.percent != null && delta.percent >= EXPENSE_JUMP_PERCENT && delta.amount > 0) {
        issues.push({
          id: `expense-previous-${category.name}`,
          tone: 'bad',
          amount: delta.amount,
          category: category.name,
          type: 'EXPENSE',
          title: `${category.name} tăng mạnh`,
          detail: `Cao hơn ${Math.round(delta.percent)}% so với tháng trước.`,
        });
      }
    } else if (
      category.current > 0
      && current.expense > 0
      && category.current / current.expense >= NEW_CATEGORY_SHARE
    ) {
      issues.push({
        id: `expense-new-${category.name}`,
        tone: 'warn',
        amount: category.current,
        category: category.name,
        type: 'EXPENSE',
        title: `${category.name} phát sinh trong tháng này`,
        detail: `Không có ở tháng trước và chiếm ${Math.round((category.current / current.expense) * 100)}% tổng chi.`,
      });
    }

    const alreadyFlagged = issues.some((issue) => issue.category === category.name && issue.type === 'EXPENSE');
    if (!alreadyFlagged && samePeriod && category.samePeriod > 0) {
      const delta = buildAmountDelta(category.current, category.samePeriod);
      if (delta.percent != null && delta.percent >= EXPENSE_JUMP_PERCENT && delta.amount > 0) {
        issues.push({
          id: `expense-same-period-${category.name}`,
          tone: 'warn',
          amount: delta.amount,
          category: category.name,
          type: 'EXPENSE',
          title: `${category.name} cao hơn cùng kỳ`,
          detail: `Cao hơn ${Math.round(delta.percent)}% so với tháng này năm trước.`,
        });
      }
    }
  });

  const expenses = (currentTransactions || []).filter(isCountedExpense);
  const byCategory = new Map();
  expenses.forEach((transaction) => {
    const name = transaction.category || 'Khác';
    const list = byCategory.get(name) || [];
    list.push(transaction);
    byCategory.set(name, list);
  });

  const categoryByName = new Map(expenseCategories.map((category) => [category.name, category]));
  const categoryRose = (name) => {
    const category = categoryByName.get(name);
    if (!category || category.previous <= 0) return category?.current > 0;
    return category.current >= category.previous * (1 + EXPENSE_JUMP_PERCENT / 100);
  };

  const flaggedTransactions = new Set();
  byCategory.forEach((list, name) => {
    if (list.length < 2 || !categoryRose(name)) return;
    const total = list.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const top = [...list].sort((left, right) => Number(right.amount || 0) - Number(left.amount || 0))[0];
    const share = total > 0 ? Number(top.amount || 0) / total : 0;
    if (share < DOMINANT_CATEGORY_SHARE) return;
    const key = transactionKey(top, name);
    flaggedTransactions.add(key);
    issues.push({
      id: `dominant-${key}`,
      tone: 'warn',
      amount: Number(top.amount || 0),
      category: name,
      type: 'EXPENSE',
      title: `Một khoản chiếm phần lớn ${name}`,
      detail: `${top.note || name} chiếm ${Math.round(share * 100)}% danh mục này.`,
    });
  });

  if (current.expense > 0 && expenses.length > 0) {
    const top = [...expenses].sort((left, right) => Number(right.amount || 0) - Number(left.amount || 0))[0];
    const name = top.category || 'Khác';
    const key = transactionKey(top, name);
    const share = Number(top.amount || 0) / current.expense;
    if (share >= DOMINANT_MONTH_SHARE && categoryRose(name) && !flaggedTransactions.has(key)) {
      issues.push({
        id: `dominant-month-${key}`,
        tone: 'warn',
        amount: Number(top.amount || 0),
        category: name,
        type: 'EXPENSE',
        title: 'Một khoản chi lớn trong tháng',
        detail: `${top.note || top.category || 'Khoản chi'} chiếm ${Math.round(share * 100)}% tổng chi.`,
      });
    }
  }

  return issues.sort((left, right) => right.amount - left.amount).slice(0, MAX_ISSUES);
}

export function buildMonthReport({
  currentTransactions = [],
  previousTransactions = [],
  samePeriodTransactions = [],
  selectedYear,
  selectedMonth,
  ready = false,
  samePeriodReady = false,
  goals = [],
  repayments = [],
}) {
  const previous = previousPeriod(selectedYear, selectedMonth);
  const asPicture = (list, year, month) => buildSalaryPicture({
    transactions: list,
    goals,
    repaid: repaymentTotal(repayments, { year, month }),
  });
  const current = asPicture(currentTransactions, selectedYear, selectedMonth);
  const previousSummary = asPicture(previousTransactions, previous.year, previous.month);
  const comparableSamePeriod = samePeriodReady ? samePeriodTransactions : [];
  const samePeriod = asPicture(comparableSamePeriod, selectedYear - 1, selectedMonth);

  const expenseCategories = mergeCategories(
    expenseByCategory(currentTransactions),
    expenseByCategory(previousTransactions),
    expenseByCategory(comparableSamePeriod),
  );
  const incomeCategories = mergeCategories(
    incomeByCategory(currentTransactions),
    incomeByCategory(previousTransactions),
    incomeByCategory(comparableSamePeriod),
  );

  const issues = ready
    ? buildIssues({
      current,
      previous: previousSummary,
      samePeriod: samePeriodReady ? samePeriod : null,
      expenseCategories,
      currentTransactions,
    })
    : [];

  return {
    ready: Boolean(ready),
    samePeriodReady: Boolean(samePeriodReady),
    selectedMonth,
    selectedYear,
    previousMonth: previous.month,
    previousYear: previous.year,
    samePeriodMonth: selectedMonth,
    samePeriodYear: selectedYear - 1,
    income: current.income,
    expense: current.expense,
    surplus: current.surplus,
    previousIncome: previousSummary.income,
    previousExpense: previousSummary.expense,
    previousSurplus: previousSummary.surplus,
    samePeriodIncome: samePeriodReady ? samePeriod.income : null,
    samePeriodExpense: samePeriodReady ? samePeriod.expense : null,
    samePeriodSurplus: samePeriodReady ? samePeriod.surplus : null,
    incomeDelta: buildAmountDelta(current.income, previousSummary.income),
    expenseDelta: buildAmountDelta(current.expense, previousSummary.expense),
    surplusDelta: buildAmountDelta(current.surplus, previousSummary.surplus),
    incomeSamePeriodDelta: samePeriodReady ? buildAmountDelta(current.income, samePeriod.income) : null,
    expenseSamePeriodDelta: samePeriodReady ? buildAmountDelta(current.expense, samePeriod.expense) : null,
    surplusSamePeriodDelta: samePeriodReady ? buildAmountDelta(current.surplus, samePeriod.surplus) : null,
    incomeCategories,
    expenseCategories,
    issues,
  };
}
