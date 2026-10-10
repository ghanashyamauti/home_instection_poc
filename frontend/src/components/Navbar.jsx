import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ currentPage, onNavigate }) {
  const { user, logout } = useAuth();

  return (
    <>
      <header className="navbar-modern">
        <div className="navbar-inner">
          <div className="navbar-brand-group" onClick={() => onNavigate('dashboard')}>
            <div className="brand-logo-mark">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div className="brand-text">
              <span className="brand-name">Inspect<span className="brand-gradient-text">AI</span></span>
              <span className="brand-tagline">Inspection Intelligence</span>
            </div>
          </div>

          <nav className="navbar-links">
            <button
              className={`nav-btn ${currentPage === 'dashboard' ? 'active' : ''}`}
              onClick={() => onNavigate('dashboard')}
              id="nav-dashboard"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
              <span>Dashboard</span>
            </button>
            <button
              className={`nav-btn ${currentPage === 'new' ? 'active' : ''}`}
              onClick={() => onNavigate('new')}
              id="nav-new"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="16"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
              <span>New Inspection</span>
            </button>
          </nav>

          <div className="navbar-user-group">
            <div className="user-profile-chip" title={user?.email}>
              <div className="user-avatar-initials">
                {user?.fullName?.charAt(0)?.toUpperCase() || 'I'}
              </div>
              <div className="user-text-meta">
                <span className="user-name">{user?.fullName || 'Certified Inspector'}</span>
                <span className="user-company">{user?.company || 'Property Inspector'}</span>
              </div>
            </div>

            <button className="btn-signout" onClick={logout} id="btn-logout" title="Sign out of InspectAI">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span className="btn-signout-text">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-dock">
        <button
          className={`mobile-dock-btn ${currentPage === 'dashboard' ? 'active' : ''}`}
          onClick={() => onNavigate('dashboard')}
        >
          <span className="dock-icon">📊</span>
          <span>Dashboard</span>
        </button>
        <button
          className={`mobile-dock-btn ${currentPage === 'new' ? 'active' : ''}`}
          onClick={() => onNavigate('new')}
        >
          <span className="dock-icon">➕</span>
          <span>New</span>
        </button>
        <button
          className="mobile-dock-btn"
          onClick={logout}
        >
          <span className="dock-icon">🚪</span>
          <span>Sign Out</span>
        </button>
      </nav>
    </>
  );
}
