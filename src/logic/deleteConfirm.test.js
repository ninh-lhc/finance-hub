import { describe, expect, it } from 'vitest';
import utils from '../utils/format.js';
import { deleteConfirmMessage } from './deleteConfirm.js';

describe('deleteConfirmMessage', () => {
  it('names the transaction and its amount', () => {
    const message = deleteConfirmMessage({
      collection: 'transactions',
      transaction: { note: 'Cà phê', category: 'Ăn uống', amount: 45000, type: 'EXPENSE' },
    });
    expect(message).toBe(`Xóa giao dịch "Cà phê" ${utils.formatVND(45000)}?`);
  });

  it('warns that a transfer removes both sides', () => {
    const message = deleteConfirmMessage({
      collection: 'transactions',
      transaction: { category: 'Chuyển khoản đi', amount: 100000, type: 'EXPENSE' },
    });
    expect(message).toBe('Xóa phiếu luân chuyển "Chuyển khoản đi"? Cả hai vế sẽ bị xóa.');
  });

  it('names the budget and the goal', () => {
    expect(deleteConfirmMessage({
      collection: 'budgets',
      item: { category: 'Ăn uống' },
    })).toBe('Xóa hạn mức "Ăn uống"?');
    expect(deleteConfirmMessage({
      collection: 'goals',
      item: { name: 'Quỹ dự phòng' },
    })).toBe('Xóa mục tiêu "Quỹ dự phòng"?');
  });

  it('leaves other collections alone', () => {
    expect(deleteConfirmMessage({ collection: 'wallets' })).toBeNull();
  });
});
