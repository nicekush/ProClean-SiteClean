import { useEffect, useRef, useState } from 'react';
import { Plus, Save, X } from 'lucide-react';
import { usePermissions } from '../security/PermissionContext';
import type { SubSector } from '../types';
import type { ComponentCreationInput, ComponentCreationResult } from '../api/components';
import './ComponentCreator.css';

export function ComponentCreator({ areaId, sectorId, equipmentId, equipmentName, onCreate, onSelect }: {
  areaId: string; sectorId: string; equipmentId: string; equipmentName: string;
  onCreate: (input: ComponentCreationInput) => Promise<ComponentCreationResult>;
  onSelect: (component: SubSector) => void;
}) {
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const saving = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  // A different equipment/session remounts this component in the wizard.
  // Avoid selecting into a different task if the previous save finishes later.
  const selection = useRef(onSelect);
  selection.current = onSelect;
  const save = async () => {
    if (saving.current || !name.trim()) return;
    saving.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const result = await onCreate({ areaId, sectorId, equipmentId, name });
      if (!mounted.current) return;
      selection.current(result.component);
      setName(''); setOpen(false);
      setMessage(result.created ? `«${result.component.name}» creado y seleccionado.` : `«${result.component.name}» ya existía y quedó seleccionado.`);
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error && !('code' in failure) ? failure.message
        : 'No se pudo guardar el componente. Revisa la selección, tu conexión y tu permiso; luego reintenta.');
    } finally { saving.current = false; if (mounted.current) setBusy(false); }
  };
  if (!can('components.create')) return null;
  return <div className="component-creator">
    {!open && <button type="button" className="btn btn-secondary" disabled={!areaId || !sectorId || !equipmentId}
      onClick={() => { setOpen(true); setMessage(''); }}><Plus size={16} /> Agregar componente</button>}
    {open && <div className="component-creator-form" aria-busy={busy}>
      <strong>Nuevo componente en {equipmentName}</strong>
      <label>Nombre del componente
        <input autoFocus maxLength={120} value={name} disabled={busy} placeholder="Ej: Pasillo lado poniente"
          onChange={event => { setName(event.target.value); setError(''); }}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void save(); } }} />
      </label>
      <small>Quedará disponible para futuras tareas de este equipo, aunque después canceles esta OT.</small>
      <div className="component-creator-actions">
        <button type="button" className="btn btn-primary" disabled={busy || !name.trim()} onClick={() => void save()}>
          <Save size={16} /> {busy ? 'Guardando…' : 'Guardar y seleccionar'}</button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { setOpen(false); setError(''); }}><X size={16} /> Cancelar</button>
      </div>
    </div>}
    {error && <p role="alert" className="component-creator-error">{error}</p>}
    {message && <p role="status">{message}</p>}
  </div>;
}
