import utils from '../utils/format.js';

function isTransfer(transaction) {
  const category = String(transaction?.category || '');
  return transaction?.type === 'TRANSFER' || category.includes('Chuyển khoản');
}

export function deleteConfirmMessage({ collection, transaction, item }) {
  if (collection === 'transactions') {
    const label = transaction?.note || transaction?.category || 'này';
    if (isTransfer(transaction)) {
      return `Xóa phiếu luân chuyển "${label}"? Cả hai vế sẽ bị xóa.`;
    }
    return `Xóa giao dịch "${label}" ${utils.formatVND(transaction?.amount || 0)}?`;
  }
  if (collection === 'budgets') {
    return `Xóa hạn mức "${item?.category || 'này'}"?`;
  }
  if (collection === 'goals') {
    return `Xóa mục tiêu "${item?.name || 'này'}"?`;
  }
  return null;
}
