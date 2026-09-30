import { useEffect, useRef, useState } from 'react';

async function preparePhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Selecciona una imagen JPG, PNG o WebP.');
  if (file.size > 20 * 1024 * 1024) throw new Error('La imagen debe pesar menos de 20 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    let scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    // Both embedded photos must fit comfortably within a Firestore document.
    for (let attempt = 0; attempt < 7; attempt++) {
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('No se pudo procesar la imagen.');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const result = canvas.toDataURL('image/jpeg', 0.78);
      if (result.length <= 220000) return result;
      scale *= 0.75;
    }
    throw new Error('La imagen sigue siendo demasiado grande. Selecciona otra fotografía.');
  } finally { URL.revokeObjectURL(url); }
}

export function WorkOrderPhotoInput({ label, value, onChange, onBusyChange }: {
  label: string; value?: string; onChange: (value: string) => void; onBusyChange: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  return <div style={{ flex: '1 1 240px', minWidth: 0, border: '1px solid #CBD5E1', borderRadius: 12, padding: 16 }}>
    <label style={{ display: 'block', fontWeight: 800 }}>{label}
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} style={{ display: 'block', marginTop: 12, maxWidth: '100%' }} onChange={async e => {
        const file = e.target.files?.[0]; e.target.value = '';
        if (!file) return;
        setBusy(true); setError(''); onBusyChange(true);
        try { const photo = await preparePhoto(file); if (active.current) onChange(photo); }
        catch (err) { if (active.current) setError(err instanceof Error ? err.message : 'No se pudo leer la imagen.'); }
        finally { if (active.current) setBusy(false); onBusyChange(false); }
      }} />
    </label>
    {busy && <p role="status">Preparando imagen…</p>}
    {error && <p role="alert" style={{ color: '#B91C1C' }}>{error}</p>}
    {value && <><img src={value} alt={label} style={{ display: 'block', width: '100%', height: 180, objectFit: 'contain', marginTop: 12 }} />
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => onChange('')} style={{ marginTop: 8 }}>Quitar imagen</button></>}
    {!value && !busy && <p style={{ color: '#64748B', fontSize: 13 }}>Sin imagen seleccionada</p>}
  </div>;
}
