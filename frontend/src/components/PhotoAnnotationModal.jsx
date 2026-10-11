import React, { useState, useRef, useEffect } from 'react';

export default function PhotoAnnotationModal({
  isOpen,
  onClose,
  imageSrc,
  initialAnnotationSrc = null,
  onSaveAnnotation,
  defectTitle = 'Defect Photo'
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Tools: 'circle', 'arrow', 'rect', 'freehand', 'badge'
  const [activeTool, setActiveTool] = useState('circle');
  const [activeColor, setActiveColor] = useState('#ef4444'); // Standard Inspection Red
  const [lineWidth, setLineWidth] = useState(5);
  const [textBadge, setTextBadge] = useState('DEFECT');

  // Shapes history for Undo
  // shape: { type, color, width, ...coords, text }
  const [shapes, setShapes] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const [baseImage, setBaseImage] = useState(null);

  // Load the image into state
  useEffect(() => {
    if (!isOpen || !imageSrc) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setBaseImage(img);
      setShapes([]);
    };
    img.src = imageSrc;
  }, [isOpen, imageSrc]);

  // Redraw canvas whenever shapes, baseImage, or live drag position changes
  useEffect(() => {
    if (!baseImage || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Fixed canvas internal resolution matching natural image size (capped for crisp performance)
    const maxDimension = 1400;
    let width = baseImage.naturalWidth || 800;
    let height = baseImage.naturalHeight || 600;

    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    // 1. Draw base photo
    ctx.drawImage(baseImage, 0, 0, width, height);

    // 2. Draw all finalized shapes
    shapes.forEach((s) => drawShape(ctx, s));

    // 3. Draw in-progress shape while dragging
    if (isDrawing) {
      const tempShape = {
        type: activeTool,
        color: activeColor,
        width: lineWidth,
        startX: startPos.x,
        startY: startPos.y,
        endX: currentPos.x,
        endY: currentPos.y,
        badgeText: textBadge,
        points: activeTool === 'freehand' ? currentPos.points : undefined
      };
      drawShape(ctx, tempShape);
    }
  }, [baseImage, shapes, isDrawing, startPos, currentPos, activeTool, activeColor, lineWidth, textBadge]);

  // Helper to draw shapes with crisp shadows and arrows
  function drawShape(ctx, shape) {
    ctx.save();
    ctx.strokeStyle = shape.color;
    ctx.fillStyle = shape.color;
    ctx.lineWidth = shape.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Subtle drop shadow for high contrast on any background
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 2;

    const { startX, startY, endX, endY } = shape;

    if (shape.type === 'circle') {
      const radiusX = Math.abs(endX - startX) / 2;
      const radiusY = Math.abs(endY - startY) / 2;
      const centerX = Math.min(startX, endX) + radiusX;
      const centerY = Math.min(startY, endY) + radiusY;

      ctx.beginPath();
      ctx.ellipse(centerX, centerY, Math.max(radiusX, 4), Math.max(radiusY, 4), 0, 0, 2 * Math.PI);
      ctx.stroke();

      // Inner subtle semi-transparent tint to highlight defect center
      ctx.fillStyle = `${shape.color}18`;
      ctx.fill();
    } else if (shape.type === 'arrow') {
      const headLength = Math.max(16, shape.width * 3.5);
      const angle = Math.atan2(endY - startY, endX - startX);

      // Draw line shaft
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Draw arrowhead
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - headLength * Math.cos(angle - Math.PI / 6),
        endY - headLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        endX - headLength * Math.cos(angle + Math.PI / 6),
        endY - headLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
    } else if (shape.type === 'rect') {
      const x = Math.min(startX, endX);
      const y = Math.min(startY, endY);
      const w = Math.abs(endX - startX);
      const h = Math.abs(endY - startY);

      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.stroke();

      // Highlight fill
      ctx.fillStyle = `${shape.color}20`;
      ctx.fillRect(x, y, w, h);
    } else if (shape.type === 'freehand' && shape.points && shape.points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      for (let i = 1; i < shape.points.length; i++) {
        ctx.lineTo(shape.points[i].x, shape.points[i].y);
      }
      ctx.stroke();
    } else if (shape.type === 'badge') {
      const text = shape.badgeText || 'DEFECT';
      ctx.font = 'bold 16px Inter, system-ui, sans-serif';
      const textMetrics = ctx.measureText(text);
      const paddingX = 10;
      const paddingY = 6;
      const boxW = textMetrics.width + paddingX * 2;
      const boxH = 28;

      ctx.fillStyle = shape.color;
      ctx.beginPath();
      ctx.roundRect(startX, startY - boxH / 2, boxW, boxH, 6);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'transparent';
      ctx.fillText(text, startX + paddingX, startY + 6);
    }

    ctx.restore();
  }

  // Convert mouse/touch event coordinates into internal canvas resolution coordinates
  function getCanvasCoords(e) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    let clientX = e.clientX;
    let clientY = e.clientY;

    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: Math.round((clientX - rect.left) * scaleX),
      y: Math.round((clientY - rect.top) * scaleY)
    };
  }

  // Pointer start
  function handlePointerDown(e) {
    e.preventDefault();
    const coords = getCanvasCoords(e);
    setIsDrawing(true);
    setStartPos(coords);

    if (activeTool === 'freehand') {
      setCurrentPos({ ...coords, points: [coords] });
    } else {
      setCurrentPos(coords);
    }
  }

  // Pointer move
  function handlePointerMove(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const coords = getCanvasCoords(e);

    if (activeTool === 'freehand') {
      setCurrentPos((prev) => ({
        ...coords,
        points: [...(prev.points || [startPos]), coords]
      }));
    } else {
      setCurrentPos(coords);
    }
  }

  // Pointer up / end
  function handlePointerUp(e) {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);

    // Save final shape to stack
    const newShape = {
      type: activeTool,
      color: activeColor,
      width: lineWidth,
      startX: startPos.x,
      startY: startPos.y,
      endX: currentPos.x,
      endY: currentPos.y,
      badgeText: textBadge,
      points: activeTool === 'freehand' ? currentPos.points : undefined
    };

    setShapes((prev) => [...prev, newShape]);
  }

  function handleUndo() {
    setShapes((prev) => prev.slice(0, -1));
  }

  function handleClear() {
    setShapes([]);
  }

  function handleSave() {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.90);
    onSaveAnnotation(dataUrl);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-box annotation-studio-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '960px', width: '95vw', padding: '1.25rem' }}
      >
        {/* Studio Header */}
        <div className="studio-header-row">
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
              ✏️ Photo Damage Annotation Studio
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Draw red circles, arrows, or damage highlight boxes to pinpoint defect evidence on "{defectTitle}".
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Toolbar Controls */}
        <div className="studio-toolbar-deck">
          {/* Tool Selector */}
          <div className="studio-tools-group">
            <button
              type="button"
              className={`studio-tool-btn ${activeTool === 'circle' ? 'active' : ''}`}
              onClick={() => setActiveTool('circle')}
              title="Draw Red Circle around defect"
            >
              ⭕ Circle
            </button>
            <button
              type="button"
              className={`studio-tool-btn ${activeTool === 'arrow' ? 'active' : ''}`}
              onClick={() => setActiveTool('arrow')}
              title="Draw Arrow pointing to defect"
            >
              ➡️ Arrow
            </button>
            <button
              type="button"
              className={`studio-tool-btn ${activeTool === 'rect' ? 'active' : ''}`}
              onClick={() => setActiveTool('rect')}
              title="Highlight bounding box"
            >
              🔲 Box
            </button>
            <button
              type="button"
              className={`studio-tool-btn ${activeTool === 'freehand' ? 'active' : ''}`}
              onClick={() => setActiveTool('freehand')}
              title="Freehand drawing"
            >
              ✏️ Freehand
            </button>
            <button
              type="button"
              className={`studio-tool-btn ${activeTool === 'badge' ? 'active' : ''}`}
              onClick={() => setActiveTool('badge')}
              title="Stamp text label"
            >
              🏷️ Label
            </button>
          </div>

          {/* Label selector if badge tool selected */}
          {activeTool === 'badge' && (
            <div className="studio-badges-row">
              {['DEFECT', 'LEAK', 'CRACK', 'HAZARD', 'EXPOSED'].map((b) => (
                <button
                  key={b}
                  type="button"
                  className={`studio-sub-badge ${textBadge === b ? 'active' : ''}`}
                  onClick={() => setTextBadge(b)}
                >
                  {b}
                </button>
              ))}
            </div>
          )}

          {/* Color Palette */}
          <div className="studio-colors-group">
            {[
              { label: 'Red (Standard)', hex: '#ef4444' },
              { label: 'Amber Warning', hex: '#f59e0b' },
              { label: 'Cyan Highlight', hex: '#06b6d4' },
              { label: 'White', hex: '#ffffff' }
            ].map((c) => (
              <button
                key={c.hex}
                type="button"
                className={`studio-color-circle ${activeColor === c.hex ? 'active' : ''}`}
                style={{ backgroundColor: c.hex }}
                onClick={() => setActiveColor(c.hex)}
                title={c.label}
              />
            ))}
          </div>

          {/* Thickness */}
          <div className="studio-sizes-group">
            {[
              { label: 'Thin', val: 3 },
              { label: 'Med', val: 5 },
              { label: 'Thick', val: 8 }
            ].map((s) => (
              <button
                key={s.val}
                type="button"
                className={`studio-size-btn ${lineWidth === s.val ? 'active' : ''}`}
                onClick={() => setLineWidth(s.val)}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Actions: Undo / Clear */}
          <div className="studio-actions-group">
            <button
              type="button"
              className="studio-act-btn"
              onClick={handleUndo}
              disabled={shapes.length === 0}
              title="Undo last shape"
            >
              ↩️ Undo
            </button>
            <button
              type="button"
              className="studio-act-btn text-danger"
              onClick={handleClear}
              disabled={shapes.length === 0}
              title="Clear all annotations"
            >
              🗑️ Clear
            </button>
          </div>
        </div>

        {/* Canvas Workspace */}
        <div className="studio-canvas-stage" ref={containerRef}>
          <canvas
            ref={canvasRef}
            className="annotation-active-canvas"
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          />
          <div className="canvas-hint-banner">
            💡 Click & drag across the photo to draw {activeTool === 'circle' ? 'a red circle' : activeTool === 'arrow' ? 'an arrow' : 'a damage box'}
          </div>
        </div>

        {/* Studio Footer */}
        <div className="studio-footer-row">
          <div className="studio-footer-left">
            <span className="shapes-counter">
              {shapes.length === 0 ? 'No annotations drawn' : `${shapes.length} markup shape${shapes.length > 1 ? 's' : ''} added`}
            </span>
          </div>

          <div className="studio-footer-right">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary-action shadow-glow"
              onClick={handleSave}
            >
              💾 Save Annotation (Side-by-Side)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
