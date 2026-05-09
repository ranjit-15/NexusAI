import React, { useState } from 'react';
import { X, Download, FileText, Code2, Check } from 'lucide-react';
import { ChatSession, Role } from '../types';

interface ExportModalProps {
  session: ChatSession;
  onClose: () => void;
}

const ExportModal: React.FC<ExportModalProps> = ({ session, onClose }) => {
  const [exported, setExported] = useState<string | null>(null);

  const exportMarkdown = () => {
    const lines: string[] = [
      `# ${session.title}`,
      `_Exported from NexusAI — ${new Date(session.updatedAt).toLocaleString()}_`,
      '',
    ];
    session.messages.forEach(m => {
      if (m.id === 'welcome') return;
      const role = m.role === Role.USER ? '**You**' : '**NexusAI**';
      const time = m.timestamp instanceof Date
        ? m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';
      lines.push(`### ${role} ${time ? `_(${time})_` : ''}`);
      lines.push(m.text);
      lines.push('');
    });
    download(lines.join('\n'), `${session.title}.md`, 'text/markdown');
    setExported('md');
  };

  const exportText = () => {
    const lines: string[] = [`${session.title}\n${'─'.repeat(40)}\n`];
    session.messages.forEach(m => {
      if (m.id === 'welcome') return;
      const role = m.role === Role.USER ? 'You' : 'NexusAI';
      lines.push(`[${role}]: ${m.text}\n`);
    });
    download(lines.join('\n'), `${session.title}.txt`, 'text/plain');
    setExported('txt');
  };

  const download = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
      <div
        className="relative w-full max-w-sm rounded-2xl shadow-2xl animate-fade-in"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <Download size={16} style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Export Chat</h2>
          </div>
          <button onClick={onClose} className="icon-btn"><X size={16} /></button>
        </div>

        <div className="px-5 py-5 space-y-3">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Download <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>"{session.title}"</span> as:
          </p>

          <button
            onClick={exportMarkdown}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all text-left"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <Code2 size={18} style={{ color: 'var(--accent)' }} />
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Markdown (.md)</div>
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Preserves formatting, code blocks, images</div>
            </div>
            {exported === 'md' && <Check size={14} style={{ color: '#10a37f' }} />}
          </button>

          <button
            onClick={exportText}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all text-left"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <FileText size={18} style={{ color: 'var(--text-secondary)' }} />
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Plain Text (.txt)</div>
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Simple, readable text format</div>
            </div>
            {exported === 'txt' && <Check size={14} style={{ color: '#10a37f' }} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
