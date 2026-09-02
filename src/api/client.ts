import type { 
  WhiteLabelConfig, 
  ClientContract, 
  ShiftType, 
  ContingencyReasonConfig, 
  WorkOrder, 
  Sector, 
  Machine, 
  Worker,
  AuditLogEntry,
  UserAccount
} from '../types';

import initialDbData from '../../data/db.json';
import { isFirebaseAuthRequired, loginWithFirebase } from './auth';
import { fetchFirebaseUsers, isFirebaseConfigured } from './firebase';

// The REST server is optional and development-only unless an explicit HTTPS
// endpoint is configured. Production Vercel builds must never call localhost.
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function apiUrl(endpoint: string): string {
  if (!API_BASE) throw new Error('REST API is not configured for this deployment.');
  return `${API_BASE}${endpoint}`;
}

// Queue for items created offline in mining terrain
const QUEUE_STORAGE_KEY = 'siteclean_offline_queue';

interface PendingQueueItem {
  id: string;
  endpoint: string;
  method: string;
  data: any;
  timestamp: string;
}

export function getOfflineQueue(): PendingQueueItem[] {
  try {
    const saved = localStorage.getItem(QUEUE_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function addToOfflineQueue(endpoint: string, method: string, data: any) {
  const queue = getOfflineQueue();
  if (!API_BASE) return queue;
  const item: PendingQueueItem = {
    id: `queue-${Date.now()}`,
    endpoint,
    method,
    data,
    timestamp: new Date().toLocaleTimeString('es-CL')
  };
  queue.push(item);
  localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  return queue;
}

export function clearOfflineQueue() {
  localStorage.removeItem(QUEUE_STORAGE_KEY);
}

// Process pending queue when network comes back online
export async function processOfflineQueue(): Promise<number> {
  const queue = getOfflineQueue();
  if (queue.length === 0 || !API_BASE) return 0;

  let processedCount = 0;
  const remaining: PendingQueueItem[] = [];

  for (const item of queue) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      const res = await fetch(apiUrl(item.endpoint), {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.data),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        processedCount++;
      } else {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  if (remaining.length > 0) {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(remaining));
  } else {
    clearOfflineQueue();
  }
  return processedCount;
}

export async function fetchFullDb() {
  const res = await fetch(apiUrl('/db'));
  return res.json();
}

// Authentication API
export async function loginUser(email: string, password?: string): Promise<{ success: boolean; user: UserAccount; error?: string }> {
  if (isFirebaseAuthRequired) {
    if (!password) throw new Error('Debes ingresar tu contraseña.');
    return { success: true, user: await loginWithFirebase(email, password) };
  }

  try {
    const res = await fetch(apiUrl('/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al iniciar sesión.');
      }
      return data;
    }
  } catch (e: any) {
    if (e.message && (e.message.includes('Credenciales') || e.message.includes('Contraseña'))) {
      throw e;
    }
    // Fallback for static production deployment (Vercel)
    let localUsers: UserAccount[] = [];
    try {
      const stored = localStorage.getItem('proclean_users');
      if (stored) localUsers = JSON.parse(stored);
    } catch (err) { console.warn(err); }

    if (!localUsers || localUsers.length === 0) {
      localUsers = (initialDbData as any).users || [];
    }

    let matchedUser = localUsers.find((u: any) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!matchedUser && isFirebaseConfigured) {
      const cloudUsers = await fetchFirebaseUsers();
      if (cloudUsers && cloudUsers.length > 0) {
        localUsers = cloudUsers;
        localStorage.setItem('proclean_users', JSON.stringify(cloudUsers));
        matchedUser = cloudUsers.find(user => user.email.toLowerCase() === email.trim().toLowerCase());
      }
    }
    if (matchedUser) {
      if (!matchedUser.password) {
        throw new Error('La cuenta no tiene una credencial heredada válida. Contacta al administrador.');
      }
      if (matchedUser.password !== password) {
        throw new Error('Contraseña incorrecta.');
      }
      return { success: true, user: matchedUser };
    }
    throw new Error('Usuario no encontrado en la base de datos.');
  }
  throw new Error('Error de conexión al servidor.');
}

export async function saveWhiteLabel(data: WhiteLabelConfig): Promise<WhiteLabelConfig> {
  try {
    const res = await fetch(apiUrl('/whitelabel'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  } catch (e) {
    addToOfflineQueue('/whitelabel', 'POST', data);
    return data;
  }
}

// Users API
export async function fetchUsers(): Promise<UserAccount[]> {
  const res = await fetch(apiUrl('/users'));
  return res.json();
}

export async function saveUser(user: Omit<UserAccount, 'id'>): Promise<UserAccount[]> {
  const account: UserAccount = {
    ...user,
    id: `usr-${Date.now()}`
  };
  try {
    const res = await fetch(apiUrl('/users'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(account)
    });
    return res.json();
  } catch (e) {
    addToOfflineQueue('/users', 'POST', account);
    return [];
  }
}

// Audit Logs API
export async function fetchAuditLogs(): Promise<AuditLogEntry[]> {
  const res = await fetch(apiUrl('/audit-logs'));
  return res.json();
}

export async function createAuditLogEntry(entry: Omit<AuditLogEntry, 'id'>): Promise<AuditLogEntry[]> {
  const log: AuditLogEntry = {
    ...entry,
    id: `log-${Date.now()}`
  };
  try {
    const res = await fetch(apiUrl('/audit-logs'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log)
    });
    return res.json();
  } catch (e) {
    addToOfflineQueue('/audit-logs', 'POST', log);
    return [];
  }
}

// Contracts API
export async function saveContracts(data: ClientContract[]): Promise<ClientContract[]> {
  try {
    const res = await fetch(apiUrl('/contracts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  } catch (e) {
    addToOfflineQueue('/contracts', 'POST', data);
    return data;
  }
}

// Shifts API
export async function saveShifts(data: ShiftType[]): Promise<ShiftType[]> {
  try {
    const res = await fetch(apiUrl('/shifts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  } catch (e) {
    addToOfflineQueue('/shifts', 'POST', data);
    return data;
  }
}

// Contingencies API
export async function saveContingencies(data: ContingencyReasonConfig[]): Promise<ContingencyReasonConfig[]> {
  try {
    const res = await fetch(apiUrl('/contingencies'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  } catch (e) {
    addToOfflineQueue('/contingencies', 'POST', data);
    return data;
  }
}

// Legacy REST Work Orders API. The application now writes work orders directly
// to Firestore so its native persistent queue can handle intermittent signal.
export async function saveWorkOrders(data: WorkOrder[]): Promise<WorkOrder[]> {
  if (!API_BASE) return data;

  try {
    const res = await fetch(apiUrl('/work-orders'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  } catch (e) {
    console.warn('Legacy REST work-order endpoint unavailable:', e);
    return data;
  }
}

// Plant Areas API
export async function savePlantAreas(data: any[]): Promise<any[]> {
  try {
    const res = await fetch(apiUrl('/plant-areas'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  } catch (e) {
    addToOfflineQueue('/plant-areas', 'POST', data);
    return data;
  }
}

// Sub-Sectors API
export async function saveSubSectors(data: any[]): Promise<any[]> {
  try {
    const res = await fetch(apiUrl('/sub-sectors'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  } catch (e) {
    addToOfflineQueue('/sub-sectors', 'POST', data);
    return data;
  }
}

// Equipments API
export async function saveEquipments(data: any[]): Promise<any[]> {
  try {
    const res = await fetch(apiUrl('/equipments'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  } catch (e) {
    addToOfflineQueue('/equipments', 'POST', data);
    return data;
  }
}

// Sectors API
export async function saveSectors(data: Sector[]): Promise<Sector[]> {
  try {
    const res = await fetch(apiUrl('/sectors'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  } catch (e) {
    addToOfflineQueue('/sectors', 'POST', data);
    return data;
  }
}

// Machines API
export async function saveMachines(data: Machine[]): Promise<Machine[]> {
  try {
    const res = await fetch(apiUrl('/machines'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  } catch (e) {
    addToOfflineQueue('/machines', 'POST', data);
    return data;
  }
}

// Workers API
export async function saveWorkers(data: Worker[]): Promise<Worker[]> {
  try {
    const res = await fetch(apiUrl('/workers'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  } catch (e) {
    addToOfflineQueue('/workers', 'POST', data);
    return data;
  }
}

export async function resetDatabaseBlankSlate() {
  const res = await fetch(apiUrl('/reset-blank-slate'), {
    method: 'POST'
  });
  return res.json();
}
