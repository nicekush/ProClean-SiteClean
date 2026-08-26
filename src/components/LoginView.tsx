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
    <div className="login-container">
      
      {/* Left Visual Panel */}
      <div className="login-visual-panel" style={{ backgroundColor: whiteLabel.primaryColor }}>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
            {whiteLabel.companyLogoUrl ? (
              <img src={whiteLabel.companyLogoUrl} alt="Logo" style={{ height: '44px', objectFit: 'contain' }} />
            ) : (
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: whiteLabel.actionColor, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '20px' }}>
                {whiteLabel.brandBadgeText}
              </div>
            )}
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#FFF', letterSpacing: '-0.3px', margin: 0 }}>{whiteLabel.companyName.toUpperCase()}</h2>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', letterSpacing: '1px', fontWeight: 700 }}>SITE CLEAN SYSTEM v2.0</div>
            </div>
          </div>

          <h1 style={{ fontWeight: 900, lineHeight: 1.2, marginBottom: '16px', letterSpacing: '-1px' }}>
            Plataforma de Control Operacional & Certificación Minera
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.85)', maxWidth: '480px', lineHeight: 1.5 }}>
            Gestión agnóstica multi-tenant de aseo industrial, control de adherencia de HH, flujo de firmas ITO Mandante y trazabilidad inmutable.
          </p>
        </div>

        <div style={{ position: 'relative', zIndex: 2, fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '20px' }}>
          © 2026 {whiteLabel.companyName}. Todos los derechos reservados.
        </div>
      </div>

      {/* Right Login Form */}
      <div className="login-form-panel">
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

        </div>
      </div>
    </div>
  );
};
