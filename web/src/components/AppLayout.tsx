import { useState } from 'react';
import { Bell, ChevronRight, HeartPulse, LogOut } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getHomeForRole, menuForRole } from '../security/access';

export function AppLayout() {
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user, logout } = useAuth();
  if (!user) return null;
  const menuItems = menuForRole(user.role);

  return (
    <div className={`app-shell${isSidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <header className="topbar">
        <NavLink to={getHomeForRole(user.role)} className="brand" aria-label="ClinicalStudyPB início">
          <HeartPulse size={39} strokeWidth={2.2} />
          <span>ClinicalStudyPB</span>
        </NavLink>
        <div className="topbar-actions">
          <button className="round-icon" type="button" aria-label="Notificações" title="Notificações"><Bell size={18} /></button>
          <button className="logout-button" type="button" onClick={logout} aria-label="Sair da conta" title="Sair da conta"><LogOut size={16} /><span>Sair</span></button>
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar" id="app-sidebar">
          <div className="sidebar-user">
            <div className="avatar avatar-solid">{initials(user.name)}</div>
            <div className="sidebar-user-copy"><strong>{user.name}</strong><span>{user.role}</span></div>
          </div>
          <nav className="sidebar-nav" aria-label={`Menu do perfil ${user.role}`}>
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.path} to={item.path} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                  <Icon size={16} strokeWidth={1.8} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </aside>
        <main className="main-content"><Outlet /></main>
      </div>
      <button
        className="sidebar-edge-control"
        type="button"
        aria-label={isSidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
        aria-controls="app-sidebar"
        aria-expanded={!isSidebarCollapsed}
        title={isSidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
        onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase() ?? '').join('');
}
