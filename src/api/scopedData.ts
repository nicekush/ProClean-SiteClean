import { collection, query, where, onSnapshot } from 'firebase/firestore';
import type { QueryConstraint } from 'firebase/firestore';
import { db } from './firebase';
import type { UserAccount } from '../types';

export function subscribeScopedData<T>(name: string, user: UserAccount, callback: (items: T[], fromCache: boolean, pendingIds: string[]) => void,
  onError: (error: unknown) => void, options: { contract?: boolean; areas?: boolean; today?: boolean } = {}) {
  if (!db) return () => {};
  const filters: QueryConstraint[] = [where('tenantId', '==', user.tenantId || 'tenant_cmz')];
  if (options.contract && user.accessScope === 'CONTRACT') filters.push(where('contractId', '==', user.contractId || '__none__'));
  if (options.areas && user.allowedAreaIds?.length) filters.push(where('areaId', 'in', user.allowedAreaIds.slice(0, 10)));
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
  if (options.today) filters.push(where('fecha', '==', today));
  return onSnapshot(query(collection(db, name), ...filters), { includeMetadataChanges: true }, snapshot => {
    const rows = snapshot.docs.map(d => ({ ...(d.data().payload || d.data()), id: d.id })) as T[];
    callback(options.today ? rows.filter(item => (item as { fecha?: string }).fecha === today) : rows,
      snapshot.metadata.fromCache, snapshot.docs.filter(d => d.metadata.hasPendingWrites).map(d => d.id));
  }, onError);
}
