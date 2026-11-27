import utils from '../utils/format.js';
import { isCountedExpense, isCountedIncome } from './monthComparison.js';

export const PASS_THROUGH_EXPENSE = 'Chi hộ';
export const PASS_THROUGH_INCOME = 'Thu nợ/Hoàn ứng';

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function isEmergencyGoal(goal) {
  return fold(goal?.name).includes('khan cap');
}

function emergencyIds(goals) {
  return new Set((goals || []).filter(isEmergencyGoal).map((goal) => goal.id).filter(Boolean));
}

export function isFundBorrow(transaction, goals) {
  if (!isCountedExpense(transaction) || transaction.category === PASS_THROUGH_EXPENSE) return false;
  return emergencyIds(goals).has(transaction?.goalId) && Number(transaction?.goalDelta || 0) < 0;
}

export function isFundTransferOut(transaction, goals) {
  return transaction?.category === 'Chuyển khoản đi'
    && emergencyIds(goals).has(transaction?.goalId)
    && Number(transaction?.goalDelta || 0) < 0;
}

export function isFundTransferIn(transaction, goals) {
  return transaction?.category === 'Chuyển khoản đến'
    && emergencyIds(goals).has(transaction?.goalId)
    && Number(transaction?.goalDelta || 0) > 0;
}

function coverFundTransfers(transactions, goals) {
  const incomingByTransfer = new Map();
  const outs = [];
  let transferRepaid = 0;
  (transactions || []).forEach((transaction) => {
    if (transaction?.category === 'Chuyển khoản đến' && transaction.transferId) {
      incomingByTransfer.set(transaction.transferId, transaction);
    }
    if (isFundTransferOut(transaction, goals)) outs.push(transaction);
    if (isFundTransferIn(transaction, goals)) transferRepaid += Number(transaction.amount || 0);
  });

  const transfers = outs.map((out) => {
    const incoming = incomingByTransfer.get(out.transferId);
    return {
      transaction: out,
      amount: Number(out.amount || 0),
      toWallet: incoming?.wallet || '',
      date: String(out.date || ''),
    };
  });
  const repayments = (transactions || []).filter((transaction) => isFundTransferIn(transaction, goals));
  const buckets = transfers.map((item) => ({
    wallet: item.toWallet,
    date: item.date,
    remaining: item.amount,
  })).filter((bucket) => bucket.wallet && bucket.remaining > 0)
    .sort((left, right) => left.date.localeCompare(right.date) || left.wallet.localeCompare(right.wallet, 'vi'));

  const byCategory = {};
  const byWallet = {};
  const spends = [];
  let excluded = 0;
  (transactions || [])
    .map((transaction, index) => ({ transaction, index }))
    .filter(({ transaction }) => isSalaryExpense(transaction, goals))
    .sort((left, right) => String(left.transaction.date || '').localeCompare(String(right.transaction.date || '')) || left.index - right.index)
    .forEach(({ transaction }) => {
      let left = Number(transaction.amount || 0);
      const wallet = transaction.linkedWallet || transaction.wallet;
      buckets.forEach((bucket) => {
        if (left <= 0 || bucket.remaining <= 0) return;
        if (bucket.wallet !== wallet) return;
        if (String(transaction.date || '') < bucket.date) return;
        const take = Math.min(left, bucket.remaining);
        bucket.remaining -= take;
        left -= take;
        excluded += take;
        spends.push({ transaction, amount: take });
        const category = transaction.category || 'Khác';
        byCategory[category] = (byCategory[category] || 0) + take;
        byWallet[wallet] = (byWallet[wallet] || 0) + take;
      });
    });

  const borrowedByGoal = {};
  outs.forEach((out) => {
    borrowedByGoal[out.goalId] = (borrowedByGoal[out.goalId] || 0) + Number(out.amount || 0);
  });
  const borrowed = Object.values(borrowedByGoal).reduce((sum, amount) => sum + amount, 0);
  return { excluded, byCategory, byWallet, borrowedByGoal, borrowed, transferRepaid, transfers, spends, repayments };
}

export function subtractFundedSpend(totals, funded) {
  const next = { ...(totals || {}) };
  Object.entries(funded || {}).forEach(([name, amount]) => {
    const left = (next[name] || 0) - Number(amount || 0);
    if (left > 0) next[name] = left;
    else delete next[name];
  });
  return next;
}

function transactionKey(transaction) {
  return transaction?.id || `${transaction?.date}|${transaction?.transferId || ''}|${transaction?.category}|${transaction?.wallet}|${transaction?.amount}|${transaction?.goalDelta || 0}`;
}

