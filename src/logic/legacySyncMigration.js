/**
 * Pure legacy public-sync → UID migration planning (read-only inventory/conflicts).
 */

import { maskSyncCode, maskUid } from './dataSourceDiagnostics.js';

const SETTINGS_DOC_ID = 'general';

export const MIGRATION_SCAN_YEARS_BEFORE = 5;
export const MIGRATION_SCAN_YEARS_AFTER = 1;

export const FIXED_RANGE_WARNING =
  'Chỉ quét giao dịch trong khoảng năm cố định (5 năm trước đến 1 năm sau năm hiện tại). Dữ liệu ngoài phạm vi có thể bị bỏ sót.';

export const LEGACY_MIGRATION_INSPECT_BLOCKED_MESSAGE =
  'Chưa thể bắt đầu kiểm tra migration trên thiết bị này. Hãy hoàn tất đăng nhập và điều kiện phòng đồng bộ cũ trước.';

function normalizeSyncCode(syncCode) {
  return typeof syncCode === 'string' ? syncCode.trim() : '';
}

function countCategories(categories) {
  if (!categories || typeof categories !== 'object') {
    return 0;
  }
  const income = Array.isArray(categories.INCOME) ? categories.INCOME.length : 0;
  const expense = Array.isArray(categories.EXPENSE) ? categories.EXPENSE.length : 0;
  return income + expense;
}

function normalizeWalletNames(wallets) {
  if (!Array.isArray(wallets)) {
    return [];
  }
  return wallets
    .filter((w) => typeof w === 'string')
    .map((w) => w.trim())
    .sort();
}

/**
 * @param {{ user?: { uid?: string; isAnonymous?: boolean } | null; syncCode?: string | null }} input
 */
export function getLegacyMigrationReadiness({ user, syncCode }) {
  const blockers = [];

  if (!user) {
    blockers.push({
      code: 'AUTH_NOT_READY',
      message: 'Chưa sẵn sàng phiên đăng nhập Firebase.',
    });
    return { ready: false, blockers };
  }

  if (user.isAnonymous) {
    blockers.push({
      code: 'GOOGLE_AUTH_REQUIRED',
      message: 'Cần đăng nhập Google trước khi kiểm tra migration.',
    });
    return { ready: false, blockers };
  }

  if (!user.uid) {
    blockers.push({
      code: 'AUTH_NOT_READY',
      message: 'Thiếu UID người dùng.',
    });
    return { ready: false, blockers };
  }

  const code = normalizeSyncCode(syncCode);
  if (code.length === 0) {
    blockers.push({
      code: 'SYNC_CODE_REQUIRED',
      message: 'Không phát hiện phòng đồng bộ cũ trên origin này.',
    });
    return { ready: false, blockers };
  }

  return { ready: true, blockers: [] };
}

/**
 * @param {{
 *   user?: { uid?: string; isAnonymous?: boolean } | null;
 *   readiness?: { ready?: boolean };
 *   isInspecting?: boolean;
 * }}
 */
export function canStartLegacyMigrationInspect({ user, readiness, isInspecting }) {
  if (isInspecting) {
    return { allowed: false, reason: 'in-progress' };
  }
  if (!user || !readiness?.ready) {
    return { allowed: false, reason: 'not-ready' };
  }
  return { allowed: true, reason: null };
}

/**
 * @param {{ summary?: object } | null | undefined} serviceResult
 * @returns {{ summary: object } | null}
 */
export function toLegacyMigrationUiInspectionState(serviceResult) {
  if (!serviceResult || typeof serviceResult !== 'object') {
    return null;
  }
  const { summary } = serviceResult;
  if (!summary || typeof summary !== 'object') {
    return null;
  }
  return { summary };
}

/**
 * @param {{ currentYear: number }} options
 */
