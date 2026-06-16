import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc } from 'firebase/firestore';

// Default fallback mock configs if env variables aren't defined
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "placeholder-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "qubook-lms.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "qubook-lms",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "qubook-lms.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:123456"
};

let db: any = null;

try {
  // Gracefully handle browser run or invalid key without crashing
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  db = getFirestore(app);
} catch (e) {
  console.warn("Firebase failed to initialize. Realtime sync falls back to background fetch interval.", e);
}

/**
 * Triggers a real-time sync update on Firestore.
 * Admin calls this on successful CRUD action.
 */
export const triggerCollectionSync = async (collectionName: string) => {
  if (!db) return;
  try {
    const syncDocRef = doc(db, 'sync', 'status');
    await setDoc(syncDocRef, {
      [collectionName]: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.error("Firebase triggerCollectionSync error: ", err);
  }
};

/**
 * Custom hook to listen to Firestore real-time status doc
 * and invalidate target react-query keys instantly on changes.
 */
export const useRealTimeSync = (queryKeys: string[][]) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!db) return;

    const syncDocRef = doc(db, 'sync', 'status');
    const unsubscribe = onSnapshot(syncDocRef, (snapshot) => {
      if (snapshot.exists()) {
        console.log("Real-time update detected from Firebase Firestore status doc!");
        queryKeys.forEach(key => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
    }, (error) => {
      console.warn("Real-time Firebase listener warning (likely sandbox rules): ", error);
    });

    return () => unsubscribe();
  }, [queryClient, queryKeys]);
};
