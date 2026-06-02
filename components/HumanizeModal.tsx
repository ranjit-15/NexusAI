import React, { useState, useCallback } from 'react';
import { X, Sparkles, Copy, Check, RefreshCw, Loader2, Wand2, ChevronDown, ChevronUp, Sliders } from 'lucide-react';
import { getStoredApiKey } from './ApiKeyModal';

interface HumanizeModalProps {
  text: string;
  onClose: () => void;
}

// ── Style Profiles ──────────────────────────────────────────────────────────
const STYLES = [
  { id: 'casual',       emoji: '💬', label: 'Casual',        desc: 'Like texting a smart friend' },
  { id: 'professional', emoji: '💼', label: 'Professional',   desc: 'Business-ready, authoritative' },
  { id: 'student',      emoji: '🎓', label: 'Student',        desc: 'Academic but genuine' },
  { id: 'storyteller',  emoji: '✍️',  label: 'Storyteller',   desc: 'Vivid narrative voice' },
  { id: 'social',       emoji: '📱', label: 'Social Media',   desc: 'Punchy, engaging, shareable' },
  { id: 'email',        emoji: '📧', label: 'Email',          desc: 'Clear, direct, professional' },
];

// ── Tone Modifiers ──────────────────────────────────────────────────────────
const TONES = [
  { id: 'neutral',     label: 'Neutral' },
  { id: 'confident',  label: 'Confident' },
  { id: 'empathetic', label: 'Empathetic' },
  { id: 'humorous',   label: 'Light Humor' },
  { id: 'urgent',     label: 'Urgent' },
];

// ── Advanced Options ────────────────────────────────────────────────────────
interface AdvOpts {
  avoidAIDetection: boolean;
  keepKeywords: boolean;
  shortenOutput: boolean;
  addPersonalTouch: boolean;
}

// ── Master Humanization Prompt ──────────────────────────────────────────────
function buildSystemPrompt(): string {
  return `You are an expert ghostwriter and writing coach specializing in making AI-generated content sound authentically human. You understand exactly how AI writes vs how humans write, and you are world-class at bridging this gap.

Key differences you eliminate:
- AI overuses hedging phrases: "It's worth noting", "It's important to remember", "Certainly", "Absolutely", "Of course", "I'd be happy to"
- AI writes in perfectly parallel structures — humans don't
- AI never uses contractions naturally — humans always do
- AI explains everything symmetrically — humans are uneven and opinionated
- AI starts with a summary then details — humans just talk
- AI loves bullet points — humans write in flowing thoughts
- AI never says "I think" or "honestly" — humans do constantly
- AI sounds like a brochure — humans sound like people
- AI uses words like "leverage", "utilize", "facilitate", "encompasses", "delve"

You are a master at: natural rhythm, sentence variety, authentic voice, imperfect but confident opinions.`;
}

function buildRewritePrompt(text: string, style: string, tone: string, opts: AdvOpts): string {
  const styleInstructions: Record<string, string> = {
    casual: `Rewrite this as if a knowledgeable person is explaining it to a friend over coffee. Use contractions ("you're", "it's", "don't"), drop unnecessary formality, mix short punchy sentences with longer flowing ones. It should feel like a smart conversation, not a Wikipedia article.`,
    professional: `Rewrite this as a confident human professional would write it — direct, clear, and authoritative without being stiff. No filler phrases. Get to the point fast. Sound like someone who has done this for years and doesn't need to prove it. Use active voice throughout.`,
    student: `Rewrite this how a genuinely smart college student would write it — engaged, a bit informal but still intelligent. They care about getting it right but they write like a person, not a textbook. Occasionally show a personal perspective. Use real sentences, not just lists.`,
    storyteller: `Rewrite this with a genuine narrative voice. Vary sentence length dramatically — some should be one word. Add texture and rhythm. Use concrete details and occasional imagery. Make the reader feel something, not just understand something. Sounds like a human who loves language.`,
    social: `Rewrite this for social media. Make it punchy, relatable, and shareable. Lead with a hook. Use short punchy sentences. Add personality. People should want to read the next sentence. No corporate speak, no bullet lists — just pure human energy.`,
    email: `Rewrite this as a clear, direct professional email from one human to another. Get to the point in the first sentence. Use "I" and "you" naturally. Be warm but efficient. Don't waste the reader's time. End with a clear action or takeaway.`,
  };

  const toneGuides: Record<string, string> = {
    neutral:    `Tone: Measured and clear. Not cold, not warm — just authentic and grounded.`,
    confident:  `Tone: Bold and certain. The writer clearly knows their stuff and isn't hedging. Strong statements.`,
    empathetic: `Tone: Warm and understanding. The writer gets it — acknowledges the human element.`,
    humorous:   `Tone: A little wit and lightness. Not trying to be a comedian, but not taking itself too seriously either.`,
    urgent:     `Tone: Direct and action-oriented. There's a reason this matters now. Energetic.`,
  };

  const extras: string[] = [];
  if (opts.avoidAIDetection) extras.push('- Use irregular sentence lengths and structures to pass AI detection tools');
  if (opts.keepKeywords) extras.push('- Preserve any key technical terms or important jargon from the original');
  if (opts.shortenOutput) extras.push('- Make the output 30% shorter than the original — cut fluff, keep substance');
  if (opts.addPersonalTouch) extras.push('- Add one subtle personal perspective or first-person opinion where it fits naturally');

  return `${styleInstructions[style] || styleInstructions.casual}

${toneGuides[tone] || toneGuides.neutral}

${extras.length ? `Additional requirements:\n${extras.join('\n')}` : ''}

STRICT RULES — never break these:
1. Output ONLY the rewritten text. Zero preamble, zero explanation.
2. NEVER start with: "Sure", "Certainly", "Absolutely", "Of course", "Here is", "Here's", "I've rewritten", "Below is"
3. NEVER use these AI-words: utilize, leverage, delve, encompass, facilitate, paramount, multifaceted, nuanced (unless quoting)
4. NEVER write in perfectly parallel bullet structures — break the pattern
5. Use contractions wherever natural ("it's", "you're", "don't", "we've")
6. Vary sentence length — some very short. Some much longer and flowing.

Text to humanize:
"""
${text}
"""`;
}