export function getMigrationCollectionNames({ currentYear }) {
  const year =
    typeof currentYear === 'number' && Number.isFinite(currentYear)
      ? currentYear
      : new Date().getFullYear();

  const transactionCollectionNames = [];
  const yearStart = year - MIGRATION_SCAN_YEARS_BEFORE;
  const yearEnd = year + MIGRATION_SCAN_YEARS_AFTER;

  for (let y = yearStart; y <= yearEnd; y += 1) {
    for (let m = 1; m <= 12; m += 1) {
      transactionCollectionNames.push(`transactions_${y}_${String(m).padStart(2, '0')}`);
    }
  }

  return {
    settingsCollectionName: 'settings',
    settingsDocumentId: SETTINGS_DOC_ID,
    goalsCollectionName: 'goals',
    budgetsCollectionName: 'budgets',
    transactionCollectionNames,
    yearStart,
    yearEnd,
    transactionCollectionCount: transactionCollectionNames.length,
  };
}

/**
 * @param {{ exists: boolean; data?: Record<string, unknown> | null }} input
 */
export function buildSettingsInventorySlice({ exists, data }) {
  if (!exists || !data) {
    return {
      exists: false,
      walletsCount: 0,
      categoriesCount: 0,
      walletBalanceEntries: 0,
      walletNames: [],
    };
  }

  const wallets = data.wallets;
  const walletNames = normalizeWalletNames(wallets);
  const walletBalances = data.walletBalances;
  const walletBalanceEntries =
    walletBalances && typeof walletBalances === 'object'
      ? Object.keys(walletBalances).length
      : 0;

  return {
    exists: true,
    walletsCount: walletNames.length,
    categoriesCount: countCategories(data.categories),
    walletBalanceEntries,
    walletNames,
  };
}

/**
 * @param {Array<{ collectionId: string; docIds: string[]; dates: string[] }>} transactionCollections
 */
export function buildTransactionsInventorySlice(transactionCollections) {
  const collectionCounts = {};
  const ids = [];
  const dates = [];

  transactionCollections.forEach(({ collectionId, docIds, dates: colDates }) => {
    collectionCounts[collectionId] = docIds.length;
    ids.push(...docIds);
    dates.push(...colDates);
  });

  const sortedDates = dates.filter((d) => typeof d === 'string' && d.length > 0).sort();

  return {
    totalCount: ids.length,
    collectionCounts,
    ids,
    earliestDate: sortedDates.length > 0 ? sortedDates[0] : null,
    latestDate: sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null,
  };
}

/**
 * @param {{ docIds: string[] }} input
 */
export function buildEntityListInventorySlice({ docIds }) {
  const ids = Array.isArray(docIds) ? [...docIds] : [];
  return {
    count: ids.length,
    ids,
  };
}

function intersectIds(sourceIds, targetIds) {
  const targetSet = new Set(targetIds);
  return sourceIds.filter((id) => targetSet.has(id));
}

function settingsShapeMismatch(sourceSettings, targetSettings) {
  if (!sourceSettings.exists || !targetSettings.exists) {
    return false;
  }
  if (sourceSettings.walletsCount !== targetSettings.walletsCount) {
    return true;
  }
  if (sourceSettings.categoriesCount !== targetSettings.categoriesCount) {
    return true;
  }
  const sourceNames = sourceSettings.walletNames ?? [];
  const targetNames = targetSettings.walletNames ?? [];
  if (sourceNames.length !== targetNames.length) {
    return true;
  }
  for (let i = 0; i < sourceNames.length; i += 1) {
    if (sourceNames[i] !== targetNames[i]) {
      return true;
    }
  }
  return false;
}

/**
 * @param {{ source: object; target: object }} input
 */
