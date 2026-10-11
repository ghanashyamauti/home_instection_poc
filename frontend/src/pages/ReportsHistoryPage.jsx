import React, { useState, useEffect } from 'react';
import { getInspections, getInspection, deleteInspection, deleteFinding, updateFinding } from '../services/api';
import { useToast } from '../context/ToastContext';
import { generatePdfReport } from '../services/pdfGenerator';
import PhotoAnnotationModal from '../components/PhotoAnnotationModal';
import RealtorRepairBuilderModal from '../components/RealtorRepairBuilderModal';

export default function ReportsHistoryPage({ onNavigateToScanner }) {
  const { addToast } = useToast();

  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(true);

  // View state: 'list' (clean batch cards) or 'batch_detail' (dedicated page for 1 batch)
  const [viewMode, setViewMode] = useState('list');
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [selectedBatchData, setSelectedBatchData] = useState(null);
  const [loadingBatchDetails, setLoadingBatchDetails] = useState(false);
  const [batchCache, setBatchCache] = useState({});

  const [searchQuery, setSearchQuery] = useState('');
  const [lightboxImage, setLightboxImage] = useState(null);
  const [annotatingItem, setAnnotatingItem] = useState(null);
  const [crlModalOpen, setCrlModalOpen] = useState(false);

  // Load all batches on mount
  useEffect(() => {
    loadAllBatches();
  }, []);

  async function loadAllBatches() {
    setLoadingBatches(true);
    try {
      const data = await getInspections();
      setBatches(data || []);
    } catch (err) {
      addToast('Failed to load inspection batches: ' + err.message, 'error');
    }
    setLoadingBatches(false);
  }

  // Open the dedicated page for a clicked batch
  async function handleOpenBatchPage(batchId) {
    setSelectedBatchId(batchId);
    setViewMode('batch_detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (batchCache[batchId]) {
      setSelectedBatchData(batchCache[batchId]);
      return;
    }

    setLoadingBatchDetails(true);
    try {
      const fullBatch = await getInspection(batchId);
      setSelectedBatchData(fullBatch);
      setBatchCache((prev) => ({ ...prev, [batchId]: fullBatch }));
    } catch (err) {
      addToast('Failed to load photos for this batch: ' + err.message, 'error');
    }
    setLoadingBatchDetails(false);
  }

  // Return to the clean batch list
  function handleBackToBatchesList() {
    setViewMode('list');
    setSelectedBatchId(null);
    setSelectedBatchData(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Delete an entire batch
  async function handleDeleteBatch(batchId, e) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this entire inspection batch and all its photos?')) return;
    try {
      await deleteInspection(batchId);
      const remaining = batches.filter((b) => b.id !== batchId);
      setBatches(remaining);

      // Clean cache
      setBatchCache((prev) => {
        const next = { ...prev };
        delete next[batchId];
        return next;
      });

      if (viewMode === 'batch_detail' && selectedBatchId === batchId) {
        handleBackToBatchesList();
      }

      addToast('Inspection batch deleted', 'success');
    } catch (err) {
      addToast('Failed to delete batch: ' + err.message, 'error');
    }
  }

  // Delete a single photo from the active batch
  async function handleDeletePhotoFinding(findingId, e) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!confirm('Remove this photo record from this batch?')) return;
    try {
      await deleteFinding(selectedBatchId, findingId);

      const updatedFindings = (selectedBatchData.findings || []).filter((f) => f.id !== findingId);
      const updatedBatch = { ...selectedBatchData, findings: updatedFindings };

      setSelectedBatchData(updatedBatch);
      setBatchCache((prev) => ({ ...prev, [selectedBatchId]: updatedBatch }));

      // Update count in batch list
      setBatches((prev) =>
        prev.map((b) =>
          b.id === selectedBatchId
            ? { ...b, finding_count: Math.max(0, (b.finding_count || 1) - 1) }
            : b
        )
      );

      addToast('Photo record removed from batch', 'success');
    } catch (err) {
      addToast('Failed to remove photo: ' + err.message, 'error');
    }
  }

  // Save annotation drawn on photo
  async function handleSaveBatchAnnotation(annotatedDataUrl) {
    if (!annotatingItem) return;
    const { finding, index } = annotatingItem;

    const updatedFindings = [...(selectedBatchData.findings || [])];
    updatedFindings[index] = {
      ...updatedFindings[index],
      annotated_image_data: annotatedDataUrl,
      annotated_preview: annotatedDataUrl
    };
    const updatedBatch = { ...selectedBatchData, findings: updatedFindings };

    setSelectedBatchData(updatedBatch);
    setBatchCache((prev) => ({ ...prev, [selectedBatchId]: updatedBatch }));

    try {
      if (finding.id && selectedBatchId) {
        await updateFinding(selectedBatchId, finding.id, {
          annotatedImageData: annotatedDataUrl
        });
      }
      addToast('Damage markup saved! Side-by-side view updated.', 'success');
    } catch (err) {
      console.warn('Could not persist annotation to server:', err);
    }
    setAnnotatingItem(null);
  }

  // Remove annotation from photo
  async function handleRemoveBatchAnnotation(findingId, index) {
    const updatedFindings = [...(selectedBatchData.findings || [])];
    updatedFindings[index] = {
      ...updatedFindings[index],
      annotated_image_data: null,
      annotated_preview: null
    };
    const updatedBatch = { ...selectedBatchData, findings: updatedFindings };

    setSelectedBatchData(updatedBatch);
    setBatchCache((prev) => ({ ...prev, [selectedBatchId]: updatedBatch }));

    try {
      if (findingId && selectedBatchId) {
        await updateFinding(selectedBatchId, findingId, {
          annotatedImageData: null
        });
      }
      addToast('Annotation removed, returned to clean baseline photo', 'info');
    } catch (err) {
      console.warn('Could not remove annotation from server:', err);
    }
  }

  // Download Master PDF for all photos in active batch
  async function handleDownloadBatchMasterPdf() {
    if (!selectedBatchData || !selectedBatchData.findings || selectedBatchData.findings.length === 0) {
      addToast('No photos to download in this batch', 'warning');
      return;
    }
    try {
      addToast(`Generating Master Batch PDF (${selectedBatchData.findings.length} photos)...`, 'info');
      await generatePdfReport(selectedBatchData);
      addToast(`Master Batch PDF downloaded with all ${selectedBatchData.findings.length} photos!`, 'success');
    } catch (err) {
      addToast('Failed to generate Master PDF: ' + err.message, 'error');
    }
  }

  // Download Master PDF directly from a batch card on the list view
  async function handleDownloadMasterPdfFromCard(batch, e) {
    if (e && e.stopPropagation) e.stopPropagation();
    try {
      addToast(`Preparing Master PDF for "${batch.title}"...`, 'info');
      let batchData = batchCache[batch.id];
      if (!batchData) {
        batchData = await getInspection(batch.id);
        setBatchCache((prev) => ({ ...prev, [batch.id]: batchData }));
      }
      if (!batchData.findings || batchData.findings.length === 0) {
        addToast('No photos found in this batch', 'warning');
        return;
      }
      await generatePdfReport(batchData);
      addToast(`Master Batch PDF downloaded with all ${batchData.findings.length} photos!`, 'success');
    } catch (err) {
      addToast('Failed to generate Master PDF: ' + err.message, 'error');
    }
  }

  // Download Single Photo Finding PDF
  async function handleDownloadSinglePhotoPdf(finding, idx) {
    try {
      addToast(`Generating Single PDF for Finding #${idx + 1}...`, 'info');
      const locationText = finding.location_in_property
        ? `${finding.location_in_property}${finding.location_direction ? ` [${finding.location_direction}]` : ''}`
        : (selectedBatchData?.property_address || 'Property Inspection');

      const reportData = {
        title: `Defect Finding #${idx + 1}: ${finding.ai_issue || 'Property Defect'}`,
        property_address: locationText,
        property_type: selectedBatchData?.property_type || 'Residential',
        client_name: selectedBatchData?.client_name,
        created_at: finding.created_at || selectedBatchData?.created_at || new Date().toISOString(),
        findings: [finding]
      };
      await generatePdfReport(reportData);
      addToast(`Single PDF for Finding #${idx + 1} downloaded!`, 'success');
    } catch (err) {
      addToast('Failed to generate single PDF: ' + err.message, 'error');
    }
  }

  const categoryIcons = {
    'Roofing & Attic': '🏠',
    'Exterior & Grounds': '🌳',
    'Electrical Systems': '⚡',
    'Plumbing Systems': '🚰',
    'HVAC (Heating & Cooling)': '❄️',
    'Interior (Walls & Floors)': '🛋️',
    'Structural & Foundation': '🏛️',
    'Doors & Windows': '🚪',
    'Built-in Appliances': '🍳',
    'Moisture & Mold Risk': '💧',
    'Structural': '🏛️',
    'Electrical': '⚡',
    'Plumbing': '🚰',
    'Surface': '🎨',
    'General Property Damage': '🏚️'
  };

  const filteredBatches = batches.filter((b) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      b.title?.toLowerCase().includes(q) ||
      b.property_address?.toLowerCase().includes(q) ||
      b.property_type?.toLowerCase().includes(q)
    );
  });

  if (loadingBatches) {
    return (
      <div className="batch-history-page">
        <div className="clean-loader">
          <div className="clean-spinner"></div>
          <p>Loading saved inspection batches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="batch-history-page">
      {/* ========================================================================= */}
      {/* VIEW 1: CLEAN BATCHES LIST (NO MESSY PHOTOS ON THIS PAGE) */}
      {/* ========================================================================= */}
      {viewMode === 'list' && (
        <div className="batches-clean-list-view animate-fade-in">
          {/* Page Header */}
          <div className="page-header-row mb-lg">
            <div>
              <h1 className="scanner-title">Saved Inspection Batches ({batches.length})</h1>
              <p className="scanner-subtitle">
                Click on any inspection batch below to open its dedicated photo gallery and reports page.
              </p>
            </div>

            <button
              type="button"
              className="btn-primary-action btn-sm shadow-glow"
              onClick={onNavigateToScanner}
            >
              ➕ Scan New Defect Batch
            </button>
          </div>

          {/* Search Bar */}
          <div className="history-toolbar mb-lg">
            <div className="search-input-wrap w-full">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search batches by property address, title, or date..."
                className="clean-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="search-clear" onClick={() => setSearchQuery('')}>✕</button>
              )}
            </div>
          </div>

          {/* Empty State */}
          {batches.length === 0 ? (
            <div className="clean-card empty-history-card">
              <div className="empty-icon">📁</div>
              <h3>No Saved Batches Yet</h3>
              <p>Scanned property inspection batches will appear here neatly organized.</p>
              <button
                type="button"
                className="btn-primary-action mt-md shadow-glow"
                onClick={onNavigateToScanner}
              >
                📸 Start Your First Batch Scan
              </button>
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="clean-card empty-history-card">
              <div className="empty-icon">🔍</div>
              <h3>No batches match "{searchQuery}"</h3>
              <button
                type="button"
                className="btn-light-secondary mt-md"
                onClick={() => setSearchQuery('')}
              >
                Clear Search
              </button>
            </div>
          ) : (
            <div className="batches-deck-grid">
              {filteredBatches.map((batch) => {
                const photoCount = batch.finding_count || 0;

                return (
                  <div
                    key={batch.id}
                    className="batch-card-tile"
                    onClick={() => handleOpenBatchPage(batch.id)}
                    title="Click to open this batch page"
                  >
                    <div>
                      <div className="batch-tile-header">
                        <span className="batch-count-tag">
                          📸 {photoCount} Photo{photoCount === 1 ? '' : 's'}
                        </span>
                        <span className="batch-tile-date">
                          🗓️ {new Date(batch.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <h3 className="batch-tile-title">{batch.title}</h3>

                      <div className="batch-tile-address">
                        <span>📍</span>
                        <span>{batch.property_address || 'On-Site Property Inspection'}</span>
                      </div>
                    </div>

                    <div className="batch-tile-footer">
                      <button
                        type="button"
                        className="btn-pdf-download"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                        onClick={(e) => handleDownloadMasterPdfFromCard(batch, e)}
                        title="Download Complete PDF report for this batch"
                      >
                        📄 Master PDF
                      </button>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="batch-active-indicator" style={{ cursor: 'pointer' }}>
                          Open Batch →
                        </span>

                        <button
                          type="button"
                          className="btn-icon-delete"
                          onClick={(e) => handleDeleteBatch(batch.id, e)}
                          title="Delete this entire batch"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: DEDICATED NEW PAGE FOR THE OPENED BATCH (CLEAN & UNCLUTTERED) */}
      {/* ========================================================================= */}
      {viewMode === 'batch_detail' && (
        <div className="batch-detail-page animate-fade-in">
          {/* Top Back Navigation Bar */}
          <div className="batch-detail-top-nav">
            <button
              type="button"
              className="btn-back-batches"
              onClick={handleBackToBatchesList}
            >
              ← Back to Saved Batches
            </button>

            <button
              type="button"
              className="btn-light-secondary btn-sm"
              onClick={onNavigateToScanner}
            >
              ➕ Scan Another Batch
            </button>
          </div>

          {loadingBatchDetails || !selectedBatchData ? (
            <div className="clean-loader p-xl">
              <div className="clean-spinner"></div>
              <p>Opening batch photos...</p>
            </div>
          ) : (
            <div className="active-batch-view">
              {/* Clean Batch Header Card */}
              <div className="active-batch-header-bar">
                <div className="active-batch-header-left">
                  <span className="active-batch-status-pill">
                    ● Batch Portfolio ({selectedBatchData.findings?.length || 0} Photos)
                  </span>
                  <h1 className="active-batch-main-title">{selectedBatchData.title}</h1>
                  <div className="active-batch-sub-meta">
                    <span>📍 {selectedBatchData.property_address || 'On-Site Property Inspection'}</span>
                    <span>🗓️ {new Date(selectedBatchData.created_at).toLocaleString()}</span>
                    <span>🏠 {selectedBatchData.property_type || 'Residential'}</span>
                  </div>
                </div>

                <div className="active-batch-header-right flex-center gap-xs">
                  <button
                    type="button"
                    className="btn-crl-action shadow-glow"
                    onClick={() => setCrlModalOpen(true)}
                    title="Open Realtor Repair Request Tool & export legal negotiation addendum"
                  >
                    🤝 Realtor Repair Tool (CRL)
                  </button>

                  <button
                    type="button"
                    className="btn-primary-action shadow-glow"
                    onClick={handleDownloadBatchMasterPdf}
                    title="Download 1 consolidated Master PDF containing all photos and findings"
                  >
                    📄 Download Master PDF (All {selectedBatchData.findings?.length || 0} Photos)
                  </button>

                  <button
                    type="button"
                    className="btn-light-secondary"
                    onClick={(e) => handleDeleteBatch(selectedBatchData.id, e)}
                    title="Delete this entire batch"
                  >
                    🗑️ Delete Batch
                  </button>
                </div>
              </div>

              {/* Photos Gallery Section */}
              <div className="batch-photos-section">
                <div className="batch-photos-intro">
                  <h3>
                    📸 Documented Photos ({selectedBatchData.findings?.length || 0})
                  </h3>
                  <span className="text-secondary" style={{ fontSize: '0.85rem' }}>
                    Click any photo to zoom in full-resolution
                  </span>
                </div>

                {!selectedBatchData.findings || selectedBatchData.findings.length === 0 ? (
                  <div className="clean-card text-center p-xl">
                    <p className="text-secondary">No photos logged in this batch.</p>
                  </div>
                ) : (
                  <div className="batch-photos-grid">
                    {selectedBatchData.findings.map((finding, idx) => {
                      const imageSrc =
                        finding.image_url ||
                        (finding.image_data
                          ? `data:${finding.image_mime_type || 'image/jpeg'};base64,${finding.image_data}`
                          : null);
                      const displayCat = finding.category || finding.ai_category || 'General Property Damage';
                      const roomTag = finding.location_in_property || 'General Area';
                      const angleTag = finding.location_direction;

                      return (
                        <div key={finding.id || idx} className="batch-photo-card">
                          {/* Card Top Bar */}
                          <div className="photo-card-top-bar">
                            <span className="photo-card-index">Photo #{idx + 1} of {selectedBatchData.findings.length}</span>
                            <span className={`clean-severity-badge sev-${finding.ai_severity?.toLowerCase()}`}>
                              ● {finding.ai_severity || 'Medium'}
                            </span>
                          </div>

                          {/* Evidence Photo: Side-by-Side if annotated, or single photo with Annotate button */}
                          {imageSrc && (
                            finding.annotated_image_data ? (
                              <div className="p-sm" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <div className="evidence-side-by-side-wrap">
                                  <div className="evidence-side-item">
                                    <span className="side-label">📷 Original Baseline</span>
                                    <div
                                      className="side-thumb-wrap"
                                      onClick={() => setLightboxImage({ url: imageSrc, title: `${finding.ai_issue} (Original)`, room: roomTag })}
                                      title="Click to zoom original photo"
                                      style={{ cursor: 'pointer' }}
                                    >
                                      <img src={imageSrc} alt={`${finding.ai_issue} Original`} />
                                    </div>
                                  </div>

                                  <div className="evidence-side-item">
                                    <span className="side-label red-label">🔍 Annotated Damage Markup</span>
                                    <div
                                      className="side-thumb-wrap annotated-border"
                                      onClick={() => setLightboxImage({ url: finding.annotated_image_data, title: `${finding.ai_issue} (Annotated)`, room: roomTag })}
                                      title="Click to zoom annotated markup"
                                      style={{ cursor: 'pointer' }}
                                    >
                                      <img src={finding.annotated_image_data} alt={`${finding.ai_issue} Annotated`} />
                                    </div>
                                  </div>
                                </div>

                                <div className="annotation-btn-row">
                                  <button
                                    type="button"
                                    className="btn-annotate-action"
                                    onClick={() => setAnnotatingItem({ finding, index: idx, imageSrc })}
                                  >
                                    ✏️ Edit Markup
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-remove-annotation"
                                    onClick={() => handleRemoveBatchAnnotation(finding.id, idx)}
                                  >
                                    ✕ Remove Markup
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div
                                  className="photo-card-thumb-wrap"
                                  onClick={() => setLightboxImage({ url: imageSrc, title: finding.ai_issue, room: roomTag })}
                                  title="Click to zoom full-resolution photo"
                                >
                                  <img src={imageSrc} alt={finding.ai_issue} className="photo-card-thumb" />
                                  <div className="photo-card-zoom-overlay">
                                    <span className="photo-card-zoom-pill">🔍 Click to Zoom</span>
                                  </div>
                                </div>

                                <div className="p-xs px-sm" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                  <button
                                    type="button"
                                    className="btn-annotate-action"
                                    onClick={() => setAnnotatingItem({ finding, index: idx, imageSrc })}
                                    title="Draw red circle, arrow, or damage highlight box"
                                  >
                                    ✏️ Annotate Defect Photo
                                  </button>
                                </div>
                              </div>
                            )
                          )}

                          {/* Card Details Body */}
                          <div className="photo-card-body">
                            {/* Room & Category Tags */}
                            <div className="photo-card-tags-row">
                              <span className="clean-location-badge">
                                📍 {roomTag}
                              </span>
                              {angleTag && !roomTag.includes(angleTag) && (
                                <span className="clean-location-badge">
                                  🧭 {angleTag}
                                </span>
                              )}
                              <span className="clean-category-badge">
                                {categoryIcons[displayCat] || '🏷️'} {displayCat}
                              </span>
                            </div>

                            {/* Defect Title & Description */}
                            <h4 className="photo-card-title">{finding.ai_issue}</h4>
                            <p className="photo-card-desc">{finding.ai_description}</p>

                            {/* Inspector On-Site Observation */}
                            {finding.inspector_comment && (
                              <div className="photo-card-desc" style={{ fontStyle: 'italic', background: '#f8fafc', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                                <strong>On-Site Note:</strong> "{finding.inspector_comment}"
                              </div>
                            )}

                            {/* AI Vision Recommendation */}
                            {finding.ai_recommendation && (
                              <div className="photo-card-callout-ai">
                                <strong>🤖 AI Vision Recommendation:</strong> {finding.ai_recommendation}
                              </div>
                            )}

                            {/* FINAL READ-ONLY INSPECTOR PROFESSIONAL RECOMMENDATION (NO MESSY EDITORS) */}
                            {finding.inspector_recommendation && (
                              <div className="photo-card-callout-inspector">
                                <strong style={{ color: '#92400e', display: 'block', marginBottom: '0.2rem' }}>
                                  👷 Inspector's Professional Recommendation:
                                </strong>
                                <span>{finding.inspector_recommendation}</span>
                              </div>
                            )}
                          </div>

                          {/* Card Actions Footer */}
                          <div className="photo-card-actions-bar">
                            <button
                              type="button"
                              className="btn-pdf-download"
                              onClick={() => handleDownloadSinglePhotoPdf(finding, idx)}
                              title={`Download single-page PDF for finding #${idx + 1} only`}
                            >
                              📄 Download Single PDF (Finding #{idx + 1} Only)
                            </button>

                            <button
                              type="button"
                              className="btn-icon-delete"
                              onClick={(e) => handleDeletePhotoFinding(finding.id, e)}
                              title="Delete this photo"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* HIGH RESOLUTION EVIDENCE LIGHTBOX MODAL */}
      {/* ========================================================================= */}
      {lightboxImage && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setLightboxImage(null)}>
          <div className="modal-box image-lightbox-box" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-header">
              <h4>📸 {lightboxImage.title}</h4>
              <button className="modal-close-btn" onClick={() => setLightboxImage(null)}>✕</button>
            </div>
            <div className="lightbox-content">
              <img src={lightboxImage.url} alt={lightboxImage.title} className="lightbox-img" />
            </div>
            <div className="lightbox-footer">
              <span>📍 {lightboxImage.room || 'Property Evidence'}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setLightboxImage(null)}>
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Damage Annotation Studio Modal */}
      {annotatingItem && (
        <PhotoAnnotationModal
          isOpen={Boolean(annotatingItem)}
          onClose={() => setAnnotatingItem(null)}
          imageSrc={annotatingItem.imageSrc}
          defectTitle={annotatingItem.finding?.ai_issue || 'Defect Photo'}
          onSaveAnnotation={handleSaveBatchAnnotation}
        />
      )}

      {/* Realtor Repair Request Tool (CRL) Modal */}
      {crlModalOpen && selectedBatchData && (
        <RealtorRepairBuilderModal
          isOpen={crlModalOpen}
          onClose={() => setCrlModalOpen(false)}
          inspection={selectedBatchData}
          onAddToast={addToast}
        />
      )}
    </div>
  );
}
