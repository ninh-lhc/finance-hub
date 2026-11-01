import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';

export default function useFinanceSettings({ user, getDocRef, syncCode }) {
  const [categories, setCategories] = useState({
    INCOME: ['Lương', 'Thưởng', 'Đầu tư', 'Số dư đầu kỳ', 'Thu nợ/Hoàn ứng'],
    EXPENSE: ['Ăn uống', 'Di chuyển', 'Mua sắm', 'Giải trí', 'Hóa đơn', 'Chi hộ']
  });
  const [wallets, setWallets] = useState(['Tiền mặt', 'Ví ngân hàng', 'Thẻ tín dụng']);
  const [walletBalances, setWalletBalances] = useState({});

  useEffect(() => {
    if (!user) return;
    const unsubSettings = onSnapshot(
      getDocRef('settings', 'general'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.categories) setCategories(data.categories);
          if (data.wallets) setWallets(data.wallets);
          if (data.walletBalances) setWalletBalances(data.walletBalances);
        }
      },
      (err) => console.error("Lỗi tải cấu hình:", err)
    );
    return () => unsubSettings();
  }, [user, syncCode, getDocRef]);

  return { categories, wallets, walletBalances };
}
