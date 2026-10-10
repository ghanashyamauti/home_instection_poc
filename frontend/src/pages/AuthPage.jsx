import React, { useState } from 'react';
import { login, register } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const { addToast } = useToast();

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    company: ''
  });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      let result;
      if (isLogin) {
        result = await login(form.email, form.password);
      } else {
        result = await register(form.fullName, form.email, form.password, form.company);
      }
      loginUser(result.token, result.user);
      addToast(`Welcome back, ${result.user.fullName || 'Inspector'}!`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }

    setLoading(false);
  }

  // Instant demo account login for reviewers / test users
  async function handleDemoLogin() {
    setLoading(true);
    const demoEmail = 'inspector.demo@inspectai.io';
    const demoPassword = 'DemoPassword123!';

    try {
      // Try login first
      const result = await login(demoEmail, demoPassword);
      loginUser(result.token, result.user);
      addToast(`Signed in as Demo Inspector!`, 'success');
    } catch {
      // If demo account doesn't exist yet, auto-register it
      try {
        const regResult = await register('Sarah Chen, CMI', demoEmail, demoPassword, 'Apex Structural Inspection Labs');
        loginUser(regResult.token, regResult.user);
        addToast(`Demo account created and logged in!`, 'success');
      } catch (err) {
        addToast(err.message, 'error');
      }
    }
    setLoading(false);
  }

  return (
    <div className="auth-modern-page">
      <div className="auth-split-layout">
        {/* Left Side: Brand & Feature Showcase */}
        <div className="auth-showcase-panel">
          <div className="showcase-brand">
            <div className="brand-logo-mark-lg">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <h2>Inspect<span className="brand-gradient-text">AI</span></h2>
          </div>

          <div className="showcase-hero">
            <h3>Enterprise Property Intelligence & Visual Defect Triage</h3>
            <p>
              Harness multimodal vision AI to analyze property images, detect structural anomalies, calculate severity risk, and generate accredited engineering inspection reports in seconds.
            </p>
          </div>

          <div className="showcase-features-list">
            <div className="feature-item">
              <span className="feature-icon">🔍</span>
              <div>
                <strong>Multimodal Defect Diagnosis</strong>
                <p>Combines high-res pixels with inspector field commentary to eliminate diagnostic false positives.</p>
              </div>
            </div>

            <div className="feature-item">
              <span className="feature-icon">🛡️</span>
              <div>
                <strong>Zero Downtime Multi-Model Chain</strong>
                <p>Auto-switches upstream vision models with built-in heuristic fallback redundancy.</p>
              </div>
            </div>

            <div className="feature-item">
              <span className="feature-icon">📄</span>
              <div>
                <strong>Automated PDF Deliverables</strong>
                <p>Generates client-ready property inspection summaries with embedded photographic evidence.</p>
              </div>
            </div>
          </div>

          <div className="showcase-footer">
            <span>Powered by Neon Serverless PostgreSQL & OpenRouter Vision Architecture</span>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="auth-form-panel">
          <div className="auth-card-modern animate-fade-in">
            <div className="auth-card-header">
              <h3>{isLogin ? 'Sign In to InspectAI' : 'Create Inspector Account'}</h3>
              <p className="auth-card-subtitle">
                {isLogin
                  ? 'Access your property portfolios and active audits'
                  : 'Start analyzing property defects with AI assistance'}
              </p>
            </div>

            {/* Quick Demo Access Button */}
            <button
              type="button"
              className="btn btn-demo-quick btn-full mb-lg"
              onClick={handleDemoLogin}
              disabled={loading}
            >
              ⚡ 1-Click Quick Demo Sign In
            </button>

            <div className="auth-divider">
              <span>or continue with email</span>
            </div>

            <form onSubmit={handleSubmit} className="auth-form-fields">
              {!isLogin && (
                <>
                  <div className="form-group">
                    <label className="form-label">
                      Full Name <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      className="form-input"
                      placeholder="e.g. John Doe, CMI"
                      value={form.fullName}
                      onChange={handleChange}
                      required={!isLogin}
                      id="input-fullname"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Inspection Company / Agency</label>
                    <input
                      type="text"
                      name="company"
                      className="form-input"
                      placeholder="e.g. Apex Property Audits"
                      value={form.company}
                      onChange={handleChange}
                      id="input-company"
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">
                  Work Email <span className="required">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  className="form-input"
                  placeholder="inspector@company.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                  id="input-email"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Password <span className="required">*</span>
                </label>
                <input
                  type="password"
                  name="password"
                  className="form-input"
                  placeholder="Minimum 8 characters"
                  value={form.password}
                  onChange={handleChange}
                  required
                  minLength={8}
                  id="input-password"
                />
                {!isLogin && (
                  <div className="form-hint">Must contain at least 8 characters</div>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg btn-full shadow-glow mt-md"
                disabled={loading}
                id="btn-auth-submit"
              >
                {loading ? (
                  <><div className="spinner-sm"></div> Authenticating...</>
                ) : (
                  isLogin ? 'Sign In →' : 'Create Account →'
                )}
              </button>
            </form>

            <div className="auth-switch-bar">
              <span>{isLogin ? "Don't have an inspector account?" : 'Already registered?'}</span>
              <button
                type="button"
                className="btn-switch-mode"
                onClick={() => setIsLogin(!isLogin)}
                id="btn-auth-switch"
              >
                {isLogin ? 'Create Account' : 'Sign In'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
