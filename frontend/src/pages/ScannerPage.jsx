import React, { useState, useRef, useEffect } from 'react';
import { scanBatch, updateFinding } from '../services/api';
import { useToast } from '../context/ToastContext';
import { generatePdfReport } from '../services/pdfGenerator';
import { InspectorRecommendationBox } from '../components/InspectorFieldControls';
import PhotoAnnotationModal from '../components/PhotoAnnotationModal';
import RealtorRepairBuilderModal from '../components/RealtorRepairBuilderModal';
import LiveCameraModal from '../components/LiveCameraModal';
import { compressImage, formatFileSize } from '../utils/imageCompressor';
import {
  INSPECTION_CATEGORIES,
  LOCATION_ROOMS,
  PHOTO_DIRECTIONS
} from '../services/inspectionStandards';

export default function ScannerPage({ onNavigateToHistory }) {
  const { addToast } = useToast();

  // Mode state: 'guided' (Room-by-Room Multi-Photo) or 'direct' (1-Click Express Batch)
  const [scanMode, setScanMode] = useState('guided');

  // ================= ROOM-BY-ROOM GUIDED INSPECTOR STATE =================
  const [activeRoom, setActiveRoom] = useState('Kitchen');
  const [showCustomRoom, setShowCustomRoom] = useState(false);
  const [customRoomName, setCustomRoomName] = useState('');
  const [activeDirection, setActiveDirection] = useState('Front View');
  const [activeCategory, setActiveCategory] = useState('');
  const [activeComment, setActiveComment] = useState('');
  const [propertyTitle, setPropertyTitle] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');

  // Queue of photos across rooms for ONE single report
  const [guidedQueue, setGuidedQueue] = useState([]);

  // Guided file input refs
  const guidedFileRef = useRef(null);
  const guidedCameraRef = useRef(null);

  // ================= DIRECT BATCH MODE STATE =================
  const [photoBatch, setPhotoBatch] = useState([]);
  const [globalLocation, setGlobalLocation] = useState('');
  const [globalCategory, setGlobalCategory] = useState('');
  const [globalDirection, setGlobalDirection] = useState('');
  const [globalComment, setGlobalComment] = useState('');
  const [globalRecommendation, setGlobalRecommendation] = useState('');

  const directFileRef = useRef(null);
  const directCameraRef = useRef(null);

  // ================= COMMON AI / SCAN STATE =================
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  const [batchResults, setBatchResults] = useState(null);
  const [savingRecId, setSavingRecId] = useState(null);
  const [annotatingFinding, setAnnotatingFinding] = useState(null);
  const [crlModalOpen, setCrlModalOpen] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [liveCameraOpen, setLiveCameraOpen] = useState(false);
  const [cameraTargetMode, setCameraTargetMode] = useState('guided');

  // Clipboard paste support (Ctrl+V)
  useEffect(() => {
    function handlePaste(e) {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            if (scanMode === 'guided') {
              addPhotosToGuidedQueue([file]);
              addToast('Pasted screenshot into room inspection queue!', 'info');
            } else {
              addFilesToDirectBatch([file]);
              addToast('Pasted screenshot into batch queue!', 'info');
            }
            break;
          }
        }
      }
    }
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [scanMode, guidedQueue.length, photoBatch.length, activeRoom, activeDirection]);

  // ================= ROOM-BY-ROOM GUIDED MODE HANDLERS =================
  async function addPhotosToGuidedQueue(files) {
    if (!files || files.length === 0) return;

    const currentRoom = showCustomRoom && customRoomName.trim()
      ? customRoomName.trim()
      : (activeRoom || 'General Area');

    setIsCompressing(true);
    try {
      const fileList = Array.from(files);
      for (const file of fileList) {
        const compressedRes = await compressImage(file);
        setGuidedQueue((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 7)}`,
            file: compressedRes.file || file,
            preview: compressedRes.preview,
            room: currentRoom,
            direction: activeDirection || '',
            category: activeCategory || '',
            comment: activeComment || '',
            inspectorRecommendation: '',
            compressionRatio: compressedRes.ratio,
            originalSize: compressedRes.originalSize,
            compressedSize: compressedRes.compressedSize
          }
        ]);
      }

      addToast(`Added ${files.length} photo${files.length > 1 ? 's' : ''} tagged [📍 ${currentRoom}${activeDirection ? ` • 🧭 ${activeDirection}` : ''}] • ⚡ Auto-optimized`, 'success');
      setBatchResults(null);
    } catch (err) {
      console.error('Guided photo compression error:', err);
    } finally {
      setIsCompressing(false);
    }
  }

  function handleSelectGuidedFiles(e) {
    const files = e.target.files;
    if (files && files.length > 0) {
      addPhotosToGuidedQueue(files);
      e.target.value = '';
    }
  }

  function updateGuidedQueueItem(id, field, value) {
    setGuidedQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  function handleRemoveGuidedQueueItem(id) {
    setGuidedQueue((prev) => prev.filter((item) => item.id !== id));
  }

  function handleClearGuidedQueue() {
    setGuidedQueue([]);
    setBatchResults(null);
  }

  async function handleRunGuidedQueueScan(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (guidedQueue.length === 0) {
      addToast('Please add at least one photo with room tags before running scan', 'error');
      return;
    }

    setScanning(true);
    setScanProgress(`Analyzing ${guidedQueue.length} photo${guidedQueue.length > 1 ? 's' : ''} across rooms for single report...`);
    setBatchResults(null);

    try {
      const formData = new FormData();
      guidedQueue.forEach((item) => {
        formData.append('images', item.file);
      });

      const itemLocations = guidedQueue.map((p) => p.room.trim() || propertyAddress.trim() || 'General Area');
      const itemDirections = guidedQueue.map((p) => p.direction.trim());
      const itemCategories = guidedQueue.map((p) => p.category.trim());
      const itemComments = guidedQueue.map((p) => p.comment.trim());
      const itemRecommendations = guidedQueue.map((p) => p.inspectorRecommendation.trim());

      formData.append('itemLocations', JSON.stringify(itemLocations));
      formData.append('itemDirections', JSON.stringify(itemDirections));
      formData.append('itemCategories', JSON.stringify(itemCategories));
      formData.append('itemComments', JSON.stringify(itemComments));
      formData.append('itemRecommendations', JSON.stringify(itemRecommendations));

      const reportTitle = propertyTitle.trim() || `Property Inspection Report (${guidedQueue.length} Defects)`;
      formData.append('title', reportTitle);
      if (propertyAddress.trim()) formData.append('location', propertyAddress.trim());

      setScanProgress(`AI vision models are diagnosing defects across all ${guidedQueue.length} photos...`);

      const response = await scanBatch(formData);

      setBatchResults(response);
      addToast(`Inspection scan complete! ${response.findings?.length || 0} defects documented for single report.`, 'success');

      setTimeout(() => {
        document.getElementById('batch-results-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } catch (err) {
      addToast(err.message || 'Inspection scan failed. Please try again.', 'error');
    }

    setScanning(false);
    setScanProgress('');
  }

  // ================= DIRECT MODE HANDLERS =================
  async function addFilesToDirectBatch(files) {
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

    setIsCompressing(true);
    try {
      for (const file of filesToAdd) {
        const compressedRes = await compressImage(file);
        setPhotoBatch((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 7)}`,
            file: compressedRes.file || file,
            preview: compressedRes.preview,
            name: file.name || `Photo_${Date.now()}.jpg`,
            location: '',
            locationDirection: '',
            category: '',
            comment: '',
            inspectorRecommendation: '',
            compressionRatio: compressedRes.ratio,
            originalSize: compressedRes.originalSize,
            compressedSize: compressedRes.compressedSize
          }
        ]);
      }
      setBatchResults(null);
    } catch (err) {
      console.error('Direct photo compression error:', err);
    } finally {
      setIsCompressing(false);
    }
  }

  function handleDirectFileChange(e) {
    const files = e.target.files;
    if (files && files.length > 0) {
      addFilesToDirectBatch(files);
      e.target.value = '';
    }
  }

  function handleSelectDirectSample(sample) {
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
        locationDirection: '',
        category: sample.category || '',
        comment: sample.comment || '',
        inspectorRecommendation: ''
      }
    ]);
    setBatchResults(null);
    addToast(`Added preset "${sample.title}" to queue`, 'info');
  }

  function handleRemovePhoto(id) {
    setPhotoBatch((prev) => prev.filter((p) => p.id !== id));
  }

  function handleClearDirectBatch() {
    setPhotoBatch([]);
    setBatchResults(null);
  }

  function updateDirectPhotoItem(id, field, value) {
    setPhotoBatch((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  async function handleRunDirectBatchScan(e) {
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
      photoBatch.forEach((item) => {
        formData.append('images', item.file);
      });

      const itemLocations = photoBatch.map((p) => p.location.trim() || globalLocation.trim());
      const itemComments = photoBatch.map((p) => p.comment.trim() || globalComment.trim());
      const itemCategories = photoBatch.map((p) => p.category.trim() || globalCategory.trim());
      const itemDirections = photoBatch.map((p) => p.locationDirection.trim() || globalDirection.trim());
      const itemRecommendations = photoBatch.map((p) => p.inspectorRecommendation.trim() || globalRecommendation.trim());

      formData.append('itemLocations', JSON.stringify(itemLocations));
      formData.append('itemComments', JSON.stringify(itemComments));
      formData.append('itemCategories', JSON.stringify(itemCategories));
      formData.append('itemDirections', JSON.stringify(itemDirections));
      formData.append('itemRecommendations', JSON.stringify(itemRecommendations));

      if (globalLocation.trim()) formData.append('location', globalLocation.trim());
      if (globalComment.trim()) formData.append('comment', globalComment.trim());
      if (globalCategory.trim()) formData.append('category', globalCategory.trim());
      if (globalDirection.trim()) formData.append('locationDirection', globalDirection.trim());

      setScanProgress(`Analyzing ${photoBatch.length} defect photo${photoBatch.length > 1 ? 's' : ''} with AI vision models...`);

      const response = await scanBatch(formData);

      setBatchResults(response);
      addToast(`AI Batch Scan Complete! (${response.findings?.length || 0} defects diagnosed)`, 'success');

      setTimeout(() => {
        document.getElementById('batch-results-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } catch (err) {
      addToast(err.message || 'Batch scan failed. Please try again.', 'error');
    }

    setScanning(false);
    setScanProgress('');
  }

  // ================= SAVE INSPECTOR RECOMMENDATION =================
  async function handleSaveInspectorRecommendation(findingId, index, recText) {
    setSavingRecId(findingId);
    try {
      const finding = batchResults.findings[index];
      if (finding.inspection_id) {
        await updateFinding(finding.inspection_id, findingId, {
          inspectorRecommendation: recText
        });
      }
      // Update local state
      setBatchResults((prev) => {
        const nextFindings = [...prev.findings];
        nextFindings[index] = { ...nextFindings[index], inspector_recommendation: recText };
        return { ...prev, findings: nextFindings };
      });
      addToast('Your professional recommendation saved to report!', 'success');
    } catch (err) {
      addToast('Failed to save recommendation: ' + err.message, 'error');
    }
    setSavingRecId(null);
  }

  // ================= ENRICHED FINDINGS & PDF EXPORT =================
  function getEnrichedFindings() {
    if (!batchResults || !batchResults.findings) return [];
    return batchResults.findings.map((finding, idx) => {
      const localPreview = (scanMode === 'guided' ? guidedQueue[idx]?.preview : photoBatch[idx]?.preview) ||
                           guidedQueue[idx]?.preview ||
                           photoBatch[idx]?.preview;
      return {
        ...finding,
        preview: localPreview || finding.preview || null,
        image_data: finding.image_data || localPreview || null,
        annotated_image_data: finding.annotated_image_data || null,
        annotated_preview: finding.annotated_image_data || null
      };
    });
  }

  async function handleSaveAnnotation(annotatedDataUrl) {
    if (!annotatingFinding) return;
    const { finding, index } = annotatingFinding;

    setBatchResults((prev) => {
      const nextFindings = [...prev.findings];
      nextFindings[index] = {
        ...nextFindings[index],
        annotated_image_data: annotatedDataUrl,
        annotated_preview: annotatedDataUrl
      };
      return { ...prev, findings: nextFindings };
    });

    try {
      if (finding.id && finding.inspection_id) {
        await updateFinding(finding.inspection_id, finding.id, {
          annotatedImageData: annotatedDataUrl
        });
      }
      addToast('Damage markup saved! Side-by-side view updated.', 'success');
    } catch (err) {
      console.warn('Could not persist annotation to server:', err);
    }
    setAnnotatingFinding(null);
  }

  function handleRemoveAnnotation(index) {
    setBatchResults((prev) => {
      const nextFindings = [...prev.findings];
      nextFindings[index] = {
        ...nextFindings[index],
        annotated_image_data: null,
        annotated_preview: null
      };
      return { ...prev, findings: nextFindings };
    });
    const finding = batchResults.findings[index];
    if (finding && finding.id && finding.inspection_id) {
      updateFinding(finding.inspection_id, finding.id, { annotatedImageData: null }).catch(() => {});
    }
    addToast('Annotation removed, returned to clean baseline photo', 'info');
  }

  async function handleDownloadFullReport() {
    if (!batchResults || !batchResults.findings || batchResults.findings.length === 0) return;
    try {
      addToast(`Preparing complete report for all ${batchResults.findings.length} photos...`, 'info');
      const enriched = getEnrichedFindings();
      const reportData = {
        title: propertyTitle.trim() || batchResults.inspection?.title || `Complete Property Inspection Audit (${enriched.length} Defects)`,
        property_address: propertyAddress.trim() || globalLocation.trim() || batchResults.inspection?.property_address || 'On-Site Property Inspection',
        property_type: 'Residential',
        created_at: batchResults.inspection?.created_at || new Date().toISOString(),
        findings: enriched
      };
      await generatePdfReport(reportData);
      addToast(`Complete PDF Report downloaded! (All ${enriched.length} photos included)`, 'success');
    } catch (err) {
      console.error('PDF generation error:', err);
      addToast('Failed to generate complete PDF report: ' + err.message, 'error');
    }
  }

  async function handleDownloadSingleFinding(finding, idx) {
    try {
      const displayIdx = typeof idx === 'number' ? idx + 1 : 1;
      addToast(`Preparing single PDF for Finding #${displayIdx}...`, 'info');
      const localPreview = (typeof idx === 'number' && (guidedQueue[idx]?.preview || photoBatch[idx]?.preview)) ||
                           finding.preview ||
                           null;
      const enrichedFinding = {
        ...finding,
        preview: localPreview || finding.preview || null,
        image_data: finding.image_data || localPreview || null,
        annotated_image_data: finding.annotated_image_data || null,
        annotated_preview: finding.annotated_image_data || null
      };
      const roomTag = enrichedFinding.location_in_property || propertyAddress || globalLocation || 'Property Inspection';
      const angleTag = enrichedFinding.location_direction ? ` [${enrichedFinding.location_direction}]` : '';

      const reportData = {
        title: `Defect Finding #${displayIdx}: ${enrichedFinding.ai_issue || 'Inspection Defect'}`,
        property_address: `${roomTag}${angleTag}`,
        property_type: 'Residential',
        created_at: enrichedFinding.created_at || new Date().toISOString(),
        findings: [enrichedFinding]
      };
      await generatePdfReport(reportData);
      addToast(`Single PDF for Finding #${displayIdx} downloaded!`, 'success');
    } catch (err) {
      console.error('Single PDF error:', err);
      addToast('Failed to generate single PDF: ' + err.message, 'error');
    }
  }

  function handleStartNewInspection() {
    setBatchResults(null);
    setGuidedQueue([]);
    setActiveRoom('Kitchen');
    setActiveDirection('Front View');
    setActiveComment('');
    setPropertyTitle('');
    setPropertyAddress('');
    setPhotoBatch([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    'Other': '📝',
    'Structural': '🏛️',
    'Electrical': '⚡',
    'Plumbing': '🚰',
    'Surface': '🎨',
    'General Property Damage': '🏚️'
  };

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
          Professional US home inspection powered by neural vision models. Choose between the structured Category-First Guided Mode (HIP Style) or the Instant 1-Click Fast Scan.
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="mode-switcher-container">
        <button
          type="button"
          className={`mode-switcher-btn ${scanMode === 'guided' ? 'active' : ''}`}
          onClick={() => {
            setScanMode('guided');
            setBatchResults(null);
          }}
        >
          <span className="mode-icon">📋</span>
          <span className="mode-title">Guided Inspector Mode</span>
          <span className="mode-badge">HIP Style (Category First)</span>
        </button>

        <button
          type="button"
          className={`mode-switcher-btn ${scanMode === 'direct' ? 'active' : ''}`}
          onClick={() => {
            setScanMode('direct');
            setBatchResults(null);
          }}
        >
          <span className="mode-icon">⚡</span>
          <span className="mode-title">Direct Quick Scan</span>
          <span className="mode-badge">1-Click Fast Batch</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* WORKFLOW 1: ROOM-BY-ROOM MULTI-PHOTO INSPECTOR MODE (SINGLE MASTER REPORT) */}
      {/* ========================================================================= */}
      {scanMode === 'guided' && (
        <div className="clean-card scanner-card animate-fade-in">
          {/* Banner */}
          <div className="guided-flow-banner">
            <span className="flow-step-pill">Room-by-Room Workflow</span>
            <span className="flow-step-text">
              Select Room (e.g. Kitchen) ➔ Snap/Upload all angles ➔ Switch Room (e.g. Hallway) ➔ Run AI Scan ➔ 1 Unified Master Report
            </span>
          </div>

          {/* Optional Property Header */}
          <div className="guided-step-block mb-md">
            <div className="field-grid">
              <div className="field-col">
                <label className="field-micro-label">
                  🏠 Property Address <span className="optional-tag">(Optional)</span>
                </label>
                <input
                  type="text"
                  className="clean-input"
                  placeholder="e.g. 742 Evergreen Terrace, Springfield"
                  value={propertyAddress}
                  onChange={(e) => setPropertyAddress(e.target.value)}
                />
              </div>

              <div className="field-col">
                <label className="field-micro-label">
                  📋 Report Title <span className="optional-tag">(Optional)</span>
                </label>
                <input
                  type="text"
                  className="clean-input"
                  placeholder="e.g. Residential Property Inspection Report"
                  value={propertyTitle}
                  onChange={(e) => setPropertyTitle(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Step 1: Active Room / Area Selector */}
          <div className="room-selector-card">
            <div className="flex-between">
              <label className="inspector-control-label">
                <span>📍 1. Active Room / Area:</span>
                <span className="active-room-pill">
                  Current Room: <strong>{showCustomRoom && customRoomName ? customRoomName : activeRoom}</strong>
                </span>
              </label>
              <button
                type="button"
                className="btn-text-subtle"
                onClick={() => setShowCustomRoom(!showCustomRoom)}
              >
                {showCustomRoom ? 'Pick Standard Rooms ▼' : '+ Custom Area Name'}
              </button>
            </div>

            {showCustomRoom ? (
              <div className="custom-room-input-row mt-xs animate-slide-down">
                <input
                  type="text"
                  className="clean-input"
                  placeholder="Type custom area name (e.g. Swimming Pool, Screened Porch, Back Patio, Sunroom)..."
                  value={customRoomName}
                  onChange={(e) => setCustomRoomName(e.target.value)}
                  autoFocus
                />
              </div>
            ) : (
              <div className="room-chips-deck mt-xs">
                {LOCATION_ROOMS.map((room) => (
                  <button
                    key={room}
                    type="button"
                    className={`room-chip-btn ${activeRoom === room ? 'chip-active' : ''}`}
                    onClick={() => setActiveRoom(room)}
                  >
                    📍 {room}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Step 2: Angle / Position Selector */}
          <div className="angle-selector-card mt-md">
            <div className="flex-between">
              <label className="inspector-control-label">
                <span>🧭 2. Angle / View Tag for Next Photo:</span>
                <span className="optional-tag">
                  {activeDirection ? `Selected: ${activeDirection}` : '(Optional)'}
                </span>
              </label>
            </div>
            <div className="angle-chips-deck mt-xs">
              {PHOTO_DIRECTIONS.map((dir) => (
                <button
                  key={dir}
                  type="button"
                  className={`angle-chip-btn ${activeDirection === dir ? 'chip-active' : ''}`}
                  onClick={() => setActiveDirection(activeDirection === dir ? '' : dir)}
                >
                  🧭 {dir}
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: Add Photos for Active Room (Snap or Upload) */}
          <div className="photo-capture-card mt-md">
            <div className="flex-between">
              <label className="inspector-control-label">
                <span>
                  📸 3. Capture / Upload Photo(s) for <u>{showCustomRoom && customRoomName ? customRoomName : activeRoom}</u>
                </span>
                <span className="optional-tag">
                  Tag: <strong>[📍 {showCustomRoom && customRoomName ? customRoomName : activeRoom}{activeDirection ? ` • 🧭 ${activeDirection}` : ''}]</strong>
                </span>
              </label>
            </div>

            {/* Optional Observation Field Note for this photo */}
            <div className="quick-note-row mt-xs mb-sm">
              <input
                type="text"
                className="clean-input clean-input-compact"
                placeholder={`Optional note for this ${showCustomRoom && customRoomName ? customRoomName : activeRoom} photo (e.g. 'Active drip along pipe', 'Hairline crack along header')...`}
                value={activeComment}
                onChange={(e) => setActiveComment(e.target.value)}
              />
            </div>

            {/* Big Action Buttons */}
            <div className="dropzone-buttons-row">
              <button
                type="button"
                className="big-action-btn camera-btn"
                onClick={() => {
                  setCameraTargetMode('guided');
                  setLiveCameraOpen(true);
                }}
              >
                <span className="action-btn-icon">📷</span>
                <span className="action-btn-text">Snap Live Photo</span>
                <span className="action-btn-sub">Open live camera viewfinder</span>
              </button>

              <button
                type="button"
                className="big-action-btn upload-btn"
                onClick={() => guidedFileRef.current?.click()}
              >
                <span className="action-btn-icon">📸</span>
                <span className="action-btn-text">Select / Upload Photos</span>
                <span className="action-btn-sub">Select 1 or multiple photos from gallery</span>
              </button>
            </div>

            <div className="dropzone-drag-hint text-center">
              💡 <strong>Workflow Tip:</strong> Snap all photos of <strong>{showCustomRoom && customRoomName ? customRoomName : activeRoom}</strong> (under sink, ceiling, etc.), then tap another room (e.g. <strong>Hallway</strong>) above to keep adding for this report! Or press <strong>Ctrl+V</strong> to paste anytime.
            </div>

            {/* Hidden native inputs */}
            <input
              type="file"
              ref={guidedFileRef}
              onChange={handleSelectGuidedFiles}
              accept="image/*"
              multiple
              style={{ display: 'none' }}
            />
            <input
              type="file"
              ref={guidedCameraRef}
              onChange={handleSelectGuidedFiles}
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
            />
          </div>

          {/* Step 4: Multi-Photo Report Queue */}
          {guidedQueue.length > 0 && (
            <div className="guided-queue-section animate-fade-in">
              <div className="queue-header-flex">
                <div className="queue-header-left">
                  <h3 className="queue-title">
                    📋 Inspection Report Queue <span className="counter-badge">{guidedQueue.length} Photos</span>
                  </h3>
                  <div className="queue-room-pills mt-xxs">
                    {Object.entries(
                      guidedQueue.reduce((acc, item) => {
                        acc[item.room] = (acc[item.room] || 0) + 1;
                        return acc;
                      }, {})
                    ).map(([room, count]) => (
                      <span key={room} className="room-summary-pill">
                        📍 {room}: <strong>{count}</strong>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="queue-header-actions flex-center gap-xs">
                  <button
                    type="button"
                    className="btn-light-secondary btn-sm"
                    onClick={() => {
                      setCameraTargetMode('guided');
                      setLiveCameraOpen(true);
                    }}
                  >
                    📷 Snap Photo
                  </button>
                  <button
                    type="button"
                    className="btn-light-secondary btn-sm"
                    onClick={() => guidedFileRef.current?.click()}
                  >
                    + Add From Files
                  </button>
                  <button
                    type="button"
                    className="btn-light-danger btn-sm"
                    onClick={handleClearGuidedQueue}
                  >
                    🗑️ Clear Queue
                  </button>
                </div>
              </div>

              {/* Grid of Queued Photos */}
              <div className="guided-queue-grid mt-sm">
                {guidedQueue.map((item, idx) => (
                  <div key={item.id} className="queue-photo-card animate-fade-in">
                    <div className="queue-card-top-tag">
                      <div className="flex-center gap-xxs" style={{ overflow: 'hidden' }}>
                        <span className="tag-room-badge" title={item.room}>📍 {item.room}</span>
                        {item.direction && (
                          <span className="tag-angle-badge" title={item.direction}>🧭 {item.direction}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="queue-card-del-btn"
                        onClick={() => handleRemoveGuidedQueueItem(item.id)}
                        title="Remove photo"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="queue-photo-thumb-wrap">
                      <img src={item.preview} alt={`Photo ${idx + 1}`} className="queue-photo-thumb" />
                      <span className="queue-photo-number">#{idx + 1}</span>
                      {item.compressionRatio && item.compressionRatio !== '0%' && (
                        <span className="queue-compression-pill" title={`Auto-compressed: ${formatFileSize(item.originalSize)} → ${formatFileSize(item.compressedSize)}`}>
                          ⚡ -{item.compressionRatio}
                        </span>
                      )}
                    </div>

                    <div className="queue-card-controls">
                      {/* Room Selector */}
                      <select
                        className="clean-select-micro"
                        value={item.room}
                        onChange={(e) => updateGuidedQueueItem(item.id, 'room', e.target.value)}
                        title="Room / Area"
                      >
                        {LOCATION_ROOMS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                        {!LOCATION_ROOMS.includes(item.room) && (
                          <option value={item.room}>{item.room}</option>
                        )}
                      </select>

                      {/* Angle Selector */}
                      <select
                        className="clean-select-micro"
                        value={item.direction}
                        onChange={(e) => updateGuidedQueueItem(item.id, 'direction', e.target.value)}
                        title="Angle / Direction"
                      >
                        <option value="">Angle (Optional)</option>
                        {PHOTO_DIRECTIONS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>

                      {/* Optional Note */}
                      <input
                        type="text"
                        className="clean-input-micro"
                        placeholder="Note (optional)"
                        value={item.comment}
                        onChange={(e) => updateGuidedQueueItem(item.id, 'comment', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Button to Run AI Scan for Single Report */}
              <div className="queue-action-bar mt-lg">
                <button
                  type="button"
                  className="btn-primary-action btn-full btn-lg shadow-glow"
                  onClick={handleRunGuidedQueueScan}
                  disabled={scanning || guidedQueue.length === 0}
                >
                  {scanning ? (
                    <span className="spinner-row">
                      <span className="clean-spinner"></span>
                      {scanProgress || `AI is analyzing all ${guidedQueue.length} photos...`}
                    </span>
                  ) : (
                    `🤖 Run AI Diagnostic on All ${guidedQueue.length} Photos for Single Report`
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* WORKFLOW 2: DIRECT QUICK SCAN (1-CLICK EXPRESS BATCH) */}
      {/* ========================================================================= */}
      {scanMode === 'direct' && (
        <div className="clean-card scanner-card animate-fade-in">
          <form onSubmit={handleRunDirectBatchScan}>
            <div className="form-section">
              <div className="section-header-flex">
                <label className="section-label">
                  Defect Photos Queue <span className="required-star">*</span>
                  {photoBatch.length > 0 && (
                    <span className="batch-counter-badge">
                      {photoBatch.length}/10 Photos
                    </span>
                  )}
                </label>

                {photoBatch.length > 0 && (
                  <div className="batch-actions-header">
                    <button
                      type="button"
                      className="btn-text-action"
                      onClick={() => {
                        setCameraTargetMode('direct');
                        setLiveCameraOpen(true);
                      }}
                    >
                      📷 Snap Photo
                    </button>
                    <button
                      type="button"
                      className="btn-text-action"
                      onClick={() => directFileRef.current?.click()}
                    >
                      + Add More
                    </button>
                    <button
                      type="button"
                      className="btn-text-danger"
                      onClick={handleClearDirectBatch}
                    >
                      🗑️ Clear All
                    </button>
                  </div>
                )}
              </div>

              {photoBatch.length === 0 ? (
                <div className="clean-dropzone">
                  <div className="dropzone-buttons-row">
                    <button
                      type="button"
                      className="big-action-btn camera-btn"
                      onClick={() => {
                        setCameraTargetMode('direct');
                        setLiveCameraOpen(true);
                      }}
                    >
                      <span className="action-btn-icon">📷</span>
                      <span className="action-btn-text">Take Live Photo</span>
                      <span className="action-btn-sub">Open live camera viewfinder</span>
                    </button>

                    <button
                      type="button"
                      className="big-action-btn upload-btn"
                      onClick={() => directFileRef.current?.click()}
                    >
                      <span className="action-btn-icon">📸</span>
                      <span className="action-btn-text">Upload Photos</span>
                      <span className="action-btn-sub">Select 1 or multiple (up to 10)</span>
                    </button>
                  </div>

                  <div className="dropzone-drag-hint">
                    Hold <strong>Ctrl</strong> to select multiple files • Drag & drop • Or press <strong>Ctrl+V</strong> to paste
                  </div>
                </div>
              ) : (
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
                          {item.compressionRatio && item.compressionRatio !== '0%' && (
                            <span className="queue-compression-pill" title={`Auto-compressed: ${formatFileSize(item.originalSize)} → ${formatFileSize(item.compressedSize)}`}>
                              ⚡ -{item.compressionRatio}
                            </span>
                          )}
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
                          <div className="batch-inputs-row">
                            <input
                              type="text"
                              className="batch-sub-input"
                              placeholder="Area (e.g. Kitchen)"
                              value={item.location}
                              onChange={(e) =>
                                updateDirectPhotoItem(item.id, 'location', e.target.value)
                              }
                            />
                            <select
                              className="batch-sub-select"
                              value={item.locationDirection}
                              onChange={(e) =>
                                updateDirectPhotoItem(item.id, 'locationDirection', e.target.value)
                              }
                            >
                              <option value="">Angle</option>
                              {PHOTO_DIRECTIONS.map((dir) => (
                                <option key={dir} value={dir}>{dir}</option>
                              ))}
                            </select>
                          </div>

                          <select
                            className="batch-sub-select w-full mt-xxs"
                            value={item.category}
                            onChange={(e) =>
                              updateDirectPhotoItem(item.id, 'category', e.target.value)
                            }
                          >
                            {INSPECTION_CATEGORIES.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.icon} {cat.label}
                              </option>
                            ))}
                          </select>

                          <input
                            type="text"
                            className="batch-sub-input mt-xxs"
                            placeholder="Note (optional)"
                            value={item.comment}
                            onChange={(e) =>
                              updateDirectPhotoItem(item.id, 'comment', e.target.value)
                            }
                          />
                        </div>
                      </div>
                    ))}

                    {photoBatch.length < 10 && (
                      <div
                        className="batch-add-tile"
                        onClick={() => directFileRef.current?.click()}
                      >
                        <span className="batch-add-icon">＋</span>
                        <span className="batch-add-text">Add More Photos</span>
                        <span className="batch-add-sub">({10 - photoBatch.length} left)</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Hidden native inputs */}
              <input
                type="file"
                ref={directFileRef}
                onChange={handleDirectFileChange}
                accept="image/*"
                multiple
                style={{ display: 'none' }}
              />
              <input
                type="file"
                ref={directCameraRef}
                onChange={handleDirectFileChange}
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
              />
            </div>

            {/* Optional Global Property Info */}
            <div className="form-section mt-md">
              <div className="field-grid">
                <div className="field-col">
                  <label className="field-label">
                    Property Address / Location <span className="optional-tag">(Optional)</span>
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
                    Default Category for All <span className="optional-tag">(Optional)</span>
                  </label>
                  <select
                    className="clean-input"
                    value={globalCategory}
                    onChange={(e) => setGlobalCategory(e.target.value)}
                  >
                    {INSPECTION_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="form-section mt-lg">
              <button
                type="submit"
                className="btn-primary-action btn-full shadow-glow"
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
                  'Add Photos to Start Quick Scan'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* AI DIAGNOSTIC RESULTS SECTION (WITH POST-SCAN INSPECTOR RECOMMENDATION) */}
      {/* ========================================================================= */}
      {batchResults && batchResults.findings && (
        <div className="batch-results-section animate-fade-in" id="batch-results-section">
          {/* Summary Banner */}
          <div className="clean-card batch-summary-banner">
            <div className="batch-summary-content">
              <div className="batch-summary-left">
                <span className="result-tag">✓ AI Vision Diagnosis Ready</span>
                <h2 className="batch-summary-title">
                  Inspection Audit:{' '}
                  <span className="text-highlight">
                    {batchResults.findings.length} Defect
                    {batchResults.findings.length > 1 ? 's' : ''} Diagnosed
                  </span>
                </h2>
                <div className="batch-severity-tally">
                  {severityCounts.Critical > 0 && (
                    <span className="clean-severity-badge sev-critical">● {severityCounts.Critical} Critical</span>
                  )}
                  {severityCounts.High > 0 && (
                    <span className="clean-severity-badge sev-high">● {severityCounts.High} High</span>
                  )}
                  {severityCounts.Medium > 0 && (
                    <span className="clean-severity-badge sev-medium">● {severityCounts.Medium} Medium</span>
                  )}
                  {severityCounts.Low > 0 && (
                    <span className="clean-severity-badge sev-low">● {severityCounts.Low} Low</span>
                  )}
                </div>
              </div>

              <div className="batch-summary-right flex-center gap-xs">
                <button
                  type="button"
                  className="btn-crl-action shadow-glow"
                  onClick={() => setCrlModalOpen(true)}
                  title="Open Realtor Repair Request Tool & negotiation addendum builder"
                >
                  🤝 Realtor Repair Tool (CRL)
                </button>
                <button
                  type="button"
                  className="btn-primary-action shadow-glow"
                  onClick={handleDownloadFullReport}
                  title="Download 1 consolidated Master PDF containing all photos and findings"
                >
                  📄 Download Master PDF (All {batchResults.findings.length} Photos)
                </button>
              </div>
            </div>
          </div>

          {/* List of Finding Cards */}
          <div className="batch-findings-stack">
            {batchResults.findings.map((finding, idx) => {
              const displayCategory = finding.category || finding.ai_category || 'General Property Damage';
              const imageSrc = finding.image_url ||
                (finding.image_data ? `data:${finding.image_mime_type || 'image/jpeg'};base64,${finding.image_data}` : null) ||
                guidedQueue[idx]?.preview ||
                photoBatch[idx]?.preview;

              return (
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
                          {categoryIcons[displayCategory] || '🏷️'} {displayCategory}
                        </span>
                        {finding.location_in_property && (
                          <span className="clean-location-badge">
                            📍 {finding.location_in_property}
                          </span>
                        )}
                        {finding.location_direction && !finding.location_in_property?.includes(finding.location_direction) && (
                          <span className="clean-location-badge">
                            🧭 {finding.location_direction}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="result-header-right">
                      <button
                        type="button"
                        className="btn-pdf-download"
                        onClick={() => handleDownloadSingleFinding(finding, idx)}
                        title={`Download individual single-page PDF for finding #${idx + 1} only`}
                      >
                        📄 Download Single PDF (Finding #{idx + 1} Only)
                      </button>
                    </div>
                  </div>

                  <div className="result-body">
                    {/* Visual Evidence: Side-by-Side if annotated, or single photo with Annotate button */}
                    {imageSrc && (
                      finding.annotated_image_data ? (
                        <div className="evidence-side-by-side-wrap mb-sm">
                          <div className="evidence-side-item">
                            <span className="side-label">📷 Original Baseline</span>
                            <div className="side-thumb-wrap">
                              <img src={imageSrc} alt={`${finding.ai_issue} Original`} />
                            </div>
                          </div>

                          <div className="evidence-side-item">
                            <span className="side-label red-label">🔍 Annotated Damage (Red Focus)</span>
                            <div className="side-thumb-wrap annotated-border">
                              <img src={finding.annotated_image_data} alt={`${finding.ai_issue} Annotated`} />
                            </div>
                          </div>

                          <div className="annotation-btn-row" style={{ gridColumn: 'span 2' }}>
                            <button
                              type="button"
                              className="btn-annotate-action"
                              onClick={() => setAnnotatingFinding({ finding, index: idx, imageSrc })}
                            >
                              ✏️ Edit Markup
                            </button>
                            <button
                              type="button"
                              className="btn-remove-annotation"
                              onClick={() => handleRemoveAnnotation(idx)}
                            >
                              ✕ Remove Markup
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="result-image-thumbnail">
                          <img src={imageSrc} alt={finding.ai_issue} />
                          <div className="annotation-btn-row mt-xs">
                            <button
                              type="button"
                              className="btn-annotate-action"
                              onClick={() => setAnnotatingFinding({ finding, index: idx, imageSrc })}
                              title="Draw red circle, arrow, or damage highlight box"
                            >
                              ✏️ Annotate Defect Photo
                            </button>
                          </div>
                        </div>
                      )
                    )}

                    <div className="result-details">
                      {/* AI Description */}
                      <div className="detail-block">
                        <h4 className="detail-title">What is this issue?</h4>
                        <p className="detail-desc">{finding.ai_description}</p>
                      </div>

                      {/* On-Site Inspector Observation */}
                      {finding.inspector_comment && (
                        <div className="detail-block note-block">
                          <h4 className="detail-title">Inspector Observation:</h4>
                          <p className="detail-desc italic">"{finding.inspector_comment}"</p>
                        </div>
                      )}

                      {/* AI Vision Recommendation */}
                      <div className="detail-block recommendation-block">
                        <h4 className="detail-title recommendation-heading">🤖 AI Vision Recommendation:</h4>
                        <p className="detail-desc recommendation-text">{finding.ai_recommendation}</p>
                      </div>

                      {/* POST-SCAN DEDICATED BOX: INSPECTOR'S PROFESSIONAL RECOMMENDATION */}
                      <div className="detail-block mt-sm">
                        <InspectorRecommendationBox
                          value={finding.inspector_recommendation || ''}
                          onChange={(newVal) => {
                            setBatchResults((prev) => {
                              const nextFindings = [...prev.findings];
                              nextFindings[idx] = { ...nextFindings[idx], inspector_recommendation: newVal };
                              return { ...prev, findings: nextFindings };
                            });
                          }}
                          onSave={() => handleSaveInspectorRecommendation(finding.id, idx, finding.inspector_recommendation)}
                          saving={savingRecId === finding.id}
                        />
                      </div>

                      <div className="result-meta-footer mt-xs">
                        <span className="confidence-text">
                          AI Confidence: <strong>{finding.ai_confidence || 85}%</strong>
                        </span>
                        {finding.ai_model_used && (
                          <span className="model-text">
                            Vision Engine: {finding.ai_model_used.split('/')[1] || finding.ai_model_used}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Actions Bar */}
          <div className="batch-bottom-bar flex-center gap-xs">
            <button
              type="button"
              className="btn-crl-action shadow-glow"
              onClick={() => setCrlModalOpen(true)}
            >
              🤝 Realtor Repair Tool (CRL)
            </button>
            <button
              type="button"
              className="btn-primary-action shadow-glow"
              onClick={handleDownloadFullReport}
            >
              📄 Download Master PDF (All {batchResults.findings.length} Photos)
            </button>
            <button
              type="button"
              className="btn-light-secondary"
              onClick={handleStartNewInspection}
            >
              📸 Document Another Inspection
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

      {/* Photo Damage Annotation Studio Modal */}
      {annotatingFinding && (
        <PhotoAnnotationModal
          isOpen={Boolean(annotatingFinding)}
          onClose={() => setAnnotatingFinding(null)}
          imageSrc={annotatingFinding.imageSrc}
          defectTitle={annotatingFinding.finding?.ai_issue || 'Defect Photo'}
          onSaveAnnotation={handleSaveAnnotation}
        />
      )}

      {/* Realtor Repair Request Tool (CRL) Modal */}
      {crlModalOpen && batchResults && (
        <RealtorRepairBuilderModal
          isOpen={crlModalOpen}
          onClose={() => setCrlModalOpen(false)}
          inspection={{
            id: batchResults.id || 'live-scan',
            title: propertyTitle || (scanMode === 'guided' ? 'Room-by-Room Inspection Audit' : 'Express Defect Batch Inspection'),
            property_address: propertyAddress || globalLocation || 'On-Site Property Inspection',
            client_name: 'Property Buyer / Client',
            created_at: new Date().toISOString(),
            findings: getEnrichedFindings()
          }}
          onAddToast={addToast}
        />
      )}

      {/* Live Camera Viewfinder Modal */}
      {liveCameraOpen && (
        <LiveCameraModal
          isOpen={liveCameraOpen}
          onClose={() => setLiveCameraOpen(false)}
          onCapture={(file) => {
            if (cameraTargetMode === 'guided') {
              addPhotosToGuidedQueue([file]);
            } else {
              addFilesToDirectBatch([file]);
            }
          }}
          room={showCustomRoom && customRoomName ? customRoomName : activeRoom}
          direction={activeDirection}
        />
      )}
    </div>
  );
}
