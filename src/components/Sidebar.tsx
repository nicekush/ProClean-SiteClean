import React from 'react';
import type { WhiteLabelConfig, ClientContract, UserRole } from '../types';
import { OFFICIAL_PROCLEAN_LOGO_URL } from '../config/branding';
import { 
  ClipboardList, 
  Settings, 
  BarChart3, 
  Camera,
  SlidersHorizontal,
  History,
  X,
  Wifi,
  WifiOff,
  Database,
  ShieldCheck,
  HardHat,
  BarChart2,
  Sliders,
  MapPin,
  Users
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  whiteLabel: WhiteLabelConfig;
  activeContract?: ClientContract;
  dbConnected?: boolean;
  isOnline?: boolean;
  currentRole?: UserRole;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  whiteLabel,
  activeContract,
  dbConnected = true,
  isOnline = true,
  currentRole = 'SUPERVISOR_TERRENO',
  isOpenMobile = false,
  onCloseMobile
}) => {
  const companyLogoUrl = whiteLabel.companyLogoUrl || OFFICIAL_PROCLEAN_LOGO_URL;

  interface DomainItem {
    id: string;
    label: string;
    icon: any;
    allowedRoles?: UserRole[];
  }

  interface DomainGroup {
    title: string;
    icon: any;
    allowedRoles: UserRole[];
    items: DomainItem[];
  }

  // Domain Groups Definition with RBAC Permissions
  const domainGroups: DomainGroup[] = [
    {
      title: 'OPERACIÓN TERRENO',
      icon: HardHat,
      allowedRoles: ['SUPERVISOR_TERRENO', 'ITO_MANDANTE', 'ADMINISTRADOR_CONTRATO', 'SUPER_ADMIN'],
      items: [
        { id: 'work-orders', label: 'Órdenes de Trabajo', icon: ClipboardList, allowedRoles: ['SUPERVISOR_TERRENO', 'ITO_MANDANTE', 'ADMINISTRADOR_CONTRATO', 'SUPER_ADMIN'] },
        { id: 'personnel-coverage', label: 'Dotación & Cobertura', icon: Users, allowedRoles: ['SUPERVISOR_TERRENO', 'ITO_MANDANTE', 'ADMINISTRADOR_CONTRATO', 'SUPER_ADMIN'] },
        { id: 'map-operational', label: 'Mapa Operacional Zaldívar', icon: MapPin, allowedRoles: ['ITO_MANDANTE', 'ADMINISTRADOR_CONTRATO', 'SUPER_ADMIN'] },
        { id: 'evidences', label: 'Evidencias Fotográficas', icon: Camera, allowedRoles: ['ITO_MANDANTE', 'ADMINISTRADOR_CONTRATO', 'SUPER_ADMIN'] }
      ]
    },
    {
      title: 'ANALÍTICA Y AUDITORÍA',
      icon: BarChart2,
      allowedRoles: ['ITO_MANDANTE', 'ADMINISTRADOR_CONTRATO', 'SUPER_ADMIN'],
      items: [
        { id: 'dashboard', label: 'Reporte KPI Operacional', icon: BarChart3, allowedRoles: ['ITO_MANDANTE', 'ADMINISTRADOR_CONTRATO', 'SUPER_ADMIN'] },
        { id: 'reporting-control', label: 'Control de reportabilidad', icon: ClipboardList, allowedRoles: ['ADMINISTRADOR_CONTRATO', 'SUPER_ADMIN'] },
        { id: 'audit-logs', label: 'Historial de Auditoría', icon: History, allowedRoles: ['ITO_MANDANTE', 'ADMINISTRADOR_CONTRATO', 'SUPER_ADMIN'] }
      ]
    },
    {
      title: 'PARAMETRIZACIÓN & SAAS',
      icon: Sliders,
      allowedRoles: ['ADMINISTRADOR_CONTRATO', 'SUPER_ADMIN'],
      items: [
        { id: 'parameters', label: 'Parámetros Operativos', icon: Settings },
        { id: 'system-config', label: 'Configuración General', icon: SlidersHorizontal }
      ]
    }
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <div 
        className={`mobile-overlay ${isOpenMobile ? 'open' : ''}`}
        onClick={onCloseMobile}
      />

      {/* Sidebar / Off-Canvas Mobile Drawer */}
      <aside 
        className={`sidebar ${isOpenMobile ? 'open' : ''}`} 
      >
        <div className="sidebar-header" style={{ position: 'relative', justifyContent: 'center', padding: '24px 20px' }}>
          {companyLogoUrl ? (
            <img 
              src={companyLogoUrl}
              alt="Logo ProClean" 
              style={{ height: '56px', maxWidth: '210px', objectFit: 'contain' }} 
            />
          ) : (
            <div 
              style={{ 
                width: '100%',
                height: '52px',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '22px',
                color: '#ffffff',
                background: 'linear-gradient(135deg, #FF7A00 0%, #E66E00 100%)',
                boxShadow: '0 8px 22px rgba(255, 122, 0, 0.32)',
                letterSpacing: '-0.04em'
              }}
            >
              {whiteLabel.companyName || 'ProCleanMG'}
            </div>
          )}

          {/* Close button on mobile drawer (< 1024px) */}
          {onCloseMobile && (
            <button 
              onClick={onCloseMobile}
              className="hamburger-btn"
              style={{ background: 'none', border: 'none', color: 'var(--slate-900)', cursor: 'pointer', padding: '4px', position: 'absolute', right: '12px' }}
              title="Cerrar Menú"
            >
              <X size={20} />
            </button>
          )}
        </div>
        
        {/* Status Badges on Mobile Drawer Header (Only visible on mobile drawer < 1024px) */}
        <div className="mobile-drawer-status-block" style={{ padding: '12px 16px', backgroundColor: 'var(--slate-50)', borderBottom: '1px solid var(--slate-200)', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800 }}>
            <span style={{ color: 'var(--slate-600)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isOnline ? <Wifi size={14} style={{ color: '#10B981' }} /> : <WifiOff size={14} style={{ color: '#EF4444' }} />}
              {isOnline ? 'En Línea' : 'Modo Offline Sync'}
            </span>
            
            <span style={{ color: 'var(--slate-600)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Database size={14} style={{ color: dbConnected ? '#FF7A00' : '#F59E0B' }} />
              {dbConnected ? 'BD LOCAL REST' : 'Conectando...'}
            </span>
          </div>

          {activeContract && (
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#FF7A00', backgroundColor: '#fff7ed', padding: '4px 10px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #ffedd5' }}>
              <ShieldCheck size={14} />
              Contrato: {activeContract.clientName}
            </div>
          )}
        </div>

        {/* Domain-Grouped Navigation with RBAC UI Guards */}
        <nav className="sidebar-menu">
          {domainGroups.map((group) => {
            // Check group-level RBAC
            if (!group.allowedRoles.includes(currentRole)) return null;

            // Filter item-level RBAC
            const validItems = group.items.filter(item => !item.allowedRoles || item.allowedRoles.includes(currentRole));
            if (validItems.length === 0) return null;

            return (
              <div key={group.title} style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '10px', fontWeight: 900, color: 'var(--slate-400)', letterSpacing: '0.1em', padding: '4px 12px 6px', textTransform: 'uppercase' }}>
                  {group.title}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {validItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        className={`nav-item ${isActive ? 'active' : ''}`}
                        onClick={() => {
                          setActiveTab(item.id);
                          if (onCloseMobile) onCloseMobile();
                        }}
                      >
                        <Icon size={18} style={{ color: isActive ? 'var(--orange)' : 'var(--slate-400)' }} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--slate-100)' }}>
          <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--slate-400)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <div>ProCleanMG Software</div>
            <div style={{ color: 'var(--orange)', marginTop: '2px' }}>Enterprise ERP v2.0</div>
          </div>
        </div>
      </aside>
    </>
  );
};
