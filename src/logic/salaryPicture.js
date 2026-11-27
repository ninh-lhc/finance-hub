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
  return goal?.isEmergencyFund === true || fold(goal?.name).includes('khan cap');
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
    if (isFundTransferIn(transaction, goals) && !transaction.fundRepaymentId) transferRepaid += Number(transaction.amount || 0);
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
    createdAt: item.transaction.createdAt,
    goalId: item.transaction.goalId,
    remaining: item.amount,
  })).filter((bucket) => bucket.wallet && bucket.remaining > 0)
    .sort((left, right) => left.date.localeCompare(right.date) || left.wallet.localeCompare(right.wallet, 'vi'));

  const byCategory = {};
  const byWallet = {};
  const spends = [];
  let excluded = 0;
  (transactions || [])
    .flatMap((transaction) => {
      const incoming = transaction.category === 'Chuyển khoản đi' && transaction.transferId
        ? incomingByTransfer.get(transaction.transferId)
        : null;
      const returnGoal = isFundTransferIn(incoming, goals) ? incoming.goalId : '';
      return returnGoal || isSalaryExpense(transaction, goals) ? [{ transaction, returnGoal }] : [];
    })
    .sort((left, right) => String(left.transaction.date || '').localeCompare(String(right.transaction.date || ''))
      || (left.transaction.createdAt || (left.returnGoal ? '' : '~'))
        .localeCompare(right.transaction.createdAt || (right.returnGoal ? '' : '~'))
      || Number(Boolean(right.returnGoal)) - Number(Boolean(left.returnGoal)))
    .forEach(({ transaction, returnGoal }) => {
      let left = Number(transaction.amount || 0);
      const wallet = transaction.linkedWallet || transaction.wallet;
      buckets.forEach((bucket) => {
        if (left <= 0 || bucket.remaining <= 0) return;
        if (bucket.wallet !== wallet) return;
        if (String(transaction.date || '') < bucket.date) return;
        if (transaction.date === bucket.date && transaction.createdAt && bucket.createdAt
          && transaction.createdAt < bucket.createdAt) return;
        if (returnGoal && returnGoal !== bucket.goalId) return;
        const take = Math.min(left, bucket.remaining);
        bucket.remaining -= take;
        left -= take;
        if (returnGoal) return;
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
  const remaining = buckets.reduce((sum, bucket) => sum + bucket.remaining, 0);
  return { excluded, byCategory, byWallet, borrowedByGoal, borrowed, transferRepaid, transfers, spends, repayments, remaining };
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

export function transactionKey(transaction) {
  return transaction?.id ? transaction.id
    : `${transaction?.date}|${transaction?.transferId || ''}|${transaction?.category}|${transaction?.wallet}|${transaction?.amount}|${transaction?.goalDelta || 0}`;
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

export function buildSalaryPicture({ transactions = [], goals = [], repaid = 0, context, through } = {}) {
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
  if (context) {
    coverage.excluded = 0;
    coverage.byCategory = {};
    coverage.byWallet = {};
    for (const transaction of transactions) {
      const funded = context.funded(transaction);
      if (!funded) continue;
      const category = transaction.category || 'Khác';
      const wallet = transaction.linkedWallet || transaction.wallet;
      coverage.excluded += funded;
      coverage.byCategory[category] = (coverage.byCategory[category] || 0) + funded;
      coverage.byWallet[wallet] = (coverage.byWallet[wallet] || 0) + funded;
    }
  }
  personalExpense = Math.max(0, personalExpense - coverage.excluded);
  fundBorrow += coverage.borrowed;

  let matched = Math.min(helped, reimbursement);
  let commission = Math.max(0, reimbursement - helped);
  let unreimbursed = Math.max(0, helped - reimbursement);
  let unmatchedReimbursement = 0;
  if (context) {
    ({ matched, commission, unreimbursed, unmatchedReimbursement } = context.reconcile(transactions, through));
  }
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
    unmatchedReimbursement,
    fundBorrow,
    helpedFromFund,
    fundBorrowByGoal,
    helpedFromFundByGoal,
    fundedSpendByCategory: coverage.byCategory,
    fundedSpendByWallet: coverage.byWallet,
    repaid: repayment,
  };
}

export function buildFinanceContext(transactions, goals, reimbursementLinks = []) {
  const funded = new Map();
  for (const item of coverFundTransfers(transactions, goals).spends) {
    const key = transactionKey(item.transaction);
    funded.set(key, (funded.get(key) || 0) + item.amount);
  }
  const open = [];
  const receipts = new Map();
  const links = new Map(reimbursementLinks.map(({ receiptKey, expenseKey }) => [receiptKey, expenseKey]));
  const ordered = [...transactions].sort((left, right) => String(left.date).localeCompare(String(right.date))
    || Number(left.type === 'INCOME') - Number(right.type === 'INCOME'));
  for (const transaction of ordered) {
    const amount = Number(transaction.amount || 0);
    if (amount <= 0) continue;
    if (transaction.type === 'EXPENSE' && transaction.category === PASS_THROUGH_EXPENSE) {
      open.push({ transaction, remaining: amount, payments: [] });
    }
    if (transaction.type !== 'INCOME' || transaction.category !== PASS_THROUGH_INCOME) continue;
    const note = fold(transaction.note).trim();
    const receiptKey = transactionKey(transaction);
    const linkedExpense = links.get(receiptKey);
    const candidates = open.filter((item) => item.remaining > 0);
    const byNote = note ? candidates.filter((item) => fold(item.transaction.note).trim() === note) : [];
    const matches = linkedExpense
      ? open.filter((item) => item.remaining > 0 && transactionKey(item.transaction) === linkedExpense)
      : byNote.length ? byNote : candidates.filter((item) => item.remaining === amount);
    if (matches.length !== 1) continue;
    const [match] = matches;
    const matched = Math.min(amount, match.remaining);
    match.remaining -= matched;
    match.payments.push({ date: transaction.date, amount: matched });
    receipts.set(receiptKey, { matched, commission: amount - matched, expense: match.transaction });
  }
  const expenses = new Map(open.map((item) => [transactionKey(item.transaction), item]));

  return {
    funded: (transaction) => funded.get(transactionKey(transaction)) || 0,
    receipt: (transaction) => receipts.get(transactionKey(transaction)),
    candidates: (receipt) => open.filter(({ transaction, payments }) => transaction.date <= receipt.date
      && Number(transaction.amount) > payments.filter((payment) => payment.date <= receipt.date)
        .reduce((sum, payment) => sum + payment.amount, 0))
      .map(({ transaction }) => transaction),
    reconcile(scope, through = scope.reduce((latest, transaction) => transaction.date > latest ? transaction.date : latest, '')) {
      let matched = 0;
      let commission = 0;
      let unreimbursed = 0;
      let unmatchedReimbursement = 0;
      for (const transaction of scope) {
        const key = transactionKey(transaction);
        const expense = expenses.get(key);
        if (expense) {
          const paid = expense.payments.filter((payment) => payment.date <= through)
            .reduce((sum, payment) => sum + payment.amount, 0);
          unreimbursed += Number(transaction.amount || 0) - paid;
        }
        if (transaction.type !== 'INCOME' || transaction.category !== PASS_THROUGH_INCOME) continue;
        const receipt = receipts.get(key);
        if (receipt) {
          matched += receipt.matched;
          commission += receipt.commission;
        } else {
          unmatchedReimbursement += Number(transaction.amount || 0);
        }
      }
      return { matched, commission, unreimbursed, unmatchedReimbursement };
    },
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

  const inputs = { history, goals, repayments, beforeMonth: payMonth };
  const dueAtPayDate = outstandingFundLoans({ ...inputs, through: payDate });
  const remaining = outstandingFundLoans({ ...inputs, through: '9999-12-31' });
  return dueAtPayDate.flatMap((loan) => {
    const current = remaining.find((item) => (
      item.goalId === loan.goalId && item.debtYear === loan.debtYear && item.debtMonth === loan.debtMonth
    ));
    return current ? [{ ...loan, amount: Math.min(loan.amount, current.amount) }] : [];
  });
}

export function outstandingFundLoans({ history, goals, repayments, through, beforeMonth = '' }) {
  const events = [];
  const funds = emergencyIds(goals);
  for (const { period, transactions } of history) {
    for (const transaction of transactions) {
      const date = transaction.date || `${period}-01`;
      if (date > through || !funds.has(transaction.goalId)) continue;
      if ((isFundBorrow(transaction, goals) || isFundTransferOut(transaction, goals))
        && (!beforeMonth || period < beforeMonth)) {
        events.push({ date, period, goalId: transaction.goalId, amount: Number(transaction.amount), order: 0 });
      } else if (isFundTransferIn(transaction, goals) && !transaction.fundRepaymentId) {
        events.push({ date, goalId: transaction.goalId, amount: Number(transaction.amount), order: 1 });
      }
    }
  }
  for (const item of repayments) {
    if (item.kind !== 'borrow' || !item.payDate || item.payDate > through) continue;
    const period = `${item.debtYear}-${String(Number(item.debtMonth) + 1).padStart(2, '0')}`;
    events.push({ date: item.payDate, period, goalId: item.goalId, amount: Number(item.amount), order: 2 });
  }

  const balances = new Map();
  for (const event of events.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)) {
    const key = `${event.period}|${event.goalId}`;
    if (event.order === 0) {
      const [year, month] = event.period.split('-').map(Number);
      const loan = balances.get(key) || { goalId: event.goalId, amount: 0, debtYear: year, debtMonth: month - 1 };
      loan.amount += event.amount;
      balances.set(key, loan);
    } else if (event.order === 2) {
      const loan = balances.get(key);
      if (loan) loan.amount = Math.max(0, loan.amount - event.amount);
    } else {
      let remaining = event.amount;
      for (const loan of balances.values()) {
        if (loan.goalId !== event.goalId || remaining <= 0) continue;
        const applied = Math.min(loan.amount, remaining);
        loan.amount -= applied;
        remaining -= applied;
      }
    }
  }
  return [...balances.values()].filter((loan) => loan.amount > 0);
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

export function listFlowItems(transactions = [], goals = [], context) {
  const helped = [];
  const reimbursements = [];
  const directSpends = [];
  const funds = emergencyIds(goals);
  (transactions || []).forEach((transaction) => {
    const amount = Number(transaction?.amount || 0);
    if (!amount) return;
    if (isCountedIncome(transaction) && transaction.category === PASS_THROUGH_INCOME) {
      const unmatched = Boolean(context && !context.receipt(transaction));
      reimbursements.push(flowEntry(transaction, amount, {
        unmatched,
        candidates: unmatched ? context.candidates(transaction) : [],
      }));
    }
    if (isCountedExpense(transaction) && transaction.category === PASS_THROUGH_EXPENSE) {
      helped.push(flowEntry(transaction, amount, { fromFund: funds.has(transaction.goalId) && Number(transaction.goalDelta || 0) < 0 }));
    }
    if (isFundBorrow(transaction, goals)) directSpends.push(flowEntry(transaction, amount));
  });
  const coverage = coverFundTransfers(transactions, goals);
  const fundedSpends = context ? transactions.flatMap((transaction) => {
    const amount = context.funded(transaction);
    return amount > 0 ? [{ transaction, amount }] : [];
  }) : coverage.spends;
  const fundedTotal = fundedSpends.reduce((sum, item) => sum + item.amount, 0);
  const directTotal = directSpends.reduce((sum, item) => sum + item.amount, 0);
  return {
    helped: helped.sort(byRecent),
    reimbursements: reimbursements.sort(byRecent),
    transfers: coverage.transfers.map((item) => flowEntry(item.transaction, item.amount, { toWallet: item.toWallet })).sort(byRecent),
    spends: [...directSpends, ...fundedSpends.map((item) => flowEntry(item.transaction, item.amount))].sort(byRecent),
    repayments: coverage.repayments.map((transaction) => flowEntry(transaction, transaction.amount)).sort(byRecent),
    spent: directTotal + fundedTotal,
    remainder: coverage.remaining,
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
