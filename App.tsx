import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Menu, BrainCircuit, ChevronDown, Check, Mic, StopCircle, Zap, Code, Image as ImageIcon, Key, Download, Search, Paperclip, X, PenTool } from 'lucide-react';
import { geminiService } from './services/geminiService';
import { Message, Role, Persona, ModelOption, ChatSession } from './types';
import { PERSONAS } from './constants/personas';
import ChatMessage from './components/ChatMessage';
import TypingIndicator from './components/TypingIndicator';
import Sidebar from './components/Sidebar';
import ApiKeyModal, { getStoredApiKey } from './components/ApiKeyModal';
import ExportModal from './components/ExportModal';
import HumanizeModal from './components/HumanizeModal';
import { saveSession, loadSessionsFromFirestore, deleteSessionFromFirestore } from './src/firestoreService';

const genId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// Resize image to max 800px and return as base64 data URL (keeps images under Vercel's 4.5MB limit)
const resizeImage = (file: File, maxPx = 800): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = ev => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = ev.target!.result as string;
    };
    reader.readAsDataURL(file);
  });

const getChatTitle = (msgs: Message[]): string => {
  const first = msgs.find(m => m.role === Role.USER && m.text?.trim());
  if (!first) return 'New Chat';
  const t = first.text.replace(/\s+/g, ' ').trim();
  return t.length > 50 ? t.slice(0, 50) + '…' : t;
};

interface IWindow extends Window { webkitSpeechRecognition: any; SpeechRecognition: any; }

const WELCOME_SUGGESTIONS = [
  { icon: Code, text: 'Write a Python script', desc: 'to scrape website data' },
  { icon: ImageIcon, text: 'Generate an image', desc: 'of a futuristic city' },
  { icon: PenTool, text: 'Write a story', desc: 'about a time traveler' },
  { icon: Zap, text: 'Help me debug', desc: 'my React application' },
];

