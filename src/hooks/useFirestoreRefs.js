import { useCallback } from 'react';
import { collection, doc } from 'firebase/firestore';
import { db, baseAppId } from '../services/firebase/config.js';

export default function useFirestoreRefs({ user, syncCode }) {
  const userId = user?.uid || 'anonymous';

  const getCollectionRef = useCallback((colName) => {
    if (syncCode) {
        return collection(db, 'artifacts', baseAppId, 'public', 'data', `sync_${syncCode}_${colName}`);
    } else {
        return collection(db, 'artifacts', baseAppId, 'users', userId, colName);
    }
  }, [syncCode, userId]);

  const getDocRef = useCallback((colName, id) => {
    if (syncCode) {
        return doc(db, 'artifacts', baseAppId, 'public', 'data', `sync_${syncCode}_${colName}`, id);
    } else {
        return doc(db, 'artifacts', baseAppId, 'users', userId, colName, id);
    }
  }, [syncCode, userId]);

  return { getCollectionRef, getDocRef };
}
