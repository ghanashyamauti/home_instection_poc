import React, { useState, useEffect } from 'react';
import { getInspections, deleteInspection } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage({ onNavigate }) {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const { addToast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    loadInspections();
  }, []);

  async function loadInspections() {
    try {
      const data = await getInspections();
      setInspections(data);
    } catch (err) {
      addToast('Failed to load inspections', 'error');
    }
    setLoading(false);
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!confirm('Are you sure you want to permanently delete this inspection and all associated findings?')) return;
    try {
      await deleteInspection(id);
      setInspections(prev => prev.filter(i => i.id !== id));
      addToast('Inspection removed from portfolio', 'success');
    } catch (err) {
      addToast('Failed to delete inspection', 'error');
    }
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  const totalInspections = inspections.length;
  const totalFindings = inspections.reduce((sum, i) => sum + parseInt(i.finding_count || 0), 0);
  const inProgressCount = inspections.filter(i => i.status === 'in_progress').length;
  const completedCount = inspections.filter(i => i.status === 'completed').length;

  const filteredInspections = inspections.filter(i => {
    const matchesStatus = statusFilter === 'ALL' || i.status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      i.title?.toLowerCase().includes(q) ||
      i.property_address?.toLowerCase().includes(q) ||
      i.client_name?.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  if (loading) {
    return (
      <div className="main-content">
        <div className="loader-container">
          <div className="analyzing-spinner"></div>
          <p className="text-secondary mt-md">Loading your inspections portfolio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      {/* Dashboard Welcome Header */}
      <div className="dashboard-hero">
        <div className="dashboard-hero-content">
          <div className="dashboard-hero-badge">
            <span className="pulse-dot"></span> System Live & Operational
          </div>
          <h1 className="dashboard-hero-title">
            Welcome back, <span className="highlight-gradient">{user?.fullName?.split(' ')[0] || 'Inspector'}</span> 👋
          </h1>
          <p className="dashboard-hero-subtitle">
            AI-assisted defect detection portfolio. Review active property audits or initiate a new inspection report.
          </p>
        </div>

        <button
          className="btn btn-primary btn-lg shadow-glow"
          onClick={() => onNavigate('new')}
          id="btn-new-inspection"
        >
          ➕ New Inspection
        </button>
      </div>

      {/* Metric Cards Grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon-box metric-blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div className="metric-details">
            <div className="metric-label">Total Properties</div>
            <div className="metric-value">{totalInspections}</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box metric-purple">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
          <div className="metric-details">
            <div className="metric-label">Identified Findings</div>
            <div className="metric-value">{totalFindings}</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box metric-amber">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="metric-details">
            <div className="metric-label">In Progress</div>
            <div className="metric-value">{inProgressCount}</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box metric-emerald">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div className="metric-details">
            <div className="metric-label">Completed Audits</div>
            <div className="metric-value">{completedCount}</div>
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="portfolio-toolbar">
        <div className="portfolio-filter-tabs">
          <button
            className={`tab-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            All Inspections ({totalInspections})
          </button>
          <button
            className={`tab-btn ${statusFilter === 'in_progress' ? 'active' : ''}`}
            onClick={() => setStatusFilter('in_progress')}
          >
            In Progress ({inProgressCount})
          </button>
          <button
            className={`tab-btn ${statusFilter === 'completed' ? 'active' : ''}`}
            onClick={() => setStatusFilter('completed')}
          >
            Completed ({completedCount})
          </button>
        </div>

        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search address or client..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Inspections Cards List */}
      {inspections.length === 0 ? (
        <div className="empty-state-modern">
          <div className="empty-state-illustration">🏠</div>
          <h3>No Property Audits Yet</h3>
          <p>Get started by initiating your first AI-assisted property inspection.</p>
          <button className="btn btn-primary btn-lg shadow-glow mt-md" onClick={() => onNavigate('new')}>
            ➕ Create First Inspection
          </button>
        </div>
      ) : filteredInspections.length === 0 ? (
        <div className="empty-state-modern">
          <div className="empty-state-illustration">🔍</div>
          <h3>No matching inspections</h3>
          <p>Try clearing your search query or switching filters.</p>
          <button className="btn btn-secondary mt-md" onClick={() => { setStatusFilter('ALL'); setSearchQuery(''); }}>
            Reset Filter
          </button>
        </div>
      ) : (
        <div className="inspections-list-grid">
          {filteredInspections.map((inspection, idx) => (
            <div
              key={inspection.id}
              className="inspection-card-modern animate-fade-in"
              style={{ animationDelay: `${idx * 0.05}s` }}
              onClick={() => onNavigate('inspection', inspection.id)}
            >
              <div className="card-top-bar">
                <span className={`badge-status badge-status-${inspection.status}`}>
                  {inspection.status === 'in_progress' ? '● In Progress' :
                   inspection.status === 'completed' ? '✓ Completed' : '📋 Reviewed'}
                </span>
                <span className="property-type-tag">
                  {inspection.property_type ? inspection.property_type.toUpperCase() : 'RESIDENTIAL'}
                </span>
              </div>

              <div className="card-content-area">
                <h3 className="card-inspection-title">{inspection.title}</h3>
                
                {inspection.property_address && (
                  <div className="card-meta-row">
                    <span className="card-meta-icon">📍</span>
                    <span className="card-address">{inspection.property_address}</span>
                  </div>
                )}

                {inspection.client_name && (
                  <div className="card-meta-row">
                    <span className="card-meta-icon">👤</span>
                    <span>Client: {inspection.client_name}</span>
                  </div>
                )}
              </div>

              <div className="card-footer-bar">
                <div className="footer-stats-group">
                  <span className="findings-counter">
                    📸 <strong>{inspection.finding_count || 0}</strong> findings
                  </span>
                  <span className="date-stamp">
                    🗓️ {formatDate(inspection.created_at)}
                  </span>
                </div>

                <div className="card-actions-group">
                  <button
                    className="btn-icon-delete"
                    onClick={(e) => handleDelete(inspection.id, e)}
                    title="Delete inspection"
                  >
                    🗑️
                  </button>
                  <span className="card-arrow-link">View Report →</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
