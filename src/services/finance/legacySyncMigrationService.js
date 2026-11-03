import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db, baseAppId } from '../firebase/config.js';
import {
  getLegacyMigrationReadiness,
  getMigrationCollectionNames,
  buildSettingsInventorySlice,
  buildTransactionsInventorySlice,
  buildEntityListInventorySlice,
  buildLegacyMigrationInventory,
  buildLegacyMigrationDryRunSummary,
  maskSyncCode,
  maskUid,
} from '../../logic/legacySyncMigration.js';

export class LegacyMigrationNotReadyError extends Error {
  constructor(blockers) {
    super('Legacy migration inspection is not ready.');
    this.name = 'LegacyMigrationNotReadyError';
    this.code = 'legacy-migration/not-ready';
    this.blockers = blockers;
  }
}

function publicDataCollectionRef(syncCode, collectionName) {
  return collection(
    db,
    'artifacts',
    baseAppId,
    'public',
    'data',
    `sync_${syncCode}_${collectionName}`,
  );
}

function uidCollectionRef(uid, collectionName) {
  return collection(db, 'artifacts', baseAppId, 'users', uid, collectionName);
}

function publicSettingsDocRef(syncCode) {
  return doc(
    db,
    'artifacts',
    baseAppId,
    'public',
    'data',
    `sync_${syncCode}_settings`,
    'general',
  );
}

function uidSettingsDocRef(uid) {
  return doc(db, 'artifacts', baseAppId, 'users', uid, 'settings', 'general');
}

function extractTransactionDatesFromDocs(docs) {
  return docs
    .map((docSnap) => docSnap.data()?.date)
    .filter((d) => typeof d === 'string' && d.length > 0);
}

async function readSettingsSlice(readDocRef) {
  const snap = await getDoc(readDocRef);
  return buildSettingsInventorySlice({
    exists: snap.exists(),
    data: snap.exists() ? snap.data() : null,
  });
}

async function readTransactionCollections(collectionRefFactory, collectionNames) {
  const snaps = await Promise.all(
    collectionNames.map((collectionId) => getDocs(collectionRefFactory(collectionId))),
  );

  return collectionNames.map((collectionId, index) => {
    const snap = snaps[index];
    const docIds = snap.docs.map((d) => d.id);
    const dates = extractTransactionDatesFromDocs(snap.docs);
    return { collectionId, docIds, dates };
  });
}

async function readEntityCollection(collectionRef) {
  const snap = await getDocs(collectionRef);
  return buildEntityListInventorySlice({ docIds: snap.docs.map((d) => d.id) });
}

async function readSideInventory({ syncCode, uid, collectionNames, isSource }) {
  const txCollections = await readTransactionCollections(
    (name) =>
      isSource
        ? publicDataCollectionRef(syncCode, name)
        : uidCollectionRef(uid, name),
    collectionNames.transactionCollectionNames,
  );

  const settings = await readSettingsSlice(
    isSource ? publicSettingsDocRef(syncCode) : uidSettingsDocRef(uid),
  );

  const goals = await readEntityCollection(
    isSource
      ? publicDataCollectionRef(syncCode, collectionNames.goalsCollectionName)
      : uidCollectionRef(uid, collectionNames.goalsCollectionName),
  );

  const budgets = await readEntityCollection(
    isSource
      ? publicDataCollectionRef(syncCode, collectionNames.budgetsCollectionName)
      : uidCollectionRef(uid, collectionNames.budgetsCollectionName),
  );

  return {
    settings,
    transactions: buildTransactionsInventorySlice(txCollections),
    goals,
    budgets,
  };
}

export async function inspectLegacySyncMigration({ user, syncCode, currentYear }) {
  const readiness = getLegacyMigrationReadiness({ user, syncCode });
  if (!readiness.ready) {
    throw new LegacyMigrationNotReadyError(readiness.blockers);
  }

  const normalizedCode =
    typeof syncCode === 'string' ? syncCode.trim() : '';
  const uid = user.uid;

  const collectionNames = getMigrationCollectionNames({ currentYear });

  const [source, target] = await Promise.all([
    readSideInventory({
      syncCode: normalizedCode,
      uid,
      collectionNames,
      isSource: true,
    }),
    readSideInventory({
      syncCode: normalizedCode,
      uid,
      collectionNames,
      isSource: false,
    }),
  ]);

  const inventory = buildLegacyMigrationInventory({ source, target });
  const summary = buildLegacyMigrationDryRunSummary({
    inventory,
    scanMeta: {
      yearStart: collectionNames.yearStart,
      yearEnd: collectionNames.yearEnd,
      transactionCollectionCount: collectionNames.transactionCollectionCount,
    },
    maskedUid: maskUid(uid),
    maskedSyncCode: maskSyncCode(normalizedCode),
  });

  return {
    readiness,
    inventory,
    summary,
  };
}
