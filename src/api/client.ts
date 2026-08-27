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

const API_BASE = 'http://localhost:3001/api';

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
  if (queue.length === 0) return 0;

  let processedCount = 0;
  const remainingQueue: PendingQueueItem[] = [];

  for (const item of queue) {
    try {
      const res = await fetch(`${API_BASE}${item.endpoint}`, {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.data)
      });
      if (res.ok) {
        processedCount++;
      } else {
        remainingQueue.push(item);
      }
    } catch (e) {
      remainingQueue.push(item);
    }
  }

  if (remainingQueue.length === 0) {
    clearOfflineQueue();
  } else {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(remainingQueue));
  }

  return processedCount;
}

export async function fetchFullDb() {
  const res = await fetch(`${API_BASE}/db`);
  return res.json();
}

// Authentication API
export async function loginUser(email: string, password?: string): Promise<{ success: boolean; user: UserAccount; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/login`, {
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
    const localUsers = (initialDbData as any).users || [];
    const matchedUser = localUsers.find((u: any) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (matchedUser) {
      if (password && matchedUser.password && matchedUser.password !== password) {
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
    const res = await fetch(`${API_BASE}/whitelabel`, {
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
  const res = await fetch(`${API_BASE}/users`);
  return res.json();
}

export async function saveUser(user: Omit<UserAccount, 'id'>): Promise<UserAccount[]> {
  const account: UserAccount = {
    ...user,
    id: `usr-${Date.now()}`
  };
  try {
    const res = await fetch(`${API_BASE}/users`, {
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
  const res = await fetch(`${API_BASE}/audit-logs`);
  return res.json();
}

export async function createAuditLogEntry(entry: Omit<AuditLogEntry, 'id'>): Promise<AuditLogEntry[]> {
  const log: AuditLogEntry = {
    ...entry,
    id: `log-${Date.now()}`
  };
  try {
    const res = await fetch(`${API_BASE}/audit-logs`, {
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
    const res = await fetch(`${API_BASE}/contracts`, {
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
    const res = await fetch(`${API_BASE}/shifts`, {
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
    const res = await fetch(`${API_BASE}/contingencies`, {
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

import { syncAllWorkOrdersToSupabase, fetchSupabaseWorkOrders, isSupabaseConfigured } from './supabase';
import { syncAllWorkOrdersToFirebase, fetchFirebaseWorkOrders, isFirebaseConfigured } from './firebase';

// Work Orders API
export async function saveWorkOrders(data: WorkOrder[]): Promise<WorkOrder[]> {
  try {
    localStorage.setItem('proclean_work_orders', JSON.stringify(data));
  } catch (err) {
    console.warn('Error guardando en localStorage', err);
  }

  // Sync with Supabase cloud database if configured
  if (isSupabaseConfigured) {
    syncAllWorkOrdersToSupabase(data);
  }

  // Sync with Firebase cloud database if configured
  if (isFirebaseConfigured) {
    syncAllWorkOrdersToFirebase(data);
  }

  try {
    const res = await fetch(`${API_BASE}/work-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  } catch (e) {
    addToOfflineQueue('/work-orders', 'POST', data);
    return data;
  }
}

// Plant Areas API
export async function savePlantAreas(data: any[]): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/plant-areas`, {
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
    const res = await fetch(`${API_BASE}/sub-sectors`, {
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
    const res = await fetch(`${API_BASE}/equipments`, {
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
    const res = await fetch(`${API_BASE}/sectors`, {
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
    const res = await fetch(`${API_BASE}/machines`, {
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
    const res = await fetch(`${API_BASE}/workers`, {
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
  const res = await fetch(`${API_BASE}/reset-blank-slate`, {
    method: 'POST'
  });
  return res.json();
}
