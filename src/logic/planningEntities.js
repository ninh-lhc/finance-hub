/**
 * Pure budget/goal payload builders (no React, Firestore, or side effects).
 */

export function isBudgetFormReady(form) {
  return Boolean(form?.budgetCategory && form?.budgetAmount);
}

export function isGoalFormReady(form) {
  return Boolean(form?.goalName && form?.goalWallet);
}

export function locksForWallet(goals, walletName) {
  return (goals || [])
    .filter((goal) => goal?.wallet === walletName)
    .map((goal) => ({
      name: goal.name,
      amount: Number(goal.amount || 0),
    }));
}

export function buildBudgetPayload({ form }) {
  return {
    category: form.budgetCategory,
    amount: Number(form.budgetAmount),
    isSample: false,
  };
}

export function buildGoalPayload({ form }) {
  return {
    name: form.goalName,
    target: Number(form.goalAmount),
    amount: Number(form.goalCurrentAmount) || 0,
    wallet: form.goalWallet || '',
    isSample: false,
  };
}
