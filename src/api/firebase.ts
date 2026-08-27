import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import type { WorkOrder } from '../types';

// Read Firebase Config from Vite env variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && 
  firebaseConfig.projectId && 
  firebaseConfig.projectId !== 'YOUR_PROJECT_ID'
);

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const db = app ? getFirestore(app) : null;

const COLLECTION_WORK_ORDERS = 'work_orders';

export async function fetchFirebaseWorkOrders(): Promise<WorkOrder[] | null> {
  if (!db) return null;
  try {
    const colRef = collection(db, COLLECTION_WORK_ORDERS);
    const q = query(colRef, orderBy('executionDate', 'desc'));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const orders: WorkOrder[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.payload) {
          orders.push({ ...data.payload, id: docSnap.id });
        } else {
          orders.push({ ...data, id: docSnap.id } as WorkOrder);
        }
      });
      return orders;
    }
    return [];
  } catch (err) {
    console.warn('Error fetching from Firebase Firestore:', err);
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
