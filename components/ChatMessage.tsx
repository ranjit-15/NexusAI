import React, { useState, useRef, useEffect } from 'react';
import { Message, Role } from '../types';
import { User, Bot, AlertCircle, Volume2, StopCircle, Copy, Check, RefreshCw, Download, Wand2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import HumanizeModal from './HumanizeModal';

interface ChatMessageProps {
  message: Message;
  onRetry?: (id: string) => void;
}

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <button onClick={handleCopy} className="p-1 text-gray-500 hover:text-purple-300 rounded transition-colors" title="Copy">
      {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
    </button>
  );
};

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onRetry }) => {
  const isUser = message.role === Role.USER;
  const [isPlaying, setIsPlaying] = useState(false);
  const [showHumanize, setShowHumanize] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Clean up speech on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const handlePlayAudio = () => {
    if (!window.speechSynthesis) {
      alert('Text-to-speech is not supported in this browser.');
      return;
    }

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    // Strip markdown for clean speech output
    const plainText = message.text
      .replace(/```[\s\S]*?```/g, 'code block')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
      .trim();

    const speak = (voices: SpeechSynthesisVoice[]) => {
      const utterance = new SpeechSynthesisUtterance(plainText);
      utterance.rate = 1.0;
      utterance.pitch = 1.1;   // Slightly higher pitch for a naturally female tone
      utterance.volume = 1.0;

      // Prefer known female voices across platforms (macOS, Windows, Chrome, Android)
      const femaleNames = ['samantha', 'google uk english female', 'zira', 'aria', 'jenny',
                           'google us english', 'karen', 'victoria', 'tessa', 'moira', 'fiona'];
      const preferred =
        voices.find(v => femaleNames.some(n => v.name.toLowerCase().includes(n)) && v.lang.startsWith('en')) ||
        voices.find(v => v.lang === 'en-US' && v.localService) ||
        voices.find(v => v.lang.startsWith('en-'));
      if (preferred) utterance.voice = preferred;

      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
    };

    // Voices may not be loaded yet on first call — wait if needed
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      speak(voices);
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        speak(window.speechSynthesis.getVoices());
        window.speechSynthesis.onvoiceschanged = null;
      };
      // Trigger voice loading (some browsers need this)
      window.speechSynthesis.getVoices();
    }
  };

  if (message.id === 'welcome') return null;

  return (
    <>
      {showHumanize && (
        <HumanizeModal text={message.text} onClose={() => setShowHumanize(false)} />
      )}
      <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
        <div className={`flex ${isUser ? 'max-w-[80%] lg:max-w-[70%] flex-row-reverse' : 'w-full flex-row'} items-start gap-3`}>
          
          {/* Avatar */}
          {isUser ? (
            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-indigo-600">
              <User size={14} className="text-white" />
            </div>
          ) : (
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              message.isError
                ? 'border border-red-500/30'
                : 'border'
            }`} style={message.isError ? { background: 'rgba(239,68,68,.1)' } : { background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
              {message.isError
                ? <AlertCircle size={14} className="text-red-400" />
                : <Bot size={14} style={{ color: 'var(--accent)' }} />}
            </div>
          )}

          {/* Content */}
          <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start flex-1 min-w-0'}`}>
            {/* Model label for bot messages */}
            {!isUser && message.model && (
              <span className="text-[10px] font-medium mb-1 ml-1" style={{ color: 'var(--text-muted)' }}>{message.model}</span>
            )}
            
            <div className={`group relative text-[14px] leading-relaxed ${
              isUser
                ? 'msg-user px-4 py-3'
                : message.isError
                  ? 'msg-error px-4 py-3 w-full'
                  : 'msg-bot w-full py-1'
            }`}>
              {/* Show attached image for user messages */}
              {isUser && message.imageUrl && (
                <div className="mb-2">
                  <img 
                    src={message.imageUrl} 
                    alt="attached" 
                    className="max-h-48 rounded-lg border object-contain"
                    style={{ borderColor: 'var(--border)' }} 
                  />
                </div>
              )}
              {message.isError ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-red-400 font-medium text-sm">
                    <AlertCircle size={14} />
                    <span>Error</span>
                  </div>
                  <p className="text-red-300/80 text-sm">{message.text}</p>
                  {onRetry && (
                    <button
                      onClick={() => onRetry(message.id)}
                      className="mt-1 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/20 transition-colors self-start"
                    >
                      <RefreshCw size={11} /> Retry
                    </button>
                  )}
                </div>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0 break-words">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc ml-4 mb-2 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal ml-4 mb-2 space-y-1">{children}</ol>,
                    li: ({ children }) => <li className="pl-1">{children}</li>,
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer"
                        className="text-purple-400 hover:text-purple-300 underline decoration-purple-500/30 underline-offset-2">
                        {children}
                      </a>
                    ),
                    strong: ({ children }) => <strong className="font-semibold" style={{ color: 'var(--text-primary)' }}>{children}</strong>,
                    img: ({ src, alt }) => (
                      <div className="relative inline-block mt-2 group">
                        <img src={src} alt={alt} className="max-w-full rounded-lg border border-transparent hover:border-purple-500/50 transition-all shadow-sm" />
                        <a 
                          href={src} 
                          download="generated-image.png" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="absolute bottom-3 right-3 bg-purple-600/90 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1.5 shadow-lg backdrop-blur-sm"
                          title="Download Image"
                        >
                          <Download size={14} /> Download
                        </a>
                      </div>
                    ),
                    code({ node, className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || '');
                      const lang = match ? match[1] : '';
                      const code = String(children).replace(/\n$/, '');
                      const isBlock = !!(match || code.includes('\n'));

                      if (isBlock) {
                        return (
                          <div className="rounded-xl overflow-hidden my-3" style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                            <div className="flex items-center justify-between px-4 py-2" style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)' }}>
                              <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{lang || 'code'}</span>
                              <CopyButton text={code} />
                            </div>
                            {match ? (
                              <SyntaxHighlighter
                                style={vscDarkPlus}
                                language={lang}
                                PreTag="div"
                                customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '0.85em', lineHeight: '1.6' }}
                                codeTagProps={{ style: { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" } }}
                              >
                                {code}
                              </SyntaxHighlighter>
                            ) : (
                              <div className="p-4 overflow-x-auto text-sm font-mono text-gray-300"><pre>{code}</pre></div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <code className="bg-purple-500/10 text-purple-300 px-1.5 py-0.5 rounded text-[13px] font-mono border border-purple-500/10" {...props}>
                          {children}
                        </code>
                      );
                    }
                  }}
                >
                  {message.text}
                </ReactMarkdown>
              )}

              {/* Action buttons for bot messages — always visible */}
              {!isUser && !message.isError && message.text && (
                <div className="flex items-center gap-1.5 mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                  <CopyButton text={message.text} />
                  {/* Read Aloud — instant browser TTS */}
                  <button
                    onClick={handlePlayAudio}
                    className="p-1 rounded transition-colors"
                    style={{ color: isPlaying ? 'var(--accent)' : 'var(--text-muted)' }}
                    title={isPlaying ? 'Stop reading' : 'Read aloud'}
                  >
                    {isPlaying ? <StopCircle size={13} /> : <Volume2 size={13} />}
                  </button>
                  {/* Humanize — opens modal with advanced options */}
                  <button
                    onClick={() => setShowHumanize(true)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-all"
                    style={{
                      background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(109,40,217,0.18))',
                      border: '1px solid rgba(139,92,246,0.25)',
                      color: '#a78bfa',
                    }}
                    title="Humanize — rewrite as natural human writing"
                  >
                    <Wand2 size={11} />
                    <span>Humanize</span>
                  </button>
                  {/* Word count */}
                  <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {message.text.trim().split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>
              )}
            </div>

            <span className="text-[10px] text-gray-600 mt-1 px-1">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatMessage;