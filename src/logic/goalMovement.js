/**
 * Goal amount changes caused by one transaction.
 * goalDelta > 0 adds to "đã tích lũy"; goalDelta < 0 subtracts.
 * The stored goal.amount already includes any previous link on the same transaction.
 */

export function goalsOnWallet(goals, walletName) {
  if (!walletName) return [];
  return (goals || []).filter((goal) => goal?.id && goal.wallet === walletName);
}

export function goalLink(goalId, amount, direction) {
  const id = goalId || '';
  const value = Math.abs(Number(amount || 0));
  if (!id || !value) return { goalId: '', goalDelta: 0 };
  return { goalId: id, goalDelta: direction === 'decrease' ? -value : value };
}

export function readGoalLink(transaction) {
  return {
    goalId: transaction?.goalId || '',
    goalDelta: Number(transaction?.goalDelta || 0),
  };
}

export function selectedGoalId(goals, walletName, goalId) {
  if (!goalId) return '';
  return goalsOnWallet(goals, walletName).some((goal) => goal.id === goalId) ? goalId : '';
}

/** Net Firestore increments. previous links are already inside goal.amount. */
export function netGoalDeltas(previousLinks = [], nextLinks = []) {
  const totals = new Map();
  const add = (link, sign) => {
    const id = link?.goalId || '';
    const delta = Number(link?.goalDelta || 0);
    if (!id || !delta) return;
    totals.set(id, (totals.get(id) || 0) + sign * delta);
  };
  previousLinks.forEach((link) => add(link, -1));
  nextLinks.forEach((link) => add(link, 1));
  return [...totals.entries()]
    .filter(([, delta]) => delta !== 0)
    .map(([goalId, delta]) => ({ goalId, delta }));
}

/** How much can still be subtracted, putting back this transaction's previous link first. */
export function goalAmountAfterUndo(goal, previousLink) {
  const current = Number(goal?.amount || 0);
  if (!previousLink || previousLink.goalId !== goal?.id) return current;
  return current - Number(previousLink.goalDelta || 0);
}

/**
 * walletByGoalId maps a newly chosen goal id to the wallet that transaction leg charges.
 * Missing goals that are only being reversed are left out of the result so delete can continue.
 */
export function validateGoalLinks({
  goals,
  walletByGoalId = {},
  previousLinks = [],
  nextLinks = [],
}) {
  for (const link of nextLinks) {
    if (!link?.goalId) continue;
    const goal = (goals || []).find((item) => item.id === link.goalId);
    if (!goal) return { ok: false, reason: 'missing' };
    const expectedWallet = walletByGoalId[link.goalId];
    if (expectedWallet && goal.wallet !== expectedWallet) {
      return { ok: false, reason: 'wrong-wallet', goalName: goal.name };
    }
  }

  const adjustments = netGoalDeltas(previousLinks, nextLinks);
  for (const adjustment of adjustments) {
    if (adjustment.delta >= 0) continue;
    const goal = (goals || []).find((item) => item.id === adjustment.goalId);
    if (!goal) continue;
    const resulting = Number(goal.amount || 0) + adjustment.delta;
    if (resulting < 0) {
      const previous = previousLinks.find((link) => link.goalId === goal.id);
      return {
        ok: false,
        reason: 'insufficient',
        goalName: goal.name || 'Mục tiêu',
        available: goalAmountAfterUndo(goal, previous),
      };
    }
  }

  return { ok: true, adjustments };
}
