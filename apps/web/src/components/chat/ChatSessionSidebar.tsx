'use client';

import { useRef, useEffect, useState } from 'react';
import { MessageSquare, Plus, Archive, MoreHorizontal, GitBranch, Pencil, Check, X, Search } from 'lucide-react';
import type { ChatSession } from '@/lib/api/sessions';

interface Props {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onFork: (id: string) => void;
  loading?: boolean;
}

type MenuState = { sessionId: string; x: number; y: number } | null;

function groupByDate(sessions: ChatSession[]): { label: string; items: ChatSession[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const week = today - 7 * 86400000;

  const groups: Record<string, ChatSession[]> = {
    'Hôm nay': [],
    'Hôm qua': [],
    '7 ngày qua': [],
    'Cũ hơn': [],
  };

  for (const s of sessions) {
    const t = new Date(s.updated_at).getTime();
    if (t >= today) groups['Hôm nay'].push(s);
    else if (t >= yesterday) groups['Hôm qua'].push(s);
    else if (t >= week) groups['7 ngày qua'].push(s);
    else groups['Cũ hơn'].push(s);
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

export function ChatSessionSidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onFork,
  loading,
}: Props) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [menu, setMenu] = useState<MenuState>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = search.trim()
    ? sessions.filter((s) => s.title.toLowerCase().includes(search.toLowerCase()))
    : sessions;

  const groups = groupByDate(filtered);

  // Close context menu on outside click
  useEffect(() => {
    if (!menu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menu]);

  function startEdit(s: ChatSession) {
    setEditingId(s.id);
    setEditTitle(s.title);
    setMenu(null);
  }

  function commitEdit() {
    if (editingId && editTitle.trim()) {
      onRename(editingId, editTitle.trim());
    }
    setEditingId(null);
  }

  return (
    <div className="flex flex-col h-full bg-neutral-950 border-r border-white/[0.06]">
      {/* Header */}
      <div className="px-3 pt-4 pb-2 flex items-center justify-between flex-shrink-0">
        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Lịch sử chat</span>
        <button
          onClick={onNew}
          title="Tạo phiên mới"
          className="w-6 h-6 flex items-center justify-center rounded text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Tìm phiên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 text-xs bg-white/5 border border-white/[0.08] rounded-md text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-brand-primary/40"
          />
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto min-h-0 px-1.5 space-y-3 pb-3">
        {loading && (
          <div className="text-center py-6 text-neutral-600 text-xs">Đang tải...</div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="text-center py-8 text-neutral-600 text-xs space-y-2">
            <MessageSquare className="w-6 h-6 mx-auto opacity-30" />
            <p>Chưa có phiên nào</p>
            <button
              onClick={onNew}
              className="text-brand-primary hover:underline text-xs"
            >
              Tạo phiên đầu tiên
            </button>
          </div>
        )}

        {groups.map(({ label, items }) => (
          <div key={label}>
            <div className="px-2 py-1 text-[10px] font-medium text-neutral-600 uppercase tracking-wider">
              {label}
            </div>
            <div className="space-y-0.5">
              {items.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  isActive={session.id === activeSessionId}
                  isEditing={editingId === session.id}
                  editTitle={editTitle}
                  onSelect={() => onSelect(session.id)}
                  onEditChange={setEditTitle}
                  onEditCommit={commitEdit}
                  onEditCancel={() => setEditingId(null)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({ sessionId: session.id, x: e.clientX, y: e.clientY });
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Context menu */}
      {menu && (
        <div
          ref={menuRef}
          style={{ top: menu.y, left: menu.x }}
          className="fixed z-50 bg-neutral-900 border border-white/10 rounded-lg shadow-xl py-1 min-w-[160px]"
        >
          <ContextMenuItem
            icon={<Pencil className="w-3.5 h-3.5" />}
            label="Đổi tên"
            onClick={() => {
              const s = sessions.find((x) => x.id === menu.sessionId);
              if (s) startEdit(s);
            }}
          />
          <ContextMenuItem
            icon={<GitBranch className="w-3.5 h-3.5" />}
            label="Rẽ nhánh"
            onClick={() => { onFork(menu.sessionId); setMenu(null); }}
          />
          <div className="my-1 border-t border-white/10" />
          <ContextMenuItem
            icon={<Archive className="w-3.5 h-3.5" />}
            label="Lưu trữ"
            danger
            onClick={() => { onDelete(menu.sessionId); setMenu(null); }}
          />
        </div>
      )}
    </div>
  );
}

function SessionItem({
  session,
  isActive,
  isEditing,
  editTitle,
  onSelect,
  onEditChange,
  onEditCommit,
  onEditCancel,
  onContextMenu,
}: {
  session: ChatSession;
  isActive: boolean;
  isEditing: boolean;
  editTitle: string;
  onSelect: () => void;
  onEditChange: (v: string) => void;
  onEditCommit: () => void;
  onEditCancel: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  return (
    <div
      onClick={!isEditing ? onSelect : undefined}
      onContextMenu={onContextMenu}
      className={`
        group relative flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors
        ${isActive
          ? 'bg-white/10 text-white'
          : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'}
      `}
    >
      <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
      {isEditing ? (
        <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
          <input
            ref={inputRef}
            value={editTitle}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onEditCommit();
              if (e.key === 'Escape') onEditCancel();
            }}
            className="flex-1 min-w-0 bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
          />
          <button onClick={onEditCommit} className="text-green-400 hover:text-green-300">
            <Check className="w-3 h-3" />
          </button>
          <button onClick={onEditCancel} className="text-neutral-500 hover:text-neutral-300">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <span className="flex-1 min-w-0 truncate text-xs leading-snug">{session.title}</span>
      )}
      {!isEditing && session.forked_from_id && (
        <GitBranch className="w-3 h-3 flex-shrink-0 opacity-40" />
      )}
    </div>
  );
}

function ContextMenuItem({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors
        ${danger ? 'text-red-400 hover:bg-red-500/10' : 'text-neutral-200 hover:bg-white/10'}`}
    >
      {icon}
      {label}
    </button>
  );
}
