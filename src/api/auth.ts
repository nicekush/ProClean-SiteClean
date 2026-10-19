import {
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import type { UserAccount } from '../types';
import { db, firebaseApp } from './firebase';

// Production always enforces Firebase identities; the flag only enables them
// in local development. A stale hosting variable cannot restore legacy login.
export const isFirebaseAuthRequired = import.meta.env.PROD || import.meta.env.VITE_FIREBASE_AUTH_REQUIRED === 'true';

const auth = firebaseApp ? getAuth(firebaseApp) : null;

if (auth) {
  void setPersistence(auth, browserLocalPersistence).catch(error => {
    console.error('Could not enable persistent Firebase Auth session:', error);
  });
}

function sanitizeProfile(profile: UserAccount, uid: string, email: string): UserAccount {
  const { password: _password, payload: _payload, ...safeProfile } = profile as UserAccount & { payload?: unknown };
  return {
    ...safeProfile,
    id: uid,
    email,
    active: safeProfile.active !== false
  };
}

export async function fetchFirebaseUserProfile(uid: string, email: string): Promise<UserAccount> {
  if (!db) throw new Error('Firestore no está configurado.');
  const snapshot = await getDoc(doc(db, 'users', uid));
  if (!snapshot.exists()) {
    throw new Error('La cuenta fue autenticada, pero no tiene un perfil autorizado en Firestore.');
  }

  const data = snapshot.data();
  const profile = (data.payload || data) as UserAccount;
  const safeProfile = sanitizeProfile(profile, uid, email);
  if (!safeProfile.active) throw new Error('Esta cuenta se encuentra deshabilitada.');
  return safeProfile;
}

export async function loginWithFirebase(email: string, password: string): Promise<UserAccount> {
  if (!auth) throw new Error('Firebase Authentication no está configurado.');
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return fetchFirebaseUserProfile(credential.user.uid, credential.user.email || email.trim());
}

export async function logoutFromFirebase(): Promise<void> {
  if (auth) await signOut(auth);
}

export async function requestFirebasePasswordReset(email: string): Promise<void> {
  if (!auth) throw new Error('Firebase Authentication no está configurado.');
  if (!email.trim()) throw new Error('Ingresa tu correo para recuperar la contraseña.');
  await sendPasswordResetEmail(auth, email.trim());
}

export function subscribeFirebaseSession(onChange: (user: UserAccount | null) => void): () => void {
  if (!auth) {
    onChange(null);
    return () => undefined;
  }

  let unsubscribeProfile: (() => void) | undefined;
  const unsubscribeAuth = onAuthStateChanged(auth, firebaseUser => {
    unsubscribeProfile?.();
    if (!firebaseUser) { onChange(null); return; }
    unsubscribeProfile = onSnapshot(doc(db!, 'users', firebaseUser.uid), snapshot => {
      const data = snapshot.data();
      if (!data || data.active !== true) {
        onChange(null);
        void signOut(auth);
        return;
      }
      onChange(sanitizeProfile({ ...(data.payload || data), ...data }, firebaseUser.uid, firebaseUser.email || ''));
    }, () => { onChange(null); void signOut(auth); });
  });
  return () => { unsubscribeProfile?.(); unsubscribeAuth(); };
}
