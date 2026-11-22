import { describe, expect, it } from 'vitest';
import {
  buildSalaryPicture,
  isEmergencyGoal,
  salaryPictureLines,
  unpaidFundOffers,
} from './salaryPicture.js';

const tx = (partial) => ({ amount: 0, goalId: '', goalDelta: 0, ...partial });

describe('buildSalaryPicture', () => {
  const goals = [{ id: 'emergency', name: 'Quỹ khẩn cấp' }];

  it('recognizes an emergency fund by name', () => {
    expect(isEmergencyGoal({ name: 'Quỹ khẩn cấp' })).toBe(true);
    expect(isEmergencyGoal({ name: 'Mua nhà' })).toBe(false);
  });

  it('turns the extra reimbursement into commission and drops the matched pass-through', () => {
    const picture = buildSalaryPicture({
      goals,
      transactions: [
        tx({ type: 'INCOME', category: 'Lương', amount: 9_700_000, date: '2026-11-01' }),
        tx({ type: 'INCOME', category: 'Thu nợ/Hoàn ứng', amount: 4_300_000, date: '2026-11-05' }),
        tx({ type: 'EXPENSE', category: 'Chi hộ', amount: 3_342_750, date: '2026-11-03' }),
        tx({ type: 'EXPENSE', category: 'Ăn uống', amount: 1_000_000, date: '2026-11-04' }),
      ],
    });

    expect(picture.income).toBe(9_700_000 + 957_250);
    expect(picture.expense).toBe(1_000_000);
    expect(picture.commission).toBe(957_250);
    expect(picture.matched).toBe(3_342_750);
    expect(picture.surplus).toBe(picture.income - picture.expense);
  });

  it('keeps an unpaid chi hộ out of personal spending', () => {
    const picture = buildSalaryPicture({
      transactions: [
        tx({ type: 'INCOME', category: 'Lương', amount: 100 }),
        tx({ type: 'EXPENSE', category: 'Chi hộ', amount: 40 }),
      ],
    });
    expect(picture.income).toBe(100);
    expect(picture.expense).toBe(0);
    expect(picture.unreimbursed).toBe(40);
  });

  it('treats a personal emergency-fund expense as a loan, and chi hộ from that fund as chi hộ', () => {
    const picture = buildSalaryPicture({
      goals,
      transactions: [
        tx({ type: 'EXPENSE', category: 'Hóa đơn', amount: 1_200_000, goalId: 'emergency', goalDelta: -1_200_000 }),
        tx({ type: 'EXPENSE', category: 'Chi hộ', amount: 500_000, goalId: 'emergency', goalDelta: -500_000 }),
        tx({ type: 'EXPENSE', category: 'Ăn uống', amount: 300_000, goalId: 'save', goalDelta: -300_000 }),
      ],
    });
    expect(picture.expense).toBe(300_000);
    expect(picture.fundBorrow).toBe(1_200_000);
    expect(picture.helpedFromFund).toBe(500_000);
    expect(picture.fundBorrowByGoal).toEqual({ emergency: 1_200_000 });
  });

  it('reduces the surplus by a confirmed fund repayment without treating it as spending', () => {
    const picture = buildSalaryPicture({
      repaid: 1_200_000,
      transactions: [
        tx({ type: 'INCOME', category: 'Lương', amount: 9_700_000 }),
        tx({ type: 'EXPENSE', category: 'Ăn uống', amount: 1_000_000 }),
      ],
    });
    expect(picture.expense).toBe(1_000_000);
    expect(picture.surplus).toBe(9_700_000 - 1_000_000 - 1_200_000);
  });

  it('offers only the part of last month that has not been repaid', () => {
    const offers = unpaidFundOffers({
      year: 2026,
      month: 10,
      goals,
      transactions: [
        tx({ type: 'EXPENSE', category: 'Hóa đơn', amount: 2_000_000, goalId: 'emergency', goalDelta: -2_000_000, date: '2026-11-02' }),
      ],
      repayments: [
        { goalId: 'emergency', kind: 'borrow', debtYear: 2026, debtMonth: 10, amount: 500_000 },
      ],
    });
    expect(offers).toEqual([{ goalId: 'emergency', amount: 1_500_000 }]);
  });

  it('writes the glance lines', () => {
    const lines = salaryPictureLines({
      matched: 100,
      commission: 20,
      unreimbursed: 0,
      fundBorrow: 50,
      outstandingBorrow: 80,
      repaid: 0,
    });
    expect(lines[0]).toMatch(/Chi hộ/);
    expect(lines[1]).toMatch(/Hoa hồng/);
    expect(lines[2]).toMatch(/Mượn quỹ/);
    expect(lines[3]).toMatch(/Còn nợ quỹ/);
  });
});
