import React, { useState } from 'react';
import type { AuditLogEntry } from '../types';
import { History, Search, Filter, ShieldCheck, HardHat, Shield, Wrench, FileSpreadsheet, PlusCircle, Edit3, Trash2, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface AuditLogViewerProps {
  auditLogs: AuditLogEntry[];
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ auditLogs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('ALL');
  const [filterAction, setFilterAction] = useState<string>('ALL');

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = 
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entityId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.diffSummary && log.diffSummary.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole = filterRole === 'ALL' || log.userRole === filterRole;

    const matchesAction = filterAction === 'ALL' || log.action === filterAction;

    return matchesSearch && matchesRole && matchesAction;
  });

  const getActionBadge = (action: AuditLogEntry['action']) => {
    switch (action) {
      case 'CREACION':
        return <span className="pill pill-complete" style={{ backgroundColor: '#E0F2FE', color: '#0369A1' }}><PlusCircle size={12} style={{ marginRight: '4px' }} /> CREACIÓN</span>;
      case 'EDICION':
        return <span className="pill pill-pending" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}><Edit3 size={12} style={{ marginRight: '4px' }} /> EDICIÓN (DIFF)</span>;
      case 'APROBACION_ITO':
        return <span className="pill pill-complete" style={{ backgroundColor: '#E6F4F1', color: '#025951' }}><CheckCircle2 size={12} style={{ marginRight: '4px' }} /> FIRMA / APROBACIÓN ITO</span>;
      case 'ELIMINACION':
        return <span className="pill pill-contingency"><Trash2 size={12} style={{ marginRight: '4px' }} /> ELIMINACIÓN</span>;
      default:
        return <span className="pill pill-pending">{action}</span>;
    }
  };

  const getRoleIcon = (role: AuditLogEntry['userRole']) => {
    switch (role) {
      case 'SUPERVISOR_TERRENO':
        return <HardHat size={14} style={{ color: '#05A6A6' }} />;
      case 'ITO_MANDANTE':
        return <ShieldCheck size={14} style={{ color: '#025951' }} />;
      case 'ADMINISTRADOR_CONTRATO':
        return <Shield size={14} style={{ color: '#3F3D73' }} />;
      case 'SUPER_ADMIN':
        return <Wrench size={14} style={{ color: '#B91C1C' }} />;
      default:
        return <History size={14} />;
    }
  };

  const exportAuditLogExcel = () => {
    const dataToExport = filteredLogs.map(log => ({
      'ID Log': log.id,
      'Marca de Tiempo': log.timestamp,
      'Usuario Ejecutor': log.userName,
      'Rol Registrado': log.userRole,
      'Tipo de Acción': log.action,
      'Entidad / Módulo': log.entityName,
      'Código / Referencia': log.entityId,
      'Detalles de Operación': log.details,
      'Resumen de Cambios (Diff)': log.diffSummary || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Historial de Auditoría');
    XLSX.writeFile(wb, `Audit_Log_SiteClean_${Date.now()}.xlsx`);
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <History size={24} style={{ color: 'var(--color-action-teal)' }} /> Historial de Auditoría & Trazabilidad Inmutable (Diff Engine)
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Registro cronológico inalterable de creación, modificaciones, firmas de ITO y eliminaciones
          </p>
        </div>

        <button onClick={exportAuditLogExcel} className="btn btn-secondary">
          <FileSpreadsheet size={16} /> Exportar Log (.xlsx)
        </button>
      </div>

      {/* Toolbar Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, position: 'relative', minWidth: '220px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar en auditoría por Usuario, OT/SAP, Detalles o Diff de cambios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid var(--color-border-light)', fontSize: '13px' }}
          />
        </div>

        {/* Action Type Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={16} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: '12px', fontWeight: 700 }}>Acción:</span>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border-light)', fontSize: '12px', backgroundColor: '#FFF', fontWeight: 700 }}
          >
            <option value="ALL">Todas las Acciones</option>
            <option value="APROBACION_ITO">✍️ Firmas ITO Mandante</option>
            <option value="CREACION">➕ Creaciones de OT</option>
            <option value="EDICION">✏️ Ediciones con Diff</option>
            <option value="ELIMINACION">🗑️ Eliminaciones</option>
          </select>
        </div>

        {/* Role Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700 }}>Rol:</span>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border-light)', fontSize: '12px', backgroundColor: '#FFF' }}
          >
            <option value="ALL">Todos los Roles</option>
            <option value="SUPERVISOR_TERRENO">👷 Supervisor Terreno</option>
            <option value="ITO_MANDANTE">🕵️ ITO Mandante</option>
            <option value="ADMINISTRADOR_CONTRATO">💼 Admin Contrato</option>
            <option value="SUPER_ADMIN">⚙️ Super Admin</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="grid-table-container">
        <table className="operational-table">
          <thead>
            <tr>
              <th>Fecha / Hora</th>
              <th>Usuario Ejecutor</th>
              <th>Acción Auditada</th>
              <th>Módulo / Entidad</th>
              <th>Código / Ref</th>
              <th>Detalle de Operación</th>
              <th>Diff de Cambios (Modificaciones)</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No se encontraron eventos de auditoría coincidentes.
                </td>
              </tr>
            ) : (
              filteredLogs.map(log => (
                <tr key={log.id}>
                  <td style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {log.timestamp}
                  </td>
                  <td>
                    <div style={{ fontWeight: 800, color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                      {getRoleIcon(log.userRole)}
                      {log.userName}
                    </div>
                  </td>
                  <td>{getActionBadge(log.action)}</td>
                  <td style={{ fontWeight: 700, fontSize: '12px' }}>{log.entityName}</td>
                  <td>
                    <span className="sap-code-badge" style={{ fontSize: '11px' }}>{log.entityId}</span>
                  </td>
                  <td style={{ fontSize: '12px', maxWidth: '240px' }}>{log.details}</td>
                  <td>
                    {log.diffSummary ? (
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#0369A1', backgroundColor: '#E0F2FE', padding: '3px 8px', borderRadius: '4px', border: '1px solid #BAE6FD', display: 'inline-block' }}>
                        {log.diffSummary}
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
