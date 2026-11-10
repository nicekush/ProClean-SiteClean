import { useEffect, useRef, useState } from 'react';
import { Edit, Save, X } from 'lucide-react';
import type { HierarchyKind, HierarchyRecord, HierarchyValues } from '../api/hierarchy';

interface Props {
  kind: HierarchyKind;
  record: HierarchyRecord;
  onSave: (values: HierarchyValues) => Promise<void>;
  onClose: () => void;
}

export function HierarchyRecordEditor({ kind, record, onSave, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(record.name);
  const [code, setCode] = useState(record.code || '');
  const [description, setDescription] = useState('description' in record ? record.description || '' : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const labels = { area: 'área de planta', sector: 'sector', equipment: 'equipo principal', component: 'componente' };

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setError('');
    setSaving(true);
    try {
      await onSave({ name, code, ...(kind === 'sector' ? { description } : {}) });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar los cambios. Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', marginTop: '6px' };
  return (
    <dialog ref={dialog} className="hierarchy-record-editor" aria-labelledby="hierarchy-edit-title" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
      style={{ width: 'min(520px, calc(100vw - 32px))', maxHeight: '90vh', margin: 'auto', overflowY: 'auto', padding: '24px', border: '1px solid #E2E8F0', borderRadius: '16px', boxShadow: '0 24px 70px #0F172A40' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <h3 id="hierarchy-edit-title" style={{ display: 'flex', gap: '8px', alignItems: 'center', margin: 0 }}><Edit size={18} /> Editar {labels[kind]}</h3>
        <button type="button" className="btn btn-secondary" aria-label="Cerrar edición" disabled={saving} onClick={onClose}><X size={16} /></button>
      </div>
      <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '20px' }}>Corrige los datos del registro. Se conservarán sus vínculos en la jerarquía de planta.</p>
      <form onSubmit={submit} style={{ display: 'grid', gap: '16px' }} aria-busy={saving}>
        <label htmlFor="hierarchy-edit-name">Nombre
          <input id="hierarchy-edit-name" autoFocus required disabled={saving} value={name} onChange={event => setName(event.target.value)} style={fieldStyle} />
        </label>
        <label htmlFor="hierarchy-edit-code">Código
          <input id="hierarchy-edit-code" required disabled={saving} value={code} onChange={event => setCode(event.target.value)} style={fieldStyle} />
        </label>
        {kind === 'sector' && <label htmlFor="hierarchy-edit-description">Descripción
          <textarea id="hierarchy-edit-description" disabled={saving} value={description} onChange={event => setDescription(event.target.value)} style={fieldStyle} rows={3} />
        </label>}
        {error && <p role="alert" style={{ color: '#B91C1C', background: '#FEF2F2', padding: '12px', borderRadius: '8px', margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '10px' }}>
          <button type="button" className="btn btn-secondary" disabled={saving} onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving || !name.trim() || !code.trim()}><Save size={16} /> {saving ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </form>
    </dialog>
  );
}
