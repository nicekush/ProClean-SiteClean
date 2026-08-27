import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import type { WorkOrder } from '../types';

// Official Firebase Config for proclean-siteclean Cloud DB
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCyRmnH6xKA41-lVm5jzb56qCsED1gpWsI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "proclean-siteclean.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "proclean-siteclean",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "proclean-siteclean.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "345091105482",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:345091105482:web:b2e0e82b9e7280608f8a33"
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && 
  firebaseConfig.projectId
);

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const db = app ? getFirestore(app) : null;

const COLLECTION_WORK_ORDERS = 'work_orders';

export async function fetchFirebaseWorkOrders(): Promise<WorkOrder[] | null> {
  if (!db) return null;
  try {
    const colRef = collection(db, COLLECTION_WORK_ORDERS);
    const snapshot = await getDocs(colRef);

    if (!snapshot.empty) {
      const orders: WorkOrder[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.payload) {
          orders.push({ ...data.payload, id: docSnap.id });
        } else if (data.status || data.equipoCorrea) {
          orders.push({ ...data, id: docSnap.id } as WorkOrder);
        }
      });
      orders.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
      return orders;
    }
    return [];
  } catch (err) {
    console.warn('Error fetching from Firebase Firestore:', err);
    return null;
  }
}

export function subscribeFirebaseWorkOrders(onUpdate: (orders: WorkOrder[]) => void): (() => void) | null {
  if (!db) return null;
  try {
    const colRef = collection(db, COLLECTION_WORK_ORDERS);
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      if (!snapshot.empty) {
        const orders: WorkOrder[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.payload) {
            orders.push({ ...data.payload, id: docSnap.id });
          } else if (data.status || data.equipoCorrea) {
            orders.push({ ...data, id: docSnap.id } as WorkOrder);
          }
        });
        orders.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
        onUpdate(orders);
      }
    }, (err) => {
      console.warn('Error in Firestore real-time listener:', err);
    });
    return unsubscribe;
  } catch (err) {
    console.warn('Failed to setup Firestore listener:', err);
    return null;
  }
}

export async function syncWorkOrderToFirebase(order: WorkOrder): Promise<boolean> {
  if (!db) return false;
  try {
    const docRef = doc(db, COLLECTION_WORK_ORDERS, order.id);
    await setDoc(docRef, {
      payload: order,
      sapCode: order.sapCode || '',
      equipoCorrea: order.equipoCorrea || '',
      status: order.status,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.error('Failed to sync to Firebase:', err);
    return false;
  }
}

export async function syncAllWorkOrdersToFirebase(orders: WorkOrder[]): Promise<boolean> {
  if (!db) return false;
  try {
    for (const order of orders) {
      await syncWorkOrderToFirebase(order);
    }
    return true;
  } catch (err) {
    console.error('Failed bulk sync to Firebase:', err);
    return false;
  }
}

export async function deleteFirebaseWorkOrder(id: string): Promise<boolean> {
  if (!db) return false;
  try {
    const docRef = doc(db, COLLECTION_WORK_ORDERS, id);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error('Failed to delete from Firebase:', err);
    return false;
  }
}
