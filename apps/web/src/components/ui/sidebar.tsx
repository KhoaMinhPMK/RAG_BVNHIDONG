'use client';

import { LayoutList, BookOpen, Settings, Circle, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  {
    label: 'Danh sách ca',
    description: 'Worklist — tất cả episode',
    href: '/',
    icon: LayoutList,
    exact: true,
    roles: ['clinician', 'radiologist', 'researcher', 'admin'], // All authenticated users
  },
  {
    label: 'Kho Tri thức',
    description: 'Quản lý tài liệu y khoa',
    href: '/knowledge',
    icon: BookOpen,
    exact: false,
    roles: ['clinician', 'radiologist', 'researcher', 'admin'], // All authenticated users
  },
  {
    label: 'Quản trị',
    description: 'RBAC · Audit log · Cấu hình',
    href: '/admin',
    icon: Settings,
    exact: false,
    roles: ['admin'], // Admin only
  },
];

const systemInfo = [
  { label: 'Supabase', status: 'ok', detail: 'pgvector · connected' },
  { label: 'Ollama', status: 'ok', detail: 'qwen2.5:7b · ~54 tok/s' },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { role, loading } = useAuth();

  function isActive(item: typeof navItems[0]) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  // Filter nav items based on user role
  // All authenticated users can see all items since middleware handles routing
  const visibleNavItems = navItems.filter(item => {
    if (loading) return false;
    if (!role) return false;
    return item.roles.includes(role);
  });

  return (
    <aside
      className={`bg-surface border-r border-border flex flex-col shrink-0 transition-all duration-200 ${
        collapsed ? 'w-14' : 'w-56'
      }`}
    >
      {/* New case CTA */}
      <div className={`p-2 border-b border-border ${collapsed ? 'flex justify-center' : ''}`}>
        <Link
          href="/cases/new"
          className={`flex items-center gap-2 bg-brand-primary text-white rounded-sm text-xs font-semibold transition-opacity hover:opacity-90 ${
            collapsed ? 'w-9 h-9 justify-center' : 'px-3 py-2'
          }`}
          title={collapsed ? 'Tạo ca mới' : undefined}
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          {!collapsed && <span>Tạo ca mới</span>}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {!collapsed && (
          <p className="px-3 mb-1 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
            Điều hướng
          </p>
        )}
        <ul className="space-y-0.5 px-1.5">
          {visibleNavItems.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-start gap-2.5 px-2 py-2 rounded-sm text-sm transition-colors group ${
                    active
                      ? 'bg-brand-light text-brand-primary'
                      : 'hover:bg-background-secondary'
                  }`}
                >
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${active ? 'text-brand-primary' : 'text-text-tertiary group-hover:text-text-primary'}`} />
                  {!collapsed && (
                    <div className="min-w-0">
                      <p className={`text-xs font-medium leading-tight truncate ${active ? 'text-brand-primary' : 'text-text-primary'}`}>
                        {item.label}
                      </p>
                      <p className="text-[10px] text-text-tertiary leading-tight mt-0.5 truncate">
                        {item.description}
                      </p>
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-border px-1.5 py-1.5">
        <button
          onClick={onToggle}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-xs text-text-secondary hover:bg-background-secondary transition-colors"
          title={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        >
          {collapsed
            ? <ChevronRight className="w-3.5 h-3.5 mx-auto" />
            : <>
                <span className="text-[10px] font-medium flex-1 text-left">Thu gọn</span>
                <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
              </>
          }
        </button>
      </div>

      {/* System status */}
      <div className={`border-t border-border ${collapsed ? 'p-1.5' : 'p-3'}`}>
        {!collapsed ? (
          <>
            <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-2">System</p>
            <div className="space-y-1.5">
              {systemInfo.map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Circle className={`w-1.5 h-1.5 fill-current ${s.status === 'ok' ? 'text-semantic-success' : 'text-semantic-error'}`} />
                    <span className="text-[10px] text-text-secondary font-medium">{s.label}</span>
                  </div>
                  <span className="text-[10px] text-text-tertiary font-mono truncate max-w-24 text-right">{s.detail}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-border">
              <p className="text-[10px] text-text-tertiary">v0.1.0 · TRIPOD+AI</p>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            {systemInfo.map((s) => (
              <Circle key={s.label} title={`${s.label}: ${s.detail}`}
                className={`w-1.5 h-1.5 fill-current ${s.status === 'ok' ? 'text-semantic-success' : 'text-semantic-error'}`} />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
