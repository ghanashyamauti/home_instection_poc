import React, { useState } from 'react';
import {
  INSPECTION_CATEGORIES,
  LOCATION_ROOMS,
  PHOTO_DIRECTIONS,
  QUICK_RECOMMENDATIONS
} from '../services/inspectionStandards';

// 1. Standalone Category Selector with dynamic 'Other' box
export function CategorySelector({
  category,
  onCategoryChange,
  customCategory,
  onCustomCategoryChange
}) {
  return (
    <div className="inspector-control-group">
      <label className="inspector-control-label">
        <span>🏷️ 1. Inspection Category (System)</span>
        <span className="optional-tag">(Optional — AI can auto-detect if skipped)</span>
      </label>

      <div className="category-select-wrapper">
        <select
          className="form-select inspector-select"
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          {INSPECTION_CATEGORIES.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.icon} {cat.label}
            </option>
          ))}
        </select>

        {category === 'Other' && (
          <div className="custom-category-box animate-slide-down mt-xs">
            <label className="field-sub-label">Custom Category Name:</label>
            <input
              type="text"
              className="form-input custom-category-input"
              placeholder="e.g. Swimming Pool, Solar Array, Septic System, Outbuilding"
              value={customCategory}
              onChange={(e) => onCustomCategoryChange(e.target.value)}
              autoFocus
            />
          </div>
        )}
      </div>
    </div>
  );
}

