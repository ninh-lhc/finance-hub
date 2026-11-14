import { buildAmountDelta } from './monthComparison.js';

function statusOf(spent, limit) {
  const remaining = limit - spent;
  if (remaining < 0) return 'over';
  if (remaining === 0) return 'used';
  return 'left';
}

function spendOf(categories, name) {
  return categories.get(name) || { current: 0, previous: 0, samePeriod: 0 };
}

export function buildBudgetSnapshot({
  budgets = [],
  expenseCategories = [],
  samePeriodReady = false,
} = {}) {
  const limits = new Map();
  budgets.forEach((budget) => {
    const name = budget?.category;
    if (!name) return;
    limits.set(name, (limits.get(name) || 0) + (Number(budget.amount) || 0));
  });

  const categories = new Map((expenseCategories || []).map((item) => [item.name, item]));
  const tracked = [...limits.entries()].map(([name, limit]) => {
    const spend = spendOf(categories, name);
    const spent = spend.current || 0;
    const previous = spend.previous || 0;
    const samePeriod = samePeriodReady ? (spend.samePeriod || 0) : null;
    return {
      name,
      limit,
      spent,
      previous,
      samePeriod,
      remaining: limit - spent,
      status: statusOf(spent, limit),
      percent: limit > 0 ? (spent / limit) * 100 : (spent > 0 ? 100 : 0),
      previousDelta: buildAmountDelta(spent, previous),
      samePeriodDelta: samePeriodReady ? buildAmountDelta(spent, spend.samePeriod || 0) : null,
    };
  }).sort((left, right) => (
    right.percent - left.percent
    || right.spent - left.spent
    || left.name.localeCompare(right.name, 'vi')
  ));

  const trackedNames = new Set(tracked.map((item) => item.name));
  const open = (expenseCategories || [])
    .filter((item) => item?.name && !trackedNames.has(item.name))
    .filter((item) => (item.current || 0) > 0 || (item.previous || 0) > 0 || (samePeriodReady && (item.samePeriod || 0) > 0))
    .map((item) => ({
      name: item.name,
      spent: item.current || 0,
      previous: item.previous || 0,
      samePeriod: samePeriodReady ? (item.samePeriod || 0) : null,
      previousDelta: buildAmountDelta(item.current || 0, item.previous || 0),
      samePeriodDelta: samePeriodReady ? buildAmountDelta(item.current || 0, item.samePeriod || 0) : null,
    }))
    .sort((left, right) => right.spent - left.spent || left.name.localeCompare(right.name, 'vi'));

  const spent = tracked.reduce((sum, item) => sum + item.spent, 0);
  const limit = tracked.reduce((sum, item) => sum + item.limit, 0);
  const leftItems = tracked.filter((item) => item.status === 'left');
  const overItems = tracked.filter((item) => item.status === 'over');

  return {
    tracked,
    open,
    totals: {
      limit,
      spent,
      remaining: limit - spent,
      percent: limit > 0 ? (spent / limit) * 100 : 0,
      leftCount: leftItems.length,
      leftAmount: leftItems.reduce((sum, item) => sum + item.remaining, 0),
      usedCount: tracked.filter((item) => item.status === 'used').length,
      overCount: overItems.length,
      overAmount: overItems.reduce((sum, item) => sum + (item.spent - item.limit), 0),
      openCount: open.filter((item) => item.spent > 0).length,
      openSpent: open.reduce((sum, item) => sum + item.spent, 0),
    },
  };
}
