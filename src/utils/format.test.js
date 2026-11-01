import { describe, it, expect, vi, afterEach } from 'vitest';
import utils from './format.js';

describe('formatVND', () => {
  it('formats positive amounts with vi-VN currency', () => {
    expect(utils.formatVND(1_000_000)).toBe('1.000.000 ₫');
  });

  it('formats zero', () => {
    expect(utils.formatVND(0)).toBe('0 ₫');
  });

  it('treats nullish as zero', () => {
    expect(utils.formatVND(null)).toBe('0 ₫');
    expect(utils.formatVND(undefined)).toBe('0 ₫');
  });

  it('formats negative amounts when provided', () => {
    expect(utils.formatVND(-500)).toContain('-');
    expect(utils.formatVND(-500)).toContain('500');
  });
});

describe('calculateProgress', () => {
  it('returns percentage capped at 100', () => {
    expect(utils.calculateProgress(50, 100)).toBe(50);
    expect(utils.calculateProgress(150, 100)).toBe(100);
  });

  it('returns 0 when max is 0', () => {
    expect(utils.calculateProgress(50, 0)).toBe(0);
  });

  it('does not clamp negative current values', () => {
    expect(utils.calculateProgress(-10, 100)).toBe(-10);
  });
});

describe('formatInputNumber', () => {
  it('returns empty string for empty input', () => {
    expect(utils.formatInputNumber('')).toBe('');
    expect(utils.formatInputNumber(null)).toBe('');
    expect(utils.formatInputNumber(undefined)).toBe('');
  });

  it('adds thousand separators', () => {
    expect(utils.formatInputNumber('1000000')).toBe('1.000.000');
    expect(utils.formatInputNumber(2500)).toBe('2.500');
  });

  it('strips non-digit characters before formatting', () => {
    expect(utils.formatInputNumber('1.234.567')).toBe('1.234.567');
    expect(utils.formatInputNumber('abc12x34')).toBe('1.234');
  });
});

describe('parseInputNumber', () => {
  it('parses dotted strings to integer', () => {
    expect(utils.parseInputNumber('1.000.500')).toBe(1_000_500);
  });

  it('returns empty string for empty input', () => {
    expect(utils.parseInputNumber('')).toBe('');
  });

  it('accepts numeric input via toString', () => {
    expect(utils.parseInputNumber(12345)).toBe(12345);
  });

  it('ignores non-digit characters', () => {
    expect(utils.parseInputNumber('12a3')).toBe(123);
  });
});

describe('getRelativeYears', () => {
  it('returns five years centered on centerYear', () => {
    expect(utils.getRelativeYears(2026)).toEqual([2024, 2025, 2026, 2027, 2028]);
  });
});

describe('getMonthName', () => {
  it('returns 1-based month label', () => {
    expect(utils.getMonthName(0)).toBe('Tháng 1');
    expect(utils.getMonthName(10)).toBe('Tháng 11');
  });
});

describe('getLocalYMD', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns local calendar date for fixed system time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00'));
    expect(utils.getLocalYMD()).toBe('2026-06-15');
  });
});

describe('formatDisplayDate', () => {
  it('converts ISO date to DD/MM/YYYY', () => {
    expect(utils.formatDisplayDate('2026-06-15')).toBe('15/06/2026');
  });

  it('returns empty string for falsy input', () => {
    expect(utils.formatDisplayDate('')).toBe('');
    expect(utils.formatDisplayDate(null)).toBe('');
  });

  it('returns original string when not ISO-shaped', () => {
    expect(utils.formatDisplayDate('15/06/2026')).toBe('15/06/2026');
  });
});

describe('getDayOfWeekVN', () => {
  it('maps ISO date to Vietnamese weekday label', () => {
    expect(utils.getDayOfWeekVN('2026-06-15')).toBe('T2');
    expect(utils.getDayOfWeekVN('2026-06-14')).toBe('Chủ nhật');
  });

  it('returns empty string for falsy input', () => {
    expect(utils.getDayOfWeekVN('')).toBe('');
  });
});