export function buildLegacyMigrationInventory({ source, target }) {
  const sourceTxIds = source.transactions?.ids ?? [];
  const targetTxIds = target.transactions?.ids ?? [];
  const transactionIdConflicts = intersectIds(sourceTxIds, targetTxIds);

  const sourceGoalIds = source.goals?.ids ?? [];
  const targetGoalIds = target.goals?.ids ?? [];
  const goalIdConflicts = intersectIds(sourceGoalIds, targetGoalIds);

  const sourceBudgetIds = source.budgets?.ids ?? [];
  const targetBudgetIds = target.budgets?.ids ?? [];
  const budgetIdConflicts = intersectIds(sourceBudgetIds, targetBudgetIds);

  const sourceSettings = source.settings ?? { exists: false };
  const targetSettings = target.settings ?? { exists: false };
  const settingsBothExist = sourceSettings.exists && targetSettings.exists;
  const settingsShapeMismatchFlag = settingsShapeMismatch(sourceSettings, targetSettings);

  return {
    source,
    target,
    conflicts: {
      settingsBothExist,
      settingsShapeMismatch: settingsShapeMismatchFlag,
      transactionIds: transactionIdConflicts,
      goalIds: goalIdConflicts,
      budgetIds: budgetIdConflicts,
    },
  };
}

/**
 * @param {{
 *   inventory: ReturnType<typeof buildLegacyMigrationInventory>;
 *   scanMeta: { yearStart: number; yearEnd: number; transactionCollectionCount: number };
 *   maskedUid?: string | null;
 *   maskedSyncCode?: string | null;
 * }} input
 */
export function buildLegacyMigrationDryRunSummary({ inventory, scanMeta, maskedUid, maskedSyncCode }) {
  const { source, target, conflicts } = inventory;

  const transactionConflictCount = conflicts.transactionIds.length;
  const goalConflictCount = conflicts.goalIds.length;
  const budgetConflictCount = conflicts.budgetIds.length;
  let settingsConflictCount = 0;
  if (conflicts.settingsBothExist) {
    settingsConflictCount += 1;
  }
  if (conflicts.settingsShapeMismatch) {
    settingsConflictCount += 1;
  }

  const warnings = [FIXED_RANGE_WARNING];
  warnings.push('Security Rules mục tiêu trong repo chưa được deploy — dry-run nên chạy trước khi deploy.');
  warnings.push('Chưa thực hiện migration, sao chép hoặc ghi đè dữ liệu.');
  warnings.push('Chưa có bản backup được xác nhận.');

  const notes = [
    'Kiểm tra này chỉ đọc Firestore; không xóa hoặc sửa phòng đồng bộ cũ.',
    'Số xung đột ID không loại trừ trùng nội dung với ID khác.',
  ];

  return {
    scanRange: {
      yearStart: scanMeta.yearStart,
      yearEnd: scanMeta.yearEnd,
      transactionCollectionCount: scanMeta.transactionCollectionCount,
    },
    sourceCounts: {
      settingsExists: Boolean(source.settings?.exists),
      wallets: source.settings?.walletsCount ?? 0,
      categories: source.settings?.categoriesCount ?? 0,
      walletBalanceEntries: source.settings?.walletBalanceEntries ?? 0,
      transactions: source.transactions?.totalCount ?? 0,
      goals: source.goals?.count ?? 0,
      budgets: source.budgets?.count ?? 0,
    },
    targetCounts: {
      settingsExists: Boolean(target.settings?.exists),
      wallets: target.settings?.walletsCount ?? 0,
      categories: target.settings?.categoriesCount ?? 0,
      walletBalanceEntries: target.settings?.walletBalanceEntries ?? 0,
      transactions: target.transactions?.totalCount ?? 0,
      goals: target.goals?.count ?? 0,
      budgets: target.budgets?.count ?? 0,
    },
    conflictCounts: {
      transactions: transactionConflictCount,
      goals: goalConflictCount,
      budgets: budgetConflictCount,
      settings: settingsConflictCount,
      total:
        transactionConflictCount +
        goalConflictCount +
        budgetConflictCount +
        settingsConflictCount,
    },
    dateRange: {
      sourceEarliest: source.transactions?.earliestDate ?? null,
      sourceLatest: source.transactions?.latestDate ?? null,
      targetEarliest: target.transactions?.earliestDate ?? null,
      targetLatest: target.transactions?.latestDate ?? null,
    },
    maskedUid: maskedUid ?? null,
    maskedSyncCode: maskedSyncCode ?? null,
    warnings,
    notes,
    migrationPerformed: false,
    backupPerformed: false,
    rulesDeployed: false,
  };
}

export { maskSyncCode, maskUid };
