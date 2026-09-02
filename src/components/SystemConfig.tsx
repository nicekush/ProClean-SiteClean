import React, { useState } from 'react';
import type { WhiteLabelConfig, ShiftType, ClientContract, ContingencyReasonConfig, CustomColumn, UserAccount, UserRole } from '../types';
import { 
  SlidersHorizontal, 
  Building2, 
  Clock, 
  Palette, 
  Plus, 
  Trash2, 
  Save, 
  RotateCcw, 
  CheckCircle,
  Upload,
  Image as ImageIcon,
  Columns,
  AlertOctagon,
  Edit,
  X,
  Users,
  Key,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

interface SystemConfigProps {
  whiteLabel: WhiteLabelConfig;
  setWhiteLabel: React.Dispatch<React.SetStateAction<WhiteLabelConfig>>;
  contracts: ClientContract[];
  setContracts: React.Dispatch<React.SetStateAction<ClientContract[]>>;
  activeContractId: string;
  setActiveContractId: (id: string) => void;
  shifts: ShiftType[];
  setShifts: React.Dispatch<React.SetStateAction<ShiftType[]>>;
  contingencies: ContingencyReasonConfig[];
  setContingencies: React.Dispatch<React.SetStateAction<ContingencyReasonConfig[]>>;
  users: UserAccount[];
  setUsers: React.Dispatch<React.SetStateAction<UserAccount[]>>;
  onResetBlankSlate: () => void;
}

export const SystemConfig: React.FC<SystemConfigProps> = ({
  whiteLabel,
  setWhiteLabel,
  contracts,
  setContracts,
  activeContractId,
  setActiveContractId,
  shifts,
  setShifts,
  contingencies,
  setContingencies,
  users,
  setUsers,
  onResetBlankSlate
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'contracts' | 'branding' | 'logos' | 'shifts' | 'custom-columns' | 'contingencies' | 'maintenance'>('users');
  const [formData, setFormData] = useState<WhiteLabelConfig>({ ...whiteLabel });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  // Editing States
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editingContract, setEditingContract] = useState<ClientContract | null>(null);
  const [editingShift, setEditingShift] = useState<ShiftType | null>(null);
  const [editingContingency, setEditingContingency] = useState<ContingencyReasonConfig | null>(null);

  // Forms
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '123', role: 'SUPERVISOR_TERRENO' as UserRole, contractId: 'c1' });
  const [newContract, setNewContract] = useState({ clientName: '', contractNumber: '', siteLocation: '', contractAdminName: '', costCenter: '' });
  const [newShift, setNewShift] = useState({ name: '', code: '', startTime: '08:00', endTime: '20:00', colorHex: '#05A6A6', breakHours: 1 });
  const [newContingency, setNewContingency] = useState({ name: '', code: '', category: 'OPERACIONAL' });
  const [newCol, setNewCol] = useState({ name: '', type: 'text' as const });

  const activeContract = contracts.find(c => c.id === activeContractId) || contracts[0];

  const handleSaveBranding = (e: React.FormEvent) => {
    e.preventDefault();
    setWhiteLabel(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleCompanyLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string;
      const updated = { ...formData, companyLogoUrl: base64 };
      setFormData(updated);
      setWhiteLabel(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    };
    reader.readAsDataURL(file);
  };

  const handleClientLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string;
      setContracts(contracts.map(c => c.id === activeContractId ? { ...c, clientLogoUrl: base64 } : c));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    };
    reader.readAsDataURL(file);
  };

  // Users CRUD
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email) return;

    const roleColors: Record<UserRole, string> = {
      SUPERVISOR_TERRENO: '#05A6A6',
      ITO_MANDANTE: '#025951',
      ADMINISTRADOR_CONTRATO: '#3F3D73',
      SUPER_ADMIN: '#B91C1C'
    };

    const created: UserAccount = {
      id: `usr-${Date.now()}`,
      name: newUser.name,
      email: newUser.email,
      password: newUser.password || '123',
      role: newUser.role,
      contractId: newUser.contractId,
      active: true,
      avatarColor: roleColors[newUser.role]
    };

    setUsers([...users, created]);
    setNewUser({ name: '', email: '', password: '123', role: 'SUPERVISOR_TERRENO', contractId: 'c1' });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleUpdateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setUsers(users.map(u => u.id === editingUser.id ? editingUser : u));
    setEditingUser(null);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleDeleteUser = (id: string) => {
    if (users.length <= 1) {
      alert('Debes mantener al menos una cuenta de usuario en el sistema.');
      return;
    }
    if (confirm('¿Eliminar esta cuenta de usuario?')) {
      setUsers(users.filter(u => u.id !== id));
    }
  };

  // Contracts CRUD
  const handleAddContract = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContract.clientName) return;
    const created: ClientContract = {
      id: Date.now().toString(),
      clientName: newContract.clientName,
      contractNumber: newContract.contractNumber || 'CNT-01',
      siteLocation: newContract.siteLocation || 'Planta Principal',
      contractAdminName: newContract.contractAdminName,
      costCenter: newContract.costCenter,
      active: true
    };
    const updated = [...contracts, created];
    setContracts(updated);
    setActiveContractId(created.id);
    setNewContract({ clientName: '', contractNumber: '', siteLocation: '', contractAdminName: '', costCenter: '' });
  };

  const handleUpdateContractSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContract) return;
    const updated = contracts.map(c => c.id === editingContract.id ? editingContract : c);
    setContracts(updated);
    setEditingContract(null);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleDeleteContract = (id: string) => {
    if (contracts.length <= 1) {
      alert('Debes mantener al menos un contrato activo en el sistema.');
      return;
    }
    if (confirm('¿Estás seguro de que deseas eliminar este cliente/contrato?')) {
      const updated = contracts.filter(c => c.id !== id);
      setContracts(updated);
      if (activeContractId === id) {
        setActiveContractId(updated[0].id);
      }
    }
  };

  // Shifts CRUD
  const handleAddShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShift.name) return;
    setShifts([
      ...shifts,
      {
        id: Date.now().toString(),
        name: newShift.name,
        code: newShift.code || `TRN-${shifts.length + 1}`,
        startTime: newShift.startTime,
        endTime: newShift.endTime,
        colorHex: newShift.colorHex,
        breakHours: Number(newShift.breakHours) || 1
      }
    ]);
    setNewShift({ name: '', code: '', startTime: '08:00', endTime: '20:00', colorHex: '#05A6A6', breakHours: 1 });
  };

  const handleUpdateShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShift) return;
    setShifts(shifts.map(s => s.id === editingShift.id ? editingShift : s));
    setEditingShift(null);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleDeleteShift = (id: string) => {
    if (shifts.length <= 1) {
      alert('Debes mantener al menos un turno configurado en el sistema.');
      return;
    }
    if (confirm('¿Deseas eliminar este turno?')) {
      setShifts(shifts.filter(s => s.id !== id));
    }
  };

  // Contingencies CRUD
  const handleAddContingency = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContingency.name) return;
    setContingencies([
      ...contingencies,
      {
        id: Date.now().toString(),
        name: newContingency.name,
        code: newContingency.code || `CTG-${contingencies.length + 1}`,
        category: newContingency.category
      }
    ]);
    setNewContingency({ name: '', code: '', category: 'OPERACIONAL' });
  };

  const handleUpdateContingencySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContingency) return;
    setContingencies(contingencies.map(c => c.id === editingContingency.id ? editingContingency : c));
    setEditingContingency(null);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleDeleteContingency = (id: string) => {
    if (confirm('¿Deseas eliminar este motivo de contingencia?')) {
      setContingencies(contingencies.filter(c => c.id !== id));
    }
  };

  const handleExecuteReset = () => {
    if (confirmText.trim().toUpperCase() !== 'REINICIAR') {
      alert('Debes escribir la palabra "REINICIAR" para confirmar la operación.');
      return;
    }
    onResetBlankSlate();
    setConfirmText('');
  };

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ color: 'var(--color-primary-dark)', fontSize: '22px', fontWeight: 800 }}>
          🎛️ Centro de Configuración y Administración del Sistema
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
          Gestión unificada de Usuarios & Roles Fijos, Clientes, Marca, Turnos y Parámetros
        </p>
      </div>

      {/* Configuration Health Widgets */}
      <div className="responsive-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '12px', marginBottom: '24px' }}>
        <div style={{ padding: '12px 16px', borderRadius: '12px', backgroundColor: '#FFF', border: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Users size={20} style={{ color: 'var(--color-action-teal)' }} />
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>USUARIOS RBAC</div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--color-primary-dark)' }}>{users.length} Activos</div>
          </div>
        </div>

        <div style={{ padding: '12px 16px', borderRadius: '12px', backgroundColor: '#FFF', border: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Building2 size={20} style={{ color: 'var(--color-forest-teal)' }} />
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>CLIENTES MINEROS</div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--color-forest-teal)' }}>{contracts.length} Registrados</div>
          </div>
        </div>

        <div style={{ padding: '12px 16px', borderRadius: '12px', backgroundColor: '#FFF', border: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Clock size={20} style={{ color: '#0369A1' }} />
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>TURNOS VIGENTES</div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#0369A1' }}>{shifts.length} Parametrizados</div>
          </div>
        </div>

        <div style={{ padding: '12px 16px', borderRadius: '12px', backgroundColor: '#FFF', border: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SlidersHorizontal size={20} style={{ color: '#991B1B' }} />
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>CONTINGENCIAS</div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#991B1B' }}>{contingencies.length} Motivos</div>
          </div>
        </div>
      </div>

      {savedSuccess && (
        <div style={{ backgroundColor: 'var(--status-complete-bg)', color: 'var(--color-forest-teal)', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={18} /> ¡Cambios guardados exitosamente en la base de datos!
        </div>
      )}

      {/* Subtabs Header (Touch Scrollable) */}
      <div className="scrollable-tabs">
        <button
          className={`btn ${activeSubTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('users')}
          style={{ flexShrink: 0 }}
        >
          <Users size={16} /> Usuarios ({users.length})
        </button>

        <button
          className={`btn ${activeSubTab === 'contracts' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('contracts')}
          style={{ flexShrink: 0 }}
        >
          <Building2 size={16} /> Clientes ({contracts.length})
        </button>

        <button
          className={`btn ${activeSubTab === 'branding' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('branding')}
          style={{ flexShrink: 0 }}
        >
          <Palette size={16} /> Tema Visual
        </button>

        <button
          className={`btn ${activeSubTab === 'logos' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('logos')}
          style={{ flexShrink: 0 }}
        >
          <ImageIcon size={16} /> Upload Logos
        </button>

        <button
          className={`btn ${activeSubTab === 'shifts' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('shifts')}
          style={{ flexShrink: 0 }}
        >
          <Clock size={16} /> Turnos ({shifts.length})
        </button>

        <button
          className={`btn ${activeSubTab === 'contingencies' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('contingencies')}
          style={{ flexShrink: 0 }}
        >
          <SlidersHorizontal size={16} /> Contingencias ({contingencies.length})
        </button>

        <button
          className={`btn ${activeSubTab === 'maintenance' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('maintenance')}
          style={activeSubTab === 'maintenance' ? { backgroundColor: '#991B1B', color: '#FFFFFF', flexShrink: 0 } : { color: '#991B1B', flexShrink: 0 }}
        >
          <AlertOctagon size={16} /> Reinicio
        </button>
      </div>

      {/* Subtab: Users Management */}
      {activeSubTab === 'users' && (
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary-dark)', marginBottom: '16px' }}>
            Gestión de Cuentas de Usuario, Contraseñas y Asignación de Roles Fijos (RBAC)
          </h3>

          {/* Edit User Form */}
          {editingUser && (
            <div style={{ backgroundColor: '#F8FAFC', padding: '20px', borderRadius: '12px', border: '2px solid var(--color-action-teal)', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-action-teal)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Edit size={18} /> Editar Cuenta y Contraseña de Usuario
                </h4>
                <button onClick={() => setEditingUser(null)} className="btn btn-secondary" style={{ padding: '4px 8px' }}><X size={16} /></button>
              </div>

              <form className="responsive-form-grid" onSubmit={handleUpdateUserSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Nombre y Apellidos</label>
                  <input
                    type="text"
                    value={editingUser.name}
                    onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Correo Electrónico (Email)</label>
                  <input
                    type="email"
                    value={editingUser.email}
                    onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Clave de Acceso (Password)</label>
                  <input
                    type="text"
                    value={editingUser.password || ''}
                    onChange={e => setEditingUser({ ...editingUser, password: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #D2D2D9', fontFamily: 'monospace', fontWeight: 700 }}
                    placeholder="Escribe nueva clave..."
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Rol Asignado (Acceso)</label>
                  <select
                    value={editingUser.role}
                    onChange={e => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
                  >
                    <option value="SUPERVISOR_TERRENO">👷 Supervisor de Terreno</option>
                    <option value="ITO_MANDANTE">🕵️ Inspector / ITO Mandante Minero</option>
                    <option value="ADMINISTRADOR_CONTRATO">💼 Administrador de Contrato</option>
                    <option value="SUPER_ADMIN">⚙️ Super Admin SaaS</option>
                  </select>
                </div>

                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditingUser(null)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary"><Save size={16} /> Actualizar Usuario</button>
                </div>
              </form>
            </div>
          )}

          {/* New User Form */}
          <form className="responsive-form-grid" onSubmit={handleAddUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '12px', marginBottom: '24px' }}>
            <input
              type="text"
              placeholder="Nombre Completo (Ej: Pedro Alarcón)"
              value={newUser.name}
              onChange={e => setNewUser({ ...newUser, name: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
              required
            />
            <input
              type="email"
              placeholder="Correo (Ej: palarcon@codelco.cl)"
              value={newUser.email}
              onChange={e => setNewUser({ ...newUser, email: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
              required
            />
            <input
              type="text"
              placeholder="Clave (Ej: 123)"
              value={newUser.password}
              onChange={e => setNewUser({ ...newUser, password: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D2D2D9', fontFamily: 'monospace' }}
              required
            />
            <select
              value={newUser.role}
              onChange={e => setNewUser({ ...newUser, role: e.target.value as UserRole })}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
            >
              <option value="SUPERVISOR_TERRENO">👷 Supervisor Terreno</option>
              <option value="ITO_MANDANTE">🕵️ ITO Mandante Minero</option>
              <option value="ADMINISTRADOR_CONTRATO">💼 Admin Contrato</option>
              <option value="SUPER_ADMIN">⚙️ Super Admin SaaS</option>
            </select>
            <button type="submit" className="btn btn-primary">
              <Plus size={16} /> Crear Usuario
            </button>
          </form>

          <div className="grid-table-container">
            <table className="operational-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Correo Electrónico</th>
                  <th>Clave Registrada</th>
                  <th>Rol Fijo Asignado</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 800, color: 'var(--color-primary-dark)' }}>{u.name}</td>
                    <td style={{ fontFamily: 'monospace' }}>{u.email}</td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, backgroundColor: '#F1F5F9', padding: '3px 8px', borderRadius: '4px', border: '1px solid #CBD5E1' }}>
                        🔑 {u.password || '123'}
                      </span>
                    </td>
                    <td>
                      <span className="pill pill-complete" style={{ backgroundColor: u.avatarColor ? `${u.avatarColor}20` : '#E2E8F0', color: u.avatarColor || '#1F2937' }}>
                        {u.role}
                      </span>
                    </td>
                    <td><span className="pill pill-complete">ACTIVO</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setEditingUser(u)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }}>
                          <Edit size={14} /> Editar
                        </button>
                        <button onClick={() => handleDeleteUser(u.id)} className="btn" style={{ backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5', padding: '4px 8px', fontSize: '11px' }}>
                          <Trash2 size={14} /> Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab: Multi-Contrato */}
      {activeSubTab === 'contracts' && (
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary-dark)', marginBottom: '16px' }}>
            Gestión de Clientes y Contratos Mineros
          </h3>

          {/* Edit Client Modal */}
          {editingContract && (
            <div style={{ backgroundColor: '#F8FAFC', padding: '20px', borderRadius: '12px', border: '2px solid var(--color-action-teal)', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-action-teal)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Edit size={18} /> Editar Datos del Cliente / Contrato
                </h4>
                <button onClick={() => setEditingContract(null)} className="btn btn-secondary" style={{ padding: '4px 8px' }}><X size={16} /></button>
              </div>

              <form className="responsive-form-grid" onSubmit={handleUpdateContractSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Nombre Cliente / Empresa Minera</label>
                  <input
                    type="text"
                    value={editingContract.clientName}
                    onChange={e => setEditingContract({ ...editingContract, clientName: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>N° de Contrato</label>
                  <input
                    type="text"
                    value={editingContract.contractNumber}
                    onChange={e => setEditingContract({ ...editingContract, contractNumber: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Faena / Ubicación</label>
                  <input
                    type="text"
                    value={editingContract.siteLocation}
                    onChange={e => setEditingContract({ ...editingContract, siteLocation: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
                    required
                  />
                </div>

                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditingContract(null)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary"><Save size={16} /> Guardar Cambios del Cliente</button>
                </div>
              </form>
            </div>
          )}

          {/* New Client Form */}
          <form className="responsive-form-grid" onSubmit={handleAddContract} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '12px', marginBottom: '24px' }}>
            <input
              type="text"
              placeholder="Cliente / Empresa Minera (Ej: Minera Escondida)"
              value={newContract.clientName}
              onChange={e => setNewContract({ ...newContract, clientName: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
              required
            />
            <input
              type="text"
              placeholder="N° Contrato (Ej: CNT-2026-08)"
              value={newContract.contractNumber}
              onChange={e => setNewContract({ ...newContract, contractNumber: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
            />
            <input
              type="text"
              placeholder="Ubicación / Faena"
              value={newContract.siteLocation}
              onChange={e => setNewContract({ ...newContract, siteLocation: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
            />
            <button type="submit" className="btn btn-primary">
              <Plus size={16} /> Registrar Nuevo Cliente
            </button>
          </form>

          <div className="grid-table-container">
            <table className="operational-table">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Cliente / Empresa Minera</th>
                  <th>N° Contrato</th>
                  <th>Faena / Ubicación</th>
                  <th>Acciones de Administración</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map(c => (
                  <tr key={c.id}>
                    <td>
                      {c.id === activeContractId ? (
                        <span className="pill pill-complete">ACTIVO</span>
                      ) : (
                        <span className="pill pill-pending">DISPONIBLE</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 800, fontSize: '14px', color: 'var(--color-primary-dark)' }}>{c.clientName}</td>
                    <td><span style={{ fontFamily: 'monospace', fontWeight: 800, backgroundColor: '#F1F5F9', padding: '4px 8px', borderRadius: '4px' }}>{c.contractNumber}</span></td>
                    <td>{c.siteLocation}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {c.id !== activeContractId ? (
                          <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setActiveContractId(c.id)}>
                            Seleccionar
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-forest-teal)', marginRight: '4px' }}>En Uso</span>
                        )}

                        <button
                          onClick={() => setEditingContract(c)}
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '12px' }}
                          title="Editar Cliente"
                        >
                          <Edit size={14} /> Editar
                        </button>

                        <button
                          onClick={() => handleDeleteContract(c.id)}
                          className="btn"
                          style={{ backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5', padding: '6px 10px', fontSize: '12px' }}
                          title="Eliminar Cliente"
                        >
                          <Trash2 size={14} /> Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab: Branding */}
      {activeSubTab === 'branding' && (
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary-dark)', marginBottom: '16px' }}>
            Personalización de Nombre y Paleta de Colores
          </h3>

          <form className="responsive-form-grid" onSubmit={handleSaveBranding} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Nombre de Tu Empresa (Contratista)</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Sigla / Badge del Logo</label>
              <input
                type="text"
                value={formData.brandBadgeText}
                onChange={e => setFormData({ ...formData, brandBadgeText: e.target.value.toUpperCase() })}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
                maxLength={4}
                required
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Título Superior de la Aplicación</label>
              <input
                type="text"
                value={formData.headerTitle}
                onChange={e => setFormData({ ...formData, headerTitle: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Color Menú Lateral / Sidebar</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={formData.primaryColor}
                  onChange={e => setFormData({ ...formData, primaryColor: e.target.value })}
                  style={{ width: '60px', height: '40px', padding: '2px', cursor: 'pointer', borderRadius: '6px' }}
                />
                <input
                  type="text"
                  value={formData.primaryColor}
                  onChange={e => setFormData({ ...formData, primaryColor: e.target.value })}
                  style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #D2D2D9', fontFamily: 'monospace' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Color Botones de Acción</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={formData.actionColor}
                  onChange={e => setFormData({ ...formData, actionColor: e.target.value })}
                  style={{ width: '60px', height: '40px', padding: '2px', cursor: 'pointer', borderRadius: '6px' }}
                />
                <input
                  type="text"
                  value={formData.actionColor}
                  onChange={e => setFormData({ ...formData, actionColor: e.target.value })}
                  style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #D2D2D9', fontFamily: 'monospace' }}
                />
              </div>
            </div>

            <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
              <button type="submit" className="btn btn-primary">
                <Save size={16} /> Guardar Tema de Colores
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Subtab: Logos */}
      {activeSubTab === 'logos' && (
        <div className="responsive-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: '24px' }}>
          <div className="card" style={{ textAlign: 'center', padding: '28px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary-dark)', marginBottom: '8px' }}>
              1. Logo Empresa Contratista
            </h3>
            <div style={{ width: '120px', height: '120px', margin: '0 auto 20px', borderRadius: '16px', border: '2px dashed var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAFA', overflow: 'hidden' }}>
              {formData.companyLogoUrl ? (
                <img src={formData.companyLogoUrl} alt="Company Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                  <ImageIcon size={32} />
                  <div style={{ fontSize: '10px', marginTop: '4px' }}>Sin Logo</div>
                </div>
              )}
            </div>

            <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
              <Upload size={16} /> Subir Logo Empresa (PNG / SVG)
              <input type="file" accept="image/*" onChange={handleCompanyLogoUpload} style={{ display: 'none' }} />
            </label>
          </div>

          <div className="card" style={{ textAlign: 'center', padding: '28px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary-dark)', marginBottom: '8px' }}>
              2. Logo Mandante Minero ({activeContract ? activeContract.clientName : ''})
            </h3>
            <div style={{ width: '120px', height: '120px', margin: '0 auto 20px', borderRadius: '16px', border: '2px dashed var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAFA', overflow: 'hidden' }}>
              {activeContract && activeContract.clientLogoUrl ? (
                <img src={activeContract.clientLogoUrl} alt="Client Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                  <Building2 size={32} />
                  <div style={{ fontSize: '10px', marginTop: '4px' }}>Sin Logo Cliente</div>
                </div>
              )}
            </div>

            <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
              <Upload size={16} /> Subir Logo Mandante (PNG / SVG)
              <input type="file" accept="image/*" onChange={handleClientLogoUpload} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
      )}

      {/* Subtab: Maintenance */}
      {activeSubTab === 'maintenance' && (
        <div className="card" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <AlertOctagon size={28} style={{ color: '#991B1B' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#991B1B' }}>
              Zona Peligrosa: Vaciado a Lienzo en Blanco
            </h3>
          </div>

          <p style={{ fontSize: '13px', color: '#7F1D1D', marginBottom: '20px', lineHeight: 1.6 }}>
            Esta sección contiene operaciones destructivas protegidas para reiniciar la Base de Datos Local de forma segura.
          </p>

          <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '10px', border: '1px solid #FCA5A5', maxWidth: '520px' }}>
            <label style={{ fontSize: '12px', fontWeight: 800, color: '#991B1B', display: 'block', marginBottom: '8px' }}>
              Escribe la palabra <span style={{ textDecoration: 'underline' }}>REINICIAR</span> para habilitar el vaciado:
            </label>

            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="REINICIAR"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #FCA5A5', fontFamily: 'monospace', fontWeight: 800, color: '#991B1B' }}
              />
              <button
                className="btn"
                onClick={handleExecuteReset}
                disabled={confirmText.trim().toUpperCase() !== 'REINICIAR'}
                style={{
                  backgroundColor: confirmText.trim().toUpperCase() === 'REINICIAR' ? '#991B1B' : '#D2D2D9',
                  color: '#FFFFFF',
                  cursor: confirmText.trim().toUpperCase() === 'REINICIAR' ? 'pointer' : 'not-allowed'
                }}
              >
                <RotateCcw size={16} /> Vaciar BD
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
