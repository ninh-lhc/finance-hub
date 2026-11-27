import utils from '../utils/format.js';

export const FINANCE_EXPORT_HEADERS = [
  'Ngày',
  'Nội dung',
  'Phân loại',
  'Danh mục',
  'Nguồn tiền',
  'Số tiền (VND)',
];

export const FINANCE_IMPORT_SAMPLE_HEADERS = [
  'Ngày (DD/MM/YYYY)',
  'Nội dung',
  'Phân loại (Thu nhập/Chi tiêu)',
  'Danh mục',
  'Nguồn tiền',
  'Số tiền (VND)',
];

const FORMULA_PREFIX_CHARS = new Set(['=', '+', '-', '@', '\t', '\r']);

/**
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function sanitizeSpreadsheetText(value) {
  if (value == null) return '';
  const text = String(value);
  if (text.length === 0) return '';
  const first = text[0];
  if (FORMULA_PREFIX_CHARS.has(first)) {
    return `'${text}`;
  }
  return text;
}

/**
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function unsanitizeSpreadsheetText(value) {
  if (value == null) return '';
  const text = String(value);
  if (text.length >= 2 && text[0] === "'" && FORMULA_PREFIX_CHARS.has(text[1])) {
    return text.slice(1);
  }
  return text;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function escapeCsvField(value) {
  if (value == null) return '';
  const raw = String(value);
  const escaped = raw.replace(/"/g, '""');
  if (/[",\r\n]/.test(escaped)) {
    return `"${escaped}"`;
  }
  return escaped;
}

/**
 * Legacy single-line parser (characterization of prior App behavior).
 * @param {string} line
 * @returns {string[]}
 */
export function parseCsvLine(line) {
  const cols = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      cols.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  cols.push(cur.trim().replace(/^"|"$/g, ''));
  return cols.map((c) => c.replace(/^"|"$/g, ''));
}

/**
 * @param {string} csvText
 * @returns {string[][]}
 */
export function parseCsvRecords(csvText) {
  const text = csvText.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      if (row.some((cell) => cell.trim() !== '') || rows.length === 0) {
        rows.push(row);
      }
      row = [];
    } else if (ch === '\r') {
      // handled by \n in CRLF
    } else {
      field += ch;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim() !== '') || rows.length === 0) {
    rows.push(row);
  }

  return rows.map((cells) =>
    cells.map((cell) => {
      const trimmed = cell.trim();
      return trimmed.replace(/^"|"$/g, '');
    }),
  );
}

/**
 * @param {string} dateStr
 * @returns {string | null}
 */
