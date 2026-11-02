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
  if (!date || date.length !== 10) return null;
  return date;
}

/**
 * @param {string} typeStr
 * @returns {'INCOME' | 'EXPENSE' | null}
 */
export function parseImportType(typeStr) {
  return String(typeStr ?? '').toLowerCase().includes('thu') ? 'INCOME' : 'EXPENSE';
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
  const rows = [];
  const totalImpact = {};
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
    note = unsanitizeSpreadsheetText(note ?? '');
    category = unsanitizeSpreadsheetText(category ?? '') || 'Khác';
    wallet = unsanitizeSpreadsheetText(wallet ?? '') || 'Tiền mặt';

    const date = normalizeImportDate(dateStr);
    if (!date) {
      errors.push({ rowNumber, code: 'CSV_INVALID_DATE', message: 'Ngày không hợp lệ.' });
      continue;
    }

    const type = parseImportType(typeStr);

    const amount = parseImportAmount(amountStr);
    if (amount == null) {
      errors.push({ rowNumber, code: 'CSV_INVALID_AMOUNT', message: 'Số tiền không hợp lệ.' });
      continue;
    }

    const [y, m] = date.split('-');
    const colName = `transactions_${y}_${m}`;

    rows.push({
      col: colName,
      data: {
        type,
        category,
        amount,
        wallet,
        date,
        note: note || '',
        createdAt: new Date().toISOString(),
        isSample: false,
      },
    });

    if (type === 'INCOME') {
      totalImpact[wallet] = (totalImpact[wallet] || 0) + amount;
      newIncCats.add(category);
    } else {
      totalImpact[wallet] = (totalImpact[wallet] || 0) - amount;
      newExpCats.add(category);
    }
    newWalletsSet.add(wallet);
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
    totalImpact,
    newWallets: Array.from(newWalletsSet),
    newIncCats: Array.from(newIncCats),
    newExpCats: Array.from(newExpCats),
    errors,
    warnings,
  };
}

/**
 * @param {{ transactions: Array<{ date: string; note?: string; type: string; category: string; wallet?: string; linkedWallet?: string; amount: number }>; includeBom?: boolean; formatDisplayDate?: (date: string) => string }} input
 * @returns {string}
 */
export function serializeFinanceCsv(input) {
  const {
    transactions,
    includeBom = true,
    formatDisplayDate = utils.formatDisplayDate,
  } = input ?? {};

  const list = Array.isArray(transactions) ? [...transactions] : [];
  list.sort((a, b) => new Date(b.date) - new Date(a.date));

  const dataRows = list.map((t) => {
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
    ];
  });

  const lines = [FINANCE_EXPORT_HEADERS.map(escapeCsvField).join(','), ...dataRows.map((r) => r.join(','))];
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
