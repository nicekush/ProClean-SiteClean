import React, { useState } from 'react';
import type { WhiteLabelConfig, UserAccount } from '../types';
import { loginUser } from '../api/client';
import { Lock, Mail, Shield, AlertCircle, ArrowRight, HardHat, UserCheck, Wrench, Building } from 'lucide-react';

interface LoginViewProps {
  whiteLabel: WhiteLabelConfig;
  onLoginSuccess: (user: UserAccount) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ whiteLabel, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await loginUser(email, password);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Credenciales inválidas o error de conexión con la base de datos.');
    } finally {
      setLoading(false);
    }
  };

  const fillQuickPreset = (presetEmail: string, presetPass: string) => {
    setEmail(presetEmail);
    setPassword(presetPass);
    setErrorMsg(null);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: 'var(--color-bg-offwhite)' }}>
      
      {/* Left Visual Panel */}
      <div style={{ flex: 1, backgroundColor: whiteLabel.primaryColor, color: '#FFF', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '60px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '40px' }}>
            {whiteLabel.companyLogoUrl ? (
              <img src={whiteLabel.companyLogoUrl} alt="Logo" style={{ height: '48px', objectFit: 'contain' }} />
            ) : (
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: whiteLabel.actionColor, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '20px' }}>
                {whiteLabel.brandBadgeText}
              </div>
            )}
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#FFF', letterSpacing: '-0.3px' }}>{whiteLabel.companyName.toUpperCase()}</h2>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', letterSpacing: '1px', fontWeight: 700 }}>SITE CLEAN SYSTEM v2.0</div>
            </div>
          </div>

          <h1 style={{ fontSize: '36px', fontWeight: 900, lineHeight: 1.2, marginBottom: '20px', letterSpacing: '-1px' }}>
            Plataforma de Control Operacional & Certificación Minera
          </h1>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.8)', maxWidth: '480px', lineHeight: 1.6 }}>
            Gestión agnóstica multi-tenant de aseo industrial, control de adherencia de HH, flujo de firmas ITO Mandante y trazabilidad inmutable.
          </p>
        </div>

        <div style={{ position: 'relative', zIndex: 2, fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
          © 2026 {whiteLabel.companyName}. Todos los derechos reservados.
        </div>
      </div>

      {/* Right Login Form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <div style={{ width: '100%', maxWidth: '440px' }}>
          
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '26px', fontWeight: 900, color: 'var(--color-primary-dark)', letterSpacing: '-0.5px' }}>
              Iniciar Sesión
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Ingresa tus credenciales de usuario y rol asignado
            </p>
          </div>

          {errorMsg && (
            <div style={{ backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={18} />
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
                Correo Electrónico
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  placeholder="ejemplo@empresa.cl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px 12px 42px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '14px', fontWeight: 600 }}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
                Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px 12px 42px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '14px', fontWeight: 600 }}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '14px', justifyContent: 'center', fontSize: '14px', fontWeight: 800, borderRadius: '10px' }}
            >
              {loading ? 'Autenticando...' : 'Ingresar a la Plataforma'} <ArrowRight size={18} />
            </button>
          </form>

          {/* Quick Demo Credentials Assistant */}
          <div style={{ marginTop: '36px', paddingTop: '24px', borderTop: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
              Credenciales de Prueba Rápida (Selecciona una cuenta):
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '8px 10px', fontSize: '11px', justifyContent: 'flex-start' }}
                onClick={() => fillQuickPreset('cmendoza@contratista.cl', '123')}
              >
                <HardHat size={14} style={{ color: '#05A6A6' }} /> Supervisor Terreno
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '8px 10px', fontSize: '11px', justifyContent: 'flex-start' }}
                onClick={() => fillQuickPreset('palarcon@codelco.cl', '123')}
              >
                <UserCheck size={14} style={{ color: '#025951' }} /> ITO Mandante Minero
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '8px 10px', fontSize: '11px', justifyContent: 'flex-start' }}
                onClick={() => fillQuickPreset('rgomez@contratista.cl', '123')}
              >
                <Shield size={14} style={{ color: '#3F3D73' }} /> Admin Contrato
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '8px 10px', fontSize: '11px', justifyContent: 'flex-start' }}
                onClick={() => fillQuickPreset('admin@siteclean.io', 'admin')}
              >
                <Wrench size={14} style={{ color: '#B91C1C' }} /> Super Admin SaaS
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
