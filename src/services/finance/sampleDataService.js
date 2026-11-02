import { doc, getDocs, setDoc, writeBatch, increment } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import {
  buildSampleGenerationPlan,
  getClearSampleScanCollectionIds,
  isSampleEntity,
  aggregateClearSampleImpacts,
  SAMPLE_DELETE_CHUNK_SIZE,
} from '../../logic/sampleData.js';

export async function generateSampleDataInFirestore({
  getCollectionRef,
  getDocRef,
  wallets,
  createdAt = new Date().toISOString(),
  random = Math.random,
}) {
  const plan = buildSampleGenerationPlan({ wallets, createdAt, random });
  const batch = writeBatch(db);

  plan.writes.forEach(({ collectionId, payload }) => {
    batch.set(doc(getCollectionRef(collectionId)), payload);
  });

  const wbUpdates = {};
  Object.entries(plan.walletBalanceIncrements).forEach(([w, val]) => {
    if (val !== 0) {
      wbUpdates[w] = increment(val);
    }
  });
  if (Object.keys(wbUpdates).length > 0) {
    batch.set(getDocRef('settings', 'general'), { walletBalances: wbUpdates }, { merge: true });
  }

  await batch.commit();
  return {
    transactionCount: plan.writes.length,
    sampleYear: plan.sampleYear,
  };
}

export async function clearSampleDataFromFirestore({
  getCollectionRef,
  getDocRef,
  currentYear = new Date().getFullYear(),
}) {
  const collectionIds = getClearSampleScanCollectionIds(currentYear);
  const allSnaps = await Promise.all(
    collectionIds.map((id) => getDocs(getCollectionRef(id))),
  );

  const refsToDelete = [];
  const sampleDocuments = [];

  allSnaps.forEach((snap) => {
    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (isSampleEntity(data)) {
        refsToDelete.push(docSnap.ref);
        sampleDocuments.push(data);
      }
    });
  });

  if (refsToDelete.length === 0) {
    return { deletedCount: 0, hadSamples: false };
  }

  for (let i = 0; i < refsToDelete.length; i += SAMPLE_DELETE_CHUNK_SIZE) {
    const chunk = refsToDelete.slice(i, i + SAMPLE_DELETE_CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  const impactToReverse = aggregateClearSampleImpacts(sampleDocuments);
  const wbUpdates = {};
  Object.keys(impactToReverse).forEach((w) => {
    if (impactToReverse[w] !== 0) {
      wbUpdates[w] = increment(impactToReverse[w]);
    }
  });

  if (Object.keys(wbUpdates).length > 0) {
    await setDoc(
      getDocRef('settings', 'general'),
      { walletBalances: wbUpdates },
      { merge: true },
    );
  }

  return { deletedCount: refsToDelete.length, hadSamples: true };
}
