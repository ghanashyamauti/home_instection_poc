import React, { useState } from 'react';
import { ToastProvider } from './context/ToastContext';
import ScannerPage from './pages/ScannerPage';
import ReportsHistoryPage from './pages/ReportsHistoryPage';

function MainApp() {
  const [activeTab, setActiveTab] = useState('scanner'); // 'scanner' | 'history'

  return (
    <div className="light-app-container">
      {/* Clean Light Header */}
      <header className="clean-light-navbar">
        <div className="navbar-container">
          {/* Brand */}
          <div className="clean-brand" onClick={() => setActiveTab('scanner')}>
            <img src="/mentis-logo.png" alt="Mentis Logo" className="clean-brand-logo-img" />
            <div className="clean-brand-text">
              <span className="clean-brand-title">MENTIS<span className="clean-brand-subdot">.AI</span></span>
              <span className="clean-brand-tag">Architectural & Defect Intelligence</span>
            </div>
          </div>

          {/* Clean 2-Tab Navigation */}
          <nav className="clean-tab-nav">
            <button
              type="button"
              className={`clean-tab-btn ${activeTab === 'scanner' ? 'active' : ''}`}
              onClick={() => setActiveTab('scanner')}
              id="tab-scanner"
            >
              <span className="tab-icon">📸</span>
              <span>AI Defect Scanner</span>
            </button>
            <button
              type="button"
              className={`clean-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
              id="tab-history"
            >
              <span className="tab-icon">📋</span>
              <span>Saved Reports</span>
            </button>
          </nav>

          {/* Right Status Badge */}
          <div className="clean-nav-right">
            <span className="status-indicator-pill">
              <span className="status-dot-green"></span>
              AI Ready
            </span>
          </div>
        </div>
      </header>

      {/* Main Content View */}
      <main className="clean-main-content">
        {activeTab === 'scanner' && (
          <ScannerPage onNavigateToHistory={() => setActiveTab('history')} />
        )}

        {activeTab === 'history' && (
          <ReportsHistoryPage onNavigateToScanner={() => setActiveTab('scanner')} />
        )}
      </main>

      {/* Clean Mobile Bottom Nav */}
      <nav className="clean-mobile-dock">
        <button
          type="button"
          className={`mobile-dock-item ${activeTab === 'scanner' ? 'active' : ''}`}
          onClick={() => setActiveTab('scanner')}
        >
          <span className="dock-icon">📸</span>
          <span>Scanner</span>
        </button>
        <button
          type="button"
          className={`mobile-dock-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span className="dock-icon">📋</span>
          <span>Saved Reports</span>
        </button>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}
