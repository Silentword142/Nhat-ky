import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
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
      // Without this, setDoc/updateDoc REJECTS the entire write if any field anywhere in the
      // payload is `undefined` (e.g. an optional diary "location" left blank becomes
      // `location: undefined`) — the error was being silently swallowed by every .catch(() => {})
      // in the sync code, so an untouched optional field could quietly block an entire diary/
      // photo/card from ever reaching the cloud. This makes Firestore just omit undefined fields
      // instead of rejecting the whole document.
      ignoreUndefinedProperties: true,
    },
    configObj.firestoreDatabaseId || '(default)'
  );
} catch (e) {
  firestoreInstance = configObj.firestoreDatabaseId
    ? getFirestore(app, configObj.firestoreDatabaseId)
    : getFirestore(app);
}

// Test builds only: VITE_FIRESTORE_EMULATOR=host:port points the app at a local Firestore emulator,
// so sync can be exercised with two browsers without touching the real database. Never set for the
// GitHub Pages build, so production always talks to the real project.
const emulatorHost = (import.meta as any).env?.VITE_FIRESTORE_EMULATOR as string | undefined;
if (emulatorHost) {
  const [host, port] = emulatorHost.split(':');
  connectFirestoreEmulator(firestoreInstance, host, Number(port));
}

export const db = firestoreInstance;
export { doc, setDoc, getDoc, onSnapshot };
