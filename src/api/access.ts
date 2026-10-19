import { doc, writeBatch, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, deleteUser, inMemoryPersistence, setPersistence } from 'firebase/auth';
import { db, firebaseConfig } from './firebase';
import { isFirebaseAuthRequired } from './auth';
import type { UserAccount } from '../types';
import { effectivePermissions } from '../security/permissions';
import type { PermissionProfile } from '../security/permissions';

function audit(actor: UserAccount, target: string, details: string) {
  return { id: crypto.randomUUID(), tenantId: actor.tenantId || 'tenant_cmz', userId: actor.id,
    userName: actor.name, userRole: actor.role, action: 'EDICION', entityName: 'Usuarios y permisos',
    contractId: actor.contractId || 'c1', entityId: target, recordedAt: new Date().toISOString(), timestamp: new Date().toLocaleString('es-CL'), details };
}
export async function saveAccessUser(actor: UserAccount, next: UserAccount, previous?: UserAccount, password?: string) {
  if (!db) throw new Error('Firebase no está configurado.');
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Se requiere conexión para guardar cambios de acceso.');
  let secondary: ReturnType<typeof initializeApp> | undefined;
  let created: Awaited<ReturnType<typeof createUserWithEmailAndPassword>> | undefined;
  try {
    if (!previous && isFirebaseAuthRequired) {
      if (!password || password.length < 6) throw new Error('La contraseña inicial debe tener al menos 6 caracteres.');
      secondary = initializeApp(firebaseConfig, `provision-${crypto.randomUUID()}`);
      const provisioningAuth = getAuth(secondary);
      await setPersistence(provisioningAuth, inMemoryPersistence);
      created = await createUserWithEmailAndPassword(provisioningAuth, next.email, password);
      next = { ...next, id: created.user.uid };
    }
    const { password: _password, ...safe } = next;
    const clean = JSON.parse(JSON.stringify(safe));
    const profile = isFirebaseAuthRequired ? clean : { ...clean, ...(password ? { password } : previous?.password ? { password: previous.password } : {}) };
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', next.id), { ...profile, payload: profile, updatedAt: serverTimestamp() });
    const before = effectivePermissions(previous);
    const added = (next.permissions || []).filter(p => !before.includes(p));
    const removed = before.filter(p => !(next.permissions || []).includes(p));
    const log = audit(actor, next.id, `${previous ? 'Actualización' : 'Creación'} de ${next.email}. Permisos añadidos: ${added.join(', ') || 'ninguno'}. Retirados: ${removed.join(', ') || 'ninguno'}. Activo: ${next.active}. Alcance: ${next.accessScope || 'TENANT'}; contrato: ${next.contractId || ''}; áreas: ${(next.allowedAreaIds || []).join(', ') || 'todas'}.`);
    batch.set(doc(db, 'audit_logs', log.id), log);
    await batch.commit();
    return { ...profile, id: next.id } as UserAccount;
  } catch (error) {
    // A failed profile creation must not leave a newly provisioned Auth account behind.
    if (created) await deleteUser(created.user).catch(() => undefined);
    throw error;
  } finally { if (secondary) await deleteApp(secondary); }
}
export async function removeAccessUser(actor: UserAccount, target: UserAccount) {
  if (!db) throw new Error('Firebase no está configurado.');
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Se requiere conexión para guardar cambios de acceso.');
  const batch = writeBatch(db);
  batch.delete(doc(db, 'users', target.id));
  const log = audit(actor, target.id, `Se retiró el acceso de ${target.email}.`);
  batch.set(doc(db, 'audit_logs', log.id), log);
  await batch.commit();
}
export async function savePermissionProfile(actor: UserAccount, profile: PermissionProfile) {
  if (!db) throw new Error('Firebase no está configurado.');
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Se requiere conexión para guardar cambios de acceso.');
  const batch = writeBatch(db);
  batch.set(doc(db, 'permission_profiles', profile.id), profile);
  const log = audit(actor, profile.id, `Plantilla de permisos: ${profile.name}. Permisos: ${profile.permissions.join(', ')}.`);
  batch.set(doc(db, 'audit_logs', log.id), log);
  await batch.commit();
}
export function subscribeOwnProfile(id: string, callback: (user: UserAccount | null) => void) {
  if (!db) return () => {};
  return onSnapshot(doc(db, 'users', id), snap => {
    const data = snap.data();
    if (!data || data.active === false) { callback(null); return; }
    const { password: _password, ...safe } = { ...(data.payload || data), ...data };
    delete safe.payload;
    callback({ ...safe, id: snap.id } as UserAccount);
  }, () => callback(null));
}
