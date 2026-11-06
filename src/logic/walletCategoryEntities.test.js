import { describe, it, expect } from 'vitest';
import {
  isWalletFormReady,
  isCategoryFormReady,
  normalizeWalletName,
  buildNextWalletsList,
  getWalletBalanceTransferAmount,
  buildWalletReferencePatch,
  buildNextCategoryList,
  buildCategoriesSettings,
  getTransactionMonthCollectionNames,
  buildCategoryReferencePatch,
  shouldRenameWallet,
  shouldRenameCategory,
  hasCategoryNameConflict,
  removeCategoryAtIndex,
  canDeleteCategory,
} from './walletCategoryEntities.js';

describe('isWalletFormReady', () => {
  it('requires wallet name', () => {
    expect(isWalletFormReady({ walletName: 'Momo' })).toBe(true);
    expect(isWalletFormReady({ walletName: '' })).toBe(false);
  });
});

describe('hasCategoryNameConflict', () => {
  const categories = { INCOME: ['Lương', 'Số dư đầu kỳ'], EXPENSE: ['Ăn uống'] };

  it('blocks a second category with the same name', () => {
    expect(hasCategoryNameConflict({
      categories,
      categoryType: 'INCOME',
      cleanName: 'Số dư đầu kỳ',
      editingId: null,
    })).toBe(true);
  });

  it('allows saving the category currently being renamed', () => {
    expect(hasCategoryNameConflict({
      categories,
      categoryType: 'INCOME',
      cleanName: 'Lương',
      editingId: 0,
    })).toBe(false);
  });
});

describe('removeCategoryAtIndex', () => {
  it('removes one copy and leaves the other', () => {
    expect(removeCategoryAtIndex({
      categories: { INCOME: ['Lương', 'Số dư đầu kỳ', 'Số dư đầu kỳ'] },
      categoryType: 'INCOME',
      index: 2,
    })).toEqual(['Lương', 'Số dư đầu kỳ']);
  });
});

describe('canDeleteCategory', () => {
  it('keeps the last opening-balance category', () => {
    const categories = { INCOME: ['Lương', 'Số dư đầu kỳ'] };
    expect(canDeleteCategory({ categories, categoryType: 'INCOME', index: 1 })).toBe(false);
    expect(canDeleteCategory({ categories, categoryType: 'INCOME', index: 0 })).toBe(true);
  });

  it('allows deleting a duplicate opening-balance category', () => {
    const categories = { INCOME: ['Số dư đầu kỳ', 'Số dư đầu kỳ'] };
    expect(canDeleteCategory({ categories, categoryType: 'INCOME', index: 1 })).toBe(true);
  });
});

describe('isCategoryFormReady', () => {
  it('requires category name', () => {
    expect(isCategoryFormReady({ categoryName: 'Ăn uống' })).toBe(true);
    expect(isCategoryFormReady({ categoryName: '' })).toBe(false);
  });
});

describe('normalizeWalletName', () => {
  it('trims whitespace', () => {
    expect(normalizeWalletName('  Techcombank  ')).toBe('Techcombank');
  });
});

describe('buildNextWalletsList', () => {
  it('appends on create', () => {
    expect(
      buildNextWalletsList({
        wallets: ['A'],
        cleanName: 'B',
        editingId: null,
      }),
    ).toEqual(['A', 'B']);
  });

  it('replaces at index on edit', () => {
    expect(
      buildNextWalletsList({
        wallets: ['A', 'B'],
        cleanName: 'C',
        editingId: 1,
      }),
    ).toEqual(['A', 'C']);
  });

  it('does not mutate wallets input', () => {
    const wallets = ['A'];
    const copy = [...wallets];
    buildNextWalletsList({ wallets, cleanName: 'B', editingId: null });
    expect(wallets).toEqual(copy);
  });

  it('allows duplicate names like current app', () => {
    expect(
      buildNextWalletsList({
        wallets: ['A'],
        cleanName: 'A',
        editingId: null,
      }),
    ).toEqual(['A', 'A']);
  });
});

describe('getWalletBalanceTransferAmount', () => {
  it('returns balance for old key', () => {
    expect(
      getWalletBalanceTransferAmount({
        walletBalances: { Old: 500000 },
        oldName: 'Old',
      }),
    ).toBe(500000);
  });

  it('defaults missing key to 0', () => {
    expect(
      getWalletBalanceTransferAmount({
        walletBalances: {},
        oldName: 'Missing',
      }),
    ).toBe(0);
  });

  it('keeps negative balance if present', () => {
    expect(
      getWalletBalanceTransferAmount({
        walletBalances: { W: -100 },
        oldName: 'W',
      }),
    ).toBe(-100);
  });

  it('does not mutate walletBalances', () => {
    const walletBalances = { A: 1 };
    getWalletBalanceTransferAmount({ walletBalances, oldName: 'A' });
    expect(walletBalances).toEqual({ A: 1 });
  });
});

