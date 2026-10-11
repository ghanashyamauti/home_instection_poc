import React, { useState, useMemo } from 'react';
import { generateRepairAddendumPdf } from '../services/pdfGenerator';

export default function RealtorRepairBuilderModal({
  isOpen,
  onClose,
  inspection,
  onAddToast = null
}) {
  if (!isOpen || !inspection) return null;

  const findings = inspection.findings || [];

  // Initialize requests state: key -> { requested: boolean, action: 'repair'|'credit'|'accept', creditAmount: number, notes: string }
  const [repairRequests, setRepairRequests] = useState(() => {
    const initial = {};
    findings.forEach((f, idx) => {
      const key = f.id || idx;
      // Extract numeric cost if present
      let defaultCost = 0;
      if (f.estimated_cost_high) {
        defaultCost = Number(f.estimated_cost_high) || 0;
      } else if (f.estimated_cost_low) {
        defaultCost = Number(f.estimated_cost_low) || 0;
      } else if (f.estimated_cost) {
        const match = String(f.estimated_cost).match(/\$?([0-9,]+)/);
        if (match) defaultCost = parseInt(match[1].replace(/,/g, ''), 10) || 0;
      }

      // Default high/critical severity items to 'repair', others to 'credit' or 'accept'
      const isUrgent = (f.ai_severity || '').toLowerCase().includes('critical') ||
                       (f.ai_severity || '').toLowerCase().includes('high');

      initial[key] = {
        requested: isUrgent,
        action: isUrgent ? 'repair' : 'accept',
        creditAmount: defaultCost || 350,
        notes: ''
      };
    });
    return initial;
  });

  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'repair', 'credit', 'accept', 'critical'
  const [isExporting, setIsExporting] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Live Metrics Calculation
  const metrics = useMemo(() => {
    let repairCount = 0;
    let creditCount = 0;
    let totalCreditDollars = 0;
    let acceptCount = 0;
    let criticalCount = 0;

    findings.forEach((f, idx) => {
      const key = f.id || idx;
      const req = repairRequests[key];
      const isUrgent = (f.ai_severity || '').toLowerCase().includes('critical') ||
                       (f.ai_severity || '').toLowerCase().includes('high');
      if (isUrgent) criticalCount++;

      if (req && req.requested) {
        if (req.action === 'repair') {
          repairCount++;
        } else if (req.action === 'credit') {
          creditCount++;
          totalCreditDollars += parseFloat(req.creditAmount) || 0;
        } else {
          acceptCount++;
        }
      } else {
        acceptCount++;
      }
    });

    return {
      total: findings.length,
      repairCount,
      creditCount,
      totalCreditDollars,
      acceptCount,
      criticalCount
    };
  }, [findings, repairRequests]);

  // Request state mutators
  const handleActionChange = (key, action) => {
    setRepairRequests((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        action,
        requested: action !== 'accept'
      }
    }));
  };

  const handleCreditChange = (key, amount) => {
    setRepairRequests((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        creditAmount: amount
      }
    }));
  };

  const handleNotesChange = (key, notes) => {
    setRepairRequests((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        notes
      }
    }));
  };

  const appendQuickNote = (key, snippet) => {
    setRepairRequests((prev) => {
      const curr = prev[key]?.notes || '';
      const separator = curr.trim() ? '; ' : '';
      return {
        ...prev,
        [key]: {
          ...prev[key],
          notes: curr + separator + snippet
        }
      };
    });
  };

  // Bulk presets
  const handleBulkSetCriticalToRepair = () => {
    setRepairRequests((prev) => {
      const next = { ...prev };
      findings.forEach((f, idx) => {
        const key = f.id || idx;
        const isUrgent = (f.ai_severity || '').toLowerCase().includes('critical') ||
                         (f.ai_severity || '').toLowerCase().includes('high');
        if (isUrgent) {
          next[key] = {
            ...next[key],
            action: 'repair',
            requested: true
          };
        }
      });
      return next;
    });
    if (onAddToast) onAddToast('Flagged all High & Critical defects for Contractor Repair', 'info');
  };

  const handleBulkAcceptAll = () => {
    setRepairRequests((prev) => {
      const next = { ...prev };
      findings.forEach((f, idx) => {
        const key = f.id || idx;
        next[key] = {
          ...next[key],
          action: 'accept',
          requested: false
        };
      });
      return next;
    });
    if (onAddToast) onAddToast('Reset all defect requests to Accept As-Is', 'info');
  };

  // Filtered list
  const filteredFindings = useMemo(() => {
    return findings.filter((f, idx) => {
      const key = f.id || idx;
      const req = repairRequests[key];
      const isUrgent = (f.ai_severity || '').toLowerCase().includes('critical') ||
                       (f.ai_severity || '').toLowerCase().includes('high');

      if (activeFilter === 'repair') return req?.action === 'repair' && req?.requested;
      if (activeFilter === 'credit') return req?.action === 'credit' && req?.requested;
      if (activeFilter === 'accept') return !req?.requested || req?.action === 'accept';
      if (activeFilter === 'critical') return isUrgent;
      return true;
    });
  }, [findings, repairRequests, activeFilter]);

  // Export Legal PDF
  const handleExportAddendum = async () => {
    try {
      setIsExporting(true);
      await generateRepairAddendumPdf(inspection, repairRequests);
      if (onAddToast) onAddToast('Realtor Repair & Credit Negotiation Addendum PDF generated successfully!', 'success');
    } catch (err) {
      console.error('CRL PDF export error:', err);
      if (onAddToast) onAddToast('Failed to export addendum PDF: ' + err.message, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Copy Negotiation Text Summary for Email/MLS
  const handleCopySummary = () => {
    try {
      let text = `=====================================================\n`;
      text += `PROPERTY REPAIR & CREDIT NEGOTIATION ADDENDUM (CRL)\n`;
      text += `=====================================================\n`;
      text += `Property: ${inspection.property_address || 'Property Inspection'}\n`;
      text += `Buyer / Client: ${inspection.client_name || 'Buyer'}\n`;
      text += `Inspection Date: ${new Date(inspection.created_at || Date.now()).toLocaleDateString()}\n\n`;
      text += `--- NEGOTIATION SUMMARY ---\n`;
      text += `• Total Defects Evaluated: ${metrics.total}\n`;
      text += `• Licensed Contractor Repairs Demanded: ${metrics.repairCount}\n`;
      text += `• Monetary Closing Credit Requested: $${metrics.totalCreditDollars.toLocaleString()}\n`;
      text += `• Accepted As-Is: ${metrics.acceptCount}\n\n`;
      text += `--- ITEMIZED REQUESTS ---\n`;

      let reqNum = 1;
      findings.forEach((f, idx) => {
        const key = f.id || idx;
        const req = repairRequests[key];
        if (req && req.requested) {
          text += `\n[${reqNum}] ${f.ai_issue} (${f.location_in_property || 'General Area'})\n`;
          text += `    Severity: ${f.ai_severity || 'Medium'}\n`;
          if (req.action === 'repair') {
            text += `    Action: LICENSED CONTRACTOR REPAIR\n`;
            text += `    Terms: ${req.notes || 'Seller to hire licensed & insured specialist to repair with receipts & permits delivered before closing.'}\n`;
          } else if (req.action === 'credit') {
            text += `    Action: FINANCIAL CLOSING CREDIT: $${(parseFloat(req.creditAmount) || 0).toLocaleString()}\n`;
            text += `    Terms: ${req.notes || 'Seller to credit Buyer at closing toward closing costs.'}\n`;
          }
          reqNum++;
        }
      });

      if (reqNum === 1) {
        text += `(No items requested. Buyer accepts property condition as inspected.)\n`;
      }

      text += `\nStandard Contractor Clause: All repairs must be completed by licensed and insured tradespersons with paid receipts and permits submitted 3 days prior to closing.\n`;

      navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      if (onAddToast) onAddToast('Realtor Negotiation Summary copied to clipboard!', 'success');
      setTimeout(() => setCopiedSummary(false), 3000);
    } catch (err) {
      console.error('Clipboard copy error:', err);
    }
  };

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-box crl-builder-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '1060px', width: '96vw', padding: '1.25rem' }}
      >
        {/* Header */}
        <div className="crl-header-row">
          <div className="crl-header-titles">
            <div className="crl-badge-tag">
              <span>🤝 REALTOR REPAIR REQUEST TOOL (CRL)</span>
            </div>
            <h2 className="crl-main-title">
              Client Request List & Contract Negotiation Addendum
            </h2>
            <p className="crl-subtitle">
              Turn inspection findings into legally formatted contractor repair demands or financial closing credits for seller negotiations.
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Property Info Context Strip */}
        <div className="crl-property-strip">
          <div className="strip-item">
            <span className="strip-label">📍 Property</span>
            <span className="strip-val">{inspection.property_address || 'On-Site Property Inspection'}</span>
          </div>
          <div className="strip-item">
            <span className="strip-label">👤 Buyer / Client</span>
            <span className="strip-val">{inspection.client_name || 'Home Buyer'}</span>
          </div>
          <div className="strip-item">
            <span className="strip-label">📅 Inspection Date</span>
            <span className="strip-val">{new Date(inspection.created_at || Date.now()).toLocaleDateString()}</span>
          </div>
          <div className="strip-item">
            <span className="strip-label">🔍 Total Findings</span>
            <span className="strip-val font-bold">{metrics.total} Defect Items</span>
          </div>
        </div>

        {/* Live Metrics Tally Deck */}
        <div className="crl-tally-deck">
          <div className="crl-tally-card highlight-gold">
            <div className="tally-icon">📋</div>
            <div className="tally-body">
              <span className="tally-num">{metrics.total}</span>
              <span className="tally-label">Defects Evaluated</span>
            </div>
          </div>

          <div className={`crl-tally-card ${metrics.repairCount > 0 ? 'highlight-blue' : ''}`}>
            <div className="tally-icon">🔧</div>
            <div className="tally-body">
              <span className="tally-num">{metrics.repairCount}</span>
              <span className="tally-label">Contractor Repairs Demanded</span>
            </div>
          </div>

          <div className={`crl-tally-card ${metrics.totalCreditDollars > 0 ? 'highlight-green' : ''}`}>
            <div className="tally-icon">💵</div>
            <div className="tally-body">
              <span className="tally-num">${metrics.totalCreditDollars.toLocaleString()}</span>
              <span className="tally-label">Total Closing Credits</span>
            </div>
          </div>

          <div className="crl-tally-card">
            <div className="tally-icon">ℹ️</div>
            <div className="tally-body">
              <span className="tally-num">{metrics.acceptCount}</span>
              <span className="tally-label">Accepted As-Is</span>
            </div>
          </div>
        </div>

        {/* Filter Tabs & Bulk Actions */}
        <div className="crl-controls-row">
          <div className="crl-filter-tabs">
            <button
              type="button"
              className={`crl-tab-btn ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All ({findings.length})
            </button>
            <button
              type="button"
              className={`crl-tab-btn ${activeFilter === 'critical' ? 'active' : ''}`}
              onClick={() => setActiveFilter('critical')}
            >
              ⚠️ High/Critical ({metrics.criticalCount})
            </button>
            <button
              type="button"
              className={`crl-tab-btn ${activeFilter === 'repair' ? 'active' : ''}`}
              onClick={() => setActiveFilter('repair')}
            >
              🔧 Repairs ({metrics.repairCount})
            </button>
            <button
              type="button"
              className={`crl-tab-btn ${activeFilter === 'credit' ? 'active' : ''}`}
              onClick={() => setActiveFilter('credit')}
            >
              💵 Credits ({metrics.creditCount})
            </button>
            <button
              type="button"
              className={`crl-tab-btn ${activeFilter === 'accept' ? 'active' : ''}`}
              onClick={() => setActiveFilter('accept')}
            >
              ℹ️ Accept As-Is ({metrics.acceptCount})
            </button>
          </div>

          <div className="crl-bulk-actions">
            <button
              type="button"
              className="crl-quick-btn"
              onClick={handleBulkSetCriticalToRepair}
              title="Demand repair for all urgent/critical items"
            >
              ⚡ Flag Urgent for Repair
            </button>
            <button
              type="button"
              className="crl-quick-btn text-muted"
              onClick={handleBulkAcceptAll}
              title="Reset all items to accept as-is"
            >
              Reset All
            </button>
          </div>
        </div>

        {/* Findings Negotiation Cards List */}
        <div className="crl-findings-scroll-area">
          {filteredFindings.length === 0 ? (
            <div className="crl-empty-state">
              <p>No defect items match the selected filter tab.</p>
            </div>
          ) : (
            filteredFindings.map((f, idx) => {
              const key = f.id || idx;
              const req = repairRequests[key] || {
                requested: false,
                action: 'accept',
                creditAmount: 0,
                notes: ''
              };

              const severityLower = (f.ai_severity || 'medium').toLowerCase();
              const photoThumb = f.annotated_preview || f.annotated_image_url || f.preview || f.image_url;

              return (
                <div
                  key={key}
                  className={`crl-finding-card ${
                    req.action === 'repair'
                      ? 'border-repair'
                      : req.action === 'credit'
                      ? 'border-credit'
                      : 'border-accept'
                  }`}
                >
                  <div className="crl-card-grid">
                    {/* Thumbnail & Defect Info */}
                    <div className="crl-finding-info">
                      <div className="crl-thumb-wrap">
                        {photoThumb ? (
                          <img
                            src={photoThumb}
                            alt={f.ai_issue || 'Defect'}
                            className="crl-thumb-img"
                          />
                        ) : (
                          <div className="crl-thumb-placeholder">📸 Defect</div>
                        )}
                        {f.annotated_image_data || f.annotated_image_url ? (
                          <span className="crl-thumb-badge">Markup Included</span>
                        ) : null}
                      </div>

                      <div className="crl-info-body">
                        <div className="crl-info-header">
                          <span className="crl-finding-num">#{idx + 1}</span>
                          <span className={`badge-pill badge-${severityLower}`}>
                            {f.ai_severity || 'Medium'}
                          </span>
                          {f.location_in_property && (
                            <span className="crl-loc-tag">
                              📍 {f.location_in_property}
                              {f.location_direction ? ` • 🧭 ${f.location_direction}` : ''}
                            </span>
                          )}
                        </div>

                        <h4 className="crl-issue-title">{f.ai_issue || 'Property Defect'}</h4>
                        <p className="crl-ai-summary">
                          {f.ai_recommendation || f.ai_description || 'Inspection finding requiring attention.'}
                        </p>

                        {(f.estimated_cost_low || f.estimated_cost_high || f.estimated_cost) && (
                          <div className="crl-cost-tag">
                            💰 Estimated Cost:{' '}
                            <strong>
                              {f.estimated_cost_low && f.estimated_cost_high
                                ? `$${f.estimated_cost_low} – $${f.estimated_cost_high}`
                                : f.estimated_cost || '$350'}
                            </strong>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Selector & Terms */}
                    <div className="crl-action-column">
                      <label className="crl-col-label">Buyer Negotiation Request:</label>
                      <div className="crl-action-pills">
                        <button
                          type="button"
                          className={`crl-pill-btn pill-repair ${req.action === 'repair' ? 'active' : ''}`}
                          onClick={() => handleActionChange(key, 'repair')}
                        >
                          🔧 Request Contractor Repair
                        </button>
                        <button
                          type="button"
                          className={`crl-pill-btn pill-credit ${req.action === 'credit' ? 'active' : ''}`}
                          onClick={() => handleActionChange(key, 'credit')}
                        >
                          💵 Request Dollar Credit
                        </button>
                        <button
                          type="button"
                          className={`crl-pill-btn pill-accept ${req.action === 'accept' ? 'active' : ''}`}
                          onClick={() => handleActionChange(key, 'accept')}
                        >
                          ℹ️ Accept As-Is
                        </button>
                      </div>

                      {/* If Credit Selected: Dollar Input */}
                      {req.action === 'credit' && (
                        <div className="crl-credit-input-group animate-fade-in">
                          <span className="credit-curr-sym">$</span>
                          <input
                            type="number"
                            min="0"
                            step="50"
                            value={req.creditAmount}
                            onChange={(e) => handleCreditChange(key, e.target.value)}
                            placeholder="Dollar credit amount"
                            className="crl-credit-input"
                          />
                          <span className="credit-note">Closing credit deducted from purchase total</span>
                        </div>
                      )}

                      {/* Negotiation Notes / Custom Instructions */}
                      {req.action !== 'accept' && (
                        <div className="crl-terms-box animate-fade-in">
                          <label className="crl-terms-label">Specific Contractor Instructions / Addendum Terms:</label>
                          <textarea
                            rows={2}
                            value={req.notes}
                            onChange={(e) => handleNotesChange(key, e.target.value)}
                            placeholder={
                              req.action === 'repair'
                                ? 'e.g. Work must be completed by licensed & insured contractor with paid invoice and permits provided.'
                                : 'e.g. Credit to be applied towards buyer closing costs.'
                            }
                            className="crl-terms-textarea"
                          />
                          <div className="crl-quick-chips">
                            <span className="chips-hint">Quick terms:</span>
                            <button
                              type="button"
                              className="chip-btn"
                              onClick={() => appendQuickNote(key, 'Licensed contractor required')}
                            >
                              + Licensed Contractor
                            </button>
                            <button
                              type="button"
                              className="chip-btn"
                              onClick={() => appendQuickNote(key, 'Paid invoice & permits before closing')}
                            >
                              + Paid Invoice & Permits
                            </button>
                            <button
                              type="button"
                              className="chip-btn"
                              onClick={() => appendQuickNote(key, 'Transferrable 1-year warranty')}
                            >
                              + Warranty
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer & Actions */}
        <div className="crl-footer-row">
          <div className="crl-footer-left">
            <span className="crl-footer-summary">
              <strong>{metrics.repairCount + metrics.creditCount}</strong> of <strong>{metrics.total}</strong> items selected for negotiation
              {metrics.totalCreditDollars > 0 && (
                <span className="crl-footer-dollar-badge">
                  • Total Credit: <strong>${metrics.totalCreditDollars.toLocaleString()}</strong>
                </span>
              )}
            </span>
          </div>

          <div className="crl-footer-right">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCopySummary}
              title="Copy formatted summary to clipboard"
            >
              {copiedSummary ? '✅ Copied to Clipboard!' : '📋 Copy Realtor Summary'}
            </button>
            <button
              type="button"
              className="btn-primary-action shadow-glow"
              onClick={handleExportAddendum}
              disabled={isExporting}
            >
              {isExporting ? '⏳ Generating Addendum...' : '📄 Export Legal Addendum PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
