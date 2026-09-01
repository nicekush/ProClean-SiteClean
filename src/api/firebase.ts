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
import type { WorkOrder, UserAccount } from '../types';

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
const COLLECTION_USERS = 'users';

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
      const orders: WorkOrder[] = [];
      if (!snapshot.empty) {
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.payload) {
            orders.push({ ...data.payload, id: docSnap.id });
          } else if (data.status || data.equipoCorrea) {
            orders.push({ ...data, id: docSnap.id } as WorkOrder);
          }
        });
        orders.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
      }
      onUpdate(orders);
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

// USERS CLOUD FIREBASE SYNC & PERSISTENCE
export async function fetchFirebaseUsers(): Promise<UserAccount[] | null> {
  if (!db) return null;
  try {
    const colRef = collection(db, COLLECTION_USERS);
    const snapshot = await getDocs(colRef);
    if (!snapshot.empty) {
      const users: UserAccount[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.payload) {
          users.push({ ...data.payload, id: docSnap.id });
        } else if (data.email) {
          users.push({ ...data, id: docSnap.id } as UserAccount);
        }
      });
      return users;
    }
    return [];
  } catch (err) {
    console.warn('Error fetching users from Firebase Firestore:', err);
    return null;
  }
}

export function subscribeFirebaseUsers(onUpdate: (users: UserAccount[]) => void): (() => void) | null {
  if (!db) return null;
  try {
    const colRef = collection(db, COLLECTION_USERS);
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const users: UserAccount[] = [];
      if (!snapshot.empty) {
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.payload) {
            users.push({ ...data.payload, id: docSnap.id });
          } else if (data.email) {
            users.push({ ...data, id: docSnap.id } as UserAccount);
          }
        });
      }
      onUpdate(users);
    }, (err) => {
      console.warn('Error in Firestore users real-time listener:', err);
    });
    return unsubscribe;
  } catch (err) {
    console.warn('Failed to setup Firestore users listener:', err);
    return null;
  }
}

export async function syncUserToFirebase(user: UserAccount): Promise<boolean> {
  if (!db) return false;
  try {
    const docRef = doc(db, COLLECTION_USERS, user.id);
    await setDoc(docRef, {
      payload: user,
      email: user.email,
      name: user.name,
      role: user.role,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.error('Failed to sync user to Firebase:', err);
    return false;
  }
}

export async function syncAllUsersToFirebase(users: UserAccount[]): Promise<boolean> {
  if (!db) return false;
  try {
    const colRef = collection(db, COLLECTION_USERS);
    const snapshot = await getDocs(colRef);
    const localIds = new Set(users.map(u => u.id));

    if (!snapshot.empty) {
      for (const docSnap of snapshot.docs) {
        if (!localIds.has(docSnap.id)) {
          await deleteDoc(doc(db, COLLECTION_USERS, docSnap.id));
        }
      }
    }

    for (const user of users) {
      await syncUserToFirebase(user);
    }
    return true;
  } catch (err) {
    console.error('Failed bulk users sync to Firebase:', err);
    return false;
  }
}

export async function deleteFirebaseUser(id: string): Promise<boolean> {
  if (!db) return false;
  try {
    const docRef = doc(db, COLLECTION_USERS, id);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error('Failed to delete user from Firebase:', err);
    return false;
  }
}

// GENERIC CLOUD FIRESTORE HELPERS FOR ALL ERP COLLECTIONS
export async function syncSingleDocToFirebase(collectionName: string, docId: string, data: any): Promise<boolean> {
  if (!db) return false;
  try {
    const docRef = doc(db, collectionName, docId);
    await setDoc(docRef, { payload: data, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (err) {
    console.error(`Failed to sync doc to Firebase (${collectionName}):`, err);
    return false;
  }
}

export async function fetchSingleDocFromFirebase<T>(collectionName: string, docId: string): Promise<T | null> {
  if (!db) return null;
  try {
    const colRef = collection(db, collectionName);
    const snapshot = await getDocs(colRef);
    let result: T | null = null;
    snapshot.forEach(docSnap => {
      if (docSnap.id === docId) {
        const data = docSnap.data();
        result = (data.payload || data) as T;
      }
    });
    return result;
  } catch (err) {
    console.warn(`Error fetching single doc ${collectionName}/${docId}:`, err);
    return null;
  }
}

export async function syncArrayToFirebase(collectionName: string, items: any[]): Promise<boolean> {
  if (!db) return false;
  try {
    const colRef = collection(db, collectionName);
    const snapshot = await getDocs(colRef);
    const localIds = new Set(items.map(item => item.id || 'singleton'));

    if (!snapshot.empty) {
      for (const docSnap of snapshot.docs) {
        if (!localIds.has(docSnap.id)) {
          await deleteDoc(doc(db, collectionName, docSnap.id));
        }
      }
    }

    for (const item of items) {
      const docId = item.id || 'singleton';
      await syncSingleDocToFirebase(collectionName, docId, item);
    }
    return true;
  } catch (err) {
    console.error(`Failed array sync to Firebase (${collectionName}):`, err);
    return false;
  }
}

export async function fetchFirebaseCollection<T>(collectionName: string): Promise<T[] | null> {
  if (!db) return null;
  try {
    const colRef = collection(db, collectionName);
    const snapshot = await getDocs(colRef);
    if (!snapshot.empty) {
      const items: T[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.payload) {
          items.push(data.payload as T);
        } else {
          items.push({ ...data, id: docSnap.id } as T);
        }
      });
      return items;
    }
    return [];
  } catch (err) {
    console.warn(`Error fetching ${collectionName} from Firebase:`, err);
    return null;
  }
}

export function subscribeFirebaseCollection<T>(collectionName: string, onUpdate: (items: T[]) => void): (() => void) | null {
  if (!db) return null;
  try {
    const colRef = collection(db, collectionName);
    return onSnapshot(colRef, (snapshot) => {
      // Avoid overwriting local edits while writing to Cloud Firestore
      if (snapshot.metadata.hasPendingWrites) return;

      const items: T[] = [];
      if (!snapshot.empty) {
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.payload) {
            items.push(data.payload as T);
          } else {
            items.push({ ...data, id: docSnap.id } as T);
          }
        });
      }
      onUpdate(items);
    }, (err) => {
      console.warn(`Error in Firestore ${collectionName} listener:`, err);
    });
  } catch (err) {
    console.warn(`Failed setup listener for ${collectionName}:`, err);
    return null;
  }
}