// 2. Standalone Location & Angle/Direction Tag Selector
export function LocationDirectionSelector({
  location,
  onLocationChange,
  locationDirection,
  onLocationDirectionChange,
  stepNumber = '3'
}) {
  const [showPresets, setShowPresets] = useState(true);

  function handleRoomSelect(room) {
    if (location === room) {
      onLocationChange('');
    } else {
      onLocationChange(room);
    }
  }

  function handleDirectionSelect(dir) {
    if (locationDirection === dir) {
      onLocationDirectionChange('');
    } else {
      onLocationDirectionChange(dir);
    }
  }

  return (
    <div className="inspector-control-group">
      <div className="flex-between">
        <label className="inspector-control-label">
          <span>📍 {stepNumber ? `${stepNumber}. ` : ''}Photo Location & Angle Tags</span>
          <span className="optional-tag">(Optional)</span>
        </label>
        <button
          type="button"
          className="btn-text-subtle"
          onClick={() => setShowPresets(!showPresets)}
        >
          {showPresets ? 'Hide Tag Chips ▲' : '⚡ 1-Click Quick Tags ▼'}
        </button>
      </div>

      {showPresets && (
        <div className="quick-tags-drawer animate-fade-in mt-xs">
          <div className="quick-tag-row">
            <span className="quick-tag-heading">Area / Room:</span>
            <div className="chip-buttons-scroll">
              {LOCATION_ROOMS.map((room) => (
                <button
                  key={room}
                  type="button"
                  className={`quick-chip-btn ${location === room ? 'chip-active' : ''}`}
                  onClick={() => handleRoomSelect(room)}
                >
                  {room}
                </button>
              ))}
            </div>
          </div>

          <div className="quick-tag-row mt-xs">
            <span className="quick-tag-heading">Angle / Position:</span>
            <div className="chip-buttons-scroll">
              {PHOTO_DIRECTIONS.map((dir) => (
                <button
                  key={dir}
                  type="button"
                  className={`quick-chip-btn ${locationDirection === dir ? 'chip-active' : ''}`}
                  onClick={() => handleDirectionSelect(dir)}
                >
                  {dir}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Editable Location and Direction Inputs */}
      <div className="location-inputs-grid mt-sm">
        <div className="location-input-field flex-2">
          <label className="field-micro-label">
            <span>📍 Specific Area / Room</span>
            <span className="optional-tag">(or type freeform)</span>
          </label>
          <input
            type="text"
            className="form-input clean-input"
            placeholder="Type or click chips above (e.g. Kitchen, Master Bedroom, East Wall)"
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
          />
        </div>

        <div className="location-input-field flex-1">
          <label className="field-micro-label">
            <span>🧭 Angle / Direction</span>
            <span className="optional-tag">(Optional)</span>
          </label>
          <input
            type="text"
            className="form-input clean-input"
            placeholder="e.g. Left Side, Ceiling, Under Sink"
            value={locationDirection}
            onChange={(e) => onLocationDirectionChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

// 3. Prominent Post-Scan Inspector Recommendation Card (Optional option for our recommendation after AI answer)
export function InspectorRecommendationBox({
  value,
  onChange,
  onSave,
  saving = false,
  readOnly = false
}) {
  const [showPresets, setShowPresets] = useState(false);

  function handleQuickInsert(phrase) {
    if (value?.trim()) {
      onChange(`${value.trim()} ${phrase}`);
    } else {
      onChange(phrase);
    }
  }

  return (
    <div className="inspector-post-rec-card animate-fade-in">
      <div className="rec-card-header">
        <div className="rec-title-group">
          <div className="flex-center gap-xs">
            <span className="rec-header-icon">👷</span>
            <h4 className="rec-header-title">Our Recommendation / Inspector's Professional Advice</h4>
            <span className="optional-tag-badge">Optional</span>
          </div>
          <p className="rec-card-subtitle mt-xxs">
            Add your own recommendation or contractor repair instructions for the report. Leave blank if the AI recommendation is sufficient.
          </p>
        </div>

        <button
          type="button"
          className="btn-text-subtle"
          onClick={() => setShowPresets(!showPresets)}
        >
          {showPresets ? 'Hide Shortcuts ▲' : '⚡ 1-Click Action Phrases ▼'}
        </button>
      </div>

      {showPresets && (
        <div className="quick-tags-drawer animate-fade-in mb-sm">
          <span className="quick-tag-heading">Click to insert standard US recommendation narrative:</span>
          <div className="rec-phrases-list mt-xs">
            {QUICK_RECOMMENDATIONS.map((phrase, idx) => (
              <button
                key={idx}
                type="button"
                className="phrase-chip-btn"
                onClick={() => handleQuickInsert(phrase)}
              >
                + {phrase}
              </button>
            ))}
          </div>
        </div>
      )}

      <textarea
        className="form-textarea inspector-rec-textarea"
        rows="3"
        placeholder="Optional: Type your professional closing recommendation here (e.g., 'Recommend licensed plumbing contractor evaluate and repair drain P-trap prior to closing')..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={readOnly}
      />

      {onSave && (
        <div className="rec-card-footer mt-xs flex-between">
          <span className="rec-footer-hint">
            💡 Will be highlighted as <strong>"Inspector's Professional Recommendation"</strong> in the client PDF report.
          </span>
          <button
            type="button"
            className="btn-primary-action btn-sm btn-save-rec"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : '✓ Save Our Recommendation'}
          </button>
        </div>
      )}
    </div>
  );
}

// Default combined container for backwards-compatibility
export default function InspectorFieldControls({
  category,
  onCategoryChange,
  customCategory,
  onCustomCategoryChange,
  location,
  onLocationChange,
  locationDirection,
  onLocationDirectionChange,
  inspectorRecommendation,
  onInspectorRecommendationChange,
  showRecommendation = false,
  compact = false
}) {
  return (
    <div className={`inspector-field-controls ${compact ? 'compact-mode' : ''}`}>
      <CategorySelector
        category={category}
        onCategoryChange={onCategoryChange}
        customCategory={customCategory}
        onCustomCategoryChange={onCustomCategoryChange}
      />

      <div className="mt-sm">
        <LocationDirectionSelector
          location={location}
          onLocationChange={onLocationChange}
          locationDirection={locationDirection}
          onLocationDirectionChange={onLocationDirectionChange}
          stepNumber="2"
        />
      </div>

      {showRecommendation && (
        <div className="mt-sm">
          <InspectorRecommendationBox
            value={inspectorRecommendation}
            onChange={onInspectorRecommendationChange}
          />
        </div>
      )}
    </div>
  );
}
