import React, { useState } from 'react';
import { createInspection } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function NewInspectionPage({ onNavigate }) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    propertyAddress: '',
    propertyType: 'residential',
    clientName: ''
  });

  const propertyTypes = [
    { id: 'residential', label: 'Residential Home', icon: '🏡', desc: 'Single-family, duplex, townhouse' },
    { id: 'commercial', label: 'Commercial Building', icon: '🏢', desc: 'Retail, office, warehouse' },
    { id: 'apartment', label: 'Apartment / Flat', icon: '🏬', desc: 'Multi-unit building residence' },
    { id: 'condo', label: 'Condominium Unit', icon: '🏙️', desc: 'Individual condo unit audit' }
  ];

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleQuickFillDemo() {
    setForm({
      title: '742 Evergreen Terrace Comprehensive Audit',
      propertyAddress: '742 Evergreen Terrace, Springfield, OR',
      propertyType: 'residential',
      clientName: 'Homer Simpson'
    });
    addToast('Demo inspection details auto-filled!', 'info');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      addToast('Please enter an inspection title', 'error');
      return;
    }

    setLoading(true);
    try {
      const inspection = await createInspection(form);
      addToast('Inspection created! Ready to upload defect images.', 'success');
      onNavigate('inspection', inspection.id);
    } catch (err) {
      addToast(err.message, 'error');
    }
    setLoading(false);
  }

  return (
    <div className="main-content">
      <div className="breadcrumb-nav">
        <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('dashboard')}>
          ← Back to Dashboard
        </button>
        <span className="breadcrumb-divider">/</span>
        <span className="breadcrumb-current">New Inspection</span>
      </div>

      <div className="new-inspection-wrapper">
        <div className="new-inspection-header">
          <div className="new-inspection-title-row">
            <div>
              <h1 className="hero-title">Initiate New Inspection</h1>
              <p className="hero-subtitle">Define the property parameters to begin logging photographic defect findings.</p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleQuickFillDemo}
            >
              ⚡ Quick Fill Sample Data
            </button>
          </div>
        </div>

        <div className="card-glass animate-slide-down">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">
                Inspection Title <span className="required">*</span>
              </label>
              <input
                type="text"
                name="title"
                className="form-input"
                placeholder="e.g. 742 Evergreen Terrace — Pre-Purchase Structural Audit"
                value={form.title}
                onChange={handleChange}
                required
                id="input-title"
              />
              <div className="form-hint">A descriptive name that identifies this inspection project</div>
            </div>

            <div className="form-group">
              <label className="form-label">Property Address</label>
              <input
                type="text"
                name="propertyAddress"
                className="form-input"
                placeholder="e.g. 742 Evergreen Terrace, Springfield, OR"
                value={form.propertyAddress}
                onChange={handleChange}
                id="input-address"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Property Classification</label>
              <div className="property-types-selector">
                {propertyTypes.map((pt) => (
                  <div
                    key={pt.id}
                    className={`property-type-chip ${form.propertyType === pt.id ? 'active' : ''}`}
                    onClick={() => setForm({ ...form, propertyType: pt.id })}
                  >
                    <span className="chip-icon">{pt.icon}</span>
                    <div className="chip-text">
                      <div className="chip-label">{pt.label}</div>
                      <div className="chip-desc">{pt.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Client / Buyer Name</label>
              <input
                type="text"
                name="clientName"
                className="form-input"
                placeholder="e.g. Homer & Marge Simpson"
                value={form.clientName}
                onChange={handleChange}
                id="input-client"
              />
            </div>

            <div className="form-actions-bar mt-lg">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => onNavigate('dashboard')}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-lg shadow-glow"
                disabled={loading}
                id="btn-create-inspection"
              >
                {loading ? (
                  <><div className="spinner-sm"></div> Creating Portfolio...</>
                ) : (
                  '🚀 Launch Inspection & Add Findings →'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
