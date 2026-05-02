import { Users, ShieldCheck, FileText, Activity, Settings, Circle } from 'lucide-react';

const roles = [
  { role: 'clinician', label: 'Clinician', count: 3, perms: ['query', 'explain', 'draft'] },
  { role: 'radiologist', label: 'Radiologist', count: 2, perms: ['query', 'explain', 'draft', 'knowledge.read'] },
  { role: 'researcher', label: 'Researcher', count: 1, perms: ['query', 'knowledge.read'] },
  { role: 'admin', label: 'Admin', count: 1, perms: ['*'] },
];

const mockUsers = [
  { name: 'Bác sỹ A', email: 'bsa@bvnhidong.vn', role: 'clinician', status: 'active', lastSeen: '11:30' },
  { name: 'Bác sỹ B', email: 'bsb@bvnhidong.vn', role: 'radiologist', status: 'active', lastSeen: '10:15' },
  { name: 'Admin', email: 'admin@bvnhidong.vn', role: 'admin', status: 'active', lastSeen: '09:00' },
];

const mockAuditLogs = [
  { time: '11:42', user: 'Bác sỹ A', action: 'query.run', detail: 'viêm phổi nặng tiêu chuẩn nhập viện', status: 'ok' },
  { time: '11:38', user: 'Bác sỹ B', action: 'explain.run', detail: 'PCXR-2024-001 · Consolidation 81%', status: 'ok' },
  { time: '10:22', user: 'Bác sỹ A', action: 'draft.generate', detail: 'BN-2024-001 · PCXR Standard', status: 'ok' },
  { time: '09:15', user: 'Admin', action: 'knowledge.upload', detail: 'WHO Guidelines 2023.pdf', status: 'pending' },
];

const roleColors: Record<string, string> = {
  clinician: 'text-text-secondary',
  radiologist: 'text-text-secondary',
  researcher: 'text-text-secondary',
  admin: 'text-text-primary',
};

export default function AdminPage() {
  return (
    <div className="flex flex-col gap-4">
      {/* System config strip */}
      <div className="border border-border rounded-sm bg-surface px-4 py-2.5 flex items-center gap-6">
        <div className="flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5 text-text-tertiary" />
          <span className="text-xs font-semibold text-text-primary">System Config</span>
        </div>
        {[
          { k: 'LLM Model', v: 'qwen2.5:7b' },
          { k: 'Embedding', v: 'nomic-embed (planned)' },
          { k: 'Vector DB', v: 'Supabase pgvector' },
          { k: 'Max Context', v: '8,192 tokens' },
          { k: 'Temperature', v: '0.3 (RAG mode)' },
        ].map((c) => (
          <div key={c.k} className="flex items-center gap-1.5">
            <span className="text-[10px] text-text-tertiary">{c.k}:</span>
            <span className="text-[10px] font-mono font-semibold text-text-secondary">{c.v}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* RBAC */}
        <div className="border border-border rounded-sm bg-surface flex flex-col">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border">
            <ShieldCheck className="w-3.5 h-3.5 text-text-tertiary" />
            <span className="text-xs font-semibold text-text-primary">RBAC — Phân quyền</span>
          </div>
          <div className="divide-y divide-border flex-1">
            {roles.map((r) => (
              <div key={r.role} className="px-3 py-2.5 flex items-start gap-3">
                <div className="w-5 text-right shrink-0">
                  <span className="text-sm font-bold text-text-primary">{r.count}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${roleColors[r.role]}`}>{r.label}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {r.perms.map((p) => (
                      <span key={p} className="text-[10px] px-1 py-0.5 bg-background-tertiary border border-border rounded-sm text-text-tertiary font-mono">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Users */}
        <div className="border border-border rounded-sm bg-surface flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-text-tertiary" />
              <span className="text-xs font-semibold text-text-primary">Người dùng</span>
            </div>
            <button disabled className="text-[10px] text-brand-primary font-medium opacity-50 cursor-not-allowed">
              + Thêm
            </button>
          </div>
          <div className="divide-y divide-border flex-1">
            {mockUsers.map((u) => (
              <div key={u.email} className="flex items-center gap-3 px-3 py-2.5 opacity-80">
                <Circle className="w-1.5 h-1.5 fill-current text-semantic-success shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{u.name}</p>
                  <p className="text-[10px] text-text-tertiary truncate">{u.email}</p>
                </div>
                <span className={`text-[10px] font-semibold shrink-0 ${roleColors[u.role]}`}>
                  {u.role}
                </span>
                <span className="text-[10px] text-text-tertiary font-mono shrink-0">{u.lastSeen}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Audit log */}
      <div className="border border-border rounded-sm bg-surface">
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border">
          <FileText className="w-3.5 h-3.5 text-text-tertiary" />
          <span className="text-xs font-semibold text-text-primary">Audit Log</span>
          <span className="text-[10px] text-text-tertiary ml-auto">Mock data · Real logs chưa implement</span>
        </div>

        <div className="grid grid-cols-[48px_100px_120px_1fr_56px] gap-2 px-3 py-1.5 border-b border-border bg-background-secondary">
          {['Giờ', 'Người dùng', 'Action', 'Chi tiết', 'Status'].map((h) => (
            <span key={h} className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider truncate">
              {h}
            </span>
          ))}
        </div>

        <div className="divide-y divide-border opacity-80">
          {mockAuditLogs.map((log, i) => (
            <div key={i} className="grid grid-cols-[48px_100px_120px_1fr_56px] gap-2 px-3 py-2 items-center">
              <span className="text-[11px] font-mono text-text-tertiary">{log.time}</span>
              <span className="text-[11px] text-text-secondary truncate">{log.user}</span>
              <span className="text-[10px] font-mono text-text-secondary bg-background-tertiary border border-border px-1 py-0.5 rounded-sm truncate">
                {log.action}
              </span>
              <span className="text-[11px] text-text-tertiary truncate">{log.detail}</span>
              <div className="flex items-center gap-1">
                <Circle className={`w-1.5 h-1.5 fill-current ${log.status === 'ok' ? 'text-semantic-success' : 'text-semantic-warning'}`} />
                <span className={`text-[10px] font-medium ${log.status === 'ok' ? 'text-semantic-success' : 'text-semantic-warning'}`}>
                  {log.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
