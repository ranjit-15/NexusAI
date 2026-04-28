import React from 'react';
import { Plus, MessageSquare, Trash2 } from 'lucide-react';
import { ChatSession, UserProfile } from '../types';

interface SidebarProps {
  sessions: ChatSession[];
  activeId: string | null;
  isOpen: boolean;
  userProfile?: UserProfile | null;
  onClose: () => void;
  onNewChat: () => void;
  onSelectSession: (session: ChatSession) => void;
  onDeleteSession: (id: string) => void;
  onOpenProfile: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  sessions, activeId, isOpen, userProfile, onClose, onNewChat, onSelectSession, onDeleteSession, onOpenProfile
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
          <div className="logo-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="font-semibold text-sm whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
            NexusAI
          </span>
        </div>
      </div>

      {/* New Chat */}
      <div className="px-3 pt-3 pb-1 flex-shrink-0">
        <button onClick={onNewChat} className="new-chat-btn">
          <span className="whitespace-nowrap">New chat</span>
        </button>
      </div>

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
                <button
                  onClick={e => { e.stopPropagation(); onDeleteSession(session.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
        <div 
          className="flex items-center gap-2.5 px-2 py-1.5 cursor-pointer hover:bg-white/5 rounded-lg transition-colors"
          onClick={onOpenProfile}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #10a37f, #0d8063)' }}
          >
            <span className="text-xs font-bold text-white uppercase">
              {userProfile?.displayName.charAt(0) || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="text-xs font-medium truncate whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
              {userProfile?.displayName || 'User'}
            </div>
            <div className="text-[10px] whitespace-nowrap truncate" style={{ color: 'var(--text-muted)' }}>
              @{userProfile?.username || 'Setup required'}
            </div>
          </div>
        </div>
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
