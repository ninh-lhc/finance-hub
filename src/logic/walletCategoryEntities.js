/**
 * Pure wallet/category settings and transaction reference helpers.
 */

export function isWalletFormReady(form) {
  return Boolean(form?.walletName);
}

export function isCategoryFormReady(form) {
  return Boolean(form?.categoryName);
}

export function normalizeWalletName(walletName) {
  return walletName.trim();
}

export function normalizeCategoryName(categoryName) {
  return categoryName.trim();
}

export function getCategoryTypeFromForm(form) {
  return form.categoryType;
}

export function buildNextWalletsList({ wallets, cleanName, editingId }) {
  const base = wallets || [];
  if (editingId !== null) {
    const newWallets = [...base];
    newWallets[editingId] = cleanName;
    return newWallets;
  }
  return [...base, cleanName];
}

export function getWalletNameAtIndex({ wallets, editingId }) {
  if (editingId === null) return null;
  return wallets?.[editingId] ?? null;
}

export function shouldRenameWallet({ oldName, cleanName }) {
  return oldName !== cleanName;
}

export function getWalletBalanceTransferAmount({ walletBalances, oldName }) {
  return walletBalances?.[oldName] || 0;
}

export function buildNextCategoryList({ categories, categoryType, cleanName, editingId }) {
  const list = categories?.[categoryType] || [];
  if (editingId !== null) {
    const newCatsList = [...list];
    newCatsList[editingId] = cleanName;
    return newCatsList;
  }
  return [...list, cleanName];
}

export function getCategoryNameAtIndex({ categories, categoryType, editingId }) {
  if (editingId === null) return null;
  return categories?.[categoryType]?.[editingId] ?? null;
}

export function shouldRenameCategory({ oldName, cleanName }) {
  return oldName !== cleanName;
}

export function hasCategoryNameConflict({ categories, categoryType, cleanName, editingId }) {
  const list = categories?.[categoryType] || [];
  return list.some((name, index) => name === cleanName && index !== editingId);
}

const OPENING_BALANCE_CATEGORY = 'Số dư đầu kỳ';

export function removeCategoryAtIndex({ categories, categoryType, index }) {
  const list = categories?.[categoryType] || [];
  if (index < 0 || index >= list.length) return [...list];
  return list.filter((_, itemIndex) => itemIndex !== index);
}

export function canDeleteCategory({ categories, categoryType, index }) {
  const list = categories?.[categoryType] || [];
  const name = list[index];
  if (name !== OPENING_BALANCE_CATEGORY) return true;
  return list.filter((item) => item === OPENING_BALANCE_CATEGORY).length > 1;
}

export function buildCategoriesSettings({ categories, categoryType, newCatsList }) {
  return { ...categories, [categoryType]: newCatsList };
}

/** Same range as App: currentYear - 5 .. currentYear + 1, months 01-12 */
export function getTransactionMonthCollectionNames(currentYear) {
  const names = [];
  for (let y = currentYear - 5; y <= currentYear + 1; y += 1) {
    for (let m = 1; m <= 12; m += 1) {
      names.push(`transactions_${y}_${String(m).padStart(2, '0')}`);
    }
  }
  return names;
}

export function buildWalletReferencePatch({
  transaction,
  previousWalletName,
  nextWalletName,
}) {
  if (!transaction) return null;
  const updates = {};
  if (transaction.wallet === previousWalletName) {
    updates.wallet = nextWalletName;
  }
  if (transaction.linkedWallet === previousWalletName) {
    updates.linkedWallet = nextWalletName;
  }
  return Object.keys(updates).length > 0 ? updates : null;
}

export function buildCategoryReferencePatch({
  transaction,
  previousCategoryName,
  nextCategoryName,
  categoryType,
}) {
  if (!transaction) return null;
  if (
    transaction.category === previousCategoryName &&
    transaction.type === categoryType
  ) {
    return { category: nextCategoryName };
  }
  return null;
}
