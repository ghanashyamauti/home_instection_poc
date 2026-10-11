import React, { useState, useEffect } from 'react';
import { getInspection, addFinding, deleteFinding, updateInspectionStatus } from '../services/api';
import { useToast } from '../context/ToastContext';
import ImageUpload from '../components/ImageUpload';
import FindingCard from '../components/FindingCard';
import { CategorySelector, LocationDirectionSelector } from '../components/InspectorFieldControls';
import { generatePdfReport } from '../services/pdfGenerator';

export default function InspectionDetailPage({ inspectionId, onNavigate }) {
  const { addToast } = useToast();
  const [inspection, setInspection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Filters & Search
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Add finding form state
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [comment, setComment] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [locationDirection, setLocationDirection] = useState('');
  const [inspectorRecommendation, setInspectorRecommendation] = useState('');

  useEffect(() => {
    loadInspection();
  }, [inspectionId]);

  async function loadInspection() {
    try {
      const data = await getInspection(inspectionId);
      setInspection(data);
    } catch (err) {
      addToast('Failed to load inspection details', 'error');
    }
    setLoading(false);
  }

  function handleImageSelect(file) {
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  }

  function handleRemoveImage() {
    setImageFile(null);
    setImagePreview(null);
  }

  function handleApplySample(sample, file, dataUrl) {
    setImageFile(file);
    setImagePreview(dataUrl);
    setLocation(sample.location);
    setComment(sample.comment);
    setShowAddForm(true);
    addToast(`Loaded preset: "${sample.title}"`, 'info');
  }

  async function handleAddFinding(e) {
    e.preventDefault();
    if (!imageFile) {
      addToast('Please upload or select a property image', 'error');
      return;
    }

    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      if (comment.trim()) formData.append('comment', comment);
      if (location.trim()) formData.append('location', location);
      
      const finalCategory = category === 'Other' ? (customCategory.trim() || 'Other') : category;
      if (finalCategory) formData.append('category', finalCategory);
      if (locationDirection.trim()) formData.append('locationDirection', locationDirection);
      if (inspectorRecommendation.trim()) formData.append('inspectorRecommendation', inspectorRecommendation);

      await addFinding(inspectionId, formData);

      // Reset form
      setImageFile(null);
      setImagePreview(null);
      setComment('');
      setLocation('');
      setCategory('');
      setCustomCategory('');
      setLocationDirection('');
      setInspectorRecommendation('');
      setShowAddForm(false);

      // Reload inspection
      await loadInspection();
      addToast('Defect successfully analyzed and saved!', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
    setAnalyzing(false);
  }

  async function handleDeleteFinding(findingId) {
    if (!confirm('Are you sure you want to delete this inspection finding?')) return;
    try {
      await deleteFinding(inspectionId, findingId);
      await loadInspection();
      addToast('Finding removed', 'success');
    } catch (err) {
      addToast('Failed to delete finding', 'error');
    }
  }

  async function handleStatusChange(status) {
    try {
      await updateInspectionStatus(inspectionId, status);
      await loadInspection();
      addToast(`Status updated to ${status.replace('_', ' ')}`, 'success');
    } catch (err) {
      addToast('Failed to update status', 'error');
    }
  }

  async function handleDownloadPdf() {
    if (!inspection || !inspection.findings?.length) {
      addToast('No findings to include in PDF report', 'error');
      return;
    }
    try {
      addToast(`Generating Master Audit PDF with all ${inspection.findings.length} photos...`, 'info');
      await generatePdfReport(inspection);
      addToast('Complete Inspection Master PDF downloaded successfully!', 'success');
    } catch (err) {
      addToast('Failed to generate PDF: ' + err.message, 'error');
    }
  }

  async function handleDownloadSingleFindingPdf(finding) {
    try {
      addToast(`Generating single PDF for "${finding.ai_issue}"...`, 'info');
      const locationText = finding.location_in_property 
        ? `${finding.location_in_property}${finding.location_direction ? ` [${finding.location_direction}]` : ''}`
        : (inspection?.property_address || 'Property Inspection');

      const reportData = {
        title: finding.ai_issue || 'Property Defect Report',
        property_address: locationText,
        property_type: inspection?.property_type || 'Residential',
        client_name: inspection?.client_name,
        created_at: finding.created_at || inspection?.created_at || new Date().toISOString(),
        findings: [finding]
      };
      await generatePdfReport(reportData);
      addToast(`Downloaded single PDF for "${finding.ai_issue}"`, 'success');
    } catch (err) {
      addToast('Failed to generate single PDF: ' + err.message, 'error');
    }
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  if (loading) {
    return (
      <div className="main-content">
        <div className="loader-container">
          <div className="analyzing-spinner"></div>
          <p className="text-secondary mt-md">Loading inspection portfolio...</p>
        </div>
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="main-content">
        <div className="empty-state">
          <h3>Inspection not found</h3>
          <button className="btn btn-primary" onClick={() => onNavigate('dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const findings = inspection.findings || [];
  const severityCounts = {
    Critical: findings.filter(f => f.ai_severity === 'Critical').length,
    High: findings.filter(f => f.ai_severity === 'High').length,
    Medium: findings.filter(f => f.ai_severity === 'Medium').length,
    Low: findings.filter(f => f.ai_severity === 'Low').length
  };

  // Filtered findings list
  const filteredFindings = findings.filter(f => {
    const matchesSev = severityFilter === 'ALL' || f.ai_severity === severityFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      f.ai_issue?.toLowerCase().includes(q) ||
      f.ai_category?.toLowerCase().includes(q) ||
      f.category?.toLowerCase().includes(q) ||
      f.location_in_property?.toLowerCase().includes(q) ||
      f.location_direction?.toLowerCase().includes(q) ||
      f.inspector_comment?.toLowerCase().includes(q) ||
      f.inspector_recommendation?.toLowerCase().includes(q);
    return matchesSev && matchesSearch;
  });

  return (
    <div className="main-content">
      {/* Analyzing AI Loader Overlay */}
      {analyzing && (
        <div className="analyzing-overlay animate-fade-in">
          <div className="analyzing-card">
            <div className="analyzing-spinner"></div>
            <div className="analyzing-text">🤖 Vision AI Analyzing Evidence...</div>
            <div className="analyzing-subtext">Evaluating visual characteristics, contextual inspector comments, and risk categorization</div>
            <div className="analyzing-steps">
              <span className="step-tag active">Visual Geometry</span>
              <span className="step-tag active">Defect Classification</span>
              <span className="step-tag">Severity Assessment</span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Breadcrumb */}
      <div className="breadcrumb-nav">
        <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('dashboard')}>
          ← Back to Dashboard
        </button>
        <span className="breadcrumb-divider">/</span>
        <span className="breadcrumb-current">{inspection.title}</span>
      </div>

      {/* Hero Report Header */}
      <div className="hero-report-header">
        <div className="hero-report-main">
          <div className="hero-badge-row">
            <span className={`badge-status badge-status-${inspection.status}`}>
              {inspection.status === 'in_progress' ? '● In Progress' :
               inspection.status === 'completed' ? '✓ Completed' : '📋 Reviewed'}
            </span>
            <span className="badge-tag">
              {inspection.property_type ? `🏠 ${inspection.property_type.toUpperCase()}` : '🏠 RESIDENTIAL'}
            </span>
          </div>
          <h1 className="hero-title">{inspection.title}</h1>
          <div className="hero-meta-grid">
            {inspection.property_address && (
              <div className="hero-meta-item">
                <span className="hero-meta-icon">📍</span>
                <span>{inspection.property_address}</span>
              </div>
            )}
            {inspection.client_name && (
              <div className="hero-meta-item">
                <span className="hero-meta-icon">👤</span>
                <span>Client: <strong>{inspection.client_name}</strong></span>
              </div>
            )}
            <div className="hero-meta-item">
              <span className="hero-meta-icon">🗓️</span>
              <span>{formatDate(inspection.created_at)}</span>
            </div>
            <div className="hero-meta-item">
              <span className="hero-meta-icon">📸</span>
              <span><strong>{findings.length}</strong> Logged Findings</span>
            </div>
          </div>
        </div>

        <div className="hero-actions-panel">
          <button
            className="btn btn-primary btn-lg shadow-glow"
            onClick={() => setShowAddForm(!showAddForm)}
            id="btn-add-finding"
          >
            {showAddForm ? '✕ Close Form' : '📸 Add Defect Finding'}
          </button>
          <button
            className="btn btn-secondary btn-lg"
            onClick={handleDownloadPdf}
            id="btn-download-pdf"
            disabled={findings.length === 0}
            title="Download 1 consolidated Master PDF containing all photos and findings"
          >
            📄 Download Master PDF ({findings.length} Findings)
          </button>
          {inspection.status === 'in_progress' && (
            <button
              className="btn btn-success btn-lg"
              onClick={() => handleStatusChange('completed')}
              id="btn-complete"
            >
              ✓ Complete Inspection
            </button>
          )}
        </div>
      </div>

      {/* Severity Risk Breakdown Cards */}
      <div className="severity-summary-deck">
        <div
          className={`severity-card sev-critical ${severityFilter === 'Critical' ? 'active-filter' : ''}`}
          onClick={() => setSeverityFilter(severityFilter === 'Critical' ? 'ALL' : 'Critical')}
        >
          <div className="sev-card-top">
            <span className="sev-indicator sev-dot-critical"></span>
            <span className="sev-label">Critical</span>
          </div>
          <div className="sev-count">{severityCounts.Critical}</div>
          <div className="sev-hint">Requires Immediate Mitigation</div>
        </div>

        <div
          className={`severity-card sev-high ${severityFilter === 'High' ? 'active-filter' : ''}`}
          onClick={() => setSeverityFilter(severityFilter === 'High' ? 'ALL' : 'High')}
        >
          <div className="sev-card-top">
            <span className="sev-indicator sev-dot-high"></span>
            <span className="sev-label">High Priority</span>
          </div>
          <div className="sev-count">{severityCounts.High}</div>
          <div className="sev-hint">Prompt Repair Necessary</div>
        </div>

        <div
          className={`severity-card sev-medium ${severityFilter === 'Medium' ? 'active-filter' : ''}`}
          onClick={() => setSeverityFilter(severityFilter === 'Medium' ? 'ALL' : 'Medium')}
        >
          <div className="sev-card-top">
            <span className="sev-indicator sev-dot-medium"></span>
            <span className="sev-label">Moderate</span>
          </div>
          <div className="sev-count">{severityCounts.Medium}</div>
          <div className="sev-hint">Routine Maintenance Required</div>
        </div>

        <div
          className={`severity-card sev-low ${severityFilter === 'Low' ? 'active-filter' : ''}`}
          onClick={() => setSeverityFilter(severityFilter === 'Low' ? 'ALL' : 'Low')}
        >
          <div className="sev-card-top">
            <span className="sev-indicator sev-dot-low"></span>
            <span className="sev-label">Low / Cosmetic</span>
          </div>
          <div className="sev-count">{severityCounts.Low}</div>
          <div className="sev-hint">Monitor / Optional Repair</div>
        </div>
      </div>

      {/* Add Finding Drawer / Form */}
      {showAddForm && (
        <div className="card-glass mb-xl animate-slide-down">
          <div className="card-glass-header">
            <div>
              <h3 className="card-glass-title">📸 New Property Defect Evidence</h3>
              <p className="card-glass-subtitle">Upload or snap a photo of the area. Add optional categories, location tags, and professional notes.</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAddForm(false)}>✕</button>
          </div>

          <form onSubmit={handleAddFinding} className="add-finding-form">
            {/* Step 1: System / Category Selector */}
            <div className="form-group">
              <CategorySelector
                category={category}
                onCategoryChange={setCategory}
                customCategory={customCategory}
                onCustomCategoryChange={setCustomCategory}
              />
            </div>

            {/* Step 2: Property Image Evidence */}
            <div className="form-group mt-md">
              <label className="form-label">
                📸 2. Property Image Evidence <span className="required">*</span>
              </label>
              <ImageUpload
                onImageSelect={handleImageSelect}
                preview={imagePreview}
                onRemove={handleRemoveImage}
                onApplySample={handleApplySample}
              />
            </div>

            {/* Step 3: Location & Angle / Direction Tags */}
            <div className="form-group mt-md">
              <LocationDirectionSelector
                location={location}
                onLocationChange={setLocation}
                locationDirection={locationDirection}
                onLocationDirectionChange={setLocationDirection}
                stepNumber="3"
              />
            </div>

            {/* Step 4: On-Site Observations */}
            <div className="form-group mt-md">
              <label className="form-label">📝 4. Inspector On-Site Observations / Notes</label>
              <textarea
                className="form-textarea clean-textarea field-notes-textarea"
                rows="3"
                placeholder="Describe what you hear, touch, or observe on-site (e.g., 'Damp drywall, active drip, settlement hairline crack along door header')..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                id="input-finding-comment"
              />
              <div className="form-hint">
                💡 <strong>Tip:</strong> The AI combines visual pixels with your note to compute pinpoint severity and category.
              </div>
            </div>

            <div className="form-actions-bar">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-lg shadow-glow"
                disabled={!imageFile || analyzing}
                id="btn-analyze"
              >
                {analyzing ? (
                  <><div className="spinner-sm"></div> Analyzing with Vision AI...</>
                ) : (
                  '🤖 Run AI Inspection & Save'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Findings Controls Bar (Filter & Search) */}
      <div className="findings-toolbar">
        <div className="findings-toolbar-left">
          <h2 className="section-title">
            Documented Findings <span className="counter-pill">{filteredFindings.length}</span>
          </h2>
          {severityFilter !== 'ALL' && (
            <button className="badge-clear-filter" onClick={() => setSeverityFilter('ALL')}>
              Showing {severityFilter} only ✕
            </button>
          )}
        </div>

        <div className="findings-toolbar-right">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search findings, categories, locations..."
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="search-clear" onClick={() => setSearchQuery('')}>✕</button>
            )}
          </div>
        </div>
      </div>

      {/* Findings Grid */}
      {findings.length === 0 ? (
        <div className="empty-state-modern">
          <div className="empty-state-illustration">📸</div>
          <h3>No Defect Findings Documented</h3>
          <p>Begin documenting property conditions by uploading photos or selecting ready-to-test sample defect presets.</p>
          {!showAddForm && (
            <button className="btn btn-primary btn-lg shadow-glow mt-md" onClick={() => setShowAddForm(true)}>
              ➕ Document First Finding
            </button>
          )}
        </div>
      ) : filteredFindings.length === 0 ? (
        <div className="empty-state-modern">
          <div className="empty-state-illustration">🔍</div>
          <h3>No findings match your filter</h3>
          <p>Try resetting the search query or severity filter.</p>
          <button className="btn btn-secondary mt-md" onClick={() => { setSeverityFilter('ALL'); setSearchQuery(''); }}>
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="findings-grid">
          {filteredFindings.map((finding, idx) => (
            <div key={finding.id} style={{ animationDelay: `${idx * 0.06}s` }}>
              <FindingCard
                finding={finding}
                onDelete={handleDeleteFinding}
                onUpdate={loadInspection}
                onDownloadSinglePdf={handleDownloadSingleFindingPdf}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
