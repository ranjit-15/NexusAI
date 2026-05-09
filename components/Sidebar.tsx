import React, { useState } from 'react';
import { Plus, MessageSquare, Trash2, Search, X, Download } from 'lucide-react';
import { ChatSession } from '../types';

interface SidebarProps {
  sessions: ChatSession[];
  activeId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onSelectSession: (session: ChatSession) => void;
  onDeleteSession: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  showSearch: boolean;
  onToggleSearch: () => void;
  onExport: (session: ChatSession) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  sessions, activeId, isOpen, onClose, onNewChat, onSelectSession, onDeleteSession,
  searchQuery, onSearchChange, showSearch, onToggleSearch, onExport
}) => {
  const grouped = groupByDate(sessions);

  return (
    <aside
      className={`sidebar flex flex-col h-full
        ${isOpen ? 'open' : 'collapsed'}
      `}
      style={{ minWidth: isOpen ? undefined : 0 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div 
          className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => window.location.reload()}
          title="Refresh page"
        >
          <img src="/logo.png" alt="NexusAI Logo" className="w-6 h-6 object-contain rounded-md" />
          <span className="font-semibold text-sm whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
            NexusAI
          </span>
        </div>
      </div>

      {/* New Chat + Search row */}
      <div className="px-3 pt-3 pb-1 flex-shrink-0 flex items-center gap-2">
        <button onClick={onNewChat} className="new-chat-btn flex-1">
          <span className="whitespace-nowrap">New chat</span>
        </button>
        <button
          onClick={onToggleSearch}
          className="icon-btn flex-shrink-0"
          title="Search chats"
          style={showSearch ? { color: 'var(--accent)', background: 'var(--bg-hover)' } : {}}
        >
          <Search size={14} />
        </button>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-3 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
            <Search size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search chats..."
              className="flex-1 text-xs bg-transparent outline-none"
              style={{ color: 'var(--text-primary)' }}
              autoFocus
            />
            {searchQuery && (
              <button onClick={() => onSearchChange('')}><X size={11} style={{ color: 'var(--text-muted)' }} /></button>
            )}
          </div>
        </div>
      )}

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {sessions.length === 0 && (
          <div className="text-center py-10">
            <MessageSquare size={22} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No conversations yet</p>
          </div>
        )}

        {Object.entries(grouped).map(([label, items]) => (
          <div key={label} className="mb-4">
            <div
              className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-1"
              style={{ color: 'var(--text-muted)' }}
            >
              {label}
            </div>
            {items.map(session => (
              <div
                key={session.id}
                className={`sidebar-item group flex items-center gap-2 ${activeId === session.id ? 'active' : ''}`}
                onClick={() => onSelectSession(session)}
              >
                <MessageSquare size={13} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                <span
                  className="flex-1 text-sm truncate whitespace-nowrap"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {session.title}
                </span>
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                  <button
                    onClick={e => { e.stopPropagation(); onExport(session); }}
                    className="p-1 rounded transition-all"
                    style={{ color: 'var(--text-muted)' }}
                    title="Export"
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
                  >
                    <Download size={11} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); onDeleteSession(session.id); }}
                    className="p-1 rounded transition-all"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
                    title="Delete"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

    </aside>
  );
};

function groupByDate(sessions: ChatSession[]): Record<string, ChatSession[]> {
  const now = Date.now();
  const day = 86400000;
  const groups: Record<string, ChatSession[]> = {};
  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  for (const s of sorted) {
    const diff = now - s.updatedAt;
    let label: string;
    if (diff < day) label = 'Today';
    else if (diff < 2 * day) label = 'Yesterday';
    else if (diff < 7 * day) label = 'This Week';
    else if (diff < 30 * day) label = 'This Month';
    else label = 'Older';

    if (!groups[label]) groups[label] = [];
    groups[label].push(s);
  }

  return groups;
}

export default Sidebar;
