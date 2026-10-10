import React, { useState, useEffect } from 'react';
import { getRecentFindings, deleteFinding } from '../services/api';
import { useToast } from '../context/ToastContext';
import { generatePdfReport } from '../services/pdfGenerator';

export default function ReportsHistoryPage({ onNavigateToScanner }) {
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const { addToast } = useToast();

  useEffect(() => {
    loadFindings();
  }, []);

  async function loadFindings() {
    try {
      const data = await getRecentFindings();
      setFindings(data);
    } catch (err) {
      addToast('Failed to load saved reports', 'error');
    }
    setLoading(false);
  }

  async function handleDelete(inspectionId, findingId, e) {
    e.stopPropagation();
    if (!confirm('Delete this inspection record?')) return;
    try {
      await deleteFinding(inspectionId, findingId);
      setFindings(prev => prev.filter(f => f.id !== findingId));
      addToast('Record deleted', 'success');
    } catch (err) {
      addToast('Failed to delete', 'error');
    }
  }

  function handleDownloadReport(finding) {
    try {
      const reportData = {
        title: finding.ai_issue || 'Inspection Finding Report',
        property_address: finding.location_in_property || finding.property_address || 'Property Inspection',
        property_type: 'Residential',
        created_at: finding.created_at || new Date().toISOString(),
        findings: [finding]
      };
      generatePdfReport(reportData);
      addToast('PDF Report downloaded!', 'success');
    } catch (err) {
      addToast('Failed to generate PDF', 'error');
    }
  }

  const categoryIcons = {
    'Structural': '🏛️',
    'Electrical': '⚡',
    'Plumbing': '🚰',
    'Surface': '🎨',
    'Moisture/Water': '💧',
    'Mold/Biological': '🍄',
    'Safety Hazard': '⚠️',
    'General Property Damage': '🏚️'
  };

  const filteredFindings = findings.filter(f => {
    const matchesSev = severityFilter === 'ALL' || f.ai_severity === severityFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      f.ai_issue?.toLowerCase().includes(q) ||
      f.ai_category?.toLowerCase().includes(q) ||
      f.location_in_property?.toLowerCase().includes(q) ||
      f.inspector_comment?.toLowerCase().includes(q);
    return matchesSev && matchesSearch;
  });

  if (loading) {
    return (
      <div className="reports-history-page">
        <div className="clean-loader">
          <div className="clean-spinner"></div>
          <p>Loading saved reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-history-page">
      {/* Page Title */}
      <div className="page-header-row">
        <div>
          <h1 className="scanner-title">Mentis Audit Portfolio ({findings.length})</h1>
          <p className="scanner-subtitle">
            Repository of all AI-diagnosed architectural defects, historical inspections, and exported PDF reports.
          </p>
        </div>

        <button
          type="button"
          className="btn-primary-action btn-sm"
          onClick={onNavigateToScanner}
        >
          ➕ Scan New Defect
        </button>
      </div>

      {/* Toolbar & Filters */}
      <div className="history-toolbar">
        <div className="filter-pills-row">
          {['ALL', 'Critical', 'High', 'Medium', 'Low'].map((sev) => (
            <button
              key={sev}
              type="button"
              className={`filter-pill ${severityFilter === sev ? 'active' : ''}`}
              onClick={() => setSeverityFilter(sev)}
            >
              {sev === 'ALL' ? 'All Severities' : sev}
            </button>
          ))}
        </div>

        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search saved defects..."
            className="clean-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* List of Saved Findings */}
      {findings.length === 0 ? (
        <div className="clean-card empty-history-card">
          <div className="empty-icon">📁</div>
          <h3>No Saved Reports Yet</h3>
          <p>Scanned defects will automatically appear here with full PDF export options.</p>
          <button
            type="button"
            className="btn-primary-action mt-md"
            onClick={onNavigateToScanner}
          >
            📸 Scan Your First Defect
          </button>
        </div>
      ) : filteredFindings.length === 0 ? (
        <div className="clean-card empty-history-card">
          <div className="empty-icon">🔍</div>
          <h3>No defects match this filter</h3>
          <button
            type="button"
            className="btn-light-secondary mt-md"
            onClick={() => { setSeverityFilter('ALL'); setSearchQuery(''); }}
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="history-cards-grid">
          {filteredFindings.map((finding) => {
            const imageSrc = finding.image_url || (finding.image_data ? `data:${finding.image_mime_type || 'image/jpeg'};base64,${finding.image_data}` : null);

            return (
              <div key={finding.id} className="clean-card history-finding-card">
                {imageSrc && (
                  <div className="history-card-media">
                    <img src={imageSrc} alt={finding.ai_issue} />
                    <span className={`clean-severity-badge sev-${finding.ai_severity?.toLowerCase()} float-badge`}>
                      {finding.ai_severity}
                    </span>
                  </div>
                )}

                <div className="history-card-content">
                  <div className="history-badge-meta">
                    <span className="clean-category-badge">
                      {categoryIcons[finding.ai_category] || '🏷️'} {finding.ai_category}
                    </span>
                    {finding.location_in_property && (
                      <span className="clean-location-badge">
                        📍 {finding.location_in_property}
                      </span>
                    )}
                  </div>

                  <h3 className="history-card-title">{finding.ai_issue}</h3>
                  <p className="history-card-desc">{finding.ai_description}</p>

                  <div className="history-fix-box">
                    <strong>💡 Recommendation:</strong> {finding.ai_recommendation}
                  </div>

                  <div className="history-card-footer">
                    <span className="history-date">
                      🗓️ {new Date(finding.created_at).toLocaleDateString()}
                    </span>

                    <div className="history-card-actions">
                      <button
                        type="button"
                        className="btn-pdf-sm"
                        onClick={() => handleDownloadReport(finding)}
                        title="Download PDF"
                      >
                        📄 Download PDF
                      </button>
                      <button
                        type="button"
                        className="btn-delete-sm"
                        onClick={(e) => handleDelete(finding.inspection_id, finding.id, e)}
                        title="Delete record"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