export function normalizeImportDate(dateStr) {
  if (!dateStr) return null;
  let date = dateStr.trim();
  if (date.includes('/')) {
    const parts = date.split('/');
    if (parts.length === 3) {
      date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  } else if (date.includes('-')) {
    const parts = date.split('-');
    if (parts[0].length !== 4 && parts.length === 3) {
      date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const checked = new Date(Date.UTC(year, month - 1, day));
  if (
    checked.getUTCFullYear() !== year
    || checked.getUTCMonth() !== month - 1
    || checked.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/**
 * @param {string} typeStr
 * @returns {'INCOME' | 'EXPENSE' | null}
 */
export function parseImportType(typeStr) {
  const text = String(typeStr ?? '').trim().toLowerCase();
  if (text === 'thu nhập' || text === 'thu nhap' || text === 'thu' || text === 'income') return 'INCOME';
  if (text === 'chi tiêu' || text === 'chi' || text === 'expense') return 'EXPENSE';
  return null;
}

/**
 * @param {string} amountStr
 * @returns {number | null}
 */
export function parseImportAmount(amountStr) {
  const amount = Number(String(amountStr ?? '').replace(/[^0-9]/g, ''));
  if (Number.isNaN(amount) || amount <= 0) return null;
  return amount;
}

/**
 * @param {string} csvText
 * @param {{ wallets?: string[]; categories?: { INCOME?: string[]; EXPENSE?: string[] } }} [options]
 */
const LEDGER_METADATA = 'FinanceHub metadata';
const validDocumentId = (value) => typeof value === 'string' && value.length > 0
  && value.length < 500 && !value.includes('/') && !/^\.{1,2}$|^__.*__$/.test(value);

function readLedgerMetadata(value) {
  if (!value) return {};
  const metadata = JSON.parse(value);
  if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') throw new Error('Invalid ledger metadata');
  const data = {};
  for (const key of ['transferId', 'goalId', 'fundRepaymentId', 'goalBalanceRevision']) {
    if (validDocumentId(metadata[key])) data[key] = metadata[key];
  }
  for (const key of ['wallet', 'linkedWallet', 'createdAt']) {
    if (typeof metadata[key] === 'string') data[key] = metadata[key];
  }
  if (data.goalId && Number.isFinite(metadata.goalDelta)) data.goalDelta = metadata.goalDelta;
  const goals = (Array.isArray(metadata.goals) ? metadata.goals : []).filter((goal) => (
    validDocumentId(goal?.id) && typeof goal.name === 'string' && Number.isFinite(goal.amount)
  )).map((goal) => ({
    id: goal.id, name: goal.name, amount: goal.amount,
    wallet: typeof goal.wallet === 'string' ? goal.wallet : '',
    target: Number.isFinite(goal.target) ? goal.target : 0,
    isEmergencyFund: goal.isEmergencyFund === true,
    balanceRevision: validDocumentId(goal.balanceRevision) ? goal.balanceRevision : '',
  }));
  const repayments = (Array.isArray(metadata.repayments) ? metadata.repayments : []).filter((item) => (
    validDocumentId(item?.id) && validDocumentId(item.goalId) && ['borrow', 'helped'].includes(item.kind)
    && Number.isFinite(item.amount) && item.amount > 0 && Number.isInteger(item.debtYear)
    && Number.isInteger(item.debtMonth) && item.debtMonth >= 0 && item.debtMonth < 12
    && typeof item.payDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.payDate)
  )).map(({ id, goalId, kind, amount, debtYear, debtMonth, payDate, sourceWallet, destinationWallet }) => ({
    id, goalId, kind, amount, debtYear, debtMonth, payDate,
    sourceWallet: typeof sourceWallet === 'string' ? sourceWallet : '',
    destinationWallet: typeof destinationWallet === 'string' ? destinationWallet : '',
  }));
  return { id: validDocumentId(metadata.id) ? metadata.id : undefined, data, goals, repayments };
}

export function parseFinanceCsv(csvText, options = {}) {
  const errors = [];
  const warnings = [];
  const initialWallets = options.wallets ?? [];
  const initialCategories = options.categories ?? { INCOME: [], EXPENSE: [] };

  const records = parseCsvRecords(csvText);
  if (records.length < 2) {
    return {
      header: records[0] ?? [],
      rows: [],
      validCount: 0,
      lastImportedDate: null,
      totalImpact: {},
      newWallets: [...initialWallets],
      newIncCats: [...(initialCategories.INCOME ?? [])],
      newExpCats: [...(initialCategories.EXPENSE ?? [])],
      errors: [{ rowNumber: 0, code: 'CSV_EMPTY', message: 'File trống hoặc thiếu dữ liệu.' }],
      warnings,
    };
  }

  const header = records[0];
  const metadataIndex = header.indexOf(LEDGER_METADATA);
  const goalRecords = new Map();
  const repaymentRecords = new Map();
  const rows = [];
  const newWalletsSet = new Set(initialWallets);
  const newIncCats = new Set(initialCategories.INCOME ?? []);
  const newExpCats = new Set(initialCategories.EXPENSE ?? []);
  let validCount = 0;
  let lastImportedDate = null;

  for (let i = 1; i < records.length; i += 1) {
    const rowNumber = i + 1;
    const cols = records[i];
    if (cols.length < 6) {
      if (cols.every((c) => !c.trim())) continue;
      errors.push({
        rowNumber,
        code: 'CSV_COLUMN_COUNT',
        message: 'Dòng không đủ 6 cột.',
      });
      continue;
    }

    let [dateStr, note, typeStr, category, wallet, amountStr] = cols;
    let metadata = {};
    try {
      if (metadataIndex >= 0) metadata = readLedgerMetadata(cols[metadataIndex]);
    } catch {
      errors.push({ rowNumber, code: 'CSV_INVALID_METADATA', message: 'Siêu dữ liệu giao dịch không hợp lệ.' });
      continue;
    }
    note = unsanitizeSpreadsheetText(note ?? '');
    category = unsanitizeSpreadsheetText(category ?? '') || 'Khác';
    wallet = unsanitizeSpreadsheetText(wallet ?? '').trim();
    const knownWallets = initialWallets;
    if (!wallet) {
      wallet = knownWallets.length === 0 || knownWallets.includes('Tiền mặt') ? 'Tiền mặt' : '';
    }

    const date = normalizeImportDate(dateStr);
    if (!date) {
      errors.push({ rowNumber, code: 'CSV_INVALID_DATE', message: 'Ngày không hợp lệ.' });
      continue;
    }

    const type = parseImportType(typeStr);
    if (!type) {
      errors.push({ rowNumber, code: 'CSV_INVALID_TYPE', message: 'Phân loại phải là Thu nhập hoặc Chi tiêu.' });
      continue;
    }

    if (!wallet) {
      errors.push({ rowNumber, code: 'CSV_UNKNOWN_WALLET', message: 'Thiếu nguồn tiền.' });
      continue;
    }
    if (!metadata.id && knownWallets.length > 0 && !knownWallets.includes(wallet)) {
      errors.push({ rowNumber, code: 'CSV_UNKNOWN_WALLET', message: `Không có ví "${wallet}".` });
      continue;
    }

    const amount = parseImportAmount(amountStr);
    if (amount == null) {
      errors.push({ rowNumber, code: 'CSV_INVALID_AMOUNT', message: 'Số tiền không hợp lệ.' });
      continue;
    }

    const [y, m] = date.split('-');
    const colName = `transactions_${y}_${m}`;

    rows.push({
      col: colName,
      ...(metadata.id ? { id: metadata.id } : {}),
      data: {
        type,
        category,
        amount,
        wallet,
        date,
        note: note || '',
        createdAt: new Date().toISOString(),
        isSample: false,
        ...metadata.data,
      },
    });

    if (type === 'INCOME') {
      newIncCats.add(category);
    } else {
      newExpCats.add(category);
    }
    newWalletsSet.add(wallet);
    if (metadata.data?.wallet) newWalletsSet.add(metadata.data.wallet);
    if (metadata.data?.linkedWallet) newWalletsSet.add(metadata.data.linkedWallet);
    for (const goal of metadata.goals || []) goalRecords.set(goal.id, goal);
    for (const item of metadata.repayments || []) repaymentRecords.set(item.id, item);
    validCount += 1;
    lastImportedDate = date;
  }

  if (validCount === 0 && errors.length === 0) {
    errors.push({
      rowNumber: 0,
      code: 'CSV_NO_VALID_ROWS',
      message: 'Không có dữ liệu hợp lệ.',
    });
  }

  return {
    header,
    rows,
    validCount,
    lastImportedDate,
    totalImpact: sumImportImpact(rows),
    newWallets: Array.from(newWalletsSet),
    newIncCats: Array.from(newIncCats),
    newExpCats: Array.from(newExpCats),
    errors,
    warnings,
    ledgerGoals: [...goalRecords.values()],
    ledgerRepayments: [...repaymentRecords.values()],
  };
}

/**
 * Same identity the export writes back: the wallet that actually moved.
 * @param {{ date?: string; type?: string; category?: string; wallet?: string; linkedWallet?: string; amount?: number; note?: string }} transaction
 * @returns {string}
 */
export function transactionImportKey(transaction) {
  const wallet = transaction?.linkedWallet || transaction?.wallet || '';
  return [
    transaction?.date || '',
    transaction?.type || '',
    transaction?.category || '',
    wallet,
    String(Number(transaction?.amount || 0)),
    transaction?.note || '',
  ].join('\u0001');
}

/**
 * @param {Array<{ data: { date?: string; type?: string; category?: string; wallet?: string; linkedWallet?: string; amount?: number; note?: string } }>} rows
 * @param {Array<{ date?: string; type?: string; category?: string; wallet?: string; linkedWallet?: string; amount?: number; note?: string }>} existingTransactions
 * @returns {{ rows: typeof rows; skipped: number }}
 */
export function omitImportedDuplicates(rows, existingTransactions = []) {
  const existing = existingTransactions || [];
  const seen = new Set(existing.map(transactionImportKey));
  const ids = new Set(existing.map((transaction) => transaction.id).filter(Boolean));
  const seenLegacy = new Set(existing.filter((transaction) => !transaction.id).map(transactionImportKey));
  const kept = [];
  let skipped = 0;
  (rows || []).forEach((row) => {
    const key = transactionImportKey(row?.data);
    if (row.id ? ids.has(row.id) || seenLegacy.has(key) : seen.has(key)) {
      skipped += 1;
      return;
    }
    seen.add(key);
    if (row.id) ids.add(row.id);
    else seenLegacy.add(key);
    kept.push(row);
  });
  return { rows: kept, skipped };
}

/**
 * @param {Array<{ data: { type?: string; wallet?: string; amount?: number } }>} rows
 * @returns {Record<string, number>}
 */
export function sumImportImpact(rows) {
  const totalImpact = {};
  (rows || []).forEach((row) => {
    const wallet = row?.data?.type === 'EXPENSE' ? row.data.linkedWallet || row.data.wallet : row?.data?.wallet;
    const amount = Number(row?.data?.amount || 0);
    if (!wallet || !amount) return;
    const delta = row.data.type === 'INCOME' ? amount : -amount;
    totalImpact[wallet] = (totalImpact[wallet] || 0) + delta;
  });
  return totalImpact;
}

/**
 * @param {{ transactions: Array<{ date: string; note?: string; type: string; category: string; wallet?: string; linkedWallet?: string; amount: number }>; includeBom?: boolean; formatDisplayDate?: (date: string) => string }} input
 * @returns {string}
 */
export function serializeFinanceCsv(input) {
  const {
    transactions,
    goals = [],
    repayments = [],
    includeBom = true,
    formatDisplayDate = utils.formatDisplayDate,
  } = input ?? {};

  const list = Array.isArray(transactions) ? [...transactions] : [];
  list.sort((a, b) => new Date(b.date) - new Date(a.date));
  const hasMetadata = list.some((row) => row.id || row.transferId || row.goalId || row.fundRepaymentId)
    || goals.length > 0 || repayments.length > 0;

  const dataRows = list.map((t, index) => {
    const note = sanitizeSpreadsheetText(t.note ?? '');
    const category = sanitizeSpreadsheetText(t.category ?? '');
    const wallet = sanitizeSpreadsheetText(t.linkedWallet || t.wallet || '');
    const typeLabel = t.type === 'INCOME' ? 'Thu nhập' : 'Chi tiêu';
    return [
      escapeCsvField(formatDisplayDate(t.date)),
      escapeCsvField(note),
      escapeCsvField(typeLabel),
      escapeCsvField(category),
      escapeCsvField(wallet),
      String(t.amount ?? ''),
      ...(hasMetadata ? [escapeCsvField(JSON.stringify({
        id: t.id, wallet: t.wallet, linkedWallet: t.linkedWallet, createdAt: t.createdAt,
        transferId: t.transferId, goalId: t.goalId, goalDelta: t.goalDelta,
        goalBalanceRevision: t.goalBalanceRevision, fundRepaymentId: t.fundRepaymentId,
        goals: index === 0 ? goals : undefined,
        repayments: index === 0 ? repayments : undefined,
      }))] : []),
    ];
  });

  const headers = hasMetadata ? [...FINANCE_EXPORT_HEADERS, LEDGER_METADATA] : FINANCE_EXPORT_HEADERS;
  const lines = [headers.map(escapeCsvField).join(','), ...dataRows.map((r) => r.join(','))];
  const body = lines.join('\n');
  return includeBom ? `\uFEFF${body}` : body;
}

/**
 * @returns {string}
 */
export function serializeFinanceImportSampleCsv() {
  const sampleRows = [
    ['01/02/2025', 'Nạp tiền gốc', 'Thu nhập', 'Số dư đầu kỳ', 'Ví ngân hàng', '5000000'],
    ['25/02/2025', 'Lương tháng 2', 'Thu nhập', 'Lương', 'Tiền mặt', '15000000'],
    ['26/02/2025', 'Mua sắm siêu thị', 'Chi tiêu', 'Mua sắm', 'Ví ngân hàng', '500000'],
  ];
  const lines = [
    FINANCE_IMPORT_SAMPLE_HEADERS.map(escapeCsvField).join(','),
    ...sampleRows.map((row) => row.map((cell) => escapeCsvField(cell)).join(',')),
  ];
  return `\uFEFF${lines.join('\n')}`;
}
