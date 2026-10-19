import { useEffect, useState } from 'react';
import type { ClientContract, PlantArea, UserAccount, UserRole } from '../types';
import { PERMISSIONS, ROLE_LABELS, ROLE_PERMISSIONS, effectivePermissions, normalizePermissions, togglePermission } from '../security/permissions';
import type { PermissionProfile } from '../security/permissions';
import { usePermissions } from '../security/PermissionContext';
import { removeAccessUser, saveAccessUser, savePermissionProfile } from '../api/access';
import { subscribeFirebaseCollectionByField } from '../api/firebase';
import { isFirebaseAuthRequired } from '../api/auth';
import './AccessManager.css';

export function AccessManager({ users, contracts, plantAreas, onSaved }: {
  users: UserAccount[]; contracts: ClientContract[]; plantAreas: PlantArea[];
  onSaved: (saved: UserAccount | null, removedId?: string) => void;
}) {
  const { user: actor, can } = usePermissions();
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<UserAccount | null>(null);
  const [password, setPassword] = useState('');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [profiles, setProfiles] = useState<PermissionProfile[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [templateTargetId, setTemplateTargetId] = useState('');
  const previous = users.find(u => u.id === selectedId);
  const protectedUser = draft?.id === actor?.id || draft?.role === 'SUPER_ADMIN';
  const mayChangeAccess = can('access.manage') && !protectedUser;
  const grants = effectivePermissions(actor);
  const enabled = draft?.permissions || [];
  const groups = [...new Set(PERMISSIONS.map(p => p.group))];
  const actorId = actor?.id;
  const actorTenantId = actor?.tenantId || 'tenant_cmz';
  const mayViewAccess = can('access.view');
  useEffect(() => {
    if (!actorId || !mayViewAccess) return;
    return subscribeFirebaseCollectionByField<PermissionProfile>('permission_profiles', 'tenantId', actorTenantId, setProfiles) || undefined;
  }, [actorId, actorTenantId, mayViewAccess]);
  const select = (account: UserAccount) => {
    setSelectedId(account.id); setDraft({ ...account, permissions: effectivePermissions(account), allowedAreaIds: account.allowedAreaIds || [] });
    setTemplateTargetId(profiles.some(p => p.id === account.permissionProfileId) ? account.permissionProfileId! : '');
    setTemplateName(profiles.find(p => p.id === account.permissionProfileId)?.name || '');
    setPassword(''); setMessage(''); setError('');
  };
  const create = () => {
    setSelectedId(''); setDraft({ id: crypto.randomUUID(), name: '', email: '', role: 'CLIENTE_VISUALIZADOR', active: true,
      tenantId: actor?.tenantId || 'tenant_cmz', contractId: actor?.accessScope === 'CONTRACT' ? actor.contractId : contracts[0]?.id || '', accessScope: 'CONTRACT',
      permissions: can('access.manage') ? ROLE_PERMISSIONS.CLIENTE_VISUALIZADOR : [], permissionProfileId: can('access.manage') ? 'CLIENTE_VISUALIZADOR' : '', allowedAreaIds: actor?.allowedAreaIds || [] });
    setTemplateTargetId(''); setTemplateName('');
    setPassword(''); setMessage(''); setError('');
  };
  const changePermission = (id: string, checked: boolean) => {
    if (!draft) return;
    const next = togglePermission(enabled, id, checked);
    const other = checked ? next.filter(p => p !== id && !enabled.includes(p)) : enabled.filter(p => p !== id && !next.includes(p));
    if (!checked && other.length && !confirm(`Al desactivar este permiso también se quitarán:\n${other.map(id => PERMISSIONS.find(p => p.id === id)?.label).join('\n')}\n\n¿Aplicar al borrador?`)) return;
    setDraft({ ...draft, permissions: next, permissionProfileId: '' });
    setMessage(other.length ? `${checked ? 'Se habilitaron los requisitos' : 'Se desactivaron los permisos dependientes'}: ${other.join(', ')}. Guarda para aplicar.` : 'Hay cambios pendientes de guardar.');
  };
  const applyTemplate = (id: string) => {
    if (!draft) return;
    if (!id) { setDraft({ ...draft, permissionProfileId: '' }); return; }
    const builtin = ROLE_PERMISSIONS[id as UserRole];
    const next = builtin || profiles.find(p => p.id === id)?.permissions || [];
    const normalized = normalizePermissions(next);
    if (normalized.some(p => !grants.includes(p))) { setError('La plantilla incluye permisos que tu cuenta no puede otorgar.'); return; }
    setTemplateTargetId(builtin ? '' : id); setTemplateName(profiles.find(p => p.id === id)?.name || '');
    setDraft({ ...draft, permissions: normalized, permissionProfileId: id,
      ...(builtin ? { role: id as UserRole } : {}),
      ...(id === 'CLIENTE_VISUALIZADOR' ? { accessScope: 'CONTRACT' as const } : {}) });
    setMessage('Plantilla aplicada al borrador. Guarda para confirmar.');
  };
  const save = async () => {
    if (!actor || !draft) return;
    setBusy(true); setError(''); setMessage('');
    try {
      if (!draft.name.trim() || !draft.email.trim()) throw new Error('Completa nombre y correo.');
      if (draft.accessScope === 'CONTRACT' && !draft.contractId) throw new Error('Selecciona el contrato autorizado.');
      if (draft.allowedAreaIds && draft.allowedAreaIds.length > 10) throw new Error('Puedes seleccionar hasta 10 áreas.');
      let next = { ...draft, name: draft.name.trim(), email: draft.email.trim().toLowerCase() };
      if (previous && !mayChangeAccess) next = { ...previous, name: next.name, active: next.active };
      if (protectedUser && previous) next = { ...previous, name: next.name };
      if (!previous && password.length < 6) throw new Error('La contraseña inicial debe tener al menos 6 caracteres.');
      const saved = await saveAccessUser(actor, next, previous, password);
      onSaved(saved); setSelectedId(saved.id); setDraft({ ...saved }); setPassword(''); setMessage('Cambios confirmados en Firebase y registrados en auditoría.');
    } catch (e) { setError(e instanceof Error ? e.message : 'No fue posible guardar los cambios.'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!actor || !previous || protectedUser || !confirm(`¿Retirar el acceso de ${previous.email}?`)) return;
    setBusy(true); setError('');
    try { await removeAccessUser(actor, previous); onSaved(null, previous.id); setDraft(null); setSelectedId(''); setMessage('Acceso retirado y registrado en auditoría.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'No fue posible retirar el acceso.'); }
    finally { setBusy(false); }
  };
  const saveTemplate = async (overwrite = false) => {
    if (!actor || !draft || !templateName.trim()) return;
    const existing = profiles.find(p => p.id === templateTargetId);
    if (overwrite && !confirm('¿Actualizar esta plantilla? Los usuarios conservan sus permisos hasta que vuelvas a aplicarla y guardes sus accesos.')) return;
    setBusy(true); setError('');
    try {
      const profile = { id: overwrite && existing ? existing.id : crypto.randomUUID(), name: templateName.trim(), tenantId: actor.tenantId || 'tenant_cmz', permissions: normalizePermissions(enabled) };
      await savePermissionProfile(actor, profile);
      setDraft({ ...draft, permissionProfileId: profile.id }); setTemplateTargetId(profile.id);
      setMessage('Plantilla guardada. Al aplicarla a una persona, guarda también sus accesos.');
    } catch (e) { setError(e instanceof Error ? e.message : 'No fue posible guardar la plantilla.'); }
    finally { setBusy(false); }
  };
  return <section className="access-manager">
    <header><div><h3>Usuarios y permisos</h3><p>Selecciona una persona, aplica una plantilla y ajusta sus accesos.</p></div>
      {can('users.create') && <button className="btn btn-primary" onClick={create} disabled={busy}>Crear usuario</button>}</header>
    {!isFirebaseAuthRequired && <p className="access-notice">Modo de autenticación heredado. Antes de entregar acceso externo se debe activar Firebase Authentication y publicar las reglas de seguridad.</p>}
    {error && <p role="alert" className="access-error">{error}</p>}{message && <p role="status" className="access-notice">{message}</p>}
    <div className="access-layout"><aside className="access-directory">
      <input aria-label="Buscar usuario" placeholder="Buscar por nombre o correo" value={search} onChange={e => setSearch(e.target.value)} />
      {users.filter(u => `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase())).map(u => <button key={u.id} aria-pressed={selectedId === u.id} onClick={() => select(u)} disabled={busy}>
        <strong>{u.name}</strong><small>{u.email}</small><span>{ROLE_LABELS[u.role] || u.role} · {u.active ? 'Activo' : 'Deshabilitado'}</span>
      </button>)}
    </aside><div className="access-editor">{!draft ? <p>Selecciona un usuario para consultar o modificar sus permisos.</p> : <>
      <div className="access-fields">
        <label>Nombre<input value={draft.name} disabled={busy || (!!previous && !can('users.edit'))} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
        <label>Correo<input type="email" value={draft.email} disabled={busy || !!previous} onChange={e => setDraft({ ...draft, email: e.target.value })} /></label>
        {!previous && <label>Contraseña inicial<input type="password" autoComplete="new-password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} /></label>}
        <label>Estado<select value={String(draft.active)} disabled={busy || protectedUser || (!!previous && !can('users.disable'))} onChange={e => setDraft({ ...draft, active: e.target.value === 'true' })}><option value="true">Activo</option><option value="false">Deshabilitado</option></select></label>
      </div>
      {can('access.view') && <>
        {protectedUser && <p className="access-notice">La cuenta principal y tus propios accesos están protegidos contra cambios desde este panel.</p>}
        <div className="access-fields">
          <label>Plantilla de permisos<select aria-label="Plantilla de permisos" value={draft.permissionProfileId || ''} disabled={busy || !mayChangeAccess} onChange={e => applyTemplate(e.target.value)}>
            <option value="">Personalizado</option>{Object.entries(ROLE_LABELS).filter(([role]) => role !== 'SUPER_ADMIN').map(([role, label]) => <option key={role} value={role} disabled={ROLE_PERMISSIONS[role as UserRole].some(p => !grants.includes(p))}>{label}</option>)}
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>
          <label>Alcance<select value={draft.accessScope || 'TENANT'} disabled={busy || !mayChangeAccess || actor?.accessScope === 'CONTRACT'} onChange={e => setDraft({ ...draft, accessScope: e.target.value as 'TENANT' | 'CONTRACT' })}><option value="TENANT">Todos los contratos de la empresa</option><option value="CONTRACT">Solo el contrato seleccionado</option></select></label>
          {draft.accessScope === 'CONTRACT' && <label>Contrato autorizado<select value={draft.contractId || ''} disabled={busy || !mayChangeAccess || actor?.accessScope === 'CONTRACT'} onChange={e => setDraft({ ...draft, contractId: e.target.value })}><option value="">Seleccionar contrato</option>{contracts.map(c => <option key={c.id} value={c.id}>{c.clientName} · {c.contractNumber}</option>)}</select></label>}
        </div>
        <fieldset disabled={busy || !mayChangeAccess}><legend>Áreas operacionales autorizadas</legend><p>Sin selección: todas las áreas del contrato. La restricción por áreas se aplica a OT, mapas y KPI.</p><div className="access-area-list">{plantAreas.map(a => <label key={a.id}><input type="checkbox" disabled={!!actor?.allowedAreaIds?.length && !actor.allowedAreaIds.includes(a.id)} checked={draft.allowedAreaIds?.includes(a.id) || false} onChange={e => setDraft({ ...draft, allowedAreaIds: e.target.checked ? [...(draft.allowedAreaIds || []), a.id] : draft.allowedAreaIds?.filter(id => id !== a.id) })} />{a.name}</label>)}</div></fieldset>
        <div className="access-permission-header"><strong>{enabled.length} permisos habilitados</strong><span>Los requisitos se habilitan automáticamente.</span></div>
        <div className="access-permission-groups">{groups.map(group => <fieldset key={group} disabled={busy || !mayChangeAccess}><legend>{group}</legend>{PERMISSIONS.filter(p => p.group === group).map(p => <label key={p.id} className="access-permission"><input type="checkbox" aria-label={p.label} checked={enabled.includes(p.id)} disabled={!grants.includes(p.id) || p.id === 'maintenance.reset'} onChange={e => changePermission(p.id, e.target.checked)} /><span>{p.label}{p.requires.length > 0 && <small>Requiere: {p.requires.map(id => PERMISSIONS.find(item => item.id === id)?.label).join(' · ')}</small>}</span></label>)}</fieldset>)}</div>
        {can('access.profiles') && mayChangeAccess && <div className="access-template"><label>Nombre de plantilla<input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Ej.: Cliente con reportes" /></label><button className="btn btn-secondary" disabled={busy || !templateName.trim()} onClick={() => saveTemplate()}>Guardar como nueva plantilla</button>{profiles.some(p => p.id === templateTargetId) && <button className="btn btn-secondary" disabled={busy || !templateName.trim()} onClick={() => saveTemplate(true)}>Actualizar plantilla seleccionada</button>}<small>Las plantillas se copian al usuario al aplicarlas. Editar una plantilla no cambia accesos ya guardados.</small></div>}
      </>}
      <footer>{(can('users.edit') || can('users.disable') || mayChangeAccess || !previous) && <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>}{previous && can('users.delete') && !protectedUser && <button className="btn btn-secondary" disabled={busy} onClick={remove}>Retirar acceso</button>}</footer>
    </>}</div></div>
  </section>;
}
