import { GoogleAuthProvider, linkWithPopup, signInWithPopup } from 'firebase/auth';

function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

export async function linkAnonymousUserWithGoogle({ auth, currentUser }) {
  if (!auth || !currentUser) {
    const error = new Error('No signed-in user to link with Google.');
    error.code = 'auth/no-current-user';
    throw error;
  }
  if (auth.currentUser?.uid !== currentUser.uid) {
    const error = new Error('Current user does not match auth session.');
    error.code = 'auth/current-user-mismatch';
    throw error;
  }
  if (!currentUser.isAnonymous) {
    const error = new Error('Only anonymous users can link current data with Google.');
    error.code = 'auth/not-anonymous';
    throw error;
  }

  const previousUid = currentUser.uid;
  const provider = createGoogleProvider();
  const result = await linkWithPopup(currentUser, provider);

  if (result.user.uid !== previousUid) {
    const error = new Error('UID changed unexpectedly after linking Google account.');
    error.code = 'auth/uid-changed-after-link';
    throw error;
  }

  return result;
}

export async function signInWithExistingGoogleAccount({ auth }) {
  if (!auth) {
    const error = new Error('Auth instance is required.');
    error.code = 'auth/no-auth-instance';
    throw error;
  }
  const provider = createGoogleProvider();
  return signInWithPopup(auth, provider);
}