export function unpaidTransferDebt({ pastTransactions = [], laterTransactions = [], goals = [], year, month } = {}) {
  const limit = `${year}-${String(Number(month) + 1).padStart(2, '0')}`;
  const seen = new Set();
  let borrowed = 0;
  let repaid = 0;
  const read = (transaction, allowLaterRepay) => {
    const date = String(transaction?.date || '');
    const before = date.slice(0, 7) < limit;
    const borrow = before && isFundTransferOut(transaction, goals);
    const repay = (before || allowLaterRepay) && isFundTransferIn(transaction, goals);
    if (!borrow && !repay) return;
    const key = `${borrow ? 'out' : 'in'}|${transactionKey(transaction)}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (borrow) borrowed += Number(transaction.amount || 0);
    if (repay) repaid += Number(transaction.amount || 0);
  };
  (pastTransactions || []).forEach((transaction) => read(transaction, false));
  (laterTransactions || []).forEach((transaction) => read(transaction, true));
  return Math.max(0, borrowed - repaid);
}

export function isSalaryExpense(transaction, goals) {
  return isCountedExpense(transaction)
    && transaction.category !== PASS_THROUGH_EXPENSE
    && !isFundBorrow(transaction, goals);
}

export function repaymentTotal(repayments, { year, month, from, to } = {}) {
  return (repayments || []).reduce((sum, item) => {
    if (item?.kind === 'helped') return sum;
    const date = String(item?.payDate || '');
    if (!date) return sum;
    if (from && to && (date < from || date > to)) return sum;
    if (year != null && Number(date.slice(0, 4)) !== Number(year)) return sum;
    if (month != null && Number(date.slice(5, 7)) - 1 !== Number(month)) return sum;
    return sum + Number(item.amount || 0);
  }, 0);
}

export function buildSalaryPicture({ transactions = [], goals = [], repaid = 0 } = {}) {
  const funds = emergencyIds(goals);
  let otherIncome = 0;
  let reimbursement = 0;
  let helped = 0;
  let helpedFromFund = 0;
  let personalExpense = 0;
  let fundBorrow = 0;
  const fundBorrowByGoal = {};
  const helpedFromFundByGoal = {};

  (transactions || []).forEach((transaction) => {
    const amount = Number(transaction?.amount || 0);
    if (!amount) return;
    if (isCountedIncome(transaction)) {
      if (transaction.category === PASS_THROUGH_INCOME) reimbursement += amount;
      else otherIncome += amount;
      return;
    }
    if (!isCountedExpense(transaction)) return;
    const fromFund = funds.has(transaction.goalId) && Number(transaction.goalDelta || 0) < 0;
    if (transaction.category === PASS_THROUGH_EXPENSE) {
      helped += amount;
      if (fromFund) {
        helpedFromFund += amount;
        helpedFromFundByGoal[transaction.goalId] = (helpedFromFundByGoal[transaction.goalId] || 0) + amount;
      }
      return;
    }
    if (fromFund) {
      fundBorrow += amount;
      fundBorrowByGoal[transaction.goalId] = (fundBorrowByGoal[transaction.goalId] || 0) + amount;
      return;
    }
    personalExpense += amount;
  });

  const coverage = coverFundTransfers(transactions, goals);
  personalExpense = Math.max(0, personalExpense - coverage.excluded);
  fundBorrow += coverage.borrowed;

  const matched = Math.min(helped, reimbursement);
  const commission = Math.max(0, reimbursement - helped);
  const unreimbursed = Math.max(0, helped - reimbursement);
  const income = otherIncome + commission;
  const expense = personalExpense;
  const repayment = Math.max(0, Number(repaid || 0) + coverage.transferRepaid);
  return {
    income,
    expense,
    surplus: income - expense - repayment,
    commission,
    unreimbursed,
    matched,
    helped,
    reimbursement,
    fundBorrow,
    helpedFromFund,
    fundBorrowByGoal,
    helpedFromFundByGoal,
    fundedSpendByCategory: coverage.byCategory,
    fundedSpendByWallet: coverage.byWallet,
    repaid: repayment,
  };
}

export function coveredAmount(repayments, { goalId, debtYear, debtMonth, kind }) {
  return (repayments || []).reduce((sum, item) => {
    if (item?.goalId !== goalId || item?.kind !== kind) return sum;
    if (Number(item.debtYear) !== Number(debtYear) || Number(item.debtMonth) !== Number(debtMonth)) return sum;
    return sum + Number(item.amount || 0);
  }, 0);
}

export function unpaidFundOffers({ transactions, goals, repayments, year, month }) {
  const picture = buildSalaryPicture({ transactions, goals });
  return Object.entries(picture.fundBorrowByGoal).map(([goalId, borrowed]) => {
    const covered = coveredAmount(repayments, { goalId, debtYear: year, debtMonth: month, kind: 'borrow' });
    return { goalId, amount: Math.max(0, borrowed - covered) };
  }).filter((item) => item.amount > 0);
}

export function monthlyFundRepaymentOffers({ history, goals, repayments, payDate }) {
  const payMonth = payDate.slice(0, 7);
  if (repayments.some((item) => item.kind === 'borrow' && item.payDate?.slice(0, 7) === payMonth)) {
    return [];
  }

  return [...history]
    .filter(({ period }) => period < payMonth)
    .sort((left, right) => left.period.localeCompare(right.period))
    .flatMap(({ period, transactions }) => {
      const [year, month] = period.split('-').map(Number);
      return unpaidFundOffers({ transactions, goals, repayments, year, month: month - 1 })
        .map((offer) => ({ ...offer, debtYear: year, debtMonth: month - 1 }));
    });
}

export function unpaidHelpedLocks({ transactions, goals, repayments }) {
  const picture = buildSalaryPicture({ transactions, goals });
  return Object.entries(picture.helpedFromFundByGoal).map(([goalId, helped]) => {
    const covered = (repayments || []).reduce((sum, item) => (
      item?.goalId === goalId && item?.kind === 'helped' ? sum + Number(item.amount || 0) : sum
    ), 0);
    return { goalId, amount: Math.max(0, helped - covered) };
  }).filter((item) => item.amount > 0);
}

function flowEntry(transaction, amount, extra = {}) {
  return {
    id: transaction?.id,
    date: transaction?.date || '',
    note: transaction?.note || '',
    category: transaction?.category || '',
    wallet: transaction?.linkedWallet || transaction?.wallet || '',
    amount: Number(amount || 0),
    transaction,
    ...extra,
  };
}

function byRecent(left, right) {
  return String(right.date || '').localeCompare(String(left.date || ''))
    || right.amount - left.amount;
}

export function listFlowItems(transactions = [], goals = []) {
  const helped = [];
  const reimbursements = [];
  const directSpends = [];
  const funds = emergencyIds(goals);
  (transactions || []).forEach((transaction) => {
    const amount = Number(transaction?.amount || 0);
    if (!amount) return;
    if (isCountedIncome(transaction) && transaction.category === PASS_THROUGH_INCOME) {
      reimbursements.push(flowEntry(transaction, amount));
    }
    if (isCountedExpense(transaction) && transaction.category === PASS_THROUGH_EXPENSE) {
      helped.push(flowEntry(transaction, amount, { fromFund: funds.has(transaction.goalId) && Number(transaction.goalDelta || 0) < 0 }));
    }
    if (isFundBorrow(transaction, goals)) directSpends.push(flowEntry(transaction, amount));
  });
  const coverage = coverFundTransfers(transactions, goals);
  const directTotal = directSpends.reduce((sum, item) => sum + item.amount, 0);
  return {
    helped: helped.sort(byRecent),
    reimbursements: reimbursements.sort(byRecent),
    transfers: coverage.transfers.map((item) => flowEntry(item.transaction, item.amount, { toWallet: item.toWallet })).sort(byRecent),
    spends: [...directSpends, ...coverage.spends.map((item) => flowEntry(item.transaction, item.amount))].sort(byRecent),
    repayments: coverage.repayments.map((transaction) => flowEntry(transaction, transaction.amount)).sort(byRecent),
    spent: directTotal + coverage.excluded,
    remainder: Math.max(0, coverage.borrowed - coverage.excluded),
  };
}

export function salaryPictureLines(picture) {
  if (!picture) return [];
  const lines = [];
  if (picture.matched > 0) {
    lines.push(`Chi hộ ${utils.formatVND(picture.matched)} đã thu lại`);
  }
  if (picture.commission > 0) lines.push(`Hoa hồng ${utils.formatVND(picture.commission)}`);
  if (picture.unreimbursed > 0) lines.push(`Chi hộ chưa nhận lại ${utils.formatVND(picture.unreimbursed)}`);
  if (picture.fundBorrow > 0) lines.push(`Mượn quỹ khẩn cấp ${utils.formatVND(picture.fundBorrow)} · trả từ lương tháng sau`);
  if (picture.outstandingBorrow > 0) lines.push(`Còn nợ quỹ khẩn cấp ${utils.formatVND(picture.outstandingBorrow)} · trả khi nhận lương`);
  if (picture.repaid > 0) lines.push(`Trả quỹ khẩn cấp ${utils.formatVND(picture.repaid)}`);
  return lines;
}
