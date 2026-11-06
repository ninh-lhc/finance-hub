import { describe, it, expect } from 'vitest';
import {
  isBudgetFormReady,
  isGoalFormReady,
  buildBudgetPayload,
  buildGoalPayload,
} from './planningEntities.js';

describe('isBudgetFormReady', () => {
  it('requires category and amount', () => {
    expect(isBudgetFormReady({ budgetCategory: 'Ăn uống', budgetAmount: '100000' })).toBe(true);
    expect(isBudgetFormReady({ budgetCategory: '', budgetAmount: '100000' })).toBe(false);
    expect(isBudgetFormReady({ budgetCategory: 'Ăn uống', budgetAmount: '' })).toBe(false);
  });
});

describe('isGoalFormReady', () => {
  it('requires goal name and the wallet holding the money', () => {
    expect(isGoalFormReady({ goalName: 'Mua nhà', goalWallet: 'ViettelPay' })).toBe(true);
    expect(isGoalFormReady({ goalName: 'Mua nhà' })).toBe(false);
    expect(isGoalFormReady({ goalName: '', goalWallet: 'ViettelPay' })).toBe(false);
  });
});

describe('buildBudgetPayload', () => {
  it('maps form to Firestore budget shape', () => {
    const form = { budgetCategory: 'Di chuyển', budgetAmount: '2500000' };
    expect(buildBudgetPayload({ form })).toEqual({
      category: 'Di chuyển',
      amount: 2500000,
      isSample: false,
    });
  });

  it('parses amount with Number()', () => {
    const form = { budgetCategory: 'X', budgetAmount: 500 };
    expect(buildBudgetPayload({ form }).amount).toBe(500);
  });

  it('does not mutate form', () => {
    const form = { budgetCategory: 'A', budgetAmount: '1' };
    const copy = { ...form };
    buildBudgetPayload({ form });
    expect(form).toEqual(copy);
  });

  it('matches create and edit payload shape', () => {
    const form = { budgetCategory: 'Thu nhập', budgetAmount: '999' };
    const once = buildBudgetPayload({ form });
    const twice = buildBudgetPayload({ form });
    expect(once).toEqual(twice);
    expect(Object.keys(once).sort()).toEqual(['amount', 'category', 'isSample']);
  });

  it('coerces invalid amount to NaN like Number()', () => {
    const form = { budgetCategory: 'A', budgetAmount: 'abc' };
    expect(Number.isNaN(buildBudgetPayload({ form }).amount)).toBe(true);
  });
});

describe('buildGoalPayload', () => {
  it('maps form to Firestore goal shape', () => {
    const form = {
      goalName: 'Du lịch',
      goalAmount: '10000000',
      goalCurrentAmount: '2000000',
    };
    expect(buildGoalPayload({ form })).toEqual({
      name: 'Du lịch',
      target: 10000000,
      amount: 2000000,
      wallet: '',
      isSample: false,
    });
  });

  it('defaults current amount to 0 when empty', () => {
    expect(
      buildGoalPayload({
        form: { goalName: 'X', goalAmount: '100', goalCurrentAmount: '' },
      }).amount,
    ).toBe(0);
  });

  it('defaults current amount to 0 when NaN after Number', () => {
    expect(
      buildGoalPayload({
        form: { goalName: 'X', goalAmount: '100', goalCurrentAmount: 'bad' },
      }).amount,
    ).toBe(0);
  });

  it('keeps zero current amount', () => {
    expect(
      buildGoalPayload({
        form: { goalName: 'X', goalAmount: '100', goalCurrentAmount: '0' },
      }).amount,
    ).toBe(0);
  });

  it('does not mutate form', () => {
    const form = { goalName: 'G', goalAmount: '1', goalCurrentAmount: '2' };
    const copy = { ...form };
    buildGoalPayload({ form });
    expect(form).toEqual(copy);
  });

  it('omits createdAt (added on create in service)', () => {
    const payload = buildGoalPayload({
      form: { goalName: 'G', goalAmount: '1', goalCurrentAmount: '0' },
    });
    expect(payload).not.toHaveProperty('createdAt');
  });

  it('create and edit use same payload fields', () => {
    const form = { goalName: 'G', goalAmount: '500', goalCurrentAmount: '100' };
    expect(Object.keys(buildGoalPayload({ form })).sort()).toEqual(
      ['amount', 'isSample', 'name', 'target', 'wallet'].sort(),
    );
  });
});
