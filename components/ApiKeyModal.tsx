import React, { useState, useEffect } from 'react';
import { X, Key, ExternalLink, Eye, EyeOff, Check, AlertCircle, Trash2 } from 'lucide-react';

interface ApiKeyModalProps {
  onClose: () => void;
}

const STORAGE_KEY = 'nexus_user_api_key';

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
      setApiKey(existing);
      setHasExisting(true);
    }
  }, []);

  const handleSave = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    localStorage.setItem(STORAGE_KEY, trimmed);
    setHasExisting(true);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleRemove = () => {
    localStorage.removeItem(STORAGE_KEY);
    setApiKey('');
    setHasExisting(false);
  };

  const maskedKey = apiKey.length > 8 ? apiKey.slice(0, 4) + '••••••••' + apiKey.slice(-4) : apiKey;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
      <div
        className="relative w-full max-w-lg rounded-2xl shadow-2xl animate-fade-in"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #10a37f22, #10a37f44)' }}>
              <Key size={16} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>API Key Settings</h2>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Use your own Gemini API key for unlimited access</p>
            </div>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Close"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Status badge */}
          {hasExisting && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(16,163,127,0.1)', border: '1px solid rgba(16,163,127,0.2)' }}>
              <Check size={13} style={{ color: '#10a37f' }} />
              <span className="text-xs font-medium" style={{ color: '#10a37f' }}>Custom API key active — using your quota</span>
            </div>
          )}

          {/* Guide Section */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>How to get your free API key</p>
            <ol className="space-y-2.5">
              {[
                { step: '1', text: 'Go to Google AI Studio (free, no credit card needed)' },
                { step: '2', text: 'Sign in with your Google account' },
                { step: '3', text: 'Click "Get API key" → "Create API key in new project"' },
                { step: '4', text: 'Copy the generated key and paste it below' },
              ].map(({ step, text }) => (
                <li key={step} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: 'var(--accent)', color: '#fff' }}>{step}</span>
                  <span className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{text}</span>
                </li>
              ))}
            </ol>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 w-full justify-center py-2.5 rounded-lg text-xs font-semibold transition-all mt-1"
              style={{ background: 'linear-gradient(135deg, #10a37f, #0d8063)', color: '#fff' }}
            >
              <ExternalLink size={13} />
              Open Google AI Studio
            </a>
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <AlertCircle size={13} className="flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Your key is stored <strong>only in your browser</strong> — it is never sent to our servers except directly to Google's API.
            </p>
          </div>

          {/* Input */}
          <div className="space-y-2">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Your Gemini API Key</label>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
              <Key size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="AIza..."
                className="flex-1 bg-transparent text-sm outline-none font-mono"
                style={{ color: 'var(--text-primary)' }}
              />
              <button onClick={() => setShowKey(v => !v)} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}>
                {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            {hasExisting && !showKey && (
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Saved: {maskedKey}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {hasExisting && (
              <button
                onClick={handleRemove}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <Trash2 size={12} /> Remove Key
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!apiKey.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: apiKey.trim() ? 'linear-gradient(135deg, #10a37f, #0d8063)' : 'var(--bg-hover)',
                color: apiKey.trim() ? '#fff' : 'var(--text-muted)',
                cursor: apiKey.trim() ? 'pointer' : 'not-allowed'
              }}
            >
              {saved ? <><Check size={14} /> Saved!</> : <><Key size={14} /> Save API Key</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const getStoredApiKey = (): string | undefined => {
  return localStorage.getItem(STORAGE_KEY) || undefined;
};

export default ApiKeyModal;