const HumanizeModal: React.FC<HumanizeModalProps> = ({ text, onClose }) => {
  const [style, setStyle] = useState('student');
  const [tone, setTone] = useState('neutral');
  const [inputText, setInputText] = useState(text || '');
  const [opts, setOpts] = useState<AdvOpts>({
    avoidAIDetection: true,
    keepKeywords: true,
    shortenOutput: false,
    addPersonalTouch: false,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [wordCountAfter, setWordCountAfter] = useState(0);

  const wordCountInput = inputText.trim().split(/\s+/).filter(Boolean).length;

  const humanize = useCallback(async () => {
    const textToProcess = inputText.trim();
    if (!textToProcess) { setError('Please paste or type some text to humanize.'); return; }
    setIsLoading(true);
    setError('');
    setResult('');
    try {
      const userApiKey = getStoredApiKey();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: buildRewritePrompt(textToProcess, style, tone, opts),
          history: [],
          model: 'gemma-4-31b-it',
          apiKey: userApiKey,
          persona: { systemInstruction: buildSystemPrompt() },
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any).error || 'Humanization failed');
      }

      // /api/chat returns a Server-Sent Events stream — read it properly
      if (!res.body) throw new Error('No response body received');
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        for (let part of parts) {
          part = part.trim();
          if (!part || !part.startsWith('data:')) continue;
          let dataStr = part.replace(/^data:\s*/, '').trim();
          if (dataStr === '[DONE]') break;
          while (dataStr.startsWith('data:')) dataStr = dataStr.replace(/^data:\s*/, '').trim();
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) {
              full += parsed.text;
              setResult(full);
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue;
            throw parseErr;
          }
        }
      }
      reader.releaseLock();

      if (!full) throw new Error('No output received. Please try again.');
      setWordCountAfter(full.trim().split(/\s+/).filter(Boolean).length);
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Try again.');
    } finally {
      setIsLoading(false);
    }
  }, [inputText, style, tone, opts]);

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleOpt = (key: keyof AdvOpts) =>
    setOpts(prev => ({ ...prev, [key]: !prev[key] }));

  const wordDelta = result ? wordCountAfter - wordCountInput : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl shadow-2xl animate-fade-in flex flex-col"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', maxHeight: '92vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(109,40,217,0.3))' }}
            >
              <Wand2 size={18} style={{ color: '#a78bfa' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>AI Humanizer</h2>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Make AI text sound naturally human</p>
            </div>
          </div>
          <button onClick={onClose} className="icon-btn"><X size={16} /></button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* Style picker */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Writing Style</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {STYLES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className="flex flex-col items-center p-2 rounded-xl text-center transition-all"
                  style={{
                    background: style === s.id
                      ? 'linear-gradient(135deg, rgba(139,92,246,0.18), rgba(109,40,217,0.25))'
                      : 'var(--bg-tertiary)',
                    border: `1px solid ${style === s.id ? '#8b5cf6' : 'var(--border)'}`,
                    transform: style === s.id ? 'scale(1.04)' : 'scale(1)',
                  }}
                >
                  <span className="text-lg mb-0.5">{s.emoji}</span>
                  <span className="text-[11px] font-semibold" style={{ color: style === s.id ? '#a78bfa' : 'var(--text-primary)' }}>{s.label}</span>
                  <span className="text-[9px] mt-0.5 leading-tight" style={{ color: 'var(--text-muted)' }}>{s.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tone picker */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Tone</p>
            <div className="flex flex-wrap gap-2">
              {TONES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTone(t.id)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={{
                    background: tone === t.id ? '#8b5cf6' : 'var(--bg-tertiary)',
                    color: tone === t.id ? '#fff' : 'var(--text-secondary)',
                    border: `1px solid ${tone === t.id ? '#8b5cf6' : 'var(--border)'}`,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Advanced Options toggle */}
          <div>
            <button
              onClick={() => setShowAdvanced(v => !v)}
              className="flex items-center gap-1.5 text-xs font-medium transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <Sliders size={12} />
              Advanced Options
              {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {showAdvanced && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(Object.keys(opts) as (keyof AdvOpts)[]).map(key => {
                  const labels: Record<keyof AdvOpts, string> = {
                    avoidAIDetection: '🛡️ Bypass AI Detection',
                    keepKeywords: '🔑 Keep Key Terms',
                    shortenOutput: '✂️ Shorten by 30%',
                    addPersonalTouch: '💡 Add Personal Opinion',
                  };
                  return (
                    <button
                      key={key}
                      onClick={() => toggleOpt(key)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-left transition-all"
                      style={{
                        background: opts[key] ? 'rgba(139,92,246,0.12)' : 'var(--bg-tertiary)',
                        border: `1px solid ${opts[key] ? 'rgba(139,92,246,0.4)' : 'var(--border)'}`,
                        color: opts[key] ? '#a78bfa' : 'var(--text-secondary)',
                      }}
                    >
                      <div
                        className="w-3.5 h-3.5 rounded-sm flex-shrink-0 flex items-center justify-center"
                        style={{ background: opts[key] ? '#8b5cf6' : 'var(--border)' }}
                      >
                        {opts[key] && <Check size={9} color="#fff" />}
                      </div>
                      {labels[key]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Input textarea — editable, pre-filled from message */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Text to Humanize</p>
              <span
                className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'var(--bg-tertiary)', color: wordCountInput > 0 ? 'var(--text-secondary)' : 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                {wordCountInput} words
              </span>
            </div>
            <textarea
              value={inputText}
              onChange={e => { setInputText(e.target.value); setResult(''); setError(''); }}
              placeholder="Paste your AI-generated text here…"
              rows={4}
              className="w-full rounded-xl px-3 py-2.5 text-sm leading-relaxed resize-none"
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                outline: 'none',
                fontFamily: 'Inter, sans-serif',
              }}
            />
          </div>

          {/* Humanize CTA */}
          <button
            onClick={humanize}
            disabled={isLoading}
            className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
            style={{
              background: isLoading
                ? 'var(--bg-hover)'
                : 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
              color: isLoading ? 'var(--text-muted)' : '#fff',
              boxShadow: isLoading ? 'none' : '0 4px 20px rgba(139,92,246,0.35)',
            }}
          >
            {isLoading ? (
              <><Loader2 size={16} className="animate-spin" /> Humanizing your text…</>
            ) : (
              <><Sparkles size={16} /> Humanize Now</>
            )}
          </button>

          {/* Error */}
          {error && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              ⚠️ {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                    Humanized · {wordCountAfter} words
                  </p>
                  {wordDelta !== 0 && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{
                        background: wordDelta < 0 ? 'rgba(16,163,127,0.1)' : 'rgba(245,158,11,0.1)',
                        color: wordDelta < 0 ? '#10a37f' : '#f59e0b',
                      }}
                    >
                      {wordDelta > 0 ? '+' : ''}{wordDelta} words
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={humanize}
                    disabled={isLoading}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  >
                    <RefreshCw size={11} /> Regenerate
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
                    style={{
                      background: copied ? 'rgba(16,163,127,0.15)' : 'var(--bg-tertiary)',
                      color: copied ? '#10a37f' : 'var(--text-secondary)',
                      border: `1px solid ${copied ? 'rgba(16,163,127,0.4)' : 'var(--border)'}`,
                    }}
                  >
                    {copied ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy</>}
                  </button>
                </div>
              </div>
              <div
                className="rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap"
                style={{
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.04), rgba(109,40,217,0.07))',
                  border: '1px solid rgba(139,92,246,0.2)',
                  color: 'var(--text-primary)',
                }}
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
