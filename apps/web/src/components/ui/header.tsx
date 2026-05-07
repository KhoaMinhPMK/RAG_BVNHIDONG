'use client';

import { User, Cpu, Database, ChevronDown, LogOut, Settings, UserCircle } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-semantic-success animate-pulse' : 'bg-semantic-error'}`} />
      <span className="text-xs text-text-tertiary">{label}</span>
    </div>
  );
}

function UserMenu() {
  const { profile, user, signOut, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Debug logging
  useEffect(() => {
    console.log('[UserMenu] State:', { loading, hasUser: !!user, hasProfile: !!profile, email: user?.email });
  }, [loading, user, profile]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center gap-2 pl-3 border-l border-border">
        <div className="w-7 h-7 bg-background-secondary rounded-sm animate-pulse" />
        <div className="w-16 h-3 bg-background-secondary rounded-sm animate-pulse" />
      </div>
    );
  }

  // Not logged in - show login button
  if (!profile || !user) {
    return (
      <div className="flex items-center gap-2 pl-3 border-l border-border">
        <a
          href="/login"
          className="text-xs px-3 py-1.5 bg-brand-primary text-white rounded-sm hover:bg-brand-primary/90 transition-colors font-medium"
        >
          Đăng nhập
        </a>
      </div>
    );
  }

  const roleLabels: Record<string, string> = {
    clinician: 'Clinician',
    radiologist: 'Radiologist',
    researcher: 'Researcher',
    admin: 'Admin',
  };

  const initials = profile.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 pl-3 border-l border-border hover:bg-background-secondary transition-colors rounded-sm px-2 py-1"
      >
        <div className="text-right hidden sm:block">
          <p className="text-xs font-medium text-text-primary leading-tight">{profile.full_name}</p>
          <p className="text-[10px] text-text-tertiary leading-tight">
            {profile.department || 'Nhi khoa'} · {roleLabels[profile.role] || profile.role}
          </p>
        </div>
        <div className="w-7 h-7 bg-brand-light rounded-sm flex items-center justify-center shrink-0">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full rounded-sm object-cover" />
          ) : (
            <span className="text-[10px] font-bold text-brand-primary">{initials}</span>
          )}
        </div>
        <ChevronDown className={`w-3 h-3 text-text-tertiary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-1 w-56 bg-surface border border-border rounded-sm shadow-lg z-50"
          >
            <div className="p-3 border-b border-border">
              <p className="text-xs font-medium text-text-primary">{profile.full_name}</p>
              <p className="text-[10px] text-text-tertiary mt-0.5">{profile.email}</p>
            </div>

            <div className="py-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  // Navigate to profile page (will be implemented by agentFE)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-background-secondary transition-colors"
              >
                <UserCircle className="w-3.5 h-3.5" />
                Thông tin cá nhân
              </button>
              <button
                onClick={() => {
                  setIsOpen(false);
                  // Navigate to settings page (will be implemented by agentFE)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-background-secondary transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                Cài đặt
              </button>
            </div>

            <div className="border-t border-border py-1">
              <button
                onClick={async () => {
                  setIsOpen(false);
                  await signOut();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-semantic-error hover:bg-semantic-error/10 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Đăng xuất
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Header() {
  return (
    <header className="h-12 border-b border-border bg-surface flex items-center px-4 gap-4 shrink-0">
      {/* Left — brand */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-brand-primary font-bold text-sm tracking-tight">WebRAG</span>
          <span className="text-[10px] px-1 py-0.5 bg-brand-light text-brand-primary rounded-sm font-medium leading-none">
            MVP
          </span>
          <span className="text-[10px] px-1 py-0.5 bg-background-tertiary text-text-tertiary rounded-sm font-medium leading-none border border-border">
            TRIPOD+AI
          </span>
        </div>
      </div>

      <div className="w-px h-5 bg-border shrink-0" />

      {/* Center — system status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Database className="w-3 h-3 text-text-tertiary" />
          <StatusDot ok={true} label="Supabase" />
        </div>
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3 h-3 text-text-tertiary" />
          <StatusDot ok={true} label="CAE" />
          <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-background-tertiary text-text-tertiary border border-border font-mono">
            MiMo token-plan
          </span>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right — lang + user */}
      <div className="flex items-center gap-3">
        <select
          className="text-xs border border-border bg-background rounded-sm px-1.5 py-1 text-text-secondary h-7 cursor-pointer"
          defaultValue="vi"
        >
          <option value="vi">VI</option>
          <option value="en">EN</option>
        </select>

        <UserMenu />
      </div>
    </header>
  );
}
