import React, { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Sparkles, AlertTriangle, BrainCircuit, Mic, StopCircle, ChevronDown, Check } from 'lucide-react';
import { geminiService } from './services/geminiService';
import { Message, Role, Persona } from './types';
import { PERSONAS } from './constants/personas';
import ChatMessage from './components/ChatMessage';
import TypingIndicator from './components/TypingIndicator';

const STORAGE_KEY = 'chat_history';

// Interface for Web Speech API
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

// Simple ID generator for broader compatibility
const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
    } catch (e) {
      console.error("Failed to load chat history:", e);
    }
    
    return [
      {
        id: 'welcome',
        role: Role.MODEL,
        text: "Hello! I'm your AI assistant. How can I help you today?",
        timestamp: new Date()
      }
    ];
  });
  
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isThinkingMode, setIsThinkingMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<Persona>(PERSONAS[0]);
  const [isPersonaMenuOpen, setIsPersonaMenuOpen] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const textBeforeListening = useRef('');
  const personaMenuRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close persona menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (personaMenuRef.current && !personaMenuRef.current.contains(event.target as Node)) {
        setIsPersonaMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleClearChat = () => {
    if (confirm('Are you sure you want to clear the conversation?')) {
      geminiService.startNewSession();
      const newMessages: Message[] = [{
        id: generateId(),
        role: Role.MODEL,
        text: "Conversation cleared. What would you like to discuss now?",
        timestamp: new Date()
      }];
      setMessages(newMessages);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const w = window as unknown as IWindow;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Your browser does not support voice input. Please try Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    textBeforeListening.current = inputValue;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      
      const prefix = textBeforeListening.current ? textBeforeListening.current + ' ' : '';
      setInputValue(prefix + transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
      
      if (event.error === 'not-allowed') {
        alert("Microphone access blocked. Please click the camera/lock icon in your address bar to allow microphone access.");
      } else if (event.error === 'no-speech') {
        // silently ignore
      } else if (event.error !== 'aborted') {
         // ignore aborted (manual stop)
         console.warn(`Speech recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleRetry = async (errorMsgId: string) => {
    const errorIndex = messages.findIndex(m => m.id === errorMsgId);
    if (errorIndex === -1) return;
    
    // Ensure we have a preceding user message
    const userMsg = messages[errorIndex - 1];
    if (!userMsg || userMsg.role !== Role.USER) return;
    
    // Remove the error message from UI
    setMessages(prev => prev.filter(m => m.id !== errorMsgId));
    setIsLoading(true);

    // Create new bot placeholder
    const botMessageId = generateId();
    const initialBotMessage: Message = {
      id: botMessageId,
      role: Role.MODEL,
      text: '',
      timestamp: new Date()
    };
    
    // Add placeholder
    setMessages(prev => [...prev.filter(m => m.id !== errorMsgId), initialBotMessage]);

    // History: all messages before the user message we are retrying for.
    const history = messages.slice(0, errorIndex - 1);
    
    try {
      const stream = geminiService.sendMessageStream(
        userMsg.text, 
        isThinkingMode, 
        history,
        selectedPersona.systemInstruction
      );
      let fullResponse = '';

      for await (const chunk of stream) {
        fullResponse += chunk;
        setMessages(prev => prev.map(msg => 
          msg.id === botMessageId 
            ? { ...msg, text: fullResponse }
            : msg
        ));
      }
    } catch (error: any) {
        setMessages(prev => prev.map(msg => 
        msg.id === botMessageId 
          ? { 
              ...msg, 
              text: error.message || "Sorry, I encountered an error while processing your request.", 
              isError: true 
            }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (isListening) {
      toggleListening();
    }

    if (!inputValue.trim() || isLoading) return;

    const userText = inputValue.trim();
    setInputValue('');
    
    // Create User Message
    const userMessage: Message = {
      id: generateId(),
      role: Role.USER,
      text: userText,
      timestamp: new Date()
    };

    // Capture current messages before update for history
    const currentHistory = [...messages];

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Create placeholder for Bot Message
    const botMessageId = generateId();
    const initialBotMessage: Message = {
      id: botMessageId,
      role: Role.MODEL,
      text: '',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, initialBotMessage]);

    try {
      const stream = geminiService.sendMessageStream(
        userText, 
        isThinkingMode, 
        currentHistory,
        selectedPersona.systemInstruction
      );
      let fullResponse = '';

      for await (const chunk of stream) {
        fullResponse += chunk;
        
        setMessages(prev => prev.map(msg => 
          msg.id === botMessageId 
            ? { ...msg, text: fullResponse }
            : msg
        ));
      }
    } catch (error: any) {
      console.error(error);
      setMessages(prev => prev.map(msg => 
        msg.id === botMessageId 
          ? { 
              ...msg, 
              text: error.message || "Sorry, I encountered an error while processing your request.", 
              isError: true 
            }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Check if API Key is configured - backend handles key now
  const isApiKeyMissing = false;

  return (
    <div className="flex flex-col h-[100dvh] bg-[#030712] text-gray-100 font-sans relative overflow-hidden transition-all duration-300">
      
      {/* Ambient Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="flex-none h-20 flex items-center justify-between px-6 z-20 bg-transparent relative w-full max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-indigo-500 to-violet-500 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
            <Sparkles size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              ChatBot
            </h1>
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">AI Assistant</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           {/* Persona Selector */}
           <div className="relative" ref={personaMenuRef}>
            <button
              onClick={() => setIsPersonaMenuOpen(!isPersonaMenuOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all duration-200 border border-transparent hover:border-white/5"
            >
              <selectedPersona.icon size={16} className="text-indigo-400" />
              <span className="hidden md:block">{selectedPersona.name}</span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${isPersonaMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isPersonaMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-[#11131f] border border-white/10 rounded-xl shadow-2xl backdrop-blur-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-1">
                  {PERSONAS.map((persona) => (
                    <button
                      key={persona.id}
                      onClick={() => {
                        setSelectedPersona(persona);
                        setIsPersonaMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        selectedPersona.id === persona.id 
                          ? 'bg-indigo-500/10 text-white' 
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className={`p-1.5 rounded-md ${selectedPersona.id === persona.id ? 'bg-indigo-500/20 text-indigo-400' : 'bg-gray-800/50 text-gray-500'}`}>
                        <persona.icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{persona.name}</div>
                        <div className="text-[10px] text-gray-500 truncate">{persona.description}</div>
                      </div>
                      {selectedPersona.id === persona.id && (
                        <Check size={14} className="text-indigo-400" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button 
            onClick={handleClearChat}
            className="p-2.5 text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-xl transition-all duration-200"
            title="Clear Conversation"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto px-4 py-6 md:px-6 scroll-smooth z-10 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent w-full">
        <div className="max-w-3xl mx-auto flex flex-col min-h-full justify-end pb-4">
          {/* Empty State - Only show if NO messages or only Welcome message and user explicitly wants to see placeholder */}
          {messages.length === 1 && (
            <div className="flex-1 flex flex-col items-center justify-center opacity-50 space-y-4 mb-20 animate-in fade-in duration-500">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                <selectedPersona.icon size={32} className="text-indigo-400" />
              </div>
              <p className="text-gray-400">Start a conversation...</p>
            </div>
          )}

          {messages.map(msg => (
            <ChatMessage 
              key={msg.id} 
              message={msg} 
              onRetry={msg.isError ? handleRetry : undefined}
            />
          ))}
          
          {isLoading && messages[messages.length - 1]?.text === '' && (
             <div className="flex w-full mb-8 justify-start animate-in fade-in duration-300">
                <div className="flex max-w-[85%] flex-row items-end gap-3">
                   <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    {isThinkingMode ? (
                      <BrainCircuit size={14} className="text-indigo-400 animate-pulse" />
                    ) : (
                      <selectedPersona.icon size={14} className="text-indigo-400" />
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <TypingIndicator />
                    {isThinkingMode && (
                      <span className="text-xs font-medium text-indigo-300/80 animate-pulse tracking-wide">
                        Thinking...
                      </span>
                    )}
                  </div>
                </div>
             </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </main>

      {/* Input Area */}
      <footer className="flex-none p-4 md:p-6 pb-8 z-20 bg-gradient-to-t from-[#030712] via-[#030712] to-transparent w-full">
        <div className="max-w-3xl mx-auto">
          {/* Controls Bar */}
          <div className="flex justify-center mb-4">
            <button 
              onClick={() => setIsThinkingMode(!isThinkingMode)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300 border ${
                isThinkingMode 
                  ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.2)]' 
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              <BrainCircuit size={14} className={isThinkingMode ? "animate-pulse" : ""} />
              <span>Thinking Mode</span>
              <span className={`w-1.5 h-1.5 rounded-full ml-1 ${isThinkingMode ? 'bg-indigo-400' : 'bg-gray-600'}`} />
            </button>
          </div>

          <div className="relative group">
            <div className={`absolute -inset-0.5 rounded-[28px] opacity-30 blur transition duration-500 ${isThinkingMode ? 'bg-indigo-500' : 'bg-gradient-to-r from-gray-700 to-gray-600'}`}></div>
            
            <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-[#13141f] border border-white/10 rounded-[26px] p-2 shadow-2xl">
              
              <textarea
                ref={inputRef}
                rows={1}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? "Listening..." : "Type your message..."}
                className="w-full bg-transparent text-gray-100 border-none focus:ring-0 px-4 py-3 min-h-[52px] max-h-[150px] resize-none placeholder:text-gray-500"
                disabled={isApiKeyMissing}
              />
              
              <div className="flex items-center gap-1.5 pb-1.5 pr-1.5">
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={isApiKeyMissing || isLoading}
                  className={`p-2.5 rounded-full transition-all duration-200 ${
                    isListening 
                      ? "bg-red-500/20 text-red-400 animate-pulse" 
                      : "text-gray-400 hover:text-white hover:bg-white/10"
                  }`}
                  title={isListening ? "Stop Recording" : "Voice Input"}
                >
                  {isListening ? <StopCircle size={20} /> : <Mic size={20} />}
                </button>

                <button
                  type="submit"
                  disabled={!inputValue.trim() || isLoading || isApiKeyMissing}
                  className={`p-2.5 rounded-full transition-all duration-200 shadow-lg ${
                    !inputValue.trim() || isLoading
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      : isThinkingMode 
                        ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-500/20' 
                        : 'bg-white text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Send size={18} fill={!inputValue.trim() ? "none" : "currentColor"} className={inputValue.trim() ? "translate-x-0.5" : ""} />
                </button>
              </div>
            </form>
          </div>
          
          <div className="text-center mt-3">
             <p className="text-[10px] text-gray-600 tracking-wide uppercase">
              {isThinkingMode ? "GEMINI 3.0 PRO • THINKING ENABLED" : "GEMINI 2.5 FLASH • SPEED OPTIMIZED"}
             </p>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default App;