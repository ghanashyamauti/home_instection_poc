import React, { useState, useRef, useEffect } from 'react';
import { SAMPLE_DEFECTS, svgToFile } from '../services/sampleImages';

export default function ImageUpload({ onImageSelect, preview, onRemove, onApplySample }) {
  const [dragover, setDragover] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [selectedFileSize, setSelectedFileSize] = useState('');
  const [showSamplesModal, setShowSamplesModal] = useState(false);
  const fileInputRef = useRef(null);

  // Allow global Ctrl+V paste of images
  useEffect(() => {
    function handlePaste(e) {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            setSelectedFileName(file.name || 'clipboard_image.png');
            setSelectedFileSize((file.size / 1024).toFixed(1) + ' KB');
            onImageSelect(file);
            break;
          }
        }
      }
    }

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onImageSelect]);

  function handleDragOver(e) {
    e.preventDefault();
    setDragover(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setDragover(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragover(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFileName(file.name);
      setSelectedFileSize((file.size / (1024 * 1024)).toFixed(2) + ' MB');
      onImageSelect(file);
    }
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (file) {
      setSelectedFileName(file.name);
      setSelectedFileSize((file.size / (1024 * 1024)).toFixed(2) + ' MB');
      onImageSelect(file);
    }
  }

  function handleClick() {
    fileInputRef.current?.click();
  }

  function handleCameraCapture() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        setSelectedFileName(file.name || 'camera_photo.jpg');
        setSelectedFileSize((file.size / (1024 * 1024)).toFixed(2) + ' MB');
        onImageSelect(file);
      }
    };
    input.click();
  }

  function handleChoosePreset(sample) {
    const file = svgToFile(sample.svg, `${sample.id}.svg`);
    setSelectedFileName(`${sample.title}.svg`);
    setSelectedFileSize('Sample Inspection Image');
    
    // Convert to data URI for immediate preview
    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(sample.svg)}`;
    
    if (onApplySample) {
      onApplySample(sample, file, dataUrl);
    } else {
      onImageSelect(file);
    }
    setShowSamplesModal(false);
  }

  if (preview) {
    return (
      <div className="upload-preview-card">
        <div className="upload-preview-media">
          <img src={preview} alt="Inspection defect evidence" className="upload-preview-img" />
          <div className="upload-preview-badge">
            <span className="pulse-dot"></span> Ready for AI Analysis
          </div>
        </div>
        <div className="upload-preview-bar">
          <div className="upload-file-meta">
            <span className="upload-file-icon">📷</span>
            <div>
              <div className="upload-file-name">{selectedFileName || 'Evidence Image'}</div>
              <div className="upload-file-size">{selectedFileSize || 'Ready'}</div>
            </div>
          </div>
          <div className="upload-preview-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleClick}
            >
              🔄 Replace
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => {
                setSelectedFileName('');
                setSelectedFileSize('');
                onRemove();
              }}
            >
              ✕ Remove
            </button>
          </div>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          style={{ display: 'none' }}
        />
      </div>
    );
  }

  return (
    <div className="upload-component">
      <div
        className={`upload-zone-modern ${dragover ? 'dragover' : ''}`}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="upload-icon-wrapper">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <h4 className="upload-zone-title">Drop property image here or <span className="highlight-link">browse</span></h4>
        <p className="upload-zone-subtitle">JPG, PNG, WEBP, HEIC up to 10MB • Or press <strong>Ctrl+V</strong> to paste from clipboard</p>

        <div className="upload-quick-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleClick}
          >
            📁 Choose File
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleCameraCapture}
          >
            📸 Capture Photo
          </button>
          <button
            type="button"
            className="btn btn-preset-pill btn-sm"
            onClick={() => setShowSamplesModal(true)}
          >
            ⚡ Load Sample Defect
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          style={{ display: 'none' }}
          id="image-upload-input"
        />
      </div>

      {/* Preset Samples Modal */}
      {showSamplesModal && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setShowSamplesModal(false)}>
          <div className="modal-box modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">⚡ Select a Real-World Inspection Defect</h3>
                <p className="modal-subtitle">Pick any sample image to auto-populate defect visuals and inspector field notes.</p>
              </div>
              <button className="modal-close-btn" onClick={() => setShowSamplesModal(false)}>✕</button>
            </div>
            
            <div className="sample-defects-grid">
              {SAMPLE_DEFECTS.map((sample) => (
                <div
                  key={sample.id}
                  className="sample-defect-card"
                  onClick={() => handleChoosePreset(sample)}
                >
                  <div className="sample-card-media">
                    <img
                      src={`data:image/svg+xml;utf8,${encodeURIComponent(sample.svg)}`}
                      alt={sample.title}
                    />
                    <span className={`badge badge-category-${sample.category.toLowerCase().replace(/[^a-z]/g, '')}`}>
                      {sample.category}
                    </span>
                  </div>
                  <div className="sample-card-info">
                    <h5>{sample.title}</h5>
                    <p className="sample-card-loc">📍 {sample.location}</p>
                    <p className="sample-card-comment">"{sample.comment}"</p>
                  </div>
                  <button className="btn btn-primary btn-sm btn-full mt-sm">
                    Select This Defect →
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
