import React, { useState } from 'react';
import type { UserAccount } from '../types';
import { UserCheck, ShieldCheck, HardHat, Wrench, ChevronDown, LogIn, X } from 'lucide-react';

interface UserSessionSwitcherProps {
  users: UserAccount[];
  currentUser: UserAccount;
  onSelectUser: (user: UserAccount) => void;
}

export const UserSessionSwitcher: React.FC<UserSessionSwitcherProps> = ({
  users,
  currentUser,
  onSelectUser
}) => {
  const [showModal, setShowModal] = useState(false);

  const getRoleBadge = (role: UserAccount['role']) => {
    switch (role) {
      case 'SUPERVISOR_TERRENO':
        return { label: 'Supervisor Terreno', icon: HardHat, color: '#05A6A6', bg: '#E6F4F1' };
      case 'ITO_MANDANTE':
        return { label: 'ITO Mandante Minero', icon: UserCheck, color: '#025951', bg: '#ECFDF5' };
      case 'ADMINISTRADOR_CONTRATO':
        return { label: 'Admin Contrato', icon: ShieldCheck, color: '#3F3D73', bg: '#F1F5F9' };
      case 'SUPER_ADMIN':
        return { label: 'Super Admin SaaS', icon: Wrench, color: '#B91C1C', bg: '#FEF2F2' };
    }
  };

  const currentRoleBadge = getRoleBadge(currentUser.role);
  const Icon = currentRoleBadge.icon;

  return (
    <div>
      {/* Active User Session Badge in Top Header */}
      <button
        onClick={() => setShowModal(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: 'var(--color-bg-offwhite)',
          padding: '6px 14px',
          borderRadius: '30px',
          border: '1px solid var(--color-border-light)',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
        title="Haz clic para cambiar de usuario activo / Iniciar sesión"
      >
        <div
          className="user-avatar"
          style={{ backgroundColor: currentUser.avatarColor || 'var(--color-primary-dark)' }}
        >
          {currentUser.name.substring(0, 2).toUpperCase()}
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {currentUser.name}
            <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: currentRoleBadge.color }}>
            {currentRoleBadge.label}
          </div>
        </div>
      </button>

      {/* Active User Session Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#FFF', padding: '28px', borderRadius: '16px', width: '100%', maxWidth: '420px', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <ShieldCheck size={20} style={{ color: 'var(--color-action-teal)' }} />
                Sesión de Usuario Activa
              </h3>
              <button onClick={() => setShowModal(false)} className="btn btn-secondary" style={{ padding: '4px 8px' }}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '14px', border: '1px solid #E2E8F0', marginBottom: '20px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: currentUser.avatarColor || '#3F3D73',
                  color: '#FFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '18px'
                }}
              >
                {currentUser.name.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 900, fontSize: '15px', color: 'var(--color-primary-dark)' }}>{currentUser.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{currentUser.email}</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: currentRoleBadge.color, backgroundColor: currentRoleBadge.bg, padding: '3px 8px', borderRadius: '12px', marginTop: '6px' }}>
                  <Icon size={12} />
                  {currentRoleBadge.label}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowModal(false)}
                style={{ padding: '8px 16px', fontSize: '12px' }}
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
