import { initializeApp } from 'firebase/app';
import { 
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  query,
  where
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { WorkOrder, UserAccount } from '../types';

// Official Firebase Config for proclean-siteclean Cloud DB
export const firebaseConfig = {
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

export const firebaseApp = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;

// Firestore owns the durable offline queue. On supported browsers, pending
// work-order writes survive refreshes and are shared safely across tabs.
let firestoreDb: Firestore | null = null;
if (firebaseApp) {
  try {
    firestoreDb = initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch (err) {
    // initializeFirestore can only configure an app once. Reuse the existing
    // instance if another module initialized it first.
    console.warn('Using existing Firestore instance:', err);
    firestoreDb = getFirestore(firebaseApp);
  }
}

export const db = firestoreDb;

const COLLECTION_WORK_ORDERS = 'work_orders';
const COLLECTION_USERS = 'users';

export async function fetchFirebaseWorkOrders(tenantId?: string): Promise<WorkOrder[] | null> {
  if (!db) return null;
  try {
    const colRef = collection(db, COLLECTION_WORK_ORDERS);
    const workOrdersQuery = tenantId ? query(colRef, where('tenantId', '==', tenantId)) : colRef;
    const snapshot = await getDocs(workOrdersQuery);

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

export interface WorkOrderSyncMetadata {
  pendingIds: string[];
  fromCache: boolean;
}

export function subscribeFirebaseWorkOrders(
  onUpdate: (orders: WorkOrder[], metadata: WorkOrderSyncMetadata) => void,
  onError?: (error: unknown) => void,
  tenantId?: string
): (() => void) | null {
  if (!db) return null;
  try {
    const colRef = collection(db, COLLECTION_WORK_ORDERS);
    const workOrdersQuery = tenantId ? query(colRef, where('tenantId', '==', tenantId)) : colRef;
    const unsubscribe = onSnapshot(workOrdersQuery, { includeMetadataChanges: true }, (snapshot) => {
      const orders: WorkOrder[] = [];
      const pendingIds: string[] = [];
      if (!snapshot.empty) {
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.payload) {
            orders.push({ ...data.payload, id: docSnap.id });
          } else if (data.status || data.equipoCorrea) {
            orders.push({ ...data, id: docSnap.id } as WorkOrder);
          }
          if (docSnap.metadata.hasPendingWrites) pendingIds.push(docSnap.id);
        });
        orders.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
      }
      onUpdate(orders, { pendingIds, fromCache: snapshot.metadata.fromCache });
    }, (err) => {
      console.warn('Error in Firestore real-time listener:', err);
      onError?.(err);
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
      staffingType: order.staffingType || null,
      sapCode: order.sapCode || '',
      equipoCorrea: order.equipoCorrea || '',
      status: order.status,
      tenantId: order.tenantId || 'tenant_cmz',
      updatedAt: serverTimestamp()
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

interface UserSyncOptions {
  preserveLegacyPassword?: boolean;
}

export async function syncUserToFirebase(
  user: UserAccount,
  options: UserSyncOptions = {}
): Promise<boolean> {
  if (!db) return false;
  try {
    const docRef = doc(db, COLLECTION_USERS, user.id);
    const safeUser = { ...user };
    if (!options.preserveLegacyPassword) delete safeUser.password;
    await setDoc(docRef, {
      payload: safeUser,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId || 'tenant_cmz',
      active: user.active !== false,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.error('Failed to sync user to Firebase:', err);
    return false;
  }
}

export async function syncAllUsersToFirebase(
  users: UserAccount[],
  options: UserSyncOptions = {}
): Promise<boolean> {
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
      await syncUserToFirebase(user, options);
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

// OFFICIAL DEFAULT CATALOGUES FOR DATABASE SEEDING
export const DEFAULT_OFFICIAL_COVERAGE_AREAS = [
  { id: 'a_sup', name: 'Supervisión', code: 'SUP', turnoId: 't_ambos', orden: 1 },
  { id: 'a_ch_prim', name: 'Chancado Primario', code: 'CH-PRIM', turnoId: 't_ambos', orden: 2 },
  { id: 'a_ch_terc', name: 'Chancado Terciario', code: 'CH-TERC', turnoId: 't_ambos', orden: 3 },
  { id: 'a_remanejo', name: 'Apilado y Remanejo', code: 'REM', turnoId: 't_ambos', orden: 4 },
  { id: 'a_humeda', name: 'Área Húmeda', code: 'AR-HUM', turnoId: 't_ambos', orden: 5 },
  { id: 'a_apoyo', name: 'Staff / Apoyo Planta', code: 'STAFF', turnoId: 't_ambos', orden: 6 },
  { id: 'a_personal_4x3', name: 'Personal Staff 4x3', code: 'STAFF-4X3', turnoId: 't_4x3', orden: 7 }
];

export const DEFAULT_OFFICIAL_CARGOS = [
  { id: 'c_sup', nombre: 'Supervisor', code: 'SUP' },
  { id: 'c_cond', nombre: 'Conductor Sucker / Aljibe', code: 'COND' },
  { id: 'c_ayu', nombre: 'Ayudante Aseo Industrial', code: 'AYU' },
  { id: 'c_op_aseo', nombre: 'Operador de Aseo', code: 'OP-ASEO' },
  { id: 'c_op_bomba', nombre: 'Operador Bomba / Camión Hidro', code: 'OP-BOMBA' },
  { id: 'c_op_jet', nombre: 'Operador Hidrojet', code: 'OP-JET' },
  { id: 'c_op_eq', nombre: 'Operador de Equipo / Alza Hombre', code: 'OP-EQ' },
  { id: 'c_bod', nombre: 'Bodeguero', code: 'BOD' },
  { id: 'c_mec', nombre: 'Mecánico', code: 'MEC' },
  { id: 'c_prev', nombre: 'Asesor de Prevención (APR)', code: 'PREV' },
  { id: 'c_robot', nombre: 'Aseo Robotizado', code: 'ROBOT', restrictedAreaIds: ['a_personal_4x3'] },
  { id: 'c_acd', nombre: 'ACD', code: 'ACD', restrictedAreaIds: ['a_personal_4x3'] },
  { id: 'c_jefe_prev', nombre: 'Jefe de Prevención', code: 'JEF-PREV', restrictedAreaIds: ['a_personal_4x3'] },
  { id: 'c_planif', nombre: 'Planificador', code: 'PLANIF', restrictedAreaIds: ['a_personal_4x3'] },
  { id: 'c_rrhh', nombre: 'RRHH', code: 'RRHH', restrictedAreaIds: ['a_personal_4x3'] },
  { id: 'c_jefe_taller', nombre: 'Jefe de Taller', code: 'JEF-TALLER', restrictedAreaIds: ['a_personal_4x3'] }
];

// DEDICATED CARGOS CLOUD FIRESTORE SYNC (100% PARITY WITH WORK ORDERS OT PATTERN)
export async function syncCargoToFirebase(cargo: any): Promise<boolean> {
  if (!db) return false;
  try {
    const docRef = doc(db, 'proclean_cargos', cargo.id);
    await setDoc(docRef, {
      payload: cargo,
      id: cargo.id,
      nombre: cargo.nombre,
      code: cargo.code || '',
      tenantId: cargo.tenantId || 'tenant_cmz',
      restrictedAreaIds: cargo.restrictedAreaIds || [],
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (err) {
    console.error('Failed to sync cargo to Firebase:', err);
    return false;
  }
}

export async function deleteCargoFromFirebase(cargoId: string): Promise<boolean> {
  if (!db) return false;
  try {
    const docRef = doc(db, 'proclean_cargos', cargoId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error('Failed to delete cargo from Firebase:', err);
    return false;
  }
}

export function subscribeFirebaseCargos(onUpdate: (cargos: any[]) => void): (() => void) | null {
  if (!db) return null;
  try {
    const colRef = collection(db, 'proclean_cargos');
    return onSnapshot(colRef, (snapshot) => {
      const cargosList: any[] = [];
      if (!snapshot.empty) {
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          const item = data.payload || data;
          cargosList.push({ ...item, id: docSnap.id });
        });
      }
      onUpdate(cargosList);
    }, (err) => {
      console.warn('Error in Firestore cargos listener:', err);
    });
  } catch (err) {
    console.warn('Failed setup listener for cargos:', err);
    return null;
  }
}

export async function seedOfficialDatabaseToFirebase(): Promise<boolean> {
  if (!db) return false;
  try {
    const cargosRef = collection(db, 'proclean_cargos');
    const cargosSnap = await getDocs(cargosRef);
    if (cargosSnap.empty) {
      for (const cargo of DEFAULT_OFFICIAL_CARGOS) {
        await syncCargoToFirebase(cargo);
      }
    }

    const areasRef = collection(db, 'proclean_coverageAreas');
    const areasSnap = await getDocs(areasRef);
    if (areasSnap.empty) {
      for (const area of DEFAULT_OFFICIAL_COVERAGE_AREAS) {
        const docRef = doc(db, 'proclean_coverageAreas', area.id);
        await setDoc(docRef, { payload: area, updatedAt: new Date().toISOString() }, { merge: true });
      }
    }

    return true;
  } catch (err) {
    console.error('Error seeding database to Firebase:', err);
    return false;
  }
}

// GENERIC CLOUD FIRESTORE HELPERS FOR ALL ERP COLLECTIONS
export async function syncSingleDocToFirebase(collectionName: string, docId: string, data: any): Promise<boolean> {
  if (!db) return false;
  try {
    const docRef = doc(db, collectionName, docId);
    await setDoc(docRef, { 
      ...data, 
      payload: data, 
      id: docId, 
      updatedAt: new Date().toISOString() 
    });
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
        const payload = data.payload || data;
        result = { ...payload, ...data, id: docSnap.id } as T;
      }
    });
    return result;
  } catch (err) {
    console.warn(`Error fetching single doc ${collectionName}/${docId}:`, err);
    return null;
  }
}

export async function deleteSingleDocFromFirebase(collectionName: string, docId: string): Promise<boolean> {
  if (!db) return false;
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error(`Failed to delete doc from Firebase (${collectionName}/${docId}):`, err);
    return false;
  }
}

export async function syncArrayToFirebase(collectionName: string, items: any[]): Promise<boolean> {
  if (!db) return false;
  try {
    for (const item of items) {
      const docId = item.id || 'singleton';
      const saved = await syncSingleDocToFirebase(collectionName, docId, item);
      if (!saved) return false;
    }
    return true;
  } catch (err) {
    console.error(`Failed array sync to Firebase (${collectionName}):`, err);
    return false;
  }
}

/**
 * Reconciles a collection from a known previous snapshot to its desired next
 * snapshot. Unlike syncArrayToFirebase, removed IDs are deleted from Firestore.
 * Intended for online-only operational forms such as daily staffing coverage.
 */
export async function replaceFirebaseCollection<T extends { id: string }>(
  collectionName: string,
  previousItems: T[],
  nextItems: T[]
): Promise<boolean> {
  if (!db) return false;

  try {
    const nextIds = new Set(nextItems.map(item => item.id));
    const deletions = previousItems.filter(item => !nextIds.has(item.id));
    const operations: Array<{ type: 'set'; item: T } | { type: 'delete'; id: string }> = [
      ...deletions.map(item => ({ type: 'delete' as const, id: item.id })),
      ...nextItems.map(item => ({ type: 'set' as const, item }))
    ];

    // Firestore batches allow at most 500 operations. Keep headroom so this
    // remains safe if the daily roster grows significantly.
    for (let offset = 0; offset < operations.length; offset += 450) {
      const batch = writeBatch(db);
      for (const operation of operations.slice(offset, offset + 450)) {
        if (operation.type === 'delete') {
          batch.delete(doc(db, collectionName, operation.id));
        } else {
          batch.set(doc(db, collectionName, operation.item.id), {
            ...operation.item,
            payload: operation.item,
            id: operation.item.id,
            updatedAt: serverTimestamp()
          });
        }
      }
      await batch.commit();
    }

    return true;
  } catch (err) {
    console.error(`Failed to replace Firebase collection (${collectionName}):`, err);
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
        const payload = data.payload || data;
        items.push({ ...payload, ...data, id: docSnap.id } as T);
      });
      return items;
    }
    return [];
  } catch (err) {
    console.warn(`Error fetching ${collectionName} from Firebase:`, err);
    return null;
  }
}

export async function fetchFirebaseCollectionByField<T>(
  collectionName: string,
  fieldName: string,
  fieldValue: string
): Promise<T[] | null> {
  if (!db) return null;
  try {
    const filteredQuery = query(collection(db, collectionName), where(fieldName, '==', fieldValue));
    const snapshot = await getDocs(filteredQuery);
    return snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      const payload = data.payload || data;
      return { ...payload, ...data, id: docSnap.id } as T;
    });
  } catch (err) {
    console.warn(`Error fetching filtered ${collectionName} from Firebase:`, err);
    return null;
  }
}

export function subscribeFirebaseCollection<T>(collectionName: string, onUpdate: (items: T[]) => void): (() => void) | null {
  if (!db) return null;
  try {
    const colRef = collection(db, collectionName);
    return onSnapshot(colRef, (snapshot) => {
      const items: T[] = [];
      if (!snapshot.empty) {
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          const payload = data.payload || data;
          items.push({ ...payload, ...data, id: docSnap.id } as T);
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

export function subscribeFirebaseCollectionByField<T>(
  collectionName: string,
  fieldName: string,
  fieldValue: string,
  onUpdate: (items: T[]) => void,
  onError?: (error: unknown) => void
): (() => void) | null {
  if (!db) return null;
  try {
    const filteredQuery = query(collection(db, collectionName), where(fieldName, '==', fieldValue));
    return onSnapshot(filteredQuery, snapshot => {
      const items = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const payload = data.payload || data;
        return { ...payload, ...data, id: docSnap.id } as T;
      });
      onUpdate(items);
    }, error => {
      console.warn(`Error in filtered Firestore ${collectionName} listener:`, error);
      onError?.(error);
    });
  } catch (err) {
    console.warn(`Failed filtered listener for ${collectionName}:`, err);
    return null;
  }
}

export function subscribeFirebaseCollectionByFields<T>(
  collectionName: string,
  filters: Array<{ fieldName: string; fieldValue: string }>,
  onUpdate: (items: T[]) => void,
  onError?: (error: unknown) => void
): (() => void) | null {
  if (!db) return null;
  try {
    const clauses = filters.map(filter => where(filter.fieldName, '==', filter.fieldValue));
    const filteredQuery = query(collection(db, collectionName), ...clauses);
    return onSnapshot(filteredQuery, snapshot => {
      const items = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const payload = data.payload || data;
        return { ...payload, ...data, id: docSnap.id } as T;
      });
      onUpdate(items);
    }, error => {
      console.warn(`Error in multi-filter Firestore ${collectionName} listener:`, error);
      onError?.(error);
    });
  } catch (err) {
    console.warn(`Failed multi-filter listener for ${collectionName}:`, err);
    return null;
  }
}

export function subscribeFirebaseDocument<T>(
  collectionName: string,
  docId: string,
  onUpdate: (item: T | null) => void,
  onError?: (error: unknown) => void
): (() => void) | null {
  if (!db) return null;
  try {
    return onSnapshot(doc(db, collectionName, docId), snapshot => {
      if (!snapshot.exists()) {
        onUpdate(null);
        return;
      }
      const data = snapshot.data();
      const payload = data.payload || data;
      onUpdate({ ...payload, ...data, id: snapshot.id } as T);
    }, error => {
      console.warn(`Error in Firestore ${collectionName}/${docId} listener:`, error);
      onError?.(error);
    });
  } catch (err) {
    console.warn(`Failed setup listener for ${collectionName}/${docId}:`, err);
    return null;
  }
}
