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

  const matched = Math.min(helped, reimbursement);
  const commission = Math.max(0, reimbursement - helped);
  const unreimbursed = Math.max(0, helped - reimbursement);
  const income = otherIncome + commission;
  const expense = personalExpense;
  const repayment = Math.max(0, Number(repaid || 0));
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

export function unpaidHelpedLocks({ transactions, goals, repayments }) {
  const picture = buildSalaryPicture({ transactions, goals });
  return Object.entries(picture.helpedFromFundByGoal).map(([goalId, helped]) => {
    const covered = (repayments || []).reduce((sum, item) => (
      item?.goalId === goalId && item?.kind === 'helped' ? sum + Number(item.amount || 0) : sum
    ), 0);
    return { goalId, amount: Math.max(0, helped - covered) };
  }).filter((item) => item.amount > 0);
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
