import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Live Interactive Camera Viewfinder
 * Opens real live device webcam / smartphone camera stream via WebRTC getUserMedia.
 * Features:
 * - Live video viewfinder with grid alignment & room tagging
 * - High-resolution frame capture
 * - Multi-photo continuous snap workflow (e.g. snap 4 room angles in one session)
 * - Camera flip toggle (front / rear camera)
 * - Shutter flash animation
 * - Safe hardware track release when closed
 */
export default function LiveCameraModal({
  isOpen,
  onClose,
  onCapture,
  room = 'General Area',
  direction = 'Front View'
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' for back camera, 'user' for webcam
  const [isFlashing, setIsFlashing] = useState(false);
  const [capturedCount, setCapturedCount] = useState(0);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  // Check for multiple video devices (front + rear)
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then((devices) => {
          const videoDevices = devices.filter((d) => d.kind === 'videoinput');
          setHasMultipleCameras(videoDevices.length > 1);
        })
        .catch(() => {});
    }
  }, []);

  // Stop camera stream cleanly
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Start real camera stream
  const startCamera = useCallback(async (mode) => {
    stopStream();
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera API (getUserMedia) is not supported in this browser.');
      return;
    }

    try {
      const constraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(() => {});
          setCameraActive(true);
        };
      }
    } catch (err) {
      console.warn('Primary camera constraints failed, attempting fallback:', err);
      // Fallback: request any available video camera
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(() => {});
            setCameraActive(true);
          };
        }
      } catch (fallbackErr) {
        console.error('Camera access completely denied or unavailable:', fallbackErr);
        if (fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError') {
          setCameraError('Camera permission was denied. Please allow camera access in your browser address bar.');
        } else if (fallbackErr.name === 'NotFoundError' || fallbackErr.name === 'DevicesNotFoundError') {
          setCameraError('No camera found on this device. Please connect a webcam or upload an image file.');
        } else {
          setCameraError(`Unable to open camera: ${fallbackErr.message || 'Device camera error'}`);
        }
      }
    }
  }, [stopStream]);

  // Lifecycle when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCapturedCount(0);
      startCamera(facingMode);
    } else {
      stopStream();
    }

    return () => {
      stopStream();
    };
  }, [isOpen, facingMode, startCamera, stopStream]);

  // Toggle front/back camera
  const handleToggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture photo from live video frame
  const handleSnapPhoto = () => {
    if (!videoRef.current || !cameraActive) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');

    // If using front camera ('user'), mirror preview to match standard selfie view
    if (facingMode === 'user') {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);

    // Trigger visual shutter flash
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 180);

    // Export high-quality JPEG
    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        const timestamp = Date.now();
        const cleanRoom = (room || 'area').replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `live_snap_${cleanRoom}_${timestamp}.jpg`;

        const capturedFile = new File([blob], filename, {
          type: 'image/jpeg',
          lastModified: timestamp
        });

        setCapturedCount((prev) => prev + 1);
        onCapture(capturedFile);
      },
      'image/jpeg',
      0.92
    );
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose} style={{ zIndex: 10000 }}>
      <div
        className="modal-box live-camera-modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '680px', width: '96vw', padding: '0', overflow: 'hidden' }}
      >
        {/* Camera Header */}
        <div className="live-camera-header">
          <div className="live-cam-title-group">
            <span className="live-indicator-dot"></span>
            <h3 className="live-cam-title">Live Property Inspection Camera</h3>
          </div>

          <div className="live-cam-header-actions">
            {hasMultipleCameras && (
              <button
                type="button"
                className="btn-flip-cam"
                onClick={handleToggleCamera}
                title="Flip between front and rear cameras"
              >
                🔄 Flip Cam
              </button>
            )}
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Close camera"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Viewfinder Stage */}
        <div className="live-viewfinder-stage">
          {/* Shutter Flash Overlay */}
          {isFlashing && <div className="shutter-flash-overlay"></div>}

          {/* Active Video Stream */}
          <video
            ref={videoRef}
            className={`live-video-element ${facingMode === 'user' ? 'mirrored' : ''}`}
            autoPlay
            playsInline
            muted
          />

          {/* Grid Overlay for Alignment */}
          <div className="viewfinder-grid-overlay">
            <div className="grid-line grid-v1"></div>
            <div className="grid-line grid-v2"></div>
            <div className="grid-line grid-h1"></div>
            <div className="grid-line grid-h2"></div>
            <div className="viewfinder-crosshair"></div>
          </div>

          {/* Tag Watermark Overlay */}
          <div className="viewfinder-tag-overlay">
            <span className="vf-tag-pill">📍 {room}</span>
            {direction && <span className="vf-tag-pill">🧭 {direction}</span>}
          </div>

          {/* Snapped Counter Badge */}
          {capturedCount > 0 && (
            <div className="snapped-counter-badge animate-fade-in">
              📸 {capturedCount} photo{capturedCount > 1 ? 's' : ''} captured!
            </div>
          )}

          {/* Error Message if Permission Denied */}
          {cameraError && (
            <div className="camera-error-backdrop">
              <div className="camera-error-card">
                <span className="cam-error-icon">📷⚠️</span>
                <h4>Camera Access Required</h4>
                <p>{cameraError}</p>
                <button
                  type="button"
                  className="btn-primary-action btn-sm mt-xs"
                  onClick={() => startCamera(facingMode)}
                >
                  🔄 Retry Camera Access
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Camera Control Footer */}
        <div className="live-camera-footer">
          <div className="footer-left-status">
            <span className="status-label">
              {capturedCount === 0
                ? 'Align defect in crosshairs & tap Shutter'
                : `Added ${capturedCount} photo${capturedCount > 1 ? 's' : ''} to queue`}
            </span>
          </div>

          <div className="footer-shutter-container">
            <button
              type="button"
              className={`shutter-button ${!cameraActive ? 'disabled' : ''}`}
              onClick={handleSnapPhoto}
              disabled={!cameraActive}
              title="Snap Live Photo"
            >
              <div className="shutter-inner-ring">
                <div className="shutter-center-dot"></div>
              </div>
            </button>
          </div>

          <div className="footer-right-actions">
            <button
              type="button"
              className="btn-done-cam"
              onClick={onClose}
            >
              {capturedCount > 0 ? `Done (${capturedCount})` : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
