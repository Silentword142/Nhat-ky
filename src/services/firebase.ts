import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth & Anonymous Session
export const auth = getAuth(app);
signInAnonymously(auth).catch((err) => {
  console.warn('Firebase anonymous auth status:', err.message);
});

// Initialize Firestore with fallback to robust Long Polling for iframe / incognito / Safari
let firestoreInstance;
const configObj = firebaseConfig as any;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
    },
    configObj.firestoreDatabaseId || '(default)'
  );
} catch (e) {
  firestoreInstance = configObj.firestoreDatabaseId
    ? getFirestore(app, configObj.firestoreDatabaseId)
    : getFirestore(app);
}

export const db = firestoreInstance;
export { doc, setDoc, getDoc, onSnapshot };
