import React from 'react';
import { Bot } from 'lucide-react';

const TypingIndicator: React.FC = () => {
  return (
    <div className="flex items-start gap-3 animate-fade-in mb-4">
      <div
        className="w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
      >
        <Bot size={14} style={{ color: 'var(--accent)' }} />
      </div>
      <div className="msg-bot py-3 flex items-center gap-1.5">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  );
};

export default TypingIndicator;