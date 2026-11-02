/**
 * Pure budget/goal payload builders (no React, Firestore, or side effects).
 */

export function isBudgetFormReady(form) {
  return Boolean(form?.budgetCategory && form?.budgetAmount);
}

export function isGoalFormReady(form) {
  return Boolean(form?.goalName);
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
    isSample: false,
  };
}
