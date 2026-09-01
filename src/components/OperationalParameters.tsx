import React, { useState } from 'react';
import type { PlantArea, Sector, SubSector, Machine, Worker, ShiftType, WhiteLabelConfig, CoverageArea, PersonnelMember, CargoConfig } from '../types';
import { 
  Plus, 
  Trash2, 
  MapPin, 
  Truck, 
  Users, 
  CheckCircle, 
  AlertTriangle,
  XCircle,
  Search,
  Edit,
  X,
  Save,
  Layers,
  Grid
} from 'lucide-react';

interface OperationalParametersProps {
  plantAreas: PlantArea[];
  setPlantAreas: React.Dispatch<React.SetStateAction<PlantArea[]>>;
  sectors: Sector[];
  setSectors: React.Dispatch<React.SetStateAction<Sector[]>>;
  subSectors: SubSector[];
  setSubSectors: React.Dispatch<React.SetStateAction<SubSector[]>>;
  machines: Machine[];
  setMachines: React.Dispatch<React.SetStateAction<Machine[]>>;
  workers: Worker[];
  setWorkers: React.Dispatch<React.SetStateAction<Worker[]>>;
  shifts: ShiftType[];
  whiteLabel?: WhiteLabelConfig;
  setWhiteLabel?: (updater: (prev: WhiteLabelConfig) => WhiteLabelConfig) => void;
  coverageAreas?: CoverageArea[];
  setCoverageAreas?: React.Dispatch<React.SetStateAction<CoverageArea[]>>;
  personnel?: PersonnelMember[];
  setPersonnel?: React.Dispatch<React.SetStateAction<PersonnelMember[]>>;
  cargos?: CargoConfig[];
  setCargos?: React.Dispatch<React.SetStateAction<CargoConfig[]>>;
}

