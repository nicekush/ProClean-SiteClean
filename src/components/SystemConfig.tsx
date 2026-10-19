import { useEffect } from 'react';
import { usePermissions } from '../security/PermissionContext';
import { AccessManager } from './AccessManager';
import type { PlantArea } from '../types';
import React, { useState } from 'react';
import type { WhiteLabelConfig, ShiftType, ClientContract, ContingencyReasonConfig, UserAccount } from '../types';
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
  AlertOctagon,
  Edit,
  X,
  Users,
} from 'lucide-react';

const subtabPermissions: Record<string, string> = {users:'users.view', contracts:'contracts.manage', branding:'branding.manage', logos:'branding.manage', shifts:'shifts.manage', 'custom-columns':'branding.manage', contingencies:'contingencies.manage', maintenance:'maintenance.reset'};

interface SystemConfigProps {
  plantAreas: PlantArea[];
  onAccessUserSaved: (saved: UserAccount | null, removedId?: string) => void;
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
  onResetBlankSlate: () => void;
}

export const SystemConfig: React.FC<SystemConfigProps> = ({
  plantAreas,
  onAccessUserSaved,
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
  onResetBlankSlate
}) => {
  const { can } = usePermissions();
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'contracts' | 'branding' | 'logos' | 'shifts' | 'custom-columns' | 'contingencies' | 'maintenance'>('users');
  useEffect(() => { if (!can(subtabPermissions[activeSubTab])) { const next = Object.keys(subtabPermissions).find(tab => can(subtabPermissions[tab])); if (next) setActiveSubTab(next as typeof activeSubTab); } }, [activeSubTab, can]);
  const [formData, setFormData] = useState<WhiteLabelConfig>({ ...whiteLabel });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  // Editing States
  const [editingContract, setEditingContract] = useState<ClientContract | null>(null);
  const [editingShift, setEditingShift] = useState<ShiftType | null>(null);
  const [editingContingency, setEditingContingency] = useState<ContingencyReasonConfig | null>(null);

  // Forms
  const [newContract, setNewContract] = useState({ clientName: '', contractNumber: '', siteLocation: '', contractAdminName: '', costCenter: '' });
  const [newShift, setNewShift] = useState({ name: '', code: '', startTime: '08:00', endTime: '20:00', colorHex: '#05A6A6', breakHours: 1 });
  const [newContingency, setNewContingency] = useState({ name: '', code: '', category: 'OPERACIONAL' });

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
        breakHours: Math.max(0, Number(newShift.breakHours) || 0)
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
          Gestión de usuarios y permisos, clientes, marca, turnos y parámetros
        </p>
      </div>

      {/* Configuration Health Widgets */}
      <div className="responsive-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '12px', marginBottom: '24px' }}>
        <div style={{ padding: '12px 16px', borderRadius: '12px', backgroundColor: '#FFF', border: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Users size={20} style={{ color: 'var(--color-action-teal)' }} />
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>USUARIOS</div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--color-primary-dark)' }}>{users.filter(user => user.active).length} Activos</div>
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
          hidden={!can('users.view')} onClick={() => setActiveSubTab('users')}
          style={{ flexShrink: 0 }}
        >
          <Users size={16} /> Usuarios ({users.length})
        </button>

        <button
          className={`btn ${activeSubTab === 'contracts' ? 'btn-primary' : 'btn-secondary'}`}
          hidden={!can('contracts.manage')} onClick={() => setActiveSubTab('contracts')}
          style={{ flexShrink: 0 }}
        >
          <Building2 size={16} /> Clientes ({contracts.length})
        </button>

        <button
          className={`btn ${activeSubTab === 'branding' ? 'btn-primary' : 'btn-secondary'}`}
          hidden={!can('branding.manage')} onClick={() => setActiveSubTab('branding')}
          style={{ flexShrink: 0 }}
        >
          <Palette size={16} /> Tema Visual
        </button>

        <button
          className={`btn ${activeSubTab === 'logos' ? 'btn-primary' : 'btn-secondary'}`}
          hidden={!can('branding.manage')} onClick={() => setActiveSubTab('logos')}
          style={{ flexShrink: 0 }}
        >
          <ImageIcon size={16} /> Upload Logos
        </button>

        <button
          className={`btn ${activeSubTab === 'shifts' ? 'btn-primary' : 'btn-secondary'}`}
          hidden={!can('shifts.manage')} onClick={() => setActiveSubTab('shifts')}
          style={{ flexShrink: 0 }}
        >
          <Clock size={16} /> Turnos ({shifts.length})
        </button>

        <button
          className={`btn ${activeSubTab === 'contingencies' ? 'btn-primary' : 'btn-secondary'}`}
          hidden={!can('contingencies.manage')} onClick={() => setActiveSubTab('contingencies')}
          style={{ flexShrink: 0 }}
        >
          <SlidersHorizontal size={16} /> Contingencias ({contingencies.length})
        </button>

        <button
          className={`btn ${activeSubTab === 'maintenance' ? 'btn-primary' : 'btn-secondary'}`}
          hidden={!can('maintenance.reset')} onClick={() => setActiveSubTab('maintenance')}
          style={activeSubTab === 'maintenance' ? { backgroundColor: '#991B1B', color: '#FFFFFF', flexShrink: 0 } : { color: '#991B1B', flexShrink: 0 }}
        >
          <AlertOctagon size={16} /> Reinicio
        </button>
      </div>

      {activeSubTab === 'users' && can('users.view') && (
        <AccessManager users={users} contracts={contracts} plantAreas={plantAreas} onSaved={onAccessUserSaved} />
      )}

      {/* Subtab: Multi-Contrato */}
      {activeSubTab === 'contracts' && can('contracts.manage') && (
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
      {activeSubTab === 'branding' && can('branding.manage') && (
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
      {activeSubTab === 'logos' && can('branding.manage') && (
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

      {activeSubTab === 'shifts' && can('shifts.manage') && (
        <section className="card"><h3>Turnos operacionales</h3>
          <form className="access-fields" onSubmit={editingShift ? handleUpdateShiftSubmit : handleAddShift}>
            {([{key:'name',label:'Nombre',type:'text'},{key:'code',label:'Código',type:'text'},{key:'startTime',label:'Inicio',type:'time'},{key:'endTime',label:'Término',type:'time'},{key:'breakHours',label:'Colación (horas)',type:'number'},{key:'colorHex',label:'Color',type:'color'}] as const).map(field => <label key={field.key}>{field.label}<input type={field.type} required={field.key !== 'code'} min={field.type === 'number' ? 0 : undefined} step={field.type === 'number' ? 0.5 : undefined} value={(editingShift || newShift)[field.key] ?? ''} onChange={event => { const value = field.type === 'number' ? Number(event.target.value) : event.target.value; if (editingShift) setEditingShift({...editingShift,[field.key]:value}); else setNewShift({...newShift,[field.key]:value}); }} /></label>)}
            <div><button className="btn btn-primary" type="submit">{editingShift ? 'Guardar turno' : 'Crear turno'}</button>{editingShift && <button type="button" className="btn btn-secondary" onClick={() => setEditingShift(null)}>Cancelar</button>}</div>
          </form>
          <div className="grid-table-container"><table className="operational-table"><thead><tr><th>Turno</th><th>Código</th><th>Horario</th><th>Acciones</th></tr></thead><tbody>{shifts.map(shift => <tr key={shift.id}><td>{shift.name}</td><td>{shift.code}</td><td>{shift.startTime} – {shift.endTime}</td><td><button className="btn btn-secondary" onClick={() => setEditingShift(shift)}>Editar</button><button className="btn btn-secondary" onClick={() => handleDeleteShift(shift.id)}>Eliminar</button></td></tr>)}</tbody></table></div>
        </section>
      )}
      {activeSubTab === 'contingencies' && can('contingencies.manage') && (
        <section className="card"><h3>Motivos de contingencia</h3>
          <form className="access-fields" onSubmit={editingContingency ? handleUpdateContingencySubmit : handleAddContingency}>
            {([{key:'name',label:'Motivo'},{key:'code',label:'Código'},{key:'category',label:'Categoría'}] as const).map(field => <label key={field.key}>{field.label}<input required={field.key !== 'code'} value={(editingContingency || newContingency)[field.key]} onChange={event => { if (editingContingency) setEditingContingency({...editingContingency,[field.key]:event.target.value}); else setNewContingency({...newContingency,[field.key]:event.target.value}); }} /></label>)}
            <div><button className="btn btn-primary" type="submit">{editingContingency ? 'Guardar motivo' : 'Crear motivo'}</button>{editingContingency && <button className="btn btn-secondary" type="button" onClick={() => setEditingContingency(null)}>Cancelar</button>}</div>
          </form>
          <div className="grid-table-container"><table className="operational-table"><thead><tr><th>Motivo</th><th>Código</th><th>Categoría</th><th>Acciones</th></tr></thead><tbody>{contingencies.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.code}</td><td>{item.category}</td><td><button className="btn btn-secondary" onClick={() => setEditingContingency(item)}>Editar</button><button className="btn btn-secondary" onClick={() => handleDeleteContingency(item.id)}>Eliminar</button></td></tr>)}</tbody></table></div>
        </section>
      )}

      {/* Subtab: Maintenance */}
      {activeSubTab === 'maintenance' && can('maintenance.reset') && (
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
