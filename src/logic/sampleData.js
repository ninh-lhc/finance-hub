/**
 * Pure sample-data fixtures and balance helpers (no Firestore/React).
 */

export const SAMPLE_DATA_YEAR = 2025;

export const SAMPLE_EXPENSE_CATEGORIES = ['Ăn uống', 'Di chuyển', 'Mua sắm', 'Hóa đơn'];

export const SAMPLE_DELETE_CHUNK_SIZE = 450;

export function isSampleEntity(data) {
  return data?.isSample === true;
}

export function applySampleTransactionToBalanceImpact(impact, transaction) {
  const next = { ...impact };
  if (transaction.type === 'INCOME' && transaction.wallet) {
    next[transaction.wallet] =
      (next[transaction.wallet] || 0) + Number(transaction.amount || 0);
  } else if (transaction.type === 'EXPENSE') {
    const w = transaction.linkedWallet || transaction.wallet;
    if (w) {
      next[w] = (next[w] || 0) - Number(transaction.amount || 0);
    }
  }
  return next;
}

export function mergeWalletBalanceImpactMaps(base, partial) {
  const next = { ...base };
  Object.entries(partial).forEach(([wallet, delta]) => {
    next[wallet] = (next[wallet] || 0) + delta;
  });
  return next;
}

export function computeReverseImpactForSampleDocument(data) {
  if (!isSampleEntity(data)) {
    return {};
  }
  const partial = {};
  if (data.type === 'INCOME' && data.wallet) {
    partial[data.wallet] = -Number(data.amount || 0);
  } else if (data.type === 'EXPENSE') {
    const w = data.linkedWallet || data.wallet;
    if (w) {
      partial[w] = Number(data.amount || 0);
    }
  }
  return partial;
}

export function buildSampleGenerationPlan({
  wallets,
  createdAt = new Date().toISOString(),
  random = Math.random,
}) {
  const writes = [];

  (wallets || []).forEach((w, i) => {
    const amt = 10000000 + i * 5000000;
    writes.push({
      collectionId: `transactions_${SAMPLE_DATA_YEAR}_01`,
      payload: {
        type: 'INCOME',
        category: 'Số dư đầu kỳ',
        amount: amt,
        wallet: w,
        date: `${SAMPLE_DATA_YEAR}-01-01`,
        note: `Khởi tạo số dư ví ${w}`,
        createdAt,
        isSample: true,
      },
    });
  });

  for (let m = 1; m <= 12; m += 1) {
    const mStr = String(m).padStart(2, '0');
    const collectionId = `transactions_${SAMPLE_DATA_YEAR}_${mStr}`;
    const incomeBank = wallets.length > 1 ? wallets[1] : wallets[0];
    const incomeCash = wallets[0];
    const salary = 15000000 + Math.floor(random() * 5000000);
    const extraInc = 2000000 + Math.floor(random() * 3000000);

    writes.push({
      collectionId,
      payload: {
        type: 'INCOME',
        category: 'Lương',
        amount: salary,
        wallet: incomeBank,
        date: `${SAMPLE_DATA_YEAR}-${mStr}-05`,
        note: `Lương tháng ${m}`,
        createdAt,
        isSample: true,
      },
    });

    writes.push({
      collectionId,
      payload: {
        type: 'INCOME',
        category: 'Thưởng',
        amount: extraInc,
        wallet: incomeCash,
        date: `${SAMPLE_DATA_YEAR}-${mStr}-12`,
        note: `Thu nhập phụ tháng ${m}`,
        createdAt,
        isSample: true,
      },
    });

    for (let i = 0; i < 6; i += 1) {
      const amt = 50000 + Math.floor(random() * 1000000);
      const targetW = wallets[Math.floor(random() * wallets.length)];
      const cat =
        SAMPLE_EXPENSE_CATEGORIES[
          Math.floor(random() * SAMPLE_EXPENSE_CATEGORIES.length)
        ];
      const day = String(Math.floor(Math.random() * 25) + 1).padStart(2, '0');
      writes.push({
        collectionId,
        payload: {
          type: 'EXPENSE',
          category: cat,
          amount: amt,
          wallet: targetW,
          date: `${SAMPLE_DATA_YEAR}-${mStr}-${day}`,
          note: `Chi tiêu mẫu ${i + 1}`,
          createdAt,
          isSample: true,
        },
      });
    }
  }

  let walletBalanceIncrements = {};
  (wallets || []).forEach((w) => {
    walletBalanceIncrements[w] = 0;
  });
  writes.forEach(({ payload }) => {
    walletBalanceIncrements = applySampleTransactionToBalanceImpact(
      walletBalanceIncrements,
      payload,
    );
  });

  return {
    writes,
    walletBalanceIncrements,
    sampleYear: SAMPLE_DATA_YEAR,
  };
}

export function getClearSampleScanCollectionIds(currentYear) {
  const ids = [];
  for (let y = currentYear - 5; y <= currentYear + 1; y += 1) {
    for (let m = 1; m <= 12; m += 1) {
      ids.push(`transactions_${y}_${String(m).padStart(2, '0')}`);
    }
  }
  ids.push('goals', 'budgets');
  return ids;
}

export function aggregateClearSampleImpacts(sampleDocuments) {
  let impactToReverse = {};
  sampleDocuments.forEach((data) => {
    impactToReverse = mergeWalletBalanceImpactMaps(
      impactToReverse,
      computeReverseImpactForSampleDocument(data),
    );
  });
  return impactToReverse;
}
