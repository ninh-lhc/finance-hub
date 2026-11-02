const GOOGLE_PROVIDER_ID = 'google.com';

/**
 * @param {string | null | undefined} uid
 * @returns {string | null}
 */
export function maskUid(uid) {
  if (uid == null || typeof uid !== 'string') {
    return null;
  }
  const trimmed = uid.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length <= 4) {
    return '••••';
  }
  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 2)}…${trimmed.slice(-2)}`;
  }
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

/**
 * @param {string | null | undefined} syncCode
 * @returns {string | null}
 */
export function maskSyncCode(syncCode) {
  if (syncCode == null || typeof syncCode !== 'string') {
    return null;
  }
  const trimmed = syncCode.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length <= 2) {
    return `${trimmed[0] ?? ''}•`;
  }
  const visible = trimmed.slice(0, 2);
  const hiddenCount = trimmed.length - 2;
  return visible + '•'.repeat(hiddenCount);
}

/**
 * @param {import('firebase/auth').User | null | undefined} user
 * @returns {'anonymous' | 'google' | 'authenticated-other' | 'not-authenticated'}
 */
export function resolveAuthMode(user) {
  if (!user) {
    return 'not-authenticated';
  }
  if (user.isAnonymous) {
    return 'anonymous';
  }
  const providers = user.providerData ?? [];
  const hasGoogle = providers.some((p) => p?.providerId === GOOGLE_PROVIDER_ID);
  if (hasGoogle) {
    return 'google';
  }
  return 'authenticated-other';
}

/**
 * @param {import('firebase/auth').User | null | undefined} user
 * @param {string | null | undefined} syncCode
 * @returns {'legacy-public-sync' | 'uid-owned' | 'not-ready'}
 */
export function resolveDataSourceMode(user, syncCode) {
  const code = typeof syncCode === 'string' ? syncCode.trim() : '';
  if (code.length > 0) {
    return 'legacy-public-sync';
  }
  if (user?.uid) {
    return 'uid-owned';
  }
  return 'not-ready';
}

function countCategories(categories) {
  if (!categories || typeof categories !== 'object') {
    return 0;
  }
  const income = Array.isArray(categories.INCOME) ? categories.INCOME.length : 0;
  const expense = Array.isArray(categories.EXPENSE) ? categories.EXPENSE.length : 0;
  return income + expense;
}

function countWalletBalanceEntries(walletBalances) {
  if (!walletBalances || typeof walletBalances !== 'object') {
    return 0;
  }
  return Object.keys(walletBalances).length;
}

/**
 * @param {{
 *   user?: import('firebase/auth').User | null;
 *   syncCode?: string | null;
 *   selectedYear?: number;
 *   selectedMonth?: number;
 *   transactions?: unknown[] | null;
 *   wallets?: unknown[] | null;
 *   categories?: { INCOME?: string[]; EXPENSE?: string[] } | null;
 *   walletBalances?: Record<string, unknown> | null;
 *   goals?: unknown[] | null;
 *   budgets?: unknown[] | null;
 * }} input
 */
export function buildDataSourceDiagnostics(input) {
  const {
    user,
    syncCode,
    selectedYear,
    selectedMonth,
    transactions,
    wallets,
    categories,
    walletBalances,
    goals,
    budgets,
  } = input ?? {};

  const authMode = resolveAuthMode(user);
  const normalizedSyncCode = typeof syncCode === 'string' ? syncCode.trim() : '';
  const hasSyncCode = normalizedSyncCode.length > 0;
  const dataSourceMode = resolveDataSourceMode(user, normalizedSyncCode);

  const year =
    typeof selectedYear === 'number' && Number.isFinite(selectedYear) ? selectedYear : null;
  const monthIndex =
    typeof selectedMonth === 'number' && Number.isFinite(selectedMonth) ? selectedMonth : null;
  const selectedPeriod =
    year != null && monthIndex != null
      ? `${year}-${String(monthIndex + 1).padStart(2, '0')}`
      : null;

  const txList = Array.isArray(transactions) ? transactions : [];
  const walletList = Array.isArray(wallets) ? wallets : [];
  const goalList = Array.isArray(goals) ? goals : [];
  const budgetList = Array.isArray(budgets) ? budgets : [];

  const warnings = [];
  const notes = [];

  if (dataSourceMode === 'legacy-public-sync') {
    warnings.push(
      'Thiết bị đang ưu tiên phòng đồng bộ công khai (legacy) thay vì đường dẫn UID riêng.',
    );
    warnings.push(
      'Không liên kết/đăng nhập Google, không ngắt phòng và không deploy Security Rules mới cho đến khi có kế hoạch backup/migration rõ ràng.',
    );
    warnings.push('Security Rules mục tiêu trong repo chưa được deploy lên production.');
  }

  if (dataSourceMode === 'uid-owned' && authMode === 'anonymous') {
    warnings.push(
      'Dữ liệu đang gắn với UID ẩn danh của trình duyệt/thiết bị này; thiết bị khác có thể có UID và dữ liệu khác.',
    );
    warnings.push('Không xóa dữ liệu trình duyệt (cookies/local storage) khi chưa backup.');
  }

  if (dataSourceMode === 'uid-owned' && authMode === 'google') {
    notes.push('Dữ liệu đang đọc/ghi theo UID tài khoản Google trên thiết bị này.');
    notes.push('Không thể khẳng định mọi thiết bị đã dùng cùng nguồn dữ liệu.');
  }

  if (dataSourceMode === 'not-ready') {
    warnings.push('Chưa xác định được nguồn dữ liệu — đang chờ phiên đăng nhập Firebase.');
  }

  return {
    authMode,
    dataSourceMode,
    maskedUid: maskUid(user?.uid),
    hasSyncCode,
    maskedSyncCode: hasSyncCode ? maskSyncCode(normalizedSyncCode) : null,
    selectedPeriod,
    loadedCounts: {
      transactions: txList.length,
      wallets: walletList.length,
      categories: countCategories(categories),
      goals: goalList.length,
      budgets: budgetList.length,
    },
    loadedWalletBalanceCount: countWalletBalanceEntries(walletBalances),
    warnings,
    notes,
  };
}