describe('buildWalletReferencePatch', () => {
  it('patches wallet field', () => {
    expect(
      buildWalletReferencePatch({
        transaction: { wallet: 'Old', linkedWallet: '' },
        previousWalletName: 'Old',
        nextWalletName: 'New',
      }),
    ).toEqual({ wallet: 'New' });
  });

  it('patches linkedWallet field', () => {
    expect(
      buildWalletReferencePatch({
        transaction: { wallet: 'X', linkedWallet: 'Old' },
        previousWalletName: 'Old',
        nextWalletName: 'New',
      }),
    ).toEqual({ linkedWallet: 'New' });
  });

  it('patches both when both match old name', () => {
    expect(
      buildWalletReferencePatch({
        transaction: { wallet: 'Old', linkedWallet: 'Old' },
        previousWalletName: 'Old',
        nextWalletName: 'New',
      }),
    ).toEqual({ wallet: 'New', linkedWallet: 'New' });
  });

  it('returns null when no match', () => {
    expect(
      buildWalletReferencePatch({
        transaction: { wallet: 'Other', linkedWallet: '' },
        previousWalletName: 'Old',
        nextWalletName: 'New',
      }),
    ).toBeNull();
  });

  it('does not mutate transaction', () => {
    const transaction = { wallet: 'Old', linkedWallet: '' };
    const copy = { ...transaction };
    buildWalletReferencePatch({
      transaction,
      previousWalletName: 'Old',
      nextWalletName: 'New',
    });
    expect(transaction).toEqual(copy);
  });
});

describe('buildNextCategoryList', () => {
  it('appends on create', () => {
    expect(
      buildNextCategoryList({
        categories: { EXPENSE: ['A'] },
        categoryType: 'EXPENSE',
        cleanName: 'B',
        editingId: null,
      }),
    ).toEqual(['A', 'B']);
  });

  it('replaces at index on edit', () => {
    expect(
      buildNextCategoryList({
        categories: { INCOME: ['X', 'Y'] },
        categoryType: 'INCOME',
        cleanName: 'Z',
        editingId: 0,
      }),
    ).toEqual(['Z', 'Y']);
  });

  it('does not mutate categories', () => {
    const categories = { EXPENSE: ['A'] };
    const copy = { EXPENSE: ['A'] };
    buildNextCategoryList({
      categories,
      categoryType: 'EXPENSE',
      cleanName: 'B',
      editingId: null,
    });
    expect(categories).toEqual(copy);
  });
});

describe('buildCategoriesSettings', () => {
  it('merges type list into categories object', () => {
    expect(
      buildCategoriesSettings({
        categories: { INCOME: ['A'], EXPENSE: ['B'] },
        categoryType: 'EXPENSE',
        newCatsList: ['B', 'C'],
      }),
    ).toEqual({ INCOME: ['A'], EXPENSE: ['B', 'C'] });
  });
});

describe('buildCategoryReferencePatch', () => {
  it('patches when category and type match', () => {
    expect(
      buildCategoryReferencePatch({
        transaction: { category: 'Old', type: 'EXPENSE' },
        previousCategoryName: 'Old',
        nextCategoryName: 'New',
        categoryType: 'EXPENSE',
      }),
    ).toEqual({ category: 'New' });
  });

  it('no-op when type differs', () => {
    expect(
      buildCategoryReferencePatch({
        transaction: { category: 'Old', type: 'INCOME' },
        previousCategoryName: 'Old',
        nextCategoryName: 'New',
        categoryType: 'EXPENSE',
      }),
    ).toBeNull();
  });

  it('no-op when category name differs', () => {
    expect(
      buildCategoryReferencePatch({
        transaction: { category: 'Other', type: 'EXPENSE' },
        previousCategoryName: 'Old',
        nextCategoryName: 'New',
        categoryType: 'EXPENSE',
      }),
    ).toBeNull();
  });

  it('does not patch transfer categories unless name matches', () => {
    expect(
      buildCategoryReferencePatch({
        transaction: { category: 'Chuyển khoản đi', type: 'EXPENSE' },
        previousCategoryName: 'Old',
        nextCategoryName: 'New',
        categoryType: 'EXPENSE',
      }),
    ).toBeNull();
  });
});

describe('getTransactionMonthCollectionNames', () => {
  it('covers 7 years and 12 months per year', () => {
    const names = getTransactionMonthCollectionNames(2026);
    expect(names).toHaveLength(7 * 12);
    expect(names[0]).toBe('transactions_2021_01');
    expect(names[names.length - 1]).toBe('transactions_2027_12');
  });

  it('pads month with two digits', () => {
    const names = getTransactionMonthCollectionNames(2020);
    expect(names).toContain('transactions_2015_09');
    expect(names).toContain('transactions_2021_12');
  });
});

describe('rename flags', () => {
  it('shouldRenameWallet detects name change', () => {
    expect(shouldRenameWallet({ oldName: 'A', cleanName: 'B' })).toBe(true);
    expect(shouldRenameWallet({ oldName: 'A', cleanName: 'A' })).toBe(false);
  });

  it('shouldRenameCategory detects name change', () => {
    expect(shouldRenameCategory({ oldName: 'A', cleanName: 'B' })).toBe(true);
    expect(shouldRenameCategory({ oldName: 'A', cleanName: 'A' })).toBe(false);
  });
});
