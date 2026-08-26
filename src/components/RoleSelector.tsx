import React from 'react';
import type { UserRole } from '../types';
import { Shield, UserCheck, HardHat, Wrench } from 'lucide-react';

interface RoleSelectorProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  userName: string;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({ currentRole, onRoleChange }) => {
  const roles: { role: UserRole; label: string; icon: any; color: string; desc: string }[] = [
    { 
      role: 'SUPERVISOR_TERRENO', 
      label: 'Supervisor de Terreno', 
      icon: HardHat, 
      color: '#05A6A6',
      desc: 'Registro de OTs, fotos y contingencias en faena'
    },
    { 
      role: 'ITO_MANDANTE', 
      label: 'Inspector / ITO Mandante Minero', 
      icon: UserCheck, 
      color: '#025951',
      desc: 'Certificación, revisión y firma de conformidad de OTs'
    },
    { 
      role: 'ADMINISTRADOR_CONTRATO', 
      label: 'Administrador de Contrato', 
      icon: Shield, 
      color: '#3F3D73',
      desc: 'Gestión de nóminas, turnos, equipos y reportes KPI'
    },
    { 
      role: 'SUPER_ADMIN', 
      label: 'Super Admin SaaS', 
      icon: Wrench, 
      color: '#B91C1C',
      desc: 'Acceso total y configuración de sistema multi-tenant'
    }
  ];

  const currentObj = roles.find(r => r.role === currentRole) || roles[0];
  const Icon = currentObj.icon;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#F1F5F9', padding: '4px 10px', borderRadius: '20px', border: '1px solid #CBD5E1' }}>
        <Icon size={14} style={{ color: currentObj.color }} />
        <select
          value={currentRole}
          onChange={(e) => onRoleChange(e.target.value as UserRole)}
          style={{
            border: 'none',
            backgroundColor: 'transparent',
            fontSize: '12px',
            fontWeight: 800,
            color: 'var(--text-main)',
            cursor: 'pointer',
            outline: 'none'
          }}
          title={currentObj.desc}
        >
          {roles.map((r) => (
            <option key={r.role} value={r.role}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
