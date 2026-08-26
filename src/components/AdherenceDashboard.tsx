import React, { useState } from 'react';
import type { WorkOrder, WhiteLabelConfig } from '../types';
import { 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  FileSpreadsheet,
  Calendar,
  Target,
  Printer,
  Edit2,
  Check
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface AdherenceDashboardProps {
  workOrders: WorkOrder[];
  whiteLabel?: WhiteLabelConfig;
  onUpdateWhiteLabel?: React.Dispatch<React.SetStateAction<WhiteLabelConfig>>;
}

export const AdherenceDashboard: React.FC<AdherenceDashboardProps> = ({ 
  workOrders, 
  whiteLabel,
  onUpdateWhiteLabel 
}) => {
  const [selectedSemana, setSelectedSemana] = useState<string>('ALL');
  const [isEditingTarget, setIsEditingTarget] = useState<boolean>(false);
  const [targetValue, setTargetValue] = useState<number>(whiteLabel?.targetAdherence || 85);

  const currentTarget = whiteLabel?.targetAdherence || targetValue || 85;

  // Extract unique available weeks from work orders
  const availableSemanas = Array.from(new Set(workOrders.map(o => o.semana))).sort((a, b) => a - b);

  // Filter orders by selected semana
  const filteredWorkOrders = workOrders.filter(order => {
    return selectedSemana === 'ALL' || order.semana === Number(selectedSemana);
  });

  const totalOrders = filteredWorkOrders.length;
  const completedOrders = filteredWorkOrders.filter(o => o.status === 'APROBADO_MANDANTE' || o.status === 'COMPLETADO').length;
  const contingencyOrders = filteredWorkOrders.filter(o => o.status === 'RECHAZADO_CONTINGENCIA' || o.status === 'CONTINGENCIA').length;
  
  const totalEstimatedHH = filteredWorkOrders.reduce((acc, curr) => acc + (curr.estimatedHours || 0), 0);
  const totalRealHH = filteredWorkOrders.reduce((acc, curr) => acc + (curr.realHours || 0), 0);

  const adherencePercentage = totalEstimatedHH > 0 
    ? Math.min(100, Math.round((totalRealHH / totalEstimatedHH) * 100)) 
    : 100;

  const isTargetMet = adherencePercentage >= currentTarget;

  // Group by Shift
  const shiftGrouped = filteredWorkOrders.reduce((acc, order) => {
    const key = order.shiftName || 'Turno Sin Especificar';
    if (!acc[key]) {
      acc[key] = { total: 0, completed: 0, estimatedHH: 0, realHH: 0 };
    }
    acc[key].total += 1;
    if (order.status === 'APROBADO_MANDANTE' || order.status === 'COMPLETADO') {
      acc[key].completed += 1;
    }
    acc[key].estimatedHH += order.estimatedHours || 0;
    acc[key].realHH += order.realHours || 0;
    return acc;
  }, {} as Record<string, { total: number; completed: number; estimatedHH: number; realHH: number }>);

  const handleSaveTarget = () => {
    if (onUpdateWhiteLabel && whiteLabel) {
      onUpdateWhiteLabel({ ...whiteLabel, targetAdherence: targetValue });
    }
    setIsEditingTarget(false);
  };

  const handlePrintReport = () => {
    window.print();
  };

  const exportKpiReport = () => {
    const dataToExport = Object.entries(shiftGrouped).map(([shiftName, data]) => ({
      'Filtro Semana': selectedSemana === 'ALL' ? 'Todas las Semanas' : `Semana ${selectedSemana}`,
      'Turno Operacional': shiftName,
      'OTs Registradas': data.total,
      'OTs Completadas/Aprobadas': data.completed,
      'HH Estimadas': data.estimatedHH,
      'HH Reales': data.realHH,
      'Adherencia (%)': data.estimatedHH > 0 ? `${Math.round((data.realHH / data.estimatedHH) * 100)}%` : '100%',
      'Meta Exigida (%)': `${currentTarget}%`
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resumen KPI');
    XLSX.writeFile(wb, `Reporte_KPI_Adherencia_Semana_${selectedSemana}_${Date.now()}.xlsx`);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
            Reporte Semanal de Adherencia y Desviación (KPI)
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Consolidado operacional y cálculo de adherencia por período y turno
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Week Filter Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#FFF', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
            <Calendar size={16} style={{ color: 'var(--color-action-teal)' }} />
            <span style={{ fontSize: '12px', fontWeight: 800 }}>Semana Operacional:</span>
            <select
              value={selectedSemana}
              onChange={e => setSelectedSemana(e.target.value)}
              style={{ border: 'none', background: 'none', fontSize: '13px', fontWeight: 800, color: 'var(--color-primary-dark)', cursor: 'pointer', outline: 'none' }}
            >
              <option value="ALL">Todas las Semanas (Consolidado)</option>
              {availableSemanas.map(sem => (
                <option key={sem} value={sem.toString()}>Semana {sem}</option>
              ))}
            </select>
          </div>

          <button onClick={handlePrintReport} className="btn btn-secondary">
            <Printer size={16} /> Imprimir / PDF
          </button>

          <button onClick={exportKpiReport} className="btn btn-secondary">
            <FileSpreadsheet size={16} /> Exportar Informe KPI (.xlsx)
          </button>
        </div>
      </div>

      {/* KPI Stat Cards Grid (Mobile Adaptable) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        
        {/* Adherence % Card */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: 0 }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: isTargetMet ? '#E6F4F1' : '#FEF2F2', color: isTargetMet ? 'var(--color-forest-teal)' : '#991B1B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ADHERENCIA OPERACIONAL
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: isTargetMet ? 'var(--color-forest-teal)' : '#991B1B' }}>
              {adherencePercentage}%
            </div>
          </div>
        </div>

        {/* Editable Target Adherence Card */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: 0, backgroundColor: isTargetMet ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${isTargetMet ? '#6EE7B7' : '#FCA5A5'}` }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: isTargetMet ? '#047857' : '#991B1B', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Target size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              META DE CONTRATO
              {!isEditingTarget ? (
                <button onClick={() => setIsEditingTarget(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} title="Editar Meta KPI">
                  <Edit2 size={12} />
                </button>
              ) : (
                <button onClick={handleSaveTarget} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#047857' }} title="Guardar Meta">
                  <Check size={14} />
                </button>
              )}
            </div>

            {!isEditingTarget ? (
              <div>
                <div style={{ fontSize: '22px', fontWeight: 900, color: isTargetMet ? '#047857' : '#991B1B' }}>
                  {currentTarget}% Exigido
                </div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: isTargetMet ? '#047857' : '#991B1B' }}>
                  {isTargetMet ? '✓ CUMPLIENDO META' : '⚠️ BAJO LA META'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                <input
                  type="number"
                  value={targetValue}
                  onChange={e => setTargetValue(Number(e.target.value))}
                  style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '14px', fontWeight: 800 }}
                  min={50}
                  max={100}
                />
                <span style={{ fontSize: '13px', fontWeight: 800 }}>%</span>
              </div>
            )}
          </div>
        </div>

        {/* Completed Work Orders Card */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: 0 }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#E0F2FE', color: '#0369A1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CheckCircle size={24} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              TRABAJOS COMPLETADOS
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#0369A1' }}>
              {completedOrders} / {totalOrders}
            </div>
          </div>
        </div>

        {/* Man Hours Card */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: 0 }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#F1F5F9', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              HORAS HOMBRE (HH) REAL
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--color-primary-dark)' }}>
              {totalRealHH}h <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)' }}>/ {totalEstimatedHH}h</span>
            </div>
          </div>
        </div>

      </div>

      {/* Dynamic Breakdown per Shift (Adaptable Grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        
        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary-dark)', marginBottom: '16px' }}>
            Desglose Dinámico por Turno Configurado {selectedSemana !== 'ALL' && `(Semana ${selectedSemana})`}
          </h3>

          <div className="grid-table-container">
            <table className="operational-table">
              <thead>
                <tr>
                  <th>Nombre del Turno</th>
                  <th>OTs Registradas</th>
                  <th>Completadas</th>
                  <th>HH Estimadas</th>
                  <th>HH Reales</th>
                  <th>Adherencia vs Meta</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(shiftGrouped).length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      No hay órdenes registradas con el filtro aplicado.
                    </td>
                  </tr>
                ) : (
                  Object.entries(shiftGrouped).map(([shiftName, data]) => {
                    const shiftAdherence = data.estimatedHH > 0 
                      ? Math.round((data.realHH / data.estimatedHH) * 100) 
                      : 100;
                    const shiftMet = shiftAdherence >= currentTarget;
                    return (
                      <tr key={shiftName}>
                        <td style={{ fontWeight: 800, color: 'var(--color-primary-dark)' }}>{shiftName}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{data.total}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--color-forest-teal)' }}>{data.completed}</td>
                        <td style={{ textAlign: 'center' }}>{data.estimatedHH}h</td>
                        <td style={{ textAlign: 'center', fontWeight: 800 }}>{data.realHH}h</td>
                        <td>
                          <span className={`pill ${shiftMet ? 'pill-complete' : 'pill-contingency'}`}>
                            {shiftAdherence}% {shiftMet ? '✓' : '⚠️'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Contingency Log Summary */}
        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary-dark)', marginBottom: '16px' }}>
            Registro de Detenciones & Contingencias
          </h3>

          {contingencyOrders === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              No hay órdenes en contingencia en el período. ¡Excelente desempeño operacional!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredWorkOrders.filter(o => o.status === 'RECHAZADO_CONTINGENCIA' || o.status === 'CONTINGENCIA').map(o => (
                <div key={o.id} style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '12px', color: '#991B1B' }}>
                      {o.sapCode} - {o.equipoCorrea} (Sem {o.semana})
                    </div>
                    <div style={{ fontSize: '11px', color: '#7F1D1D' }}>
                      {o.operationDetail}
                    </div>
                  </div>
                  <span className="pill pill-contingency">DETENCIÓN</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
