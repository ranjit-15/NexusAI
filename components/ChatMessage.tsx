import React, { useState, useRef, useEffect } from 'react';
import { Message, Role } from '../types';
import { User, Bot, AlertCircle, Volume2, StopCircle, Loader2, Copy, Check, RefreshCw } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ChatMessageProps {
  message: Message;
  onRetry?: (id: string) => void;
}

function decode(base64: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sr: number, ch: number): Promise<AudioBuffer> {
  const int16 = new Int16Array(data.buffer);
  const frames = int16.length / ch;
  const buf = ctx.createBuffer(ch, frames, sr);
  for (let c = 0; c < ch; c++) {
    const cd = buf.getChannelData(c);
    for (let i = 0; i < frames; i++) cd[i] = int16[i * ch + c] / 32768.0;
  }
  return buf;
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
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    return () => {
      sourceRef.current?.stop();
      audioCtxRef.current?.close();
    };
  }, []);

  const handlePlayAudio = async () => {
    if (isPlaying) {
      sourceRef.current?.stop();
      sourceRef.current = null;
      setIsPlaying(false);
      return;
    }
    try {
      setIsAudioLoading(true);
      const b64 = await geminiService.generateSpeech(message.text);
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current) audioCtxRef.current = new AC({ sampleRate: 24000 });
      else if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();
      
      const ab = await decodeAudioData(decode(b64), audioCtxRef.current, 24000, 1);
      const src = audioCtxRef.current.createBufferSource();
      src.buffer = ab;
      src.connect(audioCtxRef.current.destination);
      src.onended = () => { setIsPlaying(false); sourceRef.current = null; };
      sourceRef.current = src;
      src.start();
      setIsPlaying(true);
    } catch (e) {
      console.error('Audio error:', e);
    } finally {
      setIsAudioLoading(false);
    }
  };

  if (message.id === 'welcome') return null;

  return (
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
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    const lang = match ? match[1] : '';
                    const code = String(children).replace(/\n$/, '');

                    if (!inline && (match || code.includes('\n'))) {
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
                              {...props}
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

            {/* Action buttons for bot messages */}
            {!isUser && !message.isError && message.text && (
              <div className="flex items-center gap-1 mt-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ borderTop: '1px solid var(--border)' }}>
                <CopyButton text={message.text} />
                <button
                  onClick={handlePlayAudio}
                  disabled={isAudioLoading}
                  className="p-1 text-gray-500 hover:text-purple-300 rounded transition-colors"
                  title={isPlaying ? 'Stop' : 'Read aloud'}
                >
                  {isAudioLoading ? <Loader2 size={13} className="animate-spin" /> : isPlaying ? <StopCircle size={13} /> : <Volume2 size={13} />}
                </button>
              </div>
            )}
          </div>

          <span className="text-[10px] text-gray-600 mt-1 px-1">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;