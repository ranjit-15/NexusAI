import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Menu, BrainCircuit, ChevronDown, Check, Mic, StopCircle, Zap, Code, Lightbulb, PenTool, Plus, Cloud, CloudOff, Image as ImageIcon } from 'lucide-react';
import { geminiService } from './services/geminiService';
import { Message, Role, Persona, ModelOption, ChatSession } from './types';
import { PERSONAS } from './constants/personas';
import ChatMessage from './components/ChatMessage';
import TypingIndicator from './components/TypingIndicator';
import Sidebar from './components/Sidebar';
import { saveSession, loadSessionsFromFirestore, deleteSessionFromFirestore } from './src/firestoreService';
import { getUserProfile } from './src/userService';
import AuthModal from './components/AuthModal';
import UserProfileModal from './components/UserProfileModal';
import { UserProfile } from './types';

const MODEL_KEY = 'nexus_model';

const genId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const parseMessages = (msgs: any[]): Message[] =>
  (msgs || []).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));

const getChatTitle = (msgs: Message[]): string => {
  const first = msgs.find(m => m.role === Role.USER && m.text?.trim());
  if (!first) return 'New Chat';
  const t = first.text.replace(/\s+/g, ' ').trim();
  return t.length > 50 ? t.slice(0, 50) + '…' : t;
};

// Local cache helpers (fast, offline fallback)
const getSessionsKey = (username?: string) => `nexus_sessions_${username || 'guest'}`;

const loadLocalSessions = (username?: string): ChatSession[] => {
  try {
    const raw = localStorage.getItem(getSessionsKey(username));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((s: any) => ({
        id: String(s.id || genId()),
        title: String(s.title || 'New Chat'),
        updatedAt: Number(s.updatedAt) || Date.now(),
        messages: parseMessages(s.messages || []),
        model: s.model,
      }))
      .filter((s: ChatSession) => s.messages.length > 0);
  } catch { return []; }
};

const saveLocalSessions = (sessions: ChatSession[], username?: string) => {
  localStorage.setItem(getSessionsKey(username), JSON.stringify(sessions.slice(0, 50)));
};

interface IWindow extends Window { webkitSpeechRecognition: any; SpeechRecognition: any; }

const WELCOME_SUGGESTIONS = [
  { icon: Code, text: 'Write a Python script', desc: 'to scrape website data' },
  { icon: ImageIcon, text: 'Generate an image', desc: 'of a futuristic city' },
  { icon: PenTool, text: 'Write a story', desc: 'about a time traveler' },
  { icon: Zap, text: 'Help me debug', desc: 'my React application' },
];

const App: React.FC = () => {
  // Boot from local cache instantly; Firestore will merge in the background
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => getUserProfile());
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadLocalSessions(getUserProfile()?.username));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'synced' | 'error'>('syncing');
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<Persona>(PERSONAS[0]);
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(
    () => localStorage.getItem(MODEL_KEY) || 'gemini-2.5-flash'
  );
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isPersonaMenuOpen, setIsPersonaMenuOpen] = useState(false);
  // Sidebar: open by default on desktop, closed on mobile
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => window.innerWidth >= 768);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const textBeforeListening = useRef('');
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const personaMenuRef = useRef<HTMLDivElement>(null);

  // ── Theme initialization ────────────────────────────────────────────────
  useEffect(() => {
    if (userProfile?.theme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  }, [userProfile?.theme]);

  // ── Firestore sync: load sessions on mount ──────────────────────────────
  useEffect(() => {
    if (!userProfile) return; // Do not fetch if no user

    let mounted = true;
    setSyncStatus('syncing');
    loadSessionsFromFirestore()
      .then(firestoreSessions => {
        if (!mounted) return;
        setSessions(firestoreSessions);
        saveLocalSessions(firestoreSessions, userProfile.username); // update local cache
        setSyncStatus('synced');
      })
      .catch(() => {
        if (mounted) setSyncStatus('error');
      });
    return () => { mounted = false; };
  }, [userProfile]);

  // ── Save to localStorage (instant) + Firestore (async) on sessions change ─
  useEffect(() => {
    saveLocalSessions(sessions, userProfile?.username);
  }, [sessions, userProfile?.username]);

  useEffect(() => { localStorage.setItem(MODEL_KEY, selectedModel); }, [selectedModel]);

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
        const hasFlash = models.some(m => m.id === 'gemini-2.5-flash');
        setSelectedModel(hasFlash ? 'gemini-2.5-flash' : models[0].id);
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
    setSelectedModel(session.model || 'gemini-2.5-flash');
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
    if (!userText || isLoading) return;
    setInputValue('');

    const userMsg: Message = { id: genId(), role: Role.USER, text: userText, timestamp: new Date() };
    const botId = genId();
    const botMsg: Message = { id: botId, role: Role.MODEL, text: '', timestamp: new Date(), model: selectedModel };

    const currentHistory = [...messages];
    const newMessages = [...messages, userMsg, botMsg];
    setMessages(newMessages);

    if (!activeId) {
      createSessionFromMessages([...currentHistory, userMsg, botMsg]);
    }

    setIsLoading(true);

    try {
      const stream = geminiService.sendMessageStream(
        userText, isThinking, currentHistory, selectedModel, selectedPersona.systemInstruction
      );
      let full = '';
      for await (const chunk of stream) {
        full += chunk;
        setMessages(prev => prev.map(m => m.id === botId ? { ...m, text: full } : m));
      }
    } catch (err: any) {
      setMessages(prev => prev.map(m => m.id === botId ? { ...m, text: err.message || 'Error occurred', isError: true } : m));
    } finally { setIsLoading(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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

  return (
    <div className="app-shell">
      {!userProfile && (
        <AuthModal onComplete={(profile) => setUserProfile(profile)} />
      )}
      
      {showProfileModal && userProfile && (
        <UserProfileModal 
          profile={userProfile} 
          onClose={() => setShowProfileModal(false)}
          onUpdate={(profile) => setUserProfile(profile)}
          onDeleteAllChats={deleteAllChats}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        isOpen={sidebarOpen}
        userProfile={userProfile}
        onClose={() => setSidebarOpen(false)}
        onNewChat={startNewChat}
        onSelectSession={selectSession}
        onDeleteSession={deleteSession}
        onOpenProfile={() => setShowProfileModal(true)}
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
                <div className="absolute right-0 top-full mt-2 w-[230px] dropdown z-50 animate-fade-in">
                  <div className="p-1.5">
                    {PERSONAS.map(p => (
                      <div
                        key={p.id}
                        onClick={() => { setSelectedPersona(p); setIsPersonaMenuOpen(false); }}
                        className={`dropdown-item flex items-center gap-2.5 ${selectedPersona.id === p.id ? 'active' : ''}`}
                      >
                        <p.icon size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</div>
                          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.description}</div>
                        </div>
                        {selectedPersona.id === p.id && (
                          <Check size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Thinking toggle */}
            <button
              onClick={() => setIsThinking(!isThinking)}
              disabled={!supportsThinking}
              className={`thinking-toggle ${isThinking ? 'active' : ''}`}
              title={supportsThinking ? 'Toggle thinking mode' : 'Not supported for this model'}
            >
              <BrainCircuit size={13} className={isThinking ? 'animate-pulse' : ''} />
              <span className="hidden sm:inline">Think</span>
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
                {isLoading && messages[messages.length - 1]?.text === '' && <TypingIndicator />}
              </>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </main>

        {/* Input */}
        <div className="input-wrap">
          <div className="input-inner">
            <div className="input-container flex items-end gap-2 p-2">
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
                  disabled={!inputValue.trim() || isLoading}
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