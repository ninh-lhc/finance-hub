import { describe, it, expect } from 'vitest';
import {
  escapeCsvField,
  sanitizeSpreadsheetText,
  unsanitizeSpreadsheetText,
  parseCsvLine,
  parseFinanceCsv,
  serializeFinanceCsv,
  FINANCE_EXPORT_HEADERS,
  normalizeImportDate,
  parseImportAmount,
  parseImportType,
} from './financeCsv.js';

describe('parseCsvLine', () => {
  it('parses simple comma-separated line', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('parses comma inside quotes', () => {
    expect(parseCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
  });

  it('handles quoted segments in legacy toggle parser', () => {
    expect(parseCsvLine('"a,b",c')).toEqual(['a,b', 'c']);
  });

  it('handles empty field', () => {
    expect(parseCsvLine('a,,c')).toEqual(['a', '', 'c']);
  });

  it('preserves Vietnamese unicode', () => {
    expect(parseCsvLine('Ăn uống,500000,Chi tiêu')).toEqual(['Ăn uống', '500000', 'Chi tiêu']);
  });

  it('trims trailing fields', () => {
    expect(parseCsvLine('a,b, ')).toEqual(['a', 'b', '']);
  });
});

describe('escapeCsvField', () => {
  it('returns plain text unchanged', () => {
    expect(escapeCsvField('hello')).toBe('hello');
  });

  it('quotes comma', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
  });

  it('escapes double quotes', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it('quotes newline', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('handles nullish', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('preserves unicode', () => {
    expect(escapeCsvField('Cà phê sữa')).toBe('Cà phê sữa');
  });
});

describe('sanitizeSpreadsheetText', () => {
  it('prefixes formula-like note starting with =', () => {
    expect(sanitizeSpreadsheetText('=1+1')).toBe("'=1+1");
  });

  it('prefixes +', () => {
    expect(sanitizeSpreadsheetText('+100')).toBe("'+100");
  });

  it('prefixes - for text fields', () => {
    expect(sanitizeSpreadsheetText('-note')).toBe("'-note");
  });

  it('prefixes @', () => {
    expect(sanitizeSpreadsheetText('@SUM')).toBe("'@SUM");
  });

  it('prefixes tab', () => {
    expect(sanitizeSpreadsheetText('\tlead')).toBe("'\tlead");
  });

  it('does not change normal text', () => {
    expect(sanitizeSpreadsheetText('Cafe')).toBe('Cafe');
  });
});

describe('unsanitizeSpreadsheetText', () => {
  it('restores protected formula text on import', () => {
    expect(unsanitizeSpreadsheetText("'=cmd")).toBe('=cmd');
  });

  it('keeps leading apostrophe in normal notes', () => {
    expect(unsanitizeSpreadsheetText("'hello")).toBe("'hello");
  });
});

describe('parseFinanceCsv', () => {
  const header =
    'Ngày (DD/MM/YYYY),Nội dung,Phân loại (Thu nhập/Chi tiêu),Danh mục,Nguồn tiền,Số tiền (VND)\n';

  it('accepts valid header and one row', () => {
    const csv = `${header}01/03/2026,"Cafe",Chi tiêu,Ăn uống,Tiền mặt,50000`;
    const result = parseFinanceCsv(csv, { wallets: [], categories: { INCOME: [], EXPENSE: [] } });
    expect(result.validCount).toBe(1);
    expect(result.rows[0].data.amount).toBe(50000);
    expect(result.rows[0].data.type).toBe('EXPENSE');
    expect(result.rows[0].col).toBe('transactions_2026_03');
  });

  it('returns CSV_EMPTY for too few records', () => {
    const result = parseFinanceCsv('only-header');
    expect(result.errors[0]?.code).toBe('CSV_EMPTY');
    expect(result.validCount).toBe(0);
  });

  it('skips blank lines between rows', () => {
    const csv = `${header}01/03/2026,,Chi tiêu,Ăn,Tiền mặt,1000\n\n01/04/2026,,Thu nhập,Lương,Tiền mặt,2000`;
    const result = parseFinanceCsv(csv);
    expect(result.validCount).toBe(2);
  });

  it('records invalid amount', () => {
    const csv = `${header}01/03/2026,,Chi tiêu,Ăn,Tiền mặt,abc`;
    const result = parseFinanceCsv(csv);
    expect(result.validCount).toBe(0);
    expect(result.errors.some((e) => e.code === 'CSV_INVALID_AMOUNT')).toBe(true);
  });

  it('records invalid date', () => {
    const csv = `${header}bad-date,,Chi tiêu,Ăn,Tiền mặt,1000`;
    const result = parseFinanceCsv(csv);
    expect(result.errors.some((e) => e.code === 'CSV_INVALID_DATE')).toBe(true);
  });

  it('parses quoted note with comma', () => {
    const csv = `${header}01/03/2026,"Mua sữa, bánh",Chi tiêu,Ăn,Tiền mặt,1000`;
    const result = parseFinanceCsv(csv);
    expect(result.rows[0].data.note).toBe('Mua sữa, bánh');
  });

  it('assigns row numbers on errors', () => {
    const csv = `${header}bad,,Chi tiêu,Ăn,Tiền mặt,1000`;
    const result = parseFinanceCsv(csv);
    expect(result.errors[0].rowNumber).toBe(2);
  });

  it('does not mutate options', () => {
    const wallets = ['A'];
    const categories = { INCOME: ['Lương'], EXPENSE: ['Ăn'] };
    const snap = JSON.stringify({ wallets, categories });
    parseFinanceCsv(`${header}01/03/2026,,Chi tiêu,Ăn,Tiền mặt,1000`, { wallets, categories });
    expect(JSON.stringify({ wallets, categories })).toBe(snap);
  });
});

describe('serializeFinanceCsv', () => {
  it('uses export header and column order', () => {
    const csv = serializeFinanceCsv({
      transactions: [
        { date: '2026-03-01', note: 'n', type: 'EXPENSE', category: 'Ăn', wallet: 'Tiền mặt', amount: 1000 },
      ],
      includeBom: false,
    });
    const firstLine = csv.split('\n')[0];
    expect(firstLine).toBe(FINANCE_EXPORT_HEADERS.join(','));
  });

  it('serializes multiple transactions sorted by date desc', () => {
    const csv = serializeFinanceCsv({
      transactions: [
        { date: '2026-01-01', note: 'a', type: 'INCOME', category: 'L', wallet: 'W', amount: 1 },
        { date: '2026-03-01', note: 'b', type: 'EXPENSE', category: 'E', wallet: 'W', amount: 2 },
      ],
      includeBom: false,
    });
    const lines = csv.split('\n');
    expect(lines[1]).toContain('01/03/2026');
    expect(lines[2]).toContain('01/01/2026');
  });

  it('uses linkedWallet over wallet in export column', () => {
    const csv = serializeFinanceCsv({
      transactions: [
        {
          date: '2026-03-01',
          note: '',
          type: 'EXPENSE',
          category: 'C',
          wallet: 'A',
          linkedWallet: 'B',
          amount: 1,
        },
      ],
      includeBom: false,
    });
    expect(csv).toContain(',B,1');
  });

  it('does not mutate transactions array', () => {
    const transactions = [{ date: '2026-03-01', note: 'x', type: 'INCOME', category: 'C', wallet: 'W', amount: 1 }];
    const snap = JSON.stringify(transactions);
    serializeFinanceCsv({ transactions, includeBom: false });
    expect(JSON.stringify(transactions)).toBe(snap);
  });
});

describe('round-trip', () => {
  it('serialize then parse valid domain data', () => {
    const tx = [
      {
        date: '2026-05-10',
        note: 'Cafe',
        type: 'EXPENSE',
        category: 'Ăn uống',
        wallet: 'Tiền mặt',
        amount: 45000,
      },
    ];
    const csv = serializeFinanceCsv({ transactions: tx, includeBom: true });
    const parsed = parseFinanceCsv(csv);
    expect(parsed.validCount).toBe(1);
    expect(parsed.rows[0].data.note).toBe('Cafe');
    expect(parsed.rows[0].data.amount).toBe(45000);
  });

  it('round-trips comma and quote in note', () => {
    const tx = [
      {
        date: '2026-05-10',
        note: 'Mua "đặc biệt", ok',
        type: 'EXPENSE',
        category: 'Mua sắm',
        wallet: 'Ví',
        amount: 100,
      },
    ];
    const csv = serializeFinanceCsv({ transactions: tx, includeBom: false });
    const parsed = parseFinanceCsv(csv);
    expect(parsed.rows[0].data.note).toBe('Mua "đặc biệt", ok');
  });

  it('round-trips unicode', () => {
    const tx = [
      {
        date: '2026-05-10',
        note: 'Tiền điện',
        type: 'EXPENSE',
        category: 'Hóa đơn',
        wallet: 'Ngân hàng',
        amount: 200000,
      },
    ];
    const parsed = parseFinanceCsv(serializeFinanceCsv({ transactions: tx, includeBom: false }));
    expect(parsed.rows[0].data.category).toBe('Hóa đơn');
  });

  it('round-trips formula-protected note', () => {
    const tx = [
      {
        date: '2026-05-10',
        note: '=not a formula attack',
        type: 'EXPENSE',
        category: 'Khác',
        wallet: 'Tiền mặt',
        amount: 1000,
      },
    ];
    const parsed = parseFinanceCsv(serializeFinanceCsv({ transactions: tx, includeBom: false }));
    expect(parsed.rows[0].data.note).toBe('=not a formula attack');
  });
});

describe('helpers', () => {
  it('normalizeImportDate supports DD/MM/YYYY', () => {
    expect(normalizeImportDate('01/02/2026')).toBe('2026-02-01');
  });

  it('parseImportAmount strips non-digits', () => {
    expect(parseImportAmount('1.000.000')).toBe(1000000);
  });

  it('parseImportAmount rejects non-positive', () => {
    expect(parseImportAmount('0')).toBe(null);
    expect(parseImportAmount('abc')).toBe(null);
  });

  it('parseImportType detects thu/chi', () => {
    expect(parseImportType('Thu nhập')).toBe('INCOME');
    expect(parseImportType('Chi tiêu')).toBe('EXPENSE');
  });
});
