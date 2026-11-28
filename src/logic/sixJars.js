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

// Firestore supports arrays of objects but rejects arrays of tuples.
export function encodeJarSettings(settings) {
  return { ...settings, categoryJars: settings.categoryJars.map(([category, jar]) => ({ category, jar })) };
}

export function decodeJarSettings(settings) {
  if (!settings) return null;
  return {
    ...settings,
    categoryJars: (settings.categoryJars || []).map((entry) =>
      Array.isArray(entry) ? entry : [entry.category, entry.jar]),
  };
}

function normalizeCategory(value) {
  return value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

const categoryRules = [
  ['giving', /\b(tu thien|quyen gop|ung ho|cho di|qua tang|bieu tang)\b/],
  ['freedom', /\b(dau tu|chung khoan|co phieu|trai phieu|tu do tai chinh)\b/],
  ['savings', /\b(tiet kiem|du phong|khan cap|tich luy|mua lon)\b/],
  ['education', /\b(hoc tap|hoc phi|khoa hoc|giao duc|sach|ky nang)\b/],
  ['play', /\b(giai tri|du lich|huong thu|ca phe|mua sam|so thich|xem phim)\b/],
];

export function suggestJarSettings(categories) {
  const childCategory = categories.find((category) => normalizeCategory(category) === 'chi cho con')
    || categories.find((category) => /^(tien (cho )?con|chi phi (cho )?con|nuoi con|chu cap (cho )?con|cho con|con cai)$/.test(normalizeCategory(category)))
    || DEFAULT_JAR_SETTINGS.childCategory;
  return {
    ...DEFAULT_JAR_SETTINGS,
    childCategory,
    categoryJars: [...new Set(categories)].flatMap((category) => {
      const key = normalizeCategory(category);
      if (category === childCategory || ['chi ho', 'chuyen khoan di', 'chuyen khoan den'].includes(key)) return [];
      const jar = categoryRules.find(([, pattern]) => pattern.test(key))?.[0] || 'needs';
      return [[category, jar]];
    }),
  };
}

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
