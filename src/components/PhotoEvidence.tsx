import React, { useState, useRef } from 'react';
import type { WorkOrder } from '../types';
import { Camera, Search, Upload, CheckCircle, Image as ImageIcon, Sliders, X, Save, Filter, Clock, AlertCircle } from 'lucide-react';

interface PhotoEvidenceProps {
  workOrders: WorkOrder[];
  onUpdateWorkOrder?: (id: string, updated: Partial<WorkOrder>) => void;
}

export const PhotoEvidence: React.FC<PhotoEvidenceProps> = ({ workOrders, onUpdateWorkOrder }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterReadiness, setFilterReadiness] = useState<string>('ALL');
  const [selectedOrderId, setSelectedOrderId] = useState<string>(workOrders[0]?.id || '');
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Upload Evidence Modal State
  const [uploadingOrder, setUploadingOrder] = useState<WorkOrder | null>(null);
  const [beforePreview, setBeforePreview] = useState<string>('');
  const [afterPreview, setAfterPreview] = useState<string>('');

  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOrders = workOrders.filter(o => {
    const matchesSearch = 
      o.sapCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.equipoCorrea.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.operationDetail.toLowerCase().includes(searchTerm.toLowerCase());

    const hasBefore = !!o.beforePhotoUrl;
    const hasAfter = !!o.afterPhotoUrl;

    const matchesReadiness = filterReadiness === 'ALL' ||
      (filterReadiness === 'COMPLETE' && hasBefore && hasAfter) ||
      (filterReadiness === 'PENDING_AFTER' && hasBefore && !hasAfter) ||
      (filterReadiness === 'NO_PHOTOS' && !hasBefore && !hasAfter);

    return matchesSearch && matchesReadiness;
  });

  const selectedOrder = workOrders.find(o => o.id === selectedOrderId) || filteredOrders[0] || workOrders[0];

  const beforeImage = selectedOrder?.beforePhotoUrl || '';
  const afterImage = selectedOrder?.afterPhotoUrl || '';

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    let percentage = (x / rect.width) * 100;
    if (percentage < 0) percentage = 0;
    if (percentage > 100) percentage = 100;
    setSliderPosition(percentage);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    handleMove(e.touches[0].clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  };

  const handleOpenUploadModal = (order: WorkOrder) => {
    setUploadingOrder(order);
    setBeforePreview(order.beforePhotoUrl || '');
    setAfterPreview(order.afterPhotoUrl || '');
  };

  const handleBeforeFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setBeforePreview(evt.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAfterFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setAfterPreview(evt.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEvidence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadingOrder || !onUpdateWorkOrder) return;

    onUpdateWorkOrder(uploadingOrder.id, {
      beforePhotoUrl: beforePreview || uploadingOrder.beforePhotoUrl,
      afterPhotoUrl: afterPreview || uploadingOrder.afterPhotoUrl
    });

    setUploadingOrder(null);
  };

  return (
    <div>
      <div className="responsive-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Camera size={24} style={{ color: 'var(--color-action-teal)' }} /> Evidencias Fotográficas & Comparador Slider Antes / Después
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Verificación gráfica interactiva del aseo industrial ejecutado en terreno
          </p>
        </div>

        {/* OT Selector Dropdown & Upload Action */}
        <div className="responsive-control-group" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {selectedOrder && onUpdateWorkOrder && (
            <button 
              onClick={() => handleOpenUploadModal(selectedOrder)}
              className="btn btn-primary"
            >
              <Upload size={16} /> Subir / Editar Fotos ({selectedOrder.sapCode})
            </button>
          )}

          <select
            value={selectedOrderId}
            onChange={(e) => setSelectedOrderId(e.target.value)}
            style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border-light)', fontSize: '13px', backgroundColor: '#FFF', fontWeight: 700 }}
          >
            {filteredOrders.map(o => (
              <option key={o.id} value={o.id}>
                {o.sapCode} - {o.equipoCorrea} ({o.beforePhotoUrl && o.afterPhotoUrl ? '🟢 2/2' : o.beforePhotoUrl ? '🟡 1/2' : '🔴 0/2'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Search & Evidence Readiness Filter */}
      <div className="responsive-toolbar" style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="responsive-search" style={{ flex: 1, position: 'relative', minWidth: 'min(240px, 100%)' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar evidencia por N° OT / SAP o Nombre de Correa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid var(--color-border-light)', fontSize: '13px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={16} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: '12px', fontWeight: 700 }}>Evidencia:</span>
          <select
            value={filterReadiness}
            onChange={(e) => setFilterReadiness(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border-light)', fontSize: '12px', backgroundColor: '#FFF', fontWeight: 700 }}
          >
            <option value="ALL">Todas las Órdenes de Trabajo</option>
            <option value="COMPLETE">🟢 Evidencias Completas (Listas para Firma ITO)</option>
            <option value="PENDING_AFTER">🟡 Falta Foto Final DESPUÉS (En Lavado)</option>
            <option value="NO_PHOTOS">🔴 Sin Fotos Registradas (0/2)</option>
          </select>
        </div>
      </div>

      {/* Upload Evidence Modal */}
      {uploadingOrder && (
        <div className="modal-backdrop-overlay" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-content-card" style={{ maxWidth: '560px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={20} /> Cargar Evidencia Fotográfica ({uploadingOrder.sapCode})
              </h3>
              <button onClick={() => setUploadingOrder(null)} className="btn btn-secondary" style={{ padding: '4px 8px' }}><X size={16} /></button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Adjunta las fotos en sus respectivos momentos del turno para {uploadingOrder.equipoCorrea}.
            </p>

            <form className="responsive-two-column-grid" onSubmit={handleSaveEvidence} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              
              {/* Before Image Box (Phase 1) */}
              <div style={{ textAlign: 'center' }}>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#991B1B', display: 'block', marginBottom: '8px' }}>
                  1. Foto ANTES (Al Iniciar / Sucio)
                </label>
                <div style={{ width: '100%', height: '140px', borderRadius: '8px', border: '2px dashed #FCA5A5', backgroundColor: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: '10px' }}>
                  {beforePreview ? (
                    <img src={beforePreview} alt="Antes Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ color: '#991B1B', fontSize: '11px' }}>
                      <ImageIcon size={28} />
                      <div>Sin foto inicial</div>
                    </div>
                  )}
                </div>
                <label className="btn btn-secondary" style={{ cursor: 'pointer', fontSize: '11px', padding: '6px 10px', width: '100%', justifyContent: 'center' }}>
                  <Upload size={14} /> Cargar Foto ANTES
                  <input type="file" accept="image/*" onChange={handleBeforeFileUpload} style={{ display: 'none' }} />
                </label>
              </div>

              {/* After Image Box (Phase 2) */}
              <div style={{ textAlign: 'center' }}>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#047857', display: 'block', marginBottom: '8px' }}>
                  2. Foto DESPUÉS (Al Finalizar / Limpio)
                </label>
                <div style={{ width: '100%', height: '140px', borderRadius: '8px', border: '2px dashed #6EE7B7', backgroundColor: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: '10px' }}>
                  {afterPreview ? (
                    <img src={afterPreview} alt="Después Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ color: '#047857', fontSize: '11px' }}>
                      <ImageIcon size={28} />
                      <div>Sin foto final</div>
                    </div>
                  )}
                </div>
                <label className="btn btn-secondary" style={{ cursor: 'pointer', fontSize: '11px', padding: '6px 10px', width: '100%', justifyContent: 'center' }}>
                  <Upload size={14} /> Cargar Foto DESPUÉS
                  <input type="file" accept="image/*" onChange={handleAfterFileUpload} style={{ display: 'none' }} />
                </label>
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setUploadingOrder(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary"><Save size={16} /> Guardar Evidencias</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedOrder ? (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="sap-code-badge" style={{ fontSize: '14px', padding: '6px 12px' }}>{selectedOrder.sapCode}</span>
                {selectedOrder.beforePhotoUrl && selectedOrder.afterPhotoUrl ? (
                  <span className="pill pill-complete">🟢 EVIDENCIA COMPLETA (2/2)</span>
                ) : selectedOrder.beforePhotoUrl ? (
                  <span className="pill pill-pending">🟡 FALTA FOTO FINAL DESPUÉS (1/2)</span>
                ) : (
                  <span className="pill pill-contingency">🔴 SIN FOTOS (0/2)</span>
                )}
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-primary-dark)', marginTop: '6px' }}>
                {selectedOrder.equipoCorrea}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {selectedOrder.operationDetail}
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-forest-teal)' }}>
                Turno: {selectedOrder.shiftName} (Semana {selectedOrder.semana})
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {selectedOrder.headcount} Operadores | {selectedOrder.realHours}h Trabajadas
              </div>
            </div>
          </div>

          {/* Before / After View Container */}
          {beforeImage && afterImage ? (
            /* CASE 1: BOTH PHOTOS AVAILABLE -> INTERACTIVE COMPARATIVE SLIDER */
            <div>
              <div 
                ref={containerRef}
                onMouseDown={() => setIsDragging(true)}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
                onMouseMove={handleMouseMove}
                onTouchStart={() => setIsDragging(true)}
                onTouchEnd={() => setIsDragging(false)}
                onTouchMove={handleTouchMove}
                style={{ 
                  position: 'relative', 
                  width: '100%', 
                  height: '420px', 
                  borderRadius: '16px', 
                  overflow: 'hidden', 
                  cursor: 'ew-resize',
                  userSelect: 'none',
                  border: '2px solid var(--color-border-light)',
                  boxShadow: 'var(--shadow-md)'
                }}
              >
                {/* After Image (Background) */}
                <img 
                  src={afterImage} 
                  alt="Después (Limpio)" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} 
                />
                
                {/* Badge Después */}
                <div style={{ position: 'absolute', top: '16px', right: '16px', backgroundColor: 'rgba(2, 89, 81, 0.85)', color: '#FFF', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 800, backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle size={14} /> DESPUÉS (Estado Limpio / Entregado)
                </div>

                {/* Before Image (Foreground Clipped) */}
                <div 
                  style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    bottom: 0, 
                    width: `${sliderPosition}%`, 
                    overflow: 'hidden' 
                  }}
                >
                  <img 
                    src={beforeImage} 
                    alt="Antes (Sucio)" 
                    style={{ 
                      width: containerRef.current ? `${containerRef.current.clientWidth}px` : '100%', 
                      height: '100%', 
                      objectFit: 'cover',
                      maxWidth: 'none'
                    }} 
                  />
                  {/* Badge Antes */}
                  <div style={{ position: 'absolute', top: '16px', left: '16px', backgroundColor: 'rgba(153, 27, 27, 0.85)', color: '#FFF', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 800, backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Camera size={14} /> ANTES (Estado Inicial / Sucio)
                  </div>
                </div>

                {/* Slider Divider Line */}
                <div 
                  style={{ 
                    position: 'absolute', 
                    top: 0, 
                    bottom: 0, 
                    left: `${sliderPosition}%`, 
                    width: '3px', 
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 0 10px rgba(0,0,0,0.5)',
                    transform: 'translateX(-50%)'
                  }}
                >
                  <div 
                    style={{ 
                      position: 'absolute', 
                      top: '50%', 
                      left: '50%', 
                      transform: 'translate(-50%, -50%)',
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: '#FFFFFF',
                      color: 'var(--color-primary-dark)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      border: '2px solid var(--color-action-teal)'
                    }}
                  >
                    <Sliders size={18} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span>◄ Arrastra el deslizador blanco hacia la izquierda/derecha para comparar el aseo industrial ►</span>
              </div>
            </div>
          ) : beforeImage || afterImage ? (
            /* CASE 2: ONLY ONE PHOTO AVAILABLE */
            <div className="responsive-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '16px' }}>
              <div style={{ position: 'relative', height: '320px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--slate-200)' }}>
                {beforeImage ? (
                  <>
                    <img src={beforeImage} alt="Antes" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', top: '12px', left: '12px', backgroundColor: 'rgba(153, 27, 27, 0.9)', color: '#FFF', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 800 }}>
                      📷 ANTES (Estado Inicial)
                    </div>
                  </>
                ) : (
                  <div style={{ width: '100%', height: '100%', backgroundColor: '#FEF2F2', border: '2px dashed #FCA5A5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#991B1B', padding: '20px' }}>
                    <ImageIcon size={36} />
                    <div style={{ fontWeight: 800, fontSize: '13px' }}>Falta Foto Inicial (ANTES)</div>
                    <button onClick={() => handleOpenUploadModal(selectedOrder)} className="btn btn-secondary" style={{ fontSize: '11px', padding: '6px 12px', marginTop: '6px' }}>
                      <Upload size={12} /> Cargar Foto ANTES
                    </button>
                  </div>
                )}
              </div>

              <div style={{ position: 'relative', height: '320px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--slate-200)' }}>
                {afterImage ? (
                  <>
                    <img src={afterImage} alt="Después" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', top: '12px', right: '12px', backgroundColor: 'rgba(4, 120, 87, 0.9)', color: '#FFF', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 800 }}>
                      🟢 DESPUÉS (Estado Limpio / Entregado)
                    </div>
                  </>
                ) : (
                  <div style={{ width: '100%', height: '100%', backgroundColor: '#ECFDF5', border: '2px dashed #6EE7B7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#047857', padding: '20px' }}>
                    <ImageIcon size={36} />
                    <div style={{ fontWeight: 800, fontSize: '13px' }}>Falta Foto Final (DESPUÉS)</div>
                    <button onClick={() => handleOpenUploadModal(selectedOrder)} className="btn btn-secondary" style={{ fontSize: '11px', padding: '6px 12px', marginTop: '6px' }}>
                      <Upload size={12} /> Cargar Foto DESPUÉS
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* CASE 3: NO PHOTOS AVAILABLE AT ALL -> CLEAN EMPTY STATE */
            <div style={{ textAlign: 'center', padding: '50px 20px', borderRadius: '20px', backgroundColor: 'var(--slate-50)', border: '2px dashed var(--slate-300)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--slate-500)' }}>
                <ImageIcon size={28} />
              </div>
              <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--slate-800)' }}>
                Sin Evidencia Fotográfica Cargada
              </div>
              <p style={{ fontSize: '13px', color: 'var(--slate-500)', maxWidth: '420px', margin: 0, lineHeight: '1.5' }}>
                La Orden de Trabajo <strong>{selectedOrder.sapCode}</strong> ({selectedOrder.equipoCorrea}) no tiene fotografías adjuntas.
              </p>
              {onUpdateWorkOrder && (
                <button 
                  onClick={() => handleOpenUploadModal(selectedOrder)}
                  className="btn btn-primary"
                  style={{ marginTop: '6px', padding: '10px 18px', fontSize: '13px' }}
                >
                  <Upload size={16} /> Subir Fotografías ({selectedOrder.sapCode})
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          No hay órdenes de trabajo coincidentes con el filtro de evidencia.
        </div>
      )}
    </div>
  );
};
