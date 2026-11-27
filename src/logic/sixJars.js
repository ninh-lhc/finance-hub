import { buildSalaryPicture, isSalaryExpense, repaymentTotal } from './salaryPicture.js';

export const SIX_JARS = [
  { id: 'needs', label: 'Thiết yếu', weight: 55 },
  { id: 'savings', label: 'Tiết kiệm dài hạn', weight: 10 },
  { id: 'freedom', label: 'Tự do tài chính', weight: 10 },
  { id: 'education', label: 'Học tập', weight: 10 },
  { id: 'play', label: 'Hưởng thụ', weight: 10 },
  { id: 'giving', label: 'Cho đi', weight: 5 },
];

export const DEFAULT_JAR_SETTINGS = {
  childCategory: 'Chi cho con',
  childTarget: 4_000_000,
  categoryJars: [
    ['Ăn uống', 'needs'], ['Di chuyển', 'needs'], ['Hóa đơn', 'needs'],
    ['Giải trí', 'play'],
  ],
};

function jarSpending(transactions, goals, context, assignments, childCategory) {
  const totals = new Map();
  for (const row of transactions) {
    if (row.category === childCategory || !isSalaryExpense(row, goals)) continue;
    const amount = Math.max(0, Number(row.amount || 0) - (context?.funded(row) || 0));
    const jar = assignments.get(row.category) || '';
    totals.set(jar, (totals.get(jar) || 0) + amount);
  }
  return totals;
}

export function buildSixJarPlan({ settings, transactions, previousTransactions, goals, context, repayments, year, month }) {
  const assignments = new Map(settings.categoryJars.filter(([, jar]) => SIX_JARS.some(({ id }) => id === jar)));
  let salary = 0;
  let childPaid = 0;
  for (const row of transactions) {
    if (row.type === 'INCOME' && row.category === 'Lương') salary += Number(row.amount || 0);
    if (row.type === 'EXPENSE' && row.category === settings.childCategory) childPaid += Number(row.amount || 0);
  }

  const repaid = buildSalaryPicture({
    transactions, goals, repaid: repaymentTotal(repayments, { year, month }),
  }).repaid;
  const ready = salary > 0 && childPaid >= settings.childTarget;
  const available = Math.max(0, Math.floor(salary - childPaid - repaid));
  const actual = jarSpending(transactions, goals, context, assignments, settings.childCategory);
  const previous = jarSpending(previousTransactions, goals, context, assignments, settings.childCategory);
  const mappedPrevious = SIX_JARS.reduce((sum, { id }) => sum + (previous.get(id) || 0), 0);
  const jars = SIX_JARS.map(({ id, label, weight }) => {
    const lastSpent = previous.get(id) || 0;
    const share = mappedPrevious ? (weight / 100 + lastSpent / mappedPrevious) / 2 : weight / 100;
    const exact = available * share;
    return { id, label, lastSpent, spent: actual.get(id) || 0, limit: Math.floor(exact), fraction: exact % 1 };
  });
  const remainder = available - jars.reduce((sum, jar) => sum + jar.limit, 0);
  const roundingOrder = [...jars].sort((left, right) => right.fraction - left.fraction);
  for (const jar of roundingOrder.slice(0, remainder)) jar.limit += 1;

  return {
    salary, childPaid, repaid, ready, available, mappedPrevious,
    unassigned: actual.get('') || 0,
    previousUnassigned: previous.get('') || 0,
    jars: jars.map(({ id, label, lastSpent, spent, limit }) => ({
      id, label, lastSpent, spent, limit, remaining: limit - spent,
    })),
  };
}
