import React, { useState, useCallback } from 'react';
import { X, Sparkles, Copy, Check, RefreshCw, Loader2, Wand2 } from 'lucide-react';
import { getStoredApiKey } from './ApiKeyModal';

interface HumanizeModalProps {
  text: string;
  onClose: () => void;
}

const HUMANIZE_STYLES = [
  { id: 'casual', label: 'Casual', desc: 'Friendly everyday tone' },
  { id: 'professional', label: 'Professional', desc: 'Clear business writing' },
  { id: 'student', label: 'Student', desc: 'Academic but natural' },
  { id: 'storyteller', label: 'Storyteller', desc: 'Vivid, narrative prose' },
];

const buildPrompt = (text: string, style: string): string => {
  const styleGuides: Record<string, string> = {
    casual: `Rewrite the following AI-generated text to sound like a real human wrote it in a casual, friendly tone. Use natural contractions, informal phrasing, slight imperfections, and conversational flow. Avoid robotic bullet points and overly formal structure.`,
    professional: `Rewrite the following AI-generated text to sound like it was written by a real human professional. Use clear, direct language without sounding mechanical. Replace AI-sounding phrases like "Certainly!", "Absolutely!", or "I'd be happy to" with direct statements. Keep it confident and human.`,
    student: `Rewrite the following AI-generated text to sound like a college student or young professional wrote it. Use natural academic language, slight personal touches, and avoid the overly polished structure of AI output. Make it feel genuine.`,
    storyteller: `Rewrite the following AI-generated text to sound like it was written by a human with a narrative, engaging voice. Add texture, vary sentence lengths, use imagery where appropriate, and make it feel alive rather than mechanical.`,
  };

  return `${styleGuides[style] || styleGuides.casual}

IMPORTANT RULES:
- Do NOT start with "Certainly!", "Of course!", "Sure!", "Absolutely!", or "I'd be happy to"
- Do NOT use excessive bullet points — prefer flowing paragraphs
- Do NOT repeat the same phrase twice in the response
- Vary sentence structure and length naturally
- Output ONLY the rewritten text, no commentary, no explanation

Original text to rewrite:
"""
${text}
"""`;
};

const HumanizeModal: React.FC<HumanizeModalProps> = ({ text, onClose }) => {
  const [selectedStyle, setSelectedStyle] = useState('casual');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const humanize = useCallback(async (style = selectedStyle) => {
    setIsLoading(true);
    setError('');
    setResult('');
    try {
      const userApiKey = getStoredApiKey();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: buildPrompt(text, style),
          history: [],
          model: 'gemma-4-31b-it',
          apiKey: userApiKey,
          persona: { systemInstruction: 'You are an expert human writing coach. Rewrite AI text to sound genuinely human. Output only the rewritten text with no preamble.' },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to humanize');
      setResult(data.text || '');
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }, [text, selectedStyle]);

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStyleChange = (id: string) => {
    setSelectedStyle(id);
    setResult('');
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
      <div
        className="relative w-full max-w-2xl rounded-2xl shadow-2xl animate-fade-in flex flex-col"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8b5cf622, #8b5cf644)' }}>
              <Wand2 size={18} style={{ color: '#8b5cf6' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Humanize Text</h2>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Convert AI-sounding text into natural human writing</p>
            </div>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Close"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {/* Style picker */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Writing Style</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {HUMANIZE_STYLES.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleStyleChange(s.id)}
                  className="p-2.5 rounded-xl text-left transition-all"
                  style={{
                    background: selectedStyle === s.id ? 'linear-gradient(135deg, #8b5cf622, #8b5cf633)' : 'var(--bg-tertiary)',
                    border: `1px solid ${selectedStyle === s.id ? '#8b5cf6' : 'var(--border)'}`,
                  }}
                >
                  <div className="text-xs font-semibold" style={{ color: selectedStyle === s.id ? '#8b5cf6' : 'var(--text-primary)' }}>{s.label}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Original text preview */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Original (AI) Text</p>
            <div
              className="rounded-xl p-3 text-sm leading-relaxed max-h-32 overflow-y-auto"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            >
              {text.length > 300 ? text.slice(0, 300) + '…' : text}
            </div>
          </div>

          {/* Humanize button */}
          <button
            onClick={() => humanize(selectedStyle)}
            disabled={isLoading}
            className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
            style={{
              background: isLoading ? 'var(--bg-hover)' : 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
              color: isLoading ? 'var(--text-muted)' : '#fff',
            }}
          >
            {isLoading ? (
              <><Loader2 size={15} className="animate-spin" /> Humanizing…</>
            ) : (
              <><Sparkles size={15} /> Humanize Text</>
            )}
          </button>

          {/* Error */}
          {error && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Humanized Result</p>
                <div className="flex gap-1">
                  <button
                    onClick={() => humanize(selectedStyle)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  >
                    <RefreshCw size={11} /> Regenerate
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
                    style={{ background: copied ? 'rgba(16,163,127,0.15)' : 'var(--bg-tertiary)', color: copied ? '#10a37f' : 'var(--text-secondary)', border: `1px solid ${copied ? 'rgba(16,163,127,0.3)' : 'var(--border)'}` }}
                  >
                    {copied ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy</>}
                  </button>
                </div>
              </div>
              <div
                className="rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid #8b5cf633', color: 'var(--text-primary)' }}
              >
                {result}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HumanizeModal;
