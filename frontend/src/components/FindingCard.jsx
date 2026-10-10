import React, { useState } from 'react';

export default function FindingCard({ finding, onDelete, showActions = true }) {
  const [imageModalOpen, setImageModalOpen] = useState(false);

  const severityClass = `badge-severity-${finding.ai_severity?.toLowerCase() || 'medium'}`;

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

  const categoryColors = {
    'Structural': '#8b5cf6',
    'Electrical': '#f59e0b',
    'Plumbing': '#0284c7',
    'Surface': '#ec4899',
    'Moisture/Water': '#06b6d4',
    'Mold/Biological': '#84cc16',
    'Safety Hazard': '#ef4444',
    'General Property Damage': '#64748b'
  };

  const category = finding.ai_category || 'General Property Damage';
  const categoryIcon = categoryIcons[category] || '🔍';
  const categoryColor = categoryColors[category] || '#64748b';

  const confidenceValue = parseFloat(finding.ai_confidence) || 80;

  function getConfidenceColor(val) {
    if (val >= 80) return '#10b981';
    if (val >= 60) return '#f59e0b';
    return '#ef4444';
  }

  const imageSrc = finding.image_url || (finding.image_data ? `data:${finding.image_mime_type || 'image/jpeg'};base64,${finding.image_data}` : null);

  return (
    <>
      <div className="finding-card-modern animate-fade-in">
        {/* Media Section */}
        {imageSrc && (
          <div className="finding-card-media" onClick={() => setImageModalOpen(true)} title="Click to view full-resolution evidence">
            <img
              src={imageSrc}
              alt={finding.ai_issue}
              className="finding-card-img"
              loading="lazy"
            />
            <div className="media-zoom-overlay">
              <span className="media-zoom-icon">🔍 Click to zoom</span>
            </div>
            <div className="media-ribbon-top">
              <span className={`badge-severity-pill ${severityClass}`}>
                <span className="severity-pulse-dot"></span>
                {finding.ai_severity}
              </span>
            </div>
          </div>
        )}

        {/* Content Section */}
        <div className="finding-card-body">
          <div className="finding-meta-header">
            <span
              className="category-pill"
              style={{
                backgroundColor: `${categoryColor}15`,
                borderColor: `${categoryColor}40`,
                color: categoryColor
              }}
            >
              <span>{categoryIcon}</span> {category}
            </span>

            {finding.location_in_property && (
              <span className="location-pill" title={finding.location_in_property}>
                📍 {finding.location_in_property}
              </span>
            )}
          </div>

          <h3 className="finding-card-title">{finding.ai_issue}</h3>

          <p className="finding-card-desc">{finding.ai_description}</p>

          {/* Inspector Field Observation */}
          {finding.inspector_comment && (
            <div className="inspector-field-note">
              <div className="field-note-header">
                <span className="field-note-icon">📝</span>
                <strong>Inspector On-Site Note:</strong>
              </div>
              <p className="field-note-text">"{finding.inspector_comment}"</p>
            </div>
          )}

          {/* AI Actionable Recommendation */}
          <div className="recommendation-callout">
            <div className="recommendation-header">
              <span className="recommendation-icon">💡</span>
              <span className="recommendation-title">Actionable Recommendation</span>
            </div>
            <div className="recommendation-body">
              {finding.ai_recommendation}
            </div>
          </div>
        </div>

        {/* Footer info & Confidence */}
        <div className="finding-card-footer">
          <div className="confidence-meter-group">
            <div className="confidence-label-row">
              <span className="confidence-label">AI Confidence</span>
              <span className="confidence-value" style={{ color: getConfidenceColor(confidenceValue) }}>
                {confidenceValue}%
              </span>
            </div>
            <div className="confidence-track">
              <div
                className="confidence-fill"
                style={{
                  width: `${confidenceValue}%`,
                  backgroundColor: getConfidenceColor(confidenceValue)
                }}
              />
            </div>
          </div>

          <div className="finding-footer-actions">
            {finding.ai_model_used && (
              <span className="model-tag" title={`Analyzed with ${finding.ai_model_used}`}>
                ⚡ {finding.ai_model_used.split('/')[1] || finding.ai_model_used}
              </span>
            )}

            {showActions && onDelete && (
              <button
                className="btn-icon-delete"
                onClick={() => onDelete(finding.id)}
                title="Delete this finding"
              >
                🗑️
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Image Zoom Modal */}
      {imageModalOpen && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setImageModalOpen(false)}>
          <div className="modal-box image-lightbox-box" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-header">
              <h4>📸 {finding.ai_issue} — High Resolution Evidence</h4>
              <button className="modal-close-btn" onClick={() => setImageModalOpen(false)}>✕</button>
            </div>
            <div className="lightbox-content">
              <img src={imageSrc} alt={finding.ai_issue} className="lightbox-img" />
            </div>
            <div className="lightbox-footer">
              <span>{finding.location_in_property ? `📍 ${finding.location_in_property}` : 'Property Evidence'}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setImageModalOpen(false)}>
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
