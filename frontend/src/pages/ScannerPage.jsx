import React, { useState, useRef, useEffect } from 'react';
import { scanBatch } from '../services/api';
import { useToast } from '../context/ToastContext';
import { generatePdfReport } from '../services/pdfGenerator';
import { SAMPLE_DEFECTS, svgToFile } from '../services/sampleImages';

export default function ScannerPage({ onNavigateToHistory }) {
  const { addToast } = useToast();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Photo batch state: array of { id, file, preview, name, location, comment }
  const [photoBatch, setPhotoBatch] = useState([]);
  const [globalLocation, setGlobalLocation] = useState('');
  const [globalComment, setGlobalComment] = useState('');

  // AI states
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  const [batchResults, setBatchResults] = useState(null);

  // Clipboard paste support (Ctrl+V)
  useEffect(() => {
    function handlePaste(e) {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            addFilesToBatch([file]);
            addToast('Pasted screenshot into batch queue!', 'info');
            break;
          }
        }
      }
    }
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [photoBatch.length]);

  function addFilesToBatch(files) {
    if (!files || files.length === 0) return;

    const remainingSlots = 10 - photoBatch.length;
    if (remainingSlots <= 0) {
      addToast('Maximum 10 photos reached per batch', 'warning');
      return;
    }

    const filesToAdd = Array.from(files).slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      addToast(`Only added ${remainingSlots} photos (batch limit is 10)`, 'warning');
    }

    filesToAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoBatch((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 7)}`,
            file,
            preview: reader.result,
            name: file.name || `Photo_${Date.now()}.jpg`,
            location: '',
            comment: ''
          }
        ]);
      };
      reader.readAsDataURL(file);
    });

    setBatchResults(null);
  }

  function handleFileChange(e) {
    const files = e.target.files;
    if (files && files.length > 0) {
      addFilesToBatch(files);
      e.target.value = ''; // Reset file input so re-selecting same file works
    }
  }

  function handleSelectSample(sample) {
    if (photoBatch.length >= 10) {
      addToast('Maximum 10 photos reached per batch', 'warning');
      return;
    }

    const file = svgToFile(sample.svg, `${sample.id}.svg`);
    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(sample.svg)}`;

    setPhotoBatch((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 7)}`,
        file,
        preview: dataUrl,
        name: `${sample.title}.svg`,
        location: sample.location || '',
        comment: sample.comment || ''
      }
    ]);
    setBatchResults(null);
    addToast(`Added preset "${sample.title}" to batch queue`, 'info');
  }

  function handleRemovePhoto(id) {
    setPhotoBatch((prev) => prev.filter((p) => p.id !== id));
  }

  function handleClearBatch() {
    setPhotoBatch([]);
    setBatchResults(null);
  }

  function updatePhotoItem(id, field, value) {
    setPhotoBatch((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  async function handleBatchScan(e) {
    e.preventDefault();
    if (photoBatch.length === 0) {
      addToast('Please add at least one defect photo to scan', 'error');
      return;
    }

    setScanning(true);
    setScanProgress(`Preparing AI inspection for ${photoBatch.length} photo${photoBatch.length > 1 ? 's' : ''}...`);
    setBatchResults(null);

    try {
      const formData = new FormData();

      // Append all image files
      photoBatch.forEach((item) => {
        formData.append('images', item.file);
      });

      // Append locations and comments arrays
      const itemLocations = photoBatch.map((p) => p.location.trim() || globalLocation.trim());
      const itemComments = photoBatch.map((p) => p.comment.trim() || globalComment.trim());

      formData.append('itemLocations', JSON.stringify(itemLocations));
      formData.append('itemComments', JSON.stringify(itemComments));
      if (globalLocation.trim()) formData.append('location', globalLocation.trim());
      if (globalComment.trim()) formData.append('comment', globalComment.trim());

      setScanProgress(`Analyzing ${photoBatch.length} defect photo${photoBatch.length > 1 ? 's' : ''} with AI vision models...`);

      const response = await scanBatch(formData);

      setBatchResults(response);
      addToast(
        `AI Batch Scan Complete! (${response.findings?.length || 0} defects diagnosed)`,
        'success'
      );

      // Smooth scroll to results
      setTimeout(() => {
        document.getElementById('batch-results-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } catch (err) {
      addToast(err.message || 'Batch analysis failed. Please try again.', 'error');
    }

    setScanning(false);
    setScanProgress('');
  }

  function handleDownloadFullReport() {
    if (!batchResults || !batchResults.findings) return;
    try {
      const reportData = {
        title: batchResults.inspection?.title || `Inspection Audit (${batchResults.findings.length} Defects)`,
        property_address: globalLocation || batchResults.inspection?.property_address || 'Property Inspection Audit',
        property_type: 'Residential',
        created_at: batchResults.inspection?.created_at || new Date().toISOString(),
        findings: batchResults.findings
      };
      generatePdfReport(reportData);
      addToast('Comprehensive PDF Report downloaded!', 'success');
    } catch (err) {
      addToast('Failed to generate PDF report', 'error');
    }
  }

  function handleDownloadSingleFinding(finding) {
    try {
      const reportData = {
        title: finding.ai_issue || 'Property Defect Report',
        property_address: finding.location_in_property || globalLocation || 'Property Inspection',
        property_type: 'Residential',
        created_at: finding.created_at || new Date().toISOString(),
        findings: [finding]
      };
      generatePdfReport(reportData);
      addToast(`Downloaded PDF for "${finding.ai_issue}"`, 'success');
    } catch (err) {
      addToast('Failed to generate PDF', 'error');
    }
  }

  function handleScanNewBatch() {
    setPhotoBatch([]);
    setBatchResults(null);
    setGlobalLocation('');
    setGlobalComment('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // Severity counts in batch results
  const severityCounts = batchResults?.findings
    ? {
        Critical: batchResults.findings.filter((f) => f.ai_severity === 'Critical').length,
        High: batchResults.findings.filter((f) => f.ai_severity === 'High').length,
        Medium: batchResults.findings.filter((f) => f.ai_severity === 'Medium').length,
        Low: batchResults.findings.filter((f) => f.ai_severity === 'Low').length
      }
    : null;

  return (
    <div className="scanner-page">
      {/* Page Header */}
      <div className="scanner-hero">
        <div className="scanner-hero-badge">🏛️ Mentis Cognitive Inspection AI</div>
        <h1 className="scanner-title">Intelligent Architectural Diagnostics</h1>
        <p className="scanner-subtitle">
          Capture live on-site photos or batch upload up to 10 defects. Mentis neural vision identifies structural flaws, evaluates severity, and compiles audit-grade PDF reports.
        </p>
      </div>

      {/* Main Workspace Card */}
      <div className="clean-card scanner-card">
        <form onSubmit={handleBatchScan}>
          {/* Step 1: Photos Queue */}
          <div className="form-section">
            <div className="section-header-flex">
              <label className="section-label">
                1. Defect Photos <span className="required-star">*</span>
                {photoBatch.length > 0 && (
                  <span className="batch-counter-badge">
                    {photoBatch.length}/10 Photo{photoBatch.length > 1 ? 's' : ''} in Queue
                  </span>
                )}
              </label>

              {photoBatch.length > 0 && (
                <div className="batch-actions-header">
                  <button
                    type="button"
                    className="btn-text-action"
                    onClick={() => cameraInputRef.current?.click()}
                    title="Take photo with mobile camera"
                  >
                    📷 Snap Photo
                  </button>
                  <button
                    type="button"
                    className="btn-text-action"
                    onClick={() => fileInputRef.current?.click()}
                    title="Add more from file manager"
                  >
                    + Add More
                  </button>
                  <button
                    type="button"
                    className="btn-text-danger"
                    onClick={handleClearBatch}
                  >
                    🗑️ Clear All
                  </button>
                </div>
              )}
            </div>

            {/* Empty State / Initial Dropzone */}
            {photoBatch.length === 0 ? (
              <div className="clean-dropzone">
                <div className="dropzone-buttons-row">
                  <button
                    type="button"
                    className="big-action-btn camera-btn"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <span className="action-btn-icon">📷</span>
                    <span className="action-btn-text">Take Live Photo</span>
                    <span className="action-btn-sub">Open mobile camera</span>
                  </button>

                  <button
                    type="button"
                    className="big-action-btn upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <span className="action-btn-icon">📸</span>
                    <span className="action-btn-text">Upload Photos</span>
                    <span className="action-btn-sub">Select 1 or multiple (up to 10)</span>
                  </button>
                </div>

                <div className="dropzone-drag-hint">
                  Hold <strong>Ctrl</strong> to select multiple files • Drag & drop photos • Or press <strong>Ctrl+V</strong> to paste
                </div>

                {/* 1-Click Test Presets */}
                <div className="sample-presets-bar">
                  <span className="sample-presets-title">⚡ Quick 1-Click Test Presets:</span>
                  <div className="sample-chips-row">
                    {SAMPLE_DEFECTS.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="sample-chip-btn"
                        onClick={() => handleSelectSample(s)}
                      >
                        + {s.title}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Multi-Photo Batch Gallery */
              <div className="batch-gallery-container">
                <div className="batch-grid">
                  {photoBatch.map((item, index) => (
                    <div key={item.id} className="batch-item-card">
                      <div className="batch-item-thumb-wrapper">
                        <img
                          src={item.preview}
                          alt={`Defect ${index + 1}`}
                          className="batch-item-thumb"
                        />
                        <span className="batch-item-index">#{index + 1}</span>
                        <button
                          type="button"
                          className="batch-item-remove-btn"
                          onClick={() => handleRemovePhoto(item.id)}
                          title="Remove photo"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="batch-item-inputs">
                        <input
                          type="text"
                          className="batch-sub-input"
                          placeholder="Location (e.g. Master Bath)"
                          value={item.location}
                          onChange={(e) =>
                            updatePhotoItem(item.id, 'location', e.target.value)
                          }
                        />
                        <input
                          type="text"
                          className="batch-sub-input"
                          placeholder="Note (e.g. wet to touch)"
                          value={item.comment}
                          onChange={(e) =>
                            updatePhotoItem(item.id, 'comment', e.target.value)
                          }
                        />
                      </div>
                    </div>
                  ))}

                  {/* Add more tile if under limit */}
                  {photoBatch.length < 10 && (
                    <div
                      className="batch-add-tile"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <span className="batch-add-icon">＋</span>
                      <span className="batch-add-text">Add More Photos</span>
                      <span className="batch-add-sub">
                        ({10 - photoBatch.length} remaining)
                      </span>
                    </div>
                  )}
                </div>

                {/* Preset Chips Bar also available below queue */}
                <div className="batch-presets-tray">
                  <span className="batch-presets-title">Add test defects to queue:</span>
                  <div className="sample-chips-row">
                    {SAMPLE_DEFECTS.slice(0, 4).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="sample-chip-btn"
                        onClick={() => handleSelectSample(s)}
                      >
                        + {s.title}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Hidden native inputs */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              multiple
              style={{ display: 'none' }}
            />
            <input
              type="file"
              ref={cameraInputRef}
              onChange={handleFileChange}
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
            />
          </div>

          {/* Step 2: Global Property Info */}
          <div className="form-section mt-md">
            <div className="field-grid">
              <div className="field-col">
                <label className="field-label">
                  Property Address / Overall Location <span className="optional-tag">(Optional)</span>
                </label>
                <input
                  type="text"
                  className="clean-input"
                  placeholder="e.g. 742 Evergreen Terrace, Springfield"
                  value={globalLocation}
                  onChange={(e) => setGlobalLocation(e.target.value)}
                />
              </div>

              <div className="field-col">
                <label className="field-label">
                  General Inspection Notes <span className="optional-tag">(Optional)</span>
                </label>
                <input
                  type="text"
                  className="clean-input"
                  placeholder="e.g. Pre-purchase inspection, rainy conditions"
                  value={globalComment}
                  onChange={(e) => setGlobalComment(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Step 3: Action Button */}
          <div className="form-section mt-lg">
            <button
              type="submit"
              className="btn-primary-action btn-full"
              disabled={photoBatch.length === 0 || scanning}
            >
              {scanning ? (
                <span className="spinner-row">
                  <span className="clean-spinner"></span>
                  {scanProgress || 'AI is scanning defect photos...'}
                </span>
              ) : photoBatch.length > 1 ? (
                `📸 Batch Scan All ${photoBatch.length} Photos with AI`
              ) : photoBatch.length === 1 ? (
                '🔍 Scan Defect with AI'
              ) : (
                'Add Photos to Start Inspection'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* AI Batch Results Section */}
      {batchResults && batchResults.findings && (
        <div className="batch-results-section animate-fade-in" id="batch-results-section">
          {/* Summary Banner */}
          <div className="clean-card batch-summary-banner">
            <div className="batch-summary-content">
              <div className="batch-summary-left">
                <span className="result-tag">✓ AI Inspection Complete</span>
                <h2 className="batch-summary-title">
                  Inspection Audit:{' '}
                  <span className="text-highlight">
                    {batchResults.findings.length} Defect
                    {batchResults.findings.length > 1 ? 's' : ''} Identified
                  </span>
                </h2>
                <div className="batch-severity-tally">
                  {severityCounts.Critical > 0 && (
                    <span className="clean-severity-badge sev-critical">
                      ● {severityCounts.Critical} Critical
                    </span>
                  )}
                  {severityCounts.High > 0 && (
                    <span className="clean-severity-badge sev-high">
                      ● {severityCounts.High} High
                    </span>
                  )}
                  {severityCounts.Medium > 0 && (
                    <span className="clean-severity-badge sev-medium">
                      ● {severityCounts.Medium} Medium
                    </span>
                  )}
                  {severityCounts.Low > 0 && (
                    <span className="clean-severity-badge sev-low">
                      ● {severityCounts.Low} Low
                    </span>
                  )}
                </div>
              </div>

              <div className="batch-summary-right">
                <button
                  type="button"
                  className="btn-primary-action"
                  onClick={handleDownloadFullReport}
                >
                  📄 Download Complete PDF Audit ({batchResults.findings.length} Findings)
                </button>
              </div>
            </div>
          </div>

          {/* List of Individual Finding Cards */}
          <div className="batch-findings-stack">
            {batchResults.findings.map((finding, idx) => (
              <div key={finding.id || idx} className="clean-card result-card">
                <div className="result-header">
                  <div className="result-header-left">
                    <span className="result-tag">Finding #{idx + 1} of {batchResults.findings.length}</span>
                    <h3 className="result-issue-name">{finding.ai_issue}</h3>
                    <div className="result-pill-row">
                      <span className={`clean-severity-badge sev-${finding.ai_severity?.toLowerCase()}`}>
                        ● Severity: {finding.ai_severity}
                      </span>
                      <span className="clean-category-badge">
                        {categoryIcons[finding.ai_category] || '🏷️'} {finding.ai_category}
                      </span>
                      {finding.location_in_property && (
                        <span className="clean-location-badge">
                          📍 {finding.location_in_property}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="result-header-right">
                    <button
                      type="button"
                      className="btn-pdf-download"
                      onClick={() => handleDownloadSingleFinding(finding)}
                    >
                      📄 Download Finding PDF
                    </button>
                  </div>
                </div>

                <div className="result-body">
                  {/* Finding Thumbnail */}
                  <div className="result-image-thumbnail">
                    {finding.image_url ? (
                      <img src={finding.image_url} alt={finding.ai_issue} />
                    ) : finding.image_data ? (
                      <img
                        src={`data:${finding.image_mime_type || 'image/jpeg'};base64,${finding.image_data}`}
                        alt={finding.ai_issue}
                      />
                    ) : photoBatch[idx]?.preview ? (
                      <img src={photoBatch[idx].preview} alt={finding.ai_issue} />
                    ) : null}
                  </div>

                  <div className="result-details">
                    <div className="detail-block">
                      <h4 className="detail-title">What is this issue?</h4>
                      <p className="detail-desc">{finding.ai_description}</p>
                    </div>

                    {finding.inspector_comment && (
                      <div className="detail-block note-block">
                        <h4 className="detail-title">Inspector Observation:</h4>
                        <p className="detail-desc italic">"{finding.inspector_comment}"</p>
                      </div>
                    )}

                    <div className="detail-block recommendation-block">
                      <h4 className="detail-title recommendation-heading">💡 Recommended Action:</h4>
                      <p className="detail-desc recommendation-text">{finding.ai_recommendation}</p>
                    </div>

                    <div className="result-meta-footer">
                      <span className="confidence-text">
                        AI Confidence: <strong>{finding.ai_confidence || 85}%</strong>
                      </span>
                      {finding.ai_model_used && (
                        <span className="model-text">
                          Engine: {finding.ai_model_used.split('/')[1] || finding.ai_model_used}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Actions Bar */}
          <div className="batch-bottom-bar">
            <button
              type="button"
              className="btn-light-secondary"
              onClick={handleScanNewBatch}
            >
              📸 Scan Another Batch
            </button>
            <button
              type="button"
              className="btn-light-secondary"
              onClick={onNavigateToHistory}
            >
              📋 View in Saved Reports History →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
