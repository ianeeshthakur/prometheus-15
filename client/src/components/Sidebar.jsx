import React from 'react';
import { NavLink } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import './Sidebar.css';

// G-VISTA Information Architecture
// COMMAND CENTER       → Dashboard
// CAMERA INTELLIGENCE  → Camera Registry (P1), Unified Video (P2), Protocol Health (P2)
// AI & INTELLIGENCE    → AI Analytics (P3), Watchlists (P4)
// OPERATIONS          → Alerts & Investigations (P5), System Health

const navGroups = [
  {
    group: 'COMMAND CENTER',
    items: [
      {
        labelKey: 'nav_dashboard',
        path: '/',
        exact: true,
        icon: (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
          </svg>
        ),
      },
    ],
  },
  {
    group: 'CAMERA INTELLIGENCE',
    items: [
      {
        labelKey: 'nav_model1',
        path: '/registry',
        label2: 'P1',
        icon: (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
        ),
      },
      {
        labelKey: 'nav_model2',
        path: '/unified-video',
        label2: 'P2',
        icon: (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        ),
      },
      {
        labelKey: 'nav_protocol_health',
        path: '/protocol-health',
        label2: 'P2',
        icon: (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        ),
      },
    ],
  },
  {
    group: 'AI & INTELLIGENCE',
    items: [
      {
        labelKey: 'nav_ai_analytics',
        path: '/ai-analytics',
        label2: 'P3',
        icon: (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="3" />
            <circle cx="5" cy="19" r="3" />
            <circle cx="19" cy="19" r="3" />
            <line x1="12" y1="8" x2="5" y2="16" />
            <line x1="12" y1="8" x2="19" y2="16" />
          </svg>
        ),
      },
      {
        labelKey: 'nav_watchlists',
        path: '/watchlists',
        label2: 'P4',
        icon: (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        ),
      },
    ],
  },
  {
    group: 'OPERATIONS',
    items: [
      {
        labelKey: 'nav_investigation',
        path: '/investigation',
        label2: 'P5',
        icon: (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ),
      },
      {
        labelKey: 'nav_system',
        path: '/system',
        icon: (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
            <line x1="6" y1="6" x2="6.01" y2="6" />
            <line x1="6" y1="18" x2="6.01" y2="18" />
          </svg>
        ),
      },
    ],
  },
];

function Sidebar({ open = false, onClose = () => {} }) {
  const { t } = useLanguage();
  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} aria-hidden="true" />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <nav className="sidebar-nav">
          {navGroups.map((group) => (
            <div key={group.group} className="sidebar-group">
              <span className="sidebar-group-label">{group.group}</span>
              <ul className="sidebar-menu">
                {group.items.map((item) => (
                  <li key={item.path} className="sidebar-item">
                    <NavLink
                      to={item.path}
                      end={item.exact || item.path === '/'}
                      className={({ isActive }) =>
                        `sidebar-link ${isActive ? 'active' : ''}`
                      }
                    >
                      <span className="sidebar-icon">{item.icon}</span>
                      <span className="sidebar-text">{t(item.labelKey)}</span>
                      {item.label2 && <span className="sidebar-pipeline-tag">{item.label2}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

export default Sidebar;
