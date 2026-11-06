import { describe, it, expect } from 'vitest';
import {
  goalsOnWallet,
  goalLink,
  readGoalLink,
  selectedGoalId,
  netGoalDeltas,
  goalAmountAfterUndo,
  validateGoalLinks,
} from './goalMovement.js';

const goals = [
  { id: 'save', name: 'Tiết kiệm', amount: 20_000_000, wallet: 'Viettel Money' },
  { id: 'emergency', name: 'Quỹ khẩn cấp', amount: 6_272_715, wallet: 'Viettel Money' },
  { id: 'other', name: 'Khác', amount: 1_000, wallet: 'Agribank' },
];

describe('goalsOnWallet', () => {
  it('returns only goals held in that wallet', () => {
    expect(goalsOnWallet(goals, 'Viettel Money').map((goal) => goal.id)).toEqual(['save', 'emergency']);
    expect(goalsOnWallet(goals, 'Tiền mặt')).toEqual([]);
    expect(goalsOnWallet(goals, '')).toEqual([]);
  });
});

describe('goalLink', () => {
  it('stores a decrease as a negative delta and an increase as a positive delta', () => {
    expect(goalLink('emergency', 200_000, 'decrease')).toEqual({ goalId: 'emergency', goalDelta: -200_000 });
    expect(goalLink('save', 1_000_000, 'increase')).toEqual({ goalId: 'save', goalDelta: 1_000_000 });
  });

  it('drops the link when no goal is chosen', () => {
    expect(goalLink('', 1_000_000, 'increase')).toEqual({ goalId: '', goalDelta: 0 });
  });
});

describe('selectedGoalId', () => {
  it('keeps a goal only when it belongs to the charged wallet', () => {
    expect(selectedGoalId(goals, 'Viettel Money', 'emergency')).toBe('emergency');
    expect(selectedGoalId(goals, 'Agribank', 'emergency')).toBe('');
    expect(selectedGoalId(goals, 'Viettel Money', '')).toBe('');
  });
});

describe('netGoalDeltas', () => {
  it('subtracts the previous link before applying the next one', () => {
    expect(netGoalDeltas(
      [{ goalId: 'emergency', goalDelta: -100_000 }],
      [{ goalId: 'emergency', goalDelta: -150_000 }],
    )).toEqual([{ goalId: 'emergency', delta: -50_000 }]);
  });

  it('restores the old goal and charges the new one', () => {
    expect(netGoalDeltas(
      [{ goalId: 'emergency', goalDelta: -100_000 }],
      [{ goalId: 'save', goalDelta: -100_000 }],
    )).toEqual([
      { goalId: 'emergency', delta: 100_000 },
      { goalId: 'save', delta: -100_000 },
    ]);
  });

  it('reverses every link when a transaction is deleted', () => {
    expect(netGoalDeltas(
      [
        { goalId: 'save', goalDelta: 1_000_000 },
        { goalId: 'emergency', goalDelta: -200_000 },
      ],
      [],
    )).toEqual([
      { goalId: 'save', delta: -1_000_000 },
      { goalId: 'emergency', delta: 200_000 },
    ]);
  });

  it('reads a stored link and ignores transactions that never touched a goal', () => {
    expect(readGoalLink({ goalId: 'save', goalDelta: 1000 })).toEqual({ goalId: 'save', goalDelta: 1000 });
    expect(readGoalLink({ amount: 10 })).toEqual({ goalId: '', goalDelta: 0 });
    expect(netGoalDeltas([readGoalLink({ amount: 10 })], [goalLink('', 10, 'decrease')])).toEqual([]);
  });
});

describe('goalAmountAfterUndo', () => {
  it('adds back the amount this transaction already took', () => {
    const goal = goals[1];
    expect(goalAmountAfterUndo(goal, { goalId: 'emergency', goalDelta: -100_000 })).toBe(6_372_715);
    expect(goalAmountAfterUndo(goal, { goalId: 'save', goalDelta: -100_000 })).toBe(6_272_715);
  });
});

describe('validateGoalLinks', () => {
  it('allows spending the emergency fund down to zero', () => {
    const link = goalLink('emergency', 6_272_715, 'decrease');
    const result = validateGoalLinks({
      goals,
      walletByGoalId: { emergency: 'Viettel Money' },
      nextLinks: [link],
    });
    expect(result.ok).toBe(true);
    expect(result.adjustments).toEqual([{ goalId: 'emergency', delta: -6_272_715 }]);
  });

  it('blocks a decrease larger than the goal, counting the amount already on this transaction', () => {
    const result = validateGoalLinks({
      goals,
      walletByGoalId: { emergency: 'Viettel Money' },
      previousLinks: [{ goalId: 'emergency', goalDelta: -100_000 }],
      nextLinks: [goalLink('emergency', 6_400_000, 'decrease')],
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('insufficient');
    expect(result.goalName).toBe('Quỹ khẩn cấp');
    expect(result.available).toBe(6_372_715);
  });

  it('allows adding to savings without an upper cap', () => {
    const result = validateGoalLinks({
      goals,
      walletByGoalId: { save: 'Viettel Money' },
      nextLinks: [goalLink('save', 1_000_000, 'increase')],
    });
    expect(result.ok).toBe(true);
    expect(result.adjustments).toEqual([{ goalId: 'save', delta: 1_000_000 }]);
  });

  it('rejects a goal that is not in the charged wallet', () => {
    const result = validateGoalLinks({
      goals,
      walletByGoalId: { other: 'Viettel Money' },
      nextLinks: [goalLink('other', 500, 'decrease')],
    });
    expect(result).toMatchObject({ ok: false, reason: 'wrong-wallet', goalName: 'Khác' });
  });

  it('does not block deleting a link whose goal document is already gone', () => {
    const result = validateGoalLinks({
      goals,
      previousLinks: [{ goalId: 'deleted', goalDelta: -500 }],
      nextLinks: [],
    });
    expect(result.ok).toBe(true);
    expect(result.adjustments).toEqual([{ goalId: 'deleted', delta: 500 }]);
  });
});
