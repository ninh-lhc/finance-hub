import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAxf7IZZp3QoK4VTb3yeqztQeeJ8itzuOo",
  authDomain: "tai-chinh-cua-toi.firebaseapp.com",
  projectId: "tai-chinh-cua-toi",
  storageBucket: "tai-chinh-cua-toi.firebasestorage.app",
  messagingSenderId: "201177266866",
  appId: "1:201177266866:web:d539f9300f46a0d45567ab"
};
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const baseAppId = 'tai-chinh-cua-toi';

export { firebaseApp, auth, db, baseAppId };