const App: React.FC = () => {
  const deviceId = (() => { try { return localStorage.getItem('nexus_device_id') || undefined; } catch { return undefined; } })();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'synced' | 'error'>('syncing');
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHumanizeModal, setShowHumanizeModal] = useState(false);
  const [humanizeTargetText, setHumanizeTargetText] = useState('');
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<Persona>(PERSONAS[0]);
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('gemma-4-31b-it');
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isPersonaMenuOpen, setIsPersonaMenuOpen] = useState(false);
  // Sidebar: open by default on desktop, closed on mobile
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => window.innerWidth >= 768);
  // New feature states
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [exportSession, setExportSession] = useState<ChatSession | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const textBeforeListening = useRef('');
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const personaMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Register PWA service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // ── Theme initialization ────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.add('light-theme'); // default to light or dark based on your preference
  }, []);

  // ── Firestore sync: load sessions on mount ──────────────────────────────
  useEffect(() => {
    let mounted = true;
    setSyncStatus('syncing');
    loadSessionsFromFirestore()
      .then(firestoreSessions => {
        if (!mounted) return;
        setSessions(firestoreSessions);
        setSyncStatus('synced');
      })
      .catch(() => {
        if (mounted) setSyncStatus('error');
      });
    return () => { mounted = false; };
  }, [deviceId]);

  // Sync messages back to session and persist to Firestore
  useEffect(() => {
    if (activeId && messages.length > 0) {
      setSessions(prev => {
        const updated = prev.map(s =>
          s.id === activeId
            ? { ...s, title: getChatTitle(messages), updatedAt: Date.now(), messages, model: selectedModel }
            : s
        );
        // Persist to Firestore in background
        const updatedSession = updated.find(s => s.id === activeId);
        if (updatedSession) {
          saveSession(updatedSession).catch(console.error);
        }
        return updated;
      });
    }
  }, [messages, activeId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input on mount and when chat changes
  useEffect(() => { inputRef.current?.focus(); }, [activeId]);

  // Close menus on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node))
        setIsModelMenuOpen(false);
      if (personaMenuRef.current && !personaMenuRef.current.contains(e.target as Node))
        setIsPersonaMenuOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Load available models
  useEffect(() => {
    let mounted = true;
    geminiService.fetchAvailableModels().then(models => {
      if (!mounted) return;
      setAvailableModels(models);
      if (models.length && !models.some(m => m.id === selectedModel)) {
        const hasGemma = models.some(m => m.id === 'gemma-4-31b-it');
        setSelectedModel(hasGemma ? 'gemma-4-31b-it' : models[0].id);
      }
    });
    return () => { mounted = false; };
  }, []);

  // Thinking mode guard
  const supportsThinking = selectedModel.startsWith('gemini') || selectedModel.startsWith('gemma');
  useEffect(() => { if (!supportsThinking && isThinking) setIsThinking(false); }, [supportsThinking]);

  const startNewChat = useCallback(() => {
    setActiveId(null);
    setMessages([]);
    // On mobile, close sidebar after selecting new chat
    if (window.innerWidth < 768) setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const selectSession = useCallback((session: ChatSession) => {
    setActiveId(session.id);
    setMessages(session.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })));
    setSelectedModel(session.model || 'gemma-4-31b-it');
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeId === id) { setActiveId(null); setMessages([]); }
    // Remove from Firestore in background
    deleteSessionFromFirestore(id).catch(console.error);
  }, [activeId]);

  const deleteAllChats = useCallback(() => {
    sessions.forEach(s => deleteSessionFromFirestore(s.id).catch(console.error));
    setSessions([]);
    setActiveId(null);
    setMessages([]);
  }, [sessions]);

  const createSessionFromMessages = (msgs: Message[]): string => {
    const id = genId();
    const session: ChatSession = {
      id,
      title: getChatTitle(msgs),
      updatedAt: Date.now(),
      messages: msgs,
      model: selectedModel,
    };
    setSessions(prev => [session, ...prev].slice(0, 50));
    setActiveId(id);
    // Persist to Firestore immediately
    saveSession(session).catch(console.error);
    return id;
  };

  const toggleListening = () => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const w = window as unknown as IWindow;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { alert('Voice not supported in this browser. Try Chrome.'); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    textBeforeListening.current = inputValue;
    rec.onstart = () => setIsListening(true);
    rec.onresult = (e: any) => {
      let t = '';
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setInputValue((textBeforeListening.current ? textBeforeListening.current + ' ' : '') + t);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
    rec.start();
  };

  const stopGeneration = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsLoading(false);
    }
  };

  const handleRetry = async (errorMsgId: string) => {
    const idx = messages.findIndex(m => m.id === errorMsgId);
    if (idx === -1) return;
    const userMsg = messages[idx - 1];
    if (!userMsg || userMsg.role !== Role.USER) return;

    const botId = genId();
    const newMsgs = [
      ...messages.filter(m => m.id !== errorMsgId),
      { id: botId, role: Role.MODEL, text: '', timestamp: new Date(), model: selectedModel },
    ];
    setMessages(newMsgs);
    setIsLoading(true);

    try {
      const stream = geminiService.sendMessageStream(
        userMsg.text, isThinking, messages.slice(0, idx - 1), selectedModel, selectedPersona.systemInstruction
      );
      let full = '';
      for await (const chunk of stream) {
        full += chunk;
        setMessages(prev => prev.map(m => m.id === botId ? { ...m, text: full } : m));
      }
    } catch (err: any) {
      setMessages(prev => prev.map(m => m.id === botId ? { ...m, text: err.message || 'Error', isError: true } : m));
    } finally { setIsLoading(false); }
  };

  const handleSubmit = async (textOrEvent?: string | React.MouseEvent) => {
    if (isListening) toggleListening();
    const userText = (typeof textOrEvent === 'string' ? textOrEvent : inputValue).trim();
    // Allow submission if there's text OR an image attached
    if ((!userText && !imageFile) || isLoading) return;
    
    const finalText = userText || (imageFile ? `[Image: ${imageFile.name}]` : '');
    const attachedImagePreview = imagePreview;
    
    setInputValue('');
    setImageFile(null);
    setImagePreview(null);

    const userMsg: Message = { 
      id: genId(), 
      role: Role.USER, 
      text: finalText, 
      timestamp: new Date(),
      imageUrl: attachedImagePreview || undefined,
    };
    const botId = genId();
    const botMsg: Message = { id: botId, role: Role.MODEL, text: '', timestamp: new Date(), model: selectedModel };

    const currentHistory = [...messages];
    const newMessages = [...messages, userMsg, botMsg];
    setMessages(newMessages);

    if (!activeId) {
      const newSessionId = createSessionFromMessages([...currentHistory, userMsg, botMsg]);
      fetch('/api/title', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: finalText }) })
        .then(r => r.json())
        .then(d => {
          if (d.title) setSessions(prev => prev.map(s => s.id === newSessionId ? { ...s, title: d.title } : s));
        }).catch(() => {});
    }

    setIsLoading(true);
    const controller = new AbortController();
    setAbortController(controller);

    // Pass user's custom API key if available
    const userApiKey = getStoredApiKey();

    try {
      const stream = geminiService.sendMessageStream(
        finalText, isThinking, currentHistory, selectedModel, selectedPersona.systemInstruction, controller.signal, userApiKey, attachedImagePreview
      );
      let full = '';
      for await (const chunk of stream) {
        full += chunk;
        setMessages(prev => prev.map(m => m.id === botId ? { ...m, text: full } : m));
      }
      // Ensure non-empty response if stream ended with no content
      if (!full) {
        setMessages(prev => prev.map(m => m.id === botId ? { ...m, text: 'No response received. Please try again.', isError: true } : m));
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Remove the empty bot message on abort
        setMessages(prev => prev.filter(m => m.id !== botId));
        return;
      }
      setMessages(prev => prev.map(m => m.id === botId ? { ...m, text: getReadableError(err.message || ''), isError: true } : m));
    } finally { 
      setIsLoading(false); 
      setAbortController(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  const selectedModelOption = availableModels.find(m => m.id === selectedModel);
  const isWelcome = messages.length === 0;
  const activeSession = sessions.find(s => s.id === activeId) || null;

  // Filtered sessions for search
  const filteredSessions = searchQuery.trim()
    ? sessions.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.messages.some(m => m.text?.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : sessions;

  // Handle errors nicely including 429 quota errors
  const getReadableError = (errMsg: string): string => {
    if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')) {
      return 'API quota exceeded. Please wait a minute and try again, or add your own API key via the 🔑 key button.';
    }
    if (errMsg.includes('API key') || errMsg.includes('API_KEY_INVALID')) {
      return 'Invalid API key. Please check your key in the 🔑 settings.';
    }
    return errMsg || 'An error occurred. Please try again.';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so same file can be re-selected
    e.target.value = '';
    setImageFile(file);
    try {
      // Resize to max 800px — keeps payload under Vercel's 4.5MB body limit
      const resized = await resizeImage(file);
      setImagePreview(resized);
      // Auto-switch to a vision-capable model when image is attached
      if (!selectedModel.includes('gemini-2') && !selectedModel.includes('gemma-4')) {
        setSelectedModel('gemini-2.0-flash');
      }
    } catch {
      const reader = new FileReader();
      reader.onload = ev => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="app-shell">
      {showApiKeyModal && <ApiKeyModal onClose={() => setShowApiKeyModal(false)} />}
      {exportSession && <ExportModal session={exportSession} onClose={() => setExportSession(null)} />}
      {showHumanizeModal && (
        <HumanizeModal
          text={humanizeTargetText}
          onClose={() => { setShowHumanizeModal(false); setHumanizeTargetText(''); }}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <Sidebar
        sessions={filteredSessions}
        activeId={activeId}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={startNewChat}
        onSelectSession={selectSession}
        onDeleteSession={deleteSession}
        onDeleteAll={deleteAllChats}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showSearch={showSearch}
        onToggleSearch={() => setShowSearch(v => !v)}
        onExport={session => setExportSession(session)}
      />

      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay md:hidden ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ── Main Chat Area ───────────────────────────────────── */}
      <div className="chat-area">

        {/* Header */}
        <header className="app-header">
          <div className="flex items-center gap-2">
            {/* Hamburger — toggles sidebar on both mobile & desktop */}
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="icon-btn"
              aria-label="Toggle sidebar"
            >
              <Menu size={18} />
            </button>

            {/* Removed New Chat shortcut and Sync Status icons per user request */}

            {/* Model Selector */}
            <div className="relative" ref={modelMenuRef}>
              <button
                onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                className="model-badge"
              >
                <Zap size={12} />
                <span className="max-w-[140px] truncate">{selectedModelOption?.name || selectedModel}</span>
                <ChevronDown size={11} className={`transition-transform ${isModelMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isModelMenuOpen && (
                <div className="absolute left-0 top-full mt-2 w-[340px] max-w-[90vw] dropdown z-50 animate-fade-in">
                  <div className="p-1.5 max-h-[50vh] overflow-y-auto">
                    {availableModels.map(model => (
                      <div
                        key={model.id}
                        onClick={() => { setSelectedModel(model.id); setIsModelMenuOpen(false); }}
                        className={`dropdown-item flex items-start gap-2 ${selectedModel === model.id ? 'active' : ''}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{model.name}</div>
                          {model.description && (
                            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{model.description}</div>
                          )}
                          <div className="flex gap-1 mt-1.5">
                            {(model.capabilities || ['text']).map(cap => (
                              <span key={cap} className={`cap-badge cap-${cap}`}>{cap}</span>
                            ))}
                          </div>
                        </div>
                        {selectedModel === model.id && (
                          <Check size={14} className="mt-1 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Persona Selector */}
            <div className="relative" ref={personaMenuRef}>
              <button
                onClick={() => setIsPersonaMenuOpen(!isPersonaMenuOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ color: 'var(--text-secondary)', background: 'transparent', border: '1px solid transparent' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <selectedPersona.icon size={13} style={{ color: 'var(--accent)' }} />
                <span className="hidden sm:inline">{selectedPersona.name}</span>
                <ChevronDown size={11} className={`transition-transform ${isPersonaMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isPersonaMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-[240px] dropdown z-50 animate-fade-in">
                  <div className="p-1.5">
                    {PERSONAS.map(p => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedPersona(p);
                          setIsPersonaMenuOpen(false);
                        }}
                        className={`dropdown-item flex items-center gap-2.5 ${selectedPersona.id === p.id ? 'active' : ''}`}
                      >
                        <p.icon size={14} style={{ color: p.id === 'humanizer' ? '#8b5cf6' : 'var(--accent)', flexShrink: 0 }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</div>
                          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.description}</div>
                        </div>
                        {selectedPersona.id === p.id && (
                          <Check size={13} style={{ color: p.id === 'humanizer' ? '#8b5cf6' : 'var(--accent)', flexShrink: 0 }} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>


            {/* Export button (only when chat active) */}
            {activeSession && (
              <button
                onClick={() => setExportSession(activeSession)}
                className="icon-btn"
                title="Export chat"
              >
                <Download size={15} />
              </button>
            )}

            {/* API Key button */}
            <button
              onClick={() => setShowApiKeyModal(true)}
              className="icon-btn"
              title="API Key Settings"
              style={getStoredApiKey() ? { color: '#10a37f' } : {}}
            >
              <Key size={15} />
            </button>
          </div>
        </header>

        {/* Messages */}
        <main className="messages-area">
          <div className="messages-inner">
            {isWelcome ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
                <div className="w-16 h-16 mb-5 animate-float rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                  <img src="/logo.png" alt="NexusAI Logo" className="w-full h-full object-cover" />
                </div>
                <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  What can I help you with?
                </h1>
                <p className="text-sm mb-8 text-center max-w-sm" style={{ color: 'var(--text-muted)' }}>
                  Powered by {selectedModelOption?.name || selectedModel}
                </p>
                <div className="welcome-grid w-full max-w-xl">
                  {WELCOME_SUGGESTIONS.map((s, i) => (
                    <div key={i} className="welcome-card" onClick={() => handleSubmit(s.text + ' ' + s.desc)}>
                      <s.icon size={18} className="mb-2" style={{ color: 'var(--accent)' }} />
                      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.text}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map(msg => (
                  <ChatMessage key={msg.id} message={msg} onRetry={msg.isError ? handleRetry : undefined} />
                ))}
                {isLoading && <TypingIndicator />}
              </>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </main>

        {/* Input */}
        <div className="input-wrap">
          <div className="input-inner">
            {/* Image preview strip */}
            {imagePreview && (
              <div className="flex items-center gap-2 px-3 pt-2">
                <div className="relative">
                  <img src={imagePreview} alt="attachment" className="h-16 rounded-lg border" style={{ borderColor: 'var(--border)' }} />
                  <button
                    onClick={() => { setImageFile(null); setImagePreview(null); }}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: '#ef4444' }}
                  >
                    <X size={9} className="text-white" />
                  </button>
                </div>
              </div>
            )}
            <div className="input-container flex items-end gap-2 p-2">
              {/* Hidden file input */}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              {/* Attach image */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="icon-btn flex-shrink-0"
                title="Attach image"
              >
                <Paperclip size={17} />
              </button>
              {/* Think toggle — small circle next to attach */}
              <button
                onClick={() => setIsThinking(!isThinking)}
                disabled={!supportsThinking || isLoading}
                title={supportsThinking ? (isThinking ? 'Thinking ON — click to disable' : 'Enable thinking mode') : 'Not supported for this model'}
                className="flex-shrink-0 self-center flex items-center justify-center rounded-full transition-all"
                style={{
                  width: 28,
                  height: 28,
                  background: isThinking
                    ? 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.3))'
                    : 'var(--bg-tertiary)',
                  border: `1px solid ${isThinking ? 'rgba(99,102,241,0.5)' : 'var(--border)'}`,
                  color: isThinking ? '#818cf8' : 'var(--text-muted)',
                  boxShadow: isThinking ? '0 0 8px rgba(99,102,241,0.3)' : 'none',
                }}
              >
                <BrainCircuit size={13} className={isThinking ? 'animate-pulse' : ''} />
              </button>
              <textarea
                ref={inputRef}
                rows={1}
                value={inputValue}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? '🎙 Listening...' : 'Message NexusAI…'}
                className="flex-1 px-3 py-2.5 min-h-[44px] max-h-[160px]"
              />
              <div className="flex items-center gap-1 pb-1 pr-1">
                {isLoading ? (
                  <button
                    onClick={stopGeneration}
                    className="p-1.5 text-gray-400 hover:text-red-400 transition-colors bg-red-400/10 hover:bg-red-400/20 rounded-lg mr-1"
                    title="Stop generating"
                  >
                    <StopCircle size={15} />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={isLoading}
                  className={`icon-btn transition-all ${
                    isListening
                      ? 'animate-pulse-glow'
                      : ''
                  }`}
                  style={isListening ? { color: '#ef4444', background: 'rgba(239,68,68,.1)' } : {}}
                  title={isListening ? 'Stop' : 'Voice input'}
                >
                  {isListening ? <StopCircle size={18} /> : <Mic size={18} />}
                </button>
                <button
                  onClick={() => handleSubmit()}
                  disabled={(!inputValue.trim() && !imageFile) || isLoading}
                  className="btn-send"
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
            <p className="text-[11px] text-center mt-2" style={{ color: 'var(--text-muted)' }}>
              NexusAI can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;