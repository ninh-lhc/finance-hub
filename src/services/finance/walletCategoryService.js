import { getDocs, setDoc, writeBatch, increment, deleteField } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import {
  normalizeWalletName,
  normalizeCategoryName,
  getCategoryTypeFromForm,
  buildNextWalletsList,
  removeWalletAtIndex,
  getWalletNameAtIndex,
  shouldRenameWallet,
  getWalletBalanceTransferAmount,
  buildNextCategoryList,
  getCategoryNameAtIndex,
  shouldRenameCategory,
  buildCategoriesSettings,
  removeCategoryAtIndex,
  getTransactionMonthCollectionNames,
  buildWalletReferencePatch,
  buildCategoryReferencePatch,
} from '../../logic/walletCategoryEntities.js';

export async function saveWalletToFirestore({
  getCollectionRef,
  getDocRef,
  wallets,
  walletBalances,
  form,
  editingId,
  currentYear = new Date().getFullYear(),
}) {
  const cleanName = normalizeWalletName(form.walletName);
  const newWallets = buildNextWalletsList({ wallets, cleanName, editingId });

  if (editingId !== null) {
    const oldName = getWalletNameAtIndex({ wallets, editingId });
    if (shouldRenameWallet({ oldName, cleanName })) {
      const collectionNames = getTransactionMonthCollectionNames(currentYear);
      const results = await Promise.all(
        collectionNames.map((name) => getDocs(getCollectionRef(name))),
      );
      const batch = writeBatch(db);
      const transferredBal = getWalletBalanceTransferAmount({
        walletBalances,
        oldName,
      });

      batch.set(
        getDocRef('settings', 'general'),
        {
          wallets: newWallets,
          walletBalances: {
            [oldName]: increment(-transferredBal),
            [cleanName]: increment(transferredBal),
          },
        },
        { merge: true },
      );

      results.forEach((snap) => {
        snap.docs.forEach((docSnap) => {
          const patch = buildWalletReferencePatch({
            transaction: docSnap.data(),
            previousWalletName: oldName,
            nextWalletName: cleanName,
          });
          if (patch) {
            batch.update(docSnap.ref, patch);
          }
        });
      });

      await batch.commit();
      return { outcome: 'renamed' };
    }
  }

  await setDoc(
    getDocRef('settings', 'general'),
    { wallets: newWallets },
    { merge: true },
  );
  return { outcome: 'saved' };
}

export async function deleteWalletFromFirestore({
  getDocRef,
  wallets,
  index,
  walletName,
}) {
  const nextWallets = removeWalletAtIndex({ wallets, index });
  await setDoc(
    getDocRef('settings', 'general'),
    {
      wallets: nextWallets,
      walletBalances: { [walletName]: deleteField() },
    },
    { merge: true },
  );
}

export async function saveCategoryToFirestore({
  getCollectionRef,
  getDocRef,
  categories,
  form,
  editingId,
  currentYear = new Date().getFullYear(),
}) {
  const cleanName = normalizeCategoryName(form.categoryName);
  const categoryType = getCategoryTypeFromForm(form);
  const newCatsList = buildNextCategoryList({
    categories,
    categoryType,
    cleanName,
    editingId,
  });

  if (editingId !== null) {
    const oldName = getCategoryNameAtIndex({
      categories,
      categoryType,
      editingId,
    });
    if (shouldRenameCategory({ oldName, cleanName })) {
      const collectionNames = getTransactionMonthCollectionNames(currentYear);
      const results = await Promise.all(
        collectionNames.map((name) => getDocs(getCollectionRef(name))),
      );
      const batch = writeBatch(db);
      results.forEach((snap) => {
        snap.docs.forEach((docSnap) => {
          const patch = buildCategoryReferencePatch({
            transaction: docSnap.data(),
            previousCategoryName: oldName,
            nextCategoryName: cleanName,
            categoryType,
          });
          if (patch) {
            batch.update(docSnap.ref, patch);
          }
        });
      });
      const newCategories = buildCategoriesSettings({
        categories,
        categoryType,
        newCatsList,
      });
      batch.set(
        getDocRef('settings', 'general'),
        { categories: newCategories },
        { merge: true },
      );
      await batch.commit();
      return { outcome: 'renamed' };
    }
  }

  const newCategories = buildCategoriesSettings({
    categories,
    categoryType,
    newCatsList,
  });
  await setDoc(
    getDocRef('settings', 'general'),
    { categories: newCategories },
    { merge: true },
  );
  return { outcome: 'saved' };
}

export async function deleteCategoryFromFirestore({
  getDocRef,
  categories,
  categoryType,
  index,
}) {
  const newCatsList = removeCategoryAtIndex({ categories, categoryType, index });
  const newCategories = buildCategoriesSettings({
    categories,
    categoryType,
    newCatsList,
  });
  await setDoc(
    getDocRef('settings', 'general'),
    { categories: newCategories },
    { merge: true },
  );
}