export const OperationalParameters: React.FC<OperationalParametersProps> = ({
  plantAreas,
  setPlantAreas,
  sectors,
  setSectors,
  subSectors,
  setSubSectors,
  machines,
  setMachines,
  workers,
  setWorkers,
  whiteLabel,
  setWhiteLabel,
  coverageAreas = [],
  setCoverageAreas,
  personnel = [],
  setPersonnel,
  cargos = [],
  setCargos
}) => {
  const [activeTab, setActiveTab] = useState<'areas' | 'sectors' | 'subsectors' | 'machines' | 'workers' | 'manual_matrix' | 'coverage_config'>('areas');

  // Search Filters
  const [searchMachine, setSearchMachine] = useState('');
  const [searchWorker, setSearchWorker] = useState('');

  // Editing States
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);

  // New Items Forms
  const [newArea, setNewArea] = useState({ name: '', code: '' });
  const [newSector, setNewSector] = useState({ areaId: '', name: '', code: '', description: '' });
  const [newSubSector, setNewSubSector] = useState({ sectorId: '', name: '', code: '' });
  const [newMachine, setNewMachine] = useState<{ name: string; patent: string; type: string; capacity: string; capacityM3?: number }>({ name: '', patent: '', type: '', capacity: '', capacityM3: undefined });
  const [newWorker, setNewWorker] = useState({ name: '', rut: '', role: 'OPERADOR_HIDRO' });

  // Coverage Config Forms & Handlers
  const [newCovArea, setNewCovArea] = useState<{ name: string; code: string; turnoId: 't_dia' | 't_noche' | 't_4x3' }>({ name: '', code: '', turnoId: 't_dia' });
  const [newCargo, setNewCargo] = useState<{ nombre: string; code: string; isRestricted: boolean }>({ nombre: '', code: '', isRestricted: false });
  const [newPersonnel, setNewPersonnel] = useState<{ nombre: string; rut: string; grupo: 'A' | 'B' | 'AMBOS'; tipo: 'PLANTA' | 'SPOT' }>({ nombre: '', rut: '', grupo: 'A', tipo: 'PLANTA' });
  const [searchPersonnelCov, setSearchPersonnelCov] = useState('');

  const [editingCovArea, setEditingCovArea] = useState<CoverageArea | null>(null);
  const [editingCargo, setEditingCargo] = useState<CargoConfig | null>(null);
  const [editingPersonnel, setEditingPersonnel] = useState<PersonnelMember | null>(null);

  // Coverage Areas CRUD
  const handleAddCovArea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCovArea.name || !setCoverageAreas) return;
    const newAreaObj: CoverageArea = {
      id: `cov_a_${Date.now()}`,
      name: newCovArea.name,
      code: newCovArea.code || `AREA-${coverageAreas.length + 1}`,
      turnoId: newCovArea.turnoId,
      orden: coverageAreas.length + 1
    };
    setCoverageAreas([...coverageAreas, newAreaObj]);
    setNewCovArea({ name: '', code: '', turnoId: 't_dia' });
  };

  const handleDeleteCovArea = (id: string) => {
    if (!setCoverageAreas) return;
    if (confirm('¿Deseas eliminar esta ubicación de dotación?')) {
      setCoverageAreas(coverageAreas.filter(ca => ca.id !== id));
    }
  };

  const handleUpdateCovArea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCovArea || !setCoverageAreas) return;
    setCoverageAreas(coverageAreas.map(ca => ca.id === editingCovArea.id ? editingCovArea : ca));
    setEditingCovArea(null);
  };

  // Cargos CRUD
  const handleAddCargo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCargo.nombre || !setCargos) return;
    const newCargoObj: CargoConfig = {
      id: `c_${Date.now()}`,
      nombre: newCargo.nombre,
      code: newCargo.code || 'CARGO',
      restrictedAreaIds: newCargo.isRestricted ? ['a_personal_4x3'] : undefined
    };
    setCargos([...cargos, newCargoObj]);
    setNewCargo({ nombre: '', code: '', isRestricted: false });
  };

  const handleDeleteCargo = (id: string) => {
    if (!setCargos) return;
    if (confirm('¿Deseas eliminar este cargo de la matriz de dotación?')) {
      setCargos(cargos.filter(c => c.id !== id));
    }
  };

  const handleUpdateCargo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCargo || !setCargos) return;
    setCargos(cargos.map(c => c.id === editingCargo.id ? editingCargo : c));
    setEditingCargo(null);
  };

  // Personnel Roster CRUD
  const handleAddPersonnel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonnel.nombre || !setPersonnel) return;
    const newMember: PersonnelMember = {
      id: `p_${Date.now()}`,
      nombre: newPersonnel.nombre.toUpperCase(),
      rut: newPersonnel.rut || '15.482.910-K',
      grupo: newPersonnel.grupo,
      tipo: newPersonnel.tipo,
      estado: 'Activo'
    };
    setPersonnel([...personnel, newMember]);
    setNewPersonnel({ nombre: '', rut: '', grupo: 'A', tipo: 'PLANTA' });
  };

  const handleDeletePersonnel = (id: string) => {
    if (!setPersonnel) return;
    if (confirm('¿Deseas eliminar a este colaborador de la nómina oficial?')) {
      setPersonnel(personnel.filter(p => p.id !== id));
    }
  };

  const handleUpdatePersonnel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPersonnel || !setPersonnel) return;
    setPersonnel(personnel.map(p => p.id === editingPersonnel.id ? editingPersonnel : p));
    setEditingPersonnel(null);
  };

  // Plant Areas CRUD
  const handleAddArea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newArea.name) return;
    setPlantAreas([
      ...plantAreas,
      {
        id: `pa-${Date.now()}`,
        name: newArea.name,
        code: newArea.code || `AREA-${plantAreas.length + 1}`
      }
    ]);
    setNewArea({ name: '', code: '' });
  };

  const handleDeleteArea = (id: string) => {
    if (confirm('¿Deseas eliminar esta área de planta? Se eliminará la categoría para los sectores vinculados.')) {
      setPlantAreas(plantAreas.filter(a => a.id !== id));
    }
  };

  // Sectors CRUD
  const handleAddSector = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSector.name || !newSector.areaId) return;
    const linkedArea = plantAreas.find(a => a.id === newSector.areaId);

    setSectors([
      ...sectors,
      {
        id: `sec-${Date.now()}`,
        areaId: newSector.areaId,
        areaName: linkedArea ? linkedArea.name : 'General',
        name: newSector.name,
        code: newSector.code || `SEC-${sectors.length + 1}`,
        description: newSector.description
      }
    ]);
    setNewSector({ areaId: '', name: '', code: '', description: '' });
  };

  const handleDeleteSector = (id: string) => {
    if (confirm('¿Deseas eliminar este sector operativo?')) {
      setSectors(sectors.filter(s => s.id !== id));
    }
  };

  // Sub-Sectors CRUD
  const handleAddSubSector = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubSector.name || !newSubSector.sectorId) return;
    const linkedSector = sectors.find(s => s.id === newSubSector.sectorId);

    setSubSectors([
      ...subSectors,
      {
        id: `sub-${Date.now()}`,
        sectorId: newSubSector.sectorId,
        sectorName: linkedSector ? linkedSector.name : 'Sector',
        name: newSubSector.name,
        code: newSubSector.code || `SUB-${subSectors.length + 1}`
      }
    ]);
    setNewSubSector({ sectorId: '', name: '', code: '' });
  };

  const handleDeleteSubSector = (id: string) => {
    if (confirm('¿Deseas eliminar este sub-sector / equipo?')) {
      setSubSectors(subSectors.filter(s => s.id !== id));
    }
  };

  // Machines CRUD
  const handleAddMachine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMachine.name || !newMachine.patent) return;
    const capValue = newMachine.capacityM3 !== undefined && !isNaN(newMachine.capacityM3) ? Number(newMachine.capacityM3) : 0;
    setMachines([
      ...machines,
      {
        id: Date.now().toString(),
        name: newMachine.name,
        patent: newMachine.patent,
        type: newMachine.type || 'Equipos',
        capacity: capValue > 0 ? `${capValue} m³` : 'N/A',
        capacityM3: capValue,
        status: 'DISPONIBLE'
      }
    ]);
    setNewMachine({ name: '', patent: '', type: '', capacity: '', capacityM3: undefined });
  };

  const toggleMachineStatus = (id: string) => {
    setMachines(machines.map(m => {
      if (m.id === id) {
        const nextStatus: Machine['status'] = 
          m.status === 'DISPONIBLE' ? 'MANTENCION' :
          m.status === 'MANTENCION' ? 'FUERA_SERVICIO' : 'DISPONIBLE';
        return { ...m, status: nextStatus };
      }
      return m;
    }));
  };

  const handleUpdateMachineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMachine) return;
    const capValue = Number(editingMachine.capacityM3) || 0.45;
    setMachines(machines.map(m => m.id === editingMachine.id ? {
      ...editingMachine,
      capacityM3: capValue,
      capacity: `${capValue} m³`
    } : m));
    setEditingMachine(null);
  };

  const handleDeleteMachine = (id: string) => {
    if (confirm('¿Deseas eliminar este vehículo de la flota?')) {
      setMachines(machines.filter(m => m.id !== id));
    }
  };

  // Workers CRUD
  const handleAddWorker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorker.name) return;
    setWorkers([
      ...workers,
      {
        id: Date.now().toString(),
        name: newWorker.name,
        rut: newWorker.rut || '15.482.910-K',
        role: newWorker.role,
        active: true
      }
    ]);
    setNewWorker({ name: '', rut: '', role: 'OPERADOR_HIDRO' });
  };

  const handleDeleteWorker = (id: string) => {
    if (confirm('¿Deseas desvincular a este operario de la nómina?')) {
      setWorkers(workers.filter(w => w.id !== id));
    }
  };

  const filteredMachines = (machines || []).filter(m => 
    m.name.toLowerCase().includes(searchMachine.toLowerCase()) ||
    m.patent.toLowerCase().includes(searchMachine.toLowerCase()) ||
    (m.type && m.type.toLowerCase().includes(searchMachine.toLowerCase()))
  );

  const filteredWorkers = (workers || []).filter(w => 
    w.name.toLowerCase().includes(searchWorker.toLowerCase()) ||
    (w.rut && w.rut.toLowerCase().includes(searchWorker.toLowerCase())) ||
    w.role.toLowerCase().includes(searchWorker.toLowerCase())
  );

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ color: 'var(--color-primary-dark)', fontSize: '22px', fontWeight: 800 }}>
          ⚙️ Parametrización de Jerarquía de Planta, Flota y Nómina
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
          Configuración en 3 Niveles: Áreas de Planta ➔ Sectores ➔ Sub-Sectores / Equipos
        </p>
      </div>

      {/* Subtabs Navigation Bar */}
      <div className="scrollable-tabs" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '24px', flexWrap: 'nowrap' }}>
        <button
          className={`btn ${activeTab === 'areas' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('areas')}
          style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          <Layers size={16} /> 1. Áreas ({plantAreas.length})
        </button>

        <button
          className={`btn ${activeTab === 'sectors' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('sectors')}
          style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          <MapPin size={16} /> 2. Sectores ({sectors.length})
        </button>

        <button
          className={`btn ${activeTab === 'subsectors' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('subsectors')}
          style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          <Grid size={16} /> 3. Sub-Sectores ({subSectors.length})
        </button>

        <button
          className={`btn ${activeTab === 'machines' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('machines')}
          style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          <Truck size={16} /> Flota Maquinaria ({machines.length})
        </button>

        <button
          className={`btn ${activeTab === 'workers' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('workers')}
          style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          <Users size={16} /> Nómina Personal ({workers.length})
        </button>

        <button
          className={`btn ${activeTab === 'manual_matrix' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('manual_matrix')}
          style={{ 
            flexShrink: 0, 
            whiteSpace: 'nowrap',
            backgroundColor: activeTab === 'manual_matrix' ? 'var(--orange)' : 'transparent', 
            color: activeTab === 'manual_matrix' ? '#FFF' : 'var(--slate-600)',
            fontWeight: 900
          }}
        >
          🧹 Rendimiento Manual
        </button>

        <button
          className={`btn ${activeTab === 'coverage_config' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('coverage_config')}
          style={{ 
            flexShrink: 0, 
            whiteSpace: 'nowrap',
            backgroundColor: activeTab === 'coverage_config' ? 'var(--orange)' : 'transparent', 
            color: activeTab === 'coverage_config' ? '#FFF' : 'var(--slate-600)',
            fontWeight: 900
          }}
        >
          👥 Configuración de Dotación
        </button>
      </div>

      {/* TAB 1: PLANT AREAS */}
      {activeTab === 'areas' && (
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary-dark)', marginBottom: '16px' }}>
            Nivel 1: Configuración de Áreas Principales de la Planta Minera
          </h3>

          <form onSubmit={handleAddArea} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            <input
              type="text"
              placeholder="Nombre del Área (Ej: Chancador Terciario)"
              value={newArea.name}
              onChange={e => setNewArea({ ...newArea, name: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
              required
            />
            <input
              type="text"
              placeholder="Código Abreviado (Ej: CH-TERC)"
              value={newArea.code}
              onChange={e => setNewArea({ ...newArea, code: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
            />
            <button type="submit" className="btn btn-primary">
              <Plus size={16} /> Crear Área de Planta
            </button>
          </form>

          <div className="grid-table-container">
            <table className="operational-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Área de Planta</th>
                  <th>Sectores Asociados</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {plantAreas.map(area => {
                  const areaSectors = sectors.filter(s => s.areaId === area.id);
                  return (
                    <tr key={area.id}>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 800, backgroundColor: '#F1F5F9', padding: '4px 8px', borderRadius: '4px' }}>{area.code}</span></td>
                      <td style={{ fontWeight: 800, fontSize: '14px', color: 'var(--color-primary-dark)' }}>{area.name}</td>
                      <td>
                        <span className="pill pill-complete">
                          {areaSectors.length} sector(es) vinculado(s)
                        </span>
                      </td>
                      <td>
                        <button onClick={() => handleDeleteArea(area.id)} className="btn" style={{ backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5', padding: '4px 8px', fontSize: '11px' }}>
                          <Trash2 size={14} /> Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SECTORS */}
      {activeTab === 'sectors' && (
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary-dark)', marginBottom: '16px' }}>
            Nivel 2: Configuración de Sectores Vincualdos a un Área
          </h3>

          <form onSubmit={handleAddSector} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            <select
              value={newSector.areaId}
              onChange={e => setNewSector({ ...newSector, areaId: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D2D2D9', fontWeight: 700 }}
              required
            >
              <option value="">Selecciona Área de Planta Perteneciente...</option>
              {plantAreas.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Nombre del Sector (Ej: Edificio de Harneros)"
              value={newSector.name}
              onChange={e => setNewSector({ ...newSector, name: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
              required
            />

            <input
              type="text"
              placeholder="Código Sector (Ej: SEC-HAR)"
              value={newSector.code}
              onChange={e => setNewSector({ ...newSector, code: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
            />

            <button type="submit" className="btn btn-primary">
              <Plus size={16} /> Crear Sector
            </button>
          </form>

          <div className="grid-table-container">
            <table className="operational-table">
              <thead>
                <tr>
                  <th>Área Perteneciente</th>
                  <th>Código</th>
                  <th>Nombre del Sector</th>
                  <th>Sub-Sectores Vincualdos</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sectors.map(sector => {
                  const linkedArea = plantAreas.find(a => a.id === sector.areaId);
                  const sectorSubSectors = subSectors.filter(sub => sub.sectorId === sector.id);
                  return (
                    <tr key={sector.id}>
                      <td>
                        <span className="pill pill-complete" style={{ backgroundColor: '#E0F2FE', color: '#0369A1', border: '1px solid #7DD3FC' }}>
                          {linkedArea ? linkedArea.name : sector.areaName || 'General'}
                        </span>
                      </td>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 800, backgroundColor: '#F1F5F9', padding: '4px 8px', borderRadius: '4px' }}>{sector.code}</span></td>
                      <td style={{ fontWeight: 800, color: 'var(--color-primary-dark)' }}>{sector.name}</td>
                      <td>
                        <span className="pill pill-complete">
                          {sectorSubSectors.length} sub-sector(es)
                        </span>
                      </td>
                      <td>
                        <button onClick={() => handleDeleteSector(sector.id)} className="btn" style={{ backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5', padding: '4px 8px', fontSize: '11px' }}>
                          <Trash2 size={14} /> Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SUB-SECTORS / EQUIPOS */}
      {activeTab === 'subsectors' && (
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary-dark)', marginBottom: '16px' }}>
            Nivel 3: Sub-Sectores / Equipos Vincualdos a un Sector
          </h3>

          <form onSubmit={handleAddSubSector} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            <select
              value={newSubSector.sectorId}
              onChange={e => setNewSubSector({ ...newSubSector, sectorId: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D2D2D9', fontWeight: 700 }}
              required
            >
              <option value="">Selecciona Sector Perteneciente...</option>
              {sectors.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Nombre Sub-Sector / Equipo (Ej: Correa 002-CV-001)"
              value={newSubSector.name}
              onChange={e => setNewSubSector({ ...newSubSector, name: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
              required
            />

            <input
              type="text"
              placeholder="Código SAP / Identificador (Ej: CV-001)"
              value={newSubSector.code}
              onChange={e => setNewSubSector({ ...newSubSector, code: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
            />

            <button type="submit" className="btn btn-primary">
              <Plus size={16} /> Crear Sub-Sector
            </button>
          </form>

          <div className="grid-table-container">
            <table className="operational-table">
              <thead>
                <tr>
                  <th>Sector Perteneciente</th>
                  <th>Código</th>
                  <th>Sub-Sector / Equipo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {subSectors.map(sub => {
                  const linkedSector = sectors.find(s => s.id === sub.sectorId);
                  return (
                    <tr key={sub.id}>
                      <td>
                        <span className="pill pill-complete">
                          {linkedSector ? linkedSector.name : sub.sectorName || 'Sector'}
                        </span>
                      </td>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 800, backgroundColor: '#F1F5F9', padding: '4px 8px', borderRadius: '4px' }}>{sub.code}</span></td>
                      <td style={{ fontWeight: 800, color: 'var(--color-forest-teal)' }}>{sub.name}</td>
                      <td>
                        <button onClick={() => handleDeleteSubSector(sub.id)} className="btn" style={{ backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5', padding: '4px 8px', fontSize: '11px' }}>
                          <Trash2 size={14} /> Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: MACHINES */}
      {activeTab === 'machines' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
              Flota de Maquinaria y Equipos de Aseo Industrial
            </h3>

            {/* Quick Search */}
            <div style={{ position: 'relative', width: '260px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Buscar patente, nombre..."
                value={searchMachine}
                onChange={e => setSearchMachine(e.target.value)}
                style={{ width: '100%', padding: '6px 10px 6px 30px', borderRadius: '6px', border: '1px solid #D2D2D9', fontSize: '12px' }}
              />
            </div>
          </div>

          {/* Edit Machine Modal */}
          {editingMachine && (
            <div style={{ backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '2px solid var(--color-action-teal)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-action-teal)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Edit size={16} /> Editar Datos del Vehículo
                </h4>
                <button onClick={() => setEditingMachine(null)} className="btn btn-secondary" style={{ padding: '2px 6px' }}><X size={14} /></button>
              </div>

              <form onSubmit={handleUpdateMachineSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Nombre / Modelo</label>
                  <input
                    type="text"
                    value={editingMachine.name}
                    onChange={e => setEditingMachine({ ...editingMachine, name: e.target.value })}
                    style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Patente / Matrícula</label>
                  <input
                    type="text"
                    value={editingMachine.patent}
                    onChange={e => setEditingMachine({ ...editingMachine, patent: e.target.value })}
                    style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Tipo de Equipo</label>
                  <input
                    type="text"
                    value={editingMachine.type || 'Hidrolavadora'}
                    onChange={e => setEditingMachine({ ...editingMachine, type: e.target.value })}
                    style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Capacidad Balde/Tanque ($m^3$)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={editingMachine.capacityM3 || 0}
                    onChange={e => setEditingMachine({ ...editingMachine, capacityM3: Number(e.target.value) })}
                    style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #D2D2D9', fontWeight: 800 }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditingMachine(null)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary"><Save size={14} /> Actualizar Vehículo</button>
                </div>
              </form>
            </div>
          )}

          {/* New Machine Form */}
          <form onSubmit={handleAddMachine} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            <input
              type="text"
              placeholder="Nombre del Vehículo (Ej: Mini Cargador Bobcat S650)"
              value={newMachine.name}
              onChange={e => setNewMachine({ ...newMachine, name: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
              required
            />
            <input
              type="text"
              placeholder="Patente (Ej: BC-88-12)"
              value={newMachine.patent}
              onChange={e => setNewMachine({ ...newMachine, patent: e.target.value.toUpperCase() })}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
              required
            />
            <input
              type="number"
              step="0.05"
              min="0"
              placeholder="Capacidad m³ por Vuelta (Ej: 7.5)"
              value={newMachine.capacityM3 ?? ''}
              onChange={e => setNewMachine({ ...newMachine, capacityM3: e.target.value === '' ? undefined : Number(e.target.value) })}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D2D2D9', fontWeight: 800 }}
            />
            <button type="submit" className="btn btn-primary">
              <Plus size={16} /> Registrar Vehículo
            </button>
          </form>

          <div className="grid-table-container">
            <table className="operational-table">
              <thead>
                <tr>
                  <th>Vehículo / Equipo</th>
                  <th>Patente</th>
                  <th>Capacidad m³ por Vuelta</th>
                  <th>Estado Operativo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredMachines.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 800, color: 'var(--color-primary-dark)' }}>{m.name}</td>
                    <td><span className="sap-code-badge">{m.patent}</span></td>
                    <td style={{ fontWeight: 900, color: 'var(--orange)' }}>
                      {m.capacityM3 ? `${m.capacityM3} m³ / vuelta` : '-'}
                    </td>
                    <td>
                      <button 
                        onClick={() => toggleMachineStatus(m.id)}
                        className="btn"
                        style={{
                          padding: '4px 10px',
                          fontSize: '11px',
                          backgroundColor: m.status === 'DISPONIBLE' ? '#ECFDF5' : m.status === 'MANTENCION' ? '#FEF3C7' : '#FEF2F2',
                          color: m.status === 'DISPONIBLE' ? '#047857' : m.status === 'MANTENCION' ? '#92400E' : '#991B1B',
                          border: `1px solid ${m.status === 'DISPONIBLE' ? '#6EE7B7' : m.status === 'MANTENCION' ? '#FCD34D' : '#FCA5A5'}`
                        }}
                      >
                        {m.status === 'DISPONIBLE' ? <CheckCircle size={12} /> : m.status === 'MANTENCION' ? <AlertTriangle size={12} /> : <XCircle size={12} />}
                        {m.status === 'MANTENCION' ? 'EN MANTENCIÓN' : m.status === 'FUERA_SERVICIO' ? 'FUERA DE SERVICIO' : m.status} (Cambiar)
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => setEditingMachine(m)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }}>
                          <Edit size={14} /> Editar
                        </button>
                        <button onClick={() => handleDeleteMachine(m.id)} className="btn" style={{ backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5', padding: '4px 8px', fontSize: '11px' }}>
                          <Trash2 size={14} /> Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* EXPLANATORY SYNCHRONIZATION BANNER */}
          <div style={{ marginTop: '20px', backgroundColor: '#F0F9FF', borderRadius: '12px', border: '1px solid #7DD3FC', padding: '14px', fontSize: '12px', color: '#0369A1', display: 'flex', alignItems: 'center', gap: '8px' }}>
            💡 <strong>Sincronización en OT:</strong> Cada vehículo registrado tiene su propia capacidad por vuelta (m³). Al seleccionar cualquiera de estos vehículos en la creación o edición de una OT e ingresar las vueltas reales ejecutadas en terreno, el sistema calculará automáticamente el volumen removido multiplicando <strong>(Vueltas reales × m³ por Vuelta del Vehículo)</strong>.
          </div>
        </div>
      )}

      {/* TAB 5: WORKERS */}
      {activeTab === 'workers' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
              Nómina de Personal y Operadores de Cuadrilla
            </h3>

            {/* Quick Search */}
            <div style={{ position: 'relative', width: '260px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Buscar operario por RUT o Nombre..."
                value={searchWorker}
                onChange={e => setSearchWorker(e.target.value)}
                style={{ width: '100%', padding: '6px 10px 6px 30px', borderRadius: '6px', border: '1px solid #D2D2D9', fontSize: '12px' }}
              />
            </div>
          </div>

          <form onSubmit={handleAddWorker} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            <input
              type="text"
              placeholder="Nombre Completo (Ej: Manuel Torres)"
              value={newWorker.name}
              onChange={e => setNewWorker({ ...newWorker, name: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
              required
            />
            <input
              type="text"
              placeholder="RUT / DNI (Ej: 15.482.910-K)"
              value={newWorker.rut}
              onChange={e => setNewWorker({ ...newWorker, rut: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
            />
            <select
              value={newWorker.role}
              onChange={e => setNewWorker({ ...newWorker, role: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D2D2D9' }}
            >
              <option value="OPERADOR_HIDRO">Operador Hidrolavadora</option>
              <option value="CONDUCTOR_ALJIBE">Conductor Camión Aljibe</option>
              <option value="SUPERVISOR_LINEA">Supervisor de Línea</option>
            </select>
            <button type="submit" className="btn btn-primary">
              <Plus size={16} /> Agregar a Nómina
            </button>
          </form>

          <div className="grid-table-container">
            <table className="operational-table">
              <thead>
                <tr>
                  <th>Nombre Operario</th>
                  <th>RUT / DNI</th>
                  <th>Cargo / Especialidad</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkers.map(w => (
                  <tr key={w.id}>
                    <td style={{ fontWeight: 800, color: 'var(--color-primary-dark)' }}>{w.name}</td>
                    <td style={{ fontFamily: 'monospace' }}>{w.rut || '15.482.910-K'}</td>
                    <td><span className="pill pill-complete">{w.role}</span></td>
                    <td><span className="pill pill-complete">ACTIVO</span></td>
                    <td>
                      <button onClick={() => handleDeleteWorker(w.id)} className="btn" style={{ backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5', padding: '4px 8px', fontSize: '11px' }}>
                        <Trash2 size={14} /> Desvincular
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: MANUAL LABOR & WHEELBARROW MATRIX CONFIG */}
      {activeTab === 'manual_matrix' && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--slate-900)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🧹 Matriz de Rendimiento Aseo Manual & Carretillas
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--slate-600)', marginBottom: '20px' }}>
            Parametriza la matriz física para calcular automáticamente los metros cúbicos (m³) removidos por persona/hora en terreno según la capacidad de carretillas.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            
            <div>
              <label style={{ fontSize: '12px', fontWeight: 900, color: 'var(--slate-800)', display: 'block', marginBottom: '6px' }}>
                🛒 Carretillas x Día (por Persona)
              </label>
              <input
                type="number"
                min="1"
                value={whiteLabel?.manualLaborConfig?.wheelbarrowsPerDay ?? 60}
                onChange={e => {
                  const val = Number(e.target.value);
                  if (setWhiteLabel) {
                    setWhiteLabel(prev => ({
                      ...prev,
                      manualLaborConfig: {
                        wheelbarrowsPerDay: val,
                        effectiveHoursPerDay: prev.manualLaborConfig?.effectiveHoursPerDay ?? 6,
                        wheelbarrowCapacityM3: prev.manualLaborConfig?.wheelbarrowCapacityM3 ?? 0.08
                      }
                    }));
                  }
                }}
                style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--slate-300)', fontWeight: 800 }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 900, color: 'var(--slate-800)', display: 'block', marginBottom: '6px' }}>
                ⏱️ Horas Efectivas de Turno
              </label>
              <input
                type="number"
                min="1"
                value={whiteLabel?.manualLaborConfig?.effectiveHoursPerDay ?? 6}
                onChange={e => {
                  const val = Number(e.target.value);
                  if (setWhiteLabel) {
                    setWhiteLabel(prev => ({
                      ...prev,
                      manualLaborConfig: {
                        wheelbarrowsPerDay: prev.manualLaborConfig?.wheelbarrowsPerDay ?? 60,
                        effectiveHoursPerDay: val,
                        wheelbarrowCapacityM3: prev.manualLaborConfig?.wheelbarrowCapacityM3 ?? 0.08
                      }
                    }));
                  }
                }}
                style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--slate-300)', fontWeight: 800 }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 900, color: 'var(--slate-800)', display: 'block', marginBottom: '6px' }}>
                📦 m³ x Carretilla (Capacidad)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={whiteLabel?.manualLaborConfig?.wheelbarrowCapacityM3 ?? 0.08}
                onChange={e => {
                  const val = Number(e.target.value);
                  if (setWhiteLabel) {
                    setWhiteLabel(prev => ({
                      ...prev,
                      manualLaborConfig: {
                        wheelbarrowsPerDay: prev.manualLaborConfig?.wheelbarrowsPerDay ?? 60,
                        effectiveHoursPerDay: prev.manualLaborConfig?.effectiveHoursPerDay ?? 6,
                        wheelbarrowCapacityM3: val
                      }
                    }));
                  }
                }}
                style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--slate-300)', fontWeight: 800 }}
              />
            </div>

          </div>

          {/* LIVE COMPUTED SUMMARY TABLE (EXACT MATCH FOR USER SPECS) */}
          {(() => {
            const wPerDay = whiteLabel?.manualLaborConfig?.wheelbarrowsPerDay ?? 60;
            const hEff = whiteLabel?.manualLaborConfig?.effectiveHoursPerDay ?? 6;
            const capM3 = whiteLabel?.manualLaborConfig?.wheelbarrowCapacityM3 ?? 0.08;
            const wPerHour = hEff > 0 ? wPerDay / hEff : 10;
            const m3PerHour = wPerHour * capM3;

            return (
              <div style={{ backgroundColor: '#F8FAFC', borderRadius: '16px', border: '2px solid var(--orange)', padding: '20px', overflow: 'hidden' }}>
                <span style={{ fontSize: '11px', fontWeight: 900, color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '12px' }}>
                  📊 Matriz Operativa de Rendimiento Calculado (Empírico)
                </span>

                <div style={{ overflowX: 'auto', width: '100%', borderRadius: '12px' }}>
                  <table className="operational-table" style={{ width: '100%', backgroundColor: '#FFFFFF', minWidth: '600px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--slate-900)', color: '#FFFFFF' }}>
                        <th style={{ padding: '12px' }}>Modalidad</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>Carretillas x Día</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>Horas Efectivas</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>m³ x Carretilla</th>
                        <th style={{ padding: '12px', textAlign: 'center', color: '#FDBA74' }}>⚡ Carretillas por Hora</th>
                        <th style={{ padding: '12px', textAlign: 'center', color: '#FDBA74' }}>📦 m³ x Hora (por Persona)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 900, color: 'var(--slate-900)', padding: '14px' }}>👷 Manuales</td>
                        <td style={{ textAlign: 'center', fontWeight: 800 }}>{wPerDay}</td>
                        <td style={{ textAlign: 'center', fontWeight: 800 }}>{hEff} hrs</td>
                        <td style={{ textAlign: 'center', fontWeight: 800 }}>{capM3} m³</td>
                        <td style={{ textAlign: 'center', fontWeight: 900, color: 'var(--orange)', fontSize: '15px' }}>
                          {wPerHour.toFixed(1)} carr/h
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 900, color: 'var(--orange)', fontSize: '16px' }}>
                          {m3PerHour.toFixed(2)} m³/h
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: '14px', fontSize: '12px', color: 'var(--slate-600)', fontStyle: 'italic' }}>
                  💡 <strong>Ejemplo en OT:</strong> Una cuadrilla de 2 personas trabajando 6 horas efectivas (12 HH) generará automáticamente <strong>{(12 * wPerHour).toFixed(0)} carretillas ({(12 * m3PerHour).toFixed(1)} m³)</strong>.
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 7: COVERAGE CONFIG (FULL PARAMETRIC CRUD MANAGER) */}
      {activeTab === 'coverage_config' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--slate-900)', margin: '0 0 4px 0' }}>
              👥 Matriz Paramétrica de Dotación & Cobertura
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--slate-600)', margin: 0 }}>
              Crea, edita y elimina Ubicaciones de Dotación, Cargos Operacionales y la Nómina Oficial de Colaboradores de forma 100% independiente de las OTs.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
            
            {/* PANEL 1: UBICACIONES DE DOTACION (AREAS) */}
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ borderBottom: '2px solid #E2E8F0', paddingBottom: '12px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: 900, color: 'var(--slate-900)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={18} color="var(--orange)" /> 1. Ubicaciones de Dotación ({coverageAreas.length})
                </h4>
                <span style={{ fontSize: '11px', color: 'var(--slate-500)' }}>Áreas configuradas para la dotación de terreno</span>
              </div>

              {/* Form Agregar Ubicacion */}
              <form onSubmit={handleAddCovArea} style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--slate-700)' }}>➕ Nueva Ubicación</div>
                <input 
                  type="text" 
                  placeholder="Nombre Ubicación (ej: Chancado Primario)"
                  className="input-field"
                  value={newCovArea.name}
                  onChange={e => setNewCovArea({ ...newCovArea, name: e.target.value })}
                  style={{ fontSize: '12px', padding: '8px 10px' }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    placeholder="Código (ej: CH-PRIM)"
                    className="input-field"
                    value={newCovArea.code}
                    onChange={e => setNewCovArea({ ...newCovArea, code: e.target.value })}
                    style={{ fontSize: '12px', padding: '8px 10px', flex: 1 }}
                  />
                  <select
                    className="input-field"
                    value={newCovArea.turnoId}
                    onChange={e => setNewCovArea({ ...newCovArea, turnoId: e.target.value as any })}
                    style={{ fontSize: '12px', padding: '8px 10px', flex: 1 }}
                  >
                    <option value="t_ambos">🔄 Ambos Turnos (Día/Noche)</option>
                    <option value="t_dia">☀️ Solo Turno Día</option>
                    <option value="t_noche">🌙 Solo Turno Noche</option>
                    <option value="t_4x3">👔 Staff 4x3</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px', marginTop: '4px' }}>
                  <Plus size={14} /> Guardar Ubicación
                </button>
              </form>

              {/* List of Coverage Areas with Edit/Delete */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
                {coverageAreas.map(ca => (
                  <div key={ca.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#FFF', borderRadius: '10px', border: '1px solid #CBD5E1' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--slate-900)' }}>{ca.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--slate-500)', display: 'flex', gap: '6px', marginTop: '2px' }}>
                        <span>Código: <strong>{ca.code}</strong></span>
                        <span>•</span>
                        <span style={{ color: ca.turnoId === 't_ambos' ? '#047857' : ca.turnoId === 't_dia' ? '#15803D' : ca.turnoId === 't_noche' ? '#0284C7' : '#B45309', fontWeight: 800 }}>
                          {ca.turnoId === 't_ambos' ? '🔄 Ambos Turnos (Día/Noche)' : ca.turnoId === 't_dia' ? '☀️ Día' : ca.turnoId === 't_noche' ? '🌙 Noche' : '👔 Staff 4x3'}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button 
                        onClick={() => setEditingCovArea(ca)}
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', color: 'var(--color-primary-dark)', border: '1px solid var(--color-border-light)' }}
                        title="Editar Ubicación"
                      >
                        <Edit size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteCovArea(ca.id)}
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', color: '#DC2626', border: '1px solid #FCA5A5' }}
                        title="Eliminar Ubicación"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* PANEL 2: CARGOS OPERACIONALES */}
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ borderBottom: '2px solid #E2E8F0', paddingBottom: '12px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: 900, color: 'var(--slate-900)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={18} color="var(--orange)" /> 2. Cargos Operacionales ({cargos.length})
                </h4>
                <span style={{ fontSize: '11px', color: 'var(--slate-500)' }}>Cargos catalogados con restricciones opcionales</span>
              </div>

              {/* Form Agregar Cargo */}
              <form onSubmit={handleAddCargo} style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--slate-700)' }}>➕ Nuevo Cargo</div>
                <input 
                  type="text" 
                  placeholder="Nombre del Cargo (ej: Supervisor)"
                  className="input-field"
                  value={newCargo.nombre}
                  onChange={e => setNewCargo({ ...newCargo, nombre: e.target.value })}
                  style={{ fontSize: '12px', padding: '8px 10px' }}
                />
                <input 
                  type="text" 
                  placeholder="Código corto (ej: SUP)"
                  className="input-field"
                  value={newCargo.code}
                  onChange={e => setNewCargo({ ...newCargo, code: e.target.value })}
                  style={{ fontSize: '12px', padding: '8px 10px' }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 700, color: 'var(--slate-700)', cursor: 'pointer' }}>
                  <input 
                    type="checkbox"
                    checked={newCargo.isRestricted}
                    onChange={e => setNewCargo({ ...newCargo, isRestricted: e.target.checked })}
                  />
                  🔒 Restringido solo a Staff 4x3 (Planificador, SSO, etc.)
                </label>
                <button type="submit" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px', marginTop: '4px' }}>
                  <Plus size={14} /> Guardar Cargo
                </button>
              </form>

              {/* List of Cargos with Edit/Delete */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
                {cargos.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#FFF', borderRadius: '10px', border: '1px solid #CBD5E1' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--slate-900)' }}>{c.nombre}</div>
                      <div style={{ fontSize: '11px', color: 'var(--slate-500)', marginTop: '2px' }}>
                        {c.restrictedAreaIds?.length ? (
                          <span style={{ color: '#C2410C', fontWeight: 800 }}>🔒 Exclusivo Ubicación Staff 4x3</span>
                        ) : (
                          <span>Disponible para todas las Ubicaciones</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button 
                        onClick={() => setEditingCargo(c)}
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', color: 'var(--color-primary-dark)', border: '1px solid var(--color-border-light)' }}
                        title="Editar Cargo"
                      >
                        <Edit size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteCargo(c.id)}
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', color: '#DC2626', border: '1px solid #FCA5A5' }}
                        title="Eliminar Cargo"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* PANEL 3: NOMINA DE COLABORADORES */}
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ borderBottom: '2px solid #E2E8F0', paddingBottom: '12px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: 900, color: 'var(--slate-900)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={18} color="var(--orange)" /> 3. Nómina Oficial ({personnel.length})
                </h4>
                <span style={{ fontSize: '11px', color: 'var(--slate-500)' }}>Colaboradores del Turno A y Turno B</span>
              </div>

              {/* Form Agregar Colaborador */}
              <form onSubmit={handleAddPersonnel} style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--slate-700)' }}>➕ Agregar Nuevo Colaborador</div>
                <input 
                  type="text" 
                  placeholder="Nombre Completo (ej: SEBASTIÁN CORTÉS)"
                  className="input-field"
                  value={newPersonnel.nombre}
                  onChange={e => setNewPersonnel({ ...newPersonnel, nombre: e.target.value })}
                  style={{ fontSize: '12px', padding: '8px 10px' }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    placeholder="RUT (opcional)"
                    className="input-field"
                    value={newPersonnel.rut}
                    onChange={e => setNewPersonnel({ ...newPersonnel, rut: e.target.value })}
                    style={{ fontSize: '12px', padding: '8px 10px', flex: 1 }}
                  />
                  <select
                    className="input-field"
                    value={newPersonnel.grupo}
                    onChange={e => setNewPersonnel({ ...newPersonnel, grupo: e.target.value as any })}
                    style={{ fontSize: '12px', padding: '8px 10px', flex: 1 }}
                  >
                    <option value="A">Turno A</option>
                    <option value="B">Turno B</option>
                    <option value="AMBOS">Ambos Turnos</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px', marginTop: '4px' }}>
                  <Plus size={14} /> Registrar Colaborador
                </button>
              </form>

              {/* Buscador inteligente */}
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--slate-400)' }} />
                <input 
                  type="text"
                  placeholder="Filtrar colaboradores por nombre..."
                  className="input-field"
                  value={searchPersonnelCov}
                  onChange={e => setSearchPersonnelCov(e.target.value)}
                  style={{ paddingLeft: '32px', fontSize: '12px' }}
                />
              </div>

              {/* List of Personnel with Edit/Delete */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
                {personnel
                  .filter(p => p.nombre.toLowerCase().includes(searchPersonnelCov.toLowerCase()))
                  .map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#FFF', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--slate-900)' }}>👤 {p.nombre}</div>
                        <div style={{ fontSize: '10px', color: 'var(--slate-500)' }}>
                          <span style={{ color: p.grupo === 'A' ? '#15803D' : '#0284C7', fontWeight: 800 }}>Turno {p.grupo}</span> • {p.tipo}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button 
                          onClick={() => setEditingPersonnel(p)}
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', color: 'var(--color-primary-dark)', border: '1px solid var(--color-border-light)' }}
                          title="Editar Colaborador"
                        >
                          <Edit size={12} />
                        </button>
                        <button 
                          onClick={() => handleDeletePersonnel(p.id)}
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', color: '#DC2626', border: '1px solid #FCA5A5' }}
                          title="Eliminar de Nómina"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

          </div>

          {/* EDIT MODAL UBICACION */}
          {editingCovArea && (
            <div 
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(6px)',
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
              }}
              onClick={() => setEditingCovArea(null)}
            >
              <div 
                className="card" 
                style={{ maxWidth: '480px', width: '100%', padding: '28px', backgroundColor: '#FFFFFF', borderRadius: '24px', boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.45)', border: '1px solid #E2E8F0' }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '14px', background: 'linear-gradient(135deg, var(--orange), #EA580C)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(255,122,0,0.3)', flexShrink: 0 }}>
                    <MapPin size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '19px', fontWeight: 900, color: 'var(--slate-900)', letterSpacing: '-0.02em' }}>
                      Editar Ubicación de Dotación
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', fontWeight: 700, color: 'var(--slate-500)' }}>
                      Parámetros operacionales del sector de planta
                    </p>
                  </div>
                  <button className="btn btn-secondary" onClick={() => setEditingCovArea(null)} style={{ width: '32px', height: '32px', padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #CBD5E1' }}>
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleUpdateCovArea} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 900, color: 'var(--slate-600)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
                      Nombre de Ubicación
                    </label>
                    <input 
                      type="text"
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '14px', border: '2px solid #E2E8F0', fontSize: '13px', fontWeight: 800, color: '#0F172A', backgroundColor: '#F8FAFC', outline: 'none' }}
                      value={editingCovArea.name}
                      onChange={e => setEditingCovArea({ ...editingCovArea, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 900, color: 'var(--slate-600)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
                      Código Corto
                    </label>
                    <input 
                      type="text"
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '14px', border: '2px solid #E2E8F0', fontSize: '13px', fontWeight: 800, color: '#0F172A', backgroundColor: '#F8FAFC', outline: 'none' }}
                      value={editingCovArea.code}
                      onChange={e => setEditingCovArea({ ...editingCovArea, code: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 900, color: 'var(--slate-600)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
                      Jornada / Turno
                    </label>
                    <select
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '14px', border: '2px solid #E2E8F0', fontSize: '13px', fontWeight: 800, color: '#0F172A', backgroundColor: '#F8FAFC', outline: 'none' }}
                      value={editingCovArea.turnoId}
                      onChange={e => setEditingCovArea({ ...editingCovArea, turnoId: e.target.value as any })}
                    >
                      <option value="t_ambos">🔄 Ambos Turnos (Día y Noche)</option>
                      <option value="t_dia">☀️ Solo Turno Día</option>
                      <option value="t_noche">🌙 Solo Turno Noche</option>
                      <option value="t_4x3">👔 Staff 4x3</option>
                    </select>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
                    <button type="button" onClick={() => setEditingCovArea(null)} style={{ backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 800, padding: '12px 20px', borderRadius: '14px', border: '1px solid #CBD5E1', cursor: 'pointer', fontSize: '13px' }}>
                      Cancelar
                    </button>
                    <button type="submit" style={{ background: 'linear-gradient(135deg, var(--orange), #EA580C)', color: '#FFFFFF', fontWeight: 900, padding: '12px 24px', borderRadius: '14px', boxShadow: '0 4px 14px rgba(255,122,0,0.3)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <Save size={16} /> Guardar Cambios
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* EDIT MODAL CARGO */}
          {editingCargo && (
            <div 
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(6px)',
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
              }}
              onClick={() => setEditingCargo(null)}
            >
              <div 
                className="card" 
                style={{ maxWidth: '480px', width: '100%', padding: '28px', backgroundColor: '#FFFFFF', borderRadius: '24px', boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.45)', border: '1px solid #E2E8F0' }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '14px', background: 'linear-gradient(135deg, var(--orange), #EA580C)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(255,122,0,0.3)', flexShrink: 0 }}>
                    <Users size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '19px', fontWeight: 900, color: 'var(--slate-900)', letterSpacing: '-0.02em' }}>
                      Editar Cargo Operacional
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', fontWeight: 700, color: 'var(--slate-500)' }}>
                      Catálogo y restricciones de dotación
                    </p>
                  </div>
                  <button className="btn btn-secondary" onClick={() => setEditingCargo(null)} style={{ width: '32px', height: '32px', padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #CBD5E1' }}>
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleUpdateCargo} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 900, color: 'var(--slate-600)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
                      Nombre del Cargo
                    </label>
                    <input 
                      type="text"
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '14px', border: '2px solid #E2E8F0', fontSize: '13px', fontWeight: 800, color: '#0F172A', backgroundColor: '#F8FAFC', outline: 'none' }}
                      value={editingCargo.nombre}
                      onChange={e => setEditingCargo({ ...editingCargo, nombre: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 900, color: 'var(--slate-600)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
                      Código Corto
                    </label>
                    <input 
                      type="text"
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '14px', border: '2px solid #E2E8F0', fontSize: '13px', fontWeight: 800, color: '#0F172A', backgroundColor: '#F8FAFC', outline: 'none' }}
                      value={editingCargo.code || ''}
                      onChange={e => setEditingCargo({ ...editingCargo, code: e.target.value })}
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', backgroundColor: '#FFF7ED', borderRadius: '14px', border: '1px solid #FFEDD5', cursor: 'pointer' }}>
                    <input 
                      type="checkbox"
                      checked={Boolean(editingCargo.restrictedAreaIds?.length)}
                      onChange={e => setEditingCargo({
                        ...editingCargo,
                        restrictedAreaIds: e.target.checked ? ['a_personal_4x3'] : undefined
                      })}
                    />
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#C2410C' }}>🔒 Restringir solo a Ubicación Staff 4x3</span>
                  </label>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
                    <button type="button" onClick={() => setEditingCargo(null)} style={{ backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 800, padding: '12px 20px', borderRadius: '14px', border: '1px solid #CBD5E1', cursor: 'pointer', fontSize: '13px' }}>
                      Cancelar
                    </button>
                    <button type="submit" style={{ background: 'linear-gradient(135deg, var(--orange), #EA580C)', color: '#FFFFFF', fontWeight: 900, padding: '12px 24px', borderRadius: '14px', boxShadow: '0 4px 14px rgba(255,122,0,0.3)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <Save size={16} /> Guardar Cambios
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* EDIT MODAL COLABORADOR */}
          {editingPersonnel && (
            <div 
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(6px)',
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
              }}
              onClick={() => setEditingPersonnel(null)}
            >
              <div 
                className="card" 
                style={{ maxWidth: '480px', width: '100%', padding: '28px', backgroundColor: '#FFFFFF', borderRadius: '24px', boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.45)', border: '1px solid #E2E8F0' }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '14px', background: 'linear-gradient(135deg, var(--orange), #EA580C)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(255,122,0,0.3)', flexShrink: 0 }}>
                    <Users size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '19px', fontWeight: 900, color: 'var(--slate-900)', letterSpacing: '-0.02em' }}>
                      Editar Colaborador de Nómina
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', fontWeight: 700, color: 'var(--slate-500)' }}>
                      Personal oficial de contrato Minera Zaldívar
                    </p>
                  </div>
                  <button className="btn btn-secondary" onClick={() => setEditingPersonnel(null)} style={{ width: '32px', height: '32px', padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #CBD5E1' }}>
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleUpdatePersonnel} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 900, color: 'var(--slate-600)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
                      Nombre Completo
                    </label>
                    <input 
                      type="text"
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '14px', border: '2px solid #E2E8F0', fontSize: '13px', fontWeight: 800, color: '#0F172A', backgroundColor: '#F8FAFC', outline: 'none' }}
                      value={editingPersonnel.nombre}
                      onChange={e => setEditingPersonnel({ ...editingPersonnel, nombre: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 900, color: 'var(--slate-600)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
                      RUT (Opcional)
                    </label>
                    <input 
                      type="text"
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '14px', border: '2px solid #E2E8F0', fontSize: '13px', fontWeight: 800, color: '#0F172A', backgroundColor: '#F8FAFC', outline: 'none' }}
                      value={editingPersonnel.rut || ''}
                      onChange={e => setEditingPersonnel({ ...editingPersonnel, rut: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 900, color: 'var(--slate-600)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
                      Grupo de Turno (7x7)
                    </label>
                    <select
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '14px', border: '2px solid #E2E8F0', fontSize: '13px', fontWeight: 800, color: '#0F172A', backgroundColor: '#F8FAFC', outline: 'none' }}
                      value={editingPersonnel.grupo}
                      onChange={e => setEditingPersonnel({ ...editingPersonnel, grupo: e.target.value as any })}
                    >
                      <option value="A">Turno A</option>
                      <option value="B">Turno B</option>
                      <option value="AMBOS">Ambos Turnos</option>
                    </select>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
                    <button type="button" onClick={() => setEditingPersonnel(null)} style={{ backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 800, padding: '12px 20px', borderRadius: '14px', border: '1px solid #CBD5E1', cursor: 'pointer', fontSize: '13px' }}>
                      Cancelar
                    </button>
                    <button type="submit" style={{ background: 'linear-gradient(135deg, var(--orange), #EA580C)', color: '#FFFFFF', fontWeight: 900, padding: '12px 24px', borderRadius: '14px', boxShadow: '0 4px 14px rgba(255,122,0,0.3)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <Save size={16} /> Guardar Cambios
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};
