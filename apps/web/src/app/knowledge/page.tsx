import { Upload, BookOpen, Check, Clock, AlertTriangle, Search, Filter } from 'lucide-react';

const mockDocs = [
  { id: 1, title: 'WHO Pneumonia Guidelines 2023', source: 'WHO', type: 'Guideline', chunks: 142, status: 'active', updated: '2024-01-10' },
  { id: 2, title: 'BTS Paediatric Pneumonia 2022', source: 'BTS', type: 'Protocol', chunks: 89, status: 'active', updated: '2024-01-08' },
  { id: 3, title: 'BYT — Viêm phổi trẻ em 2020', source: 'BYT VN', type: 'Protocol', chunks: 67, status: 'active', updated: '2023-12-15' },
  { id: 4, title: 'PCXR Post-processing Spec v1.2', source: 'Internal', type: 'SOP', chunks: 0, status: 'pending', updated: '2024-01-14' },
];

const statusConfig: Record<string, { label: string; color: string; icon: typeof Check }> = {
  active: { label: 'Active', color: 'text-semantic-success', icon: Check },
  pending: { label: 'Chờ duyệt', color: 'text-semantic-warning', icon: Clock },
  error: { label: 'Lỗi', color: 'text-semantic-error', icon: AlertTriangle },
};

export default function KnowledgePage() {
  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 border border-border rounded-sm bg-surface px-3 py-2">
          <Search className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
          <input
            type="text"
            placeholder="Tìm kiếm tài liệu..."
            disabled
            className="flex-1 text-xs text-text-secondary placeholder:text-text-tertiary bg-transparent"
          />
        </div>
        <button disabled className="flex items-center gap-1.5 text-xs px-3 py-2 border border-border rounded-sm text-text-secondary bg-surface opacity-60 cursor-not-allowed">
          <Filter className="w-3.5 h-3.5" />
          Lọc
        </button>
        <button disabled className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-sm bg-brand-primary text-white font-semibold opacity-50 cursor-not-allowed">
          <Upload className="w-3.5 h-3.5" />
          Tải lên tài liệu
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Tổng tài liệu', value: '4', sub: '3 active · 1 pending' },
          { label: 'Tổng chunks', value: '298', sub: 'pgvector embeddings' },
          { label: 'Nguồn', value: '4', sub: 'WHO · BTS · BYT · Internal' },
          { label: 'Queue', value: '0', sub: 'Document sourcing jobs' },
        ].map((s) => (
          <div key={s.label} className="border border-border rounded-sm bg-surface px-3 py-2">
            <p className="text-[10px] text-text-tertiary font-medium">{s.label}</p>
            <p className="text-base font-bold text-text-primary mt-0.5">{s.value}</p>
            <p className="text-[10px] text-text-tertiary font-mono">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Documents table */}
      <div className="border border-border rounded-sm bg-surface flex-1 flex flex-col">
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border">
          <BookOpen className="w-3.5 h-3.5 text-text-tertiary" />
          <span className="text-xs font-semibold text-text-primary">Kho tài liệu</span>
          <span className="text-[10px] text-text-tertiary ml-auto">4 tài liệu · Mock data</span>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[1fr_80px_72px_64px_80px_80px] gap-2 px-3 py-2 border-b border-border bg-background-secondary">
          {['Tên tài liệu', 'Nguồn', 'Loại', 'Chunks', 'Cập nhật', 'Trạng thái'].map((h) => (
            <span key={h} className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider truncate">
              {h}
            </span>
          ))}
        </div>

        {/* Table rows */}
        <div className="flex-1 overflow-y-auto divide-y divide-border opacity-70">
          {mockDocs.map((doc) => {
            const s = statusConfig[doc.status];
            const Icon = s.icon;
            return (
              <div key={doc.id} className="grid grid-cols-[1fr_80px_72px_64px_80px_80px] gap-2 px-3 py-2.5 hover:bg-background-secondary transition-colors items-center">
                <p className="text-xs font-medium text-text-primary truncate">{doc.title}</p>
                <p className="text-[11px] text-text-secondary truncate">{doc.source}</p>
                <span className="text-[10px] px-1.5 py-0.5 bg-background-tertiary border border-border rounded-sm text-text-tertiary w-fit">
                  {doc.type}
                </span>
                <p className="text-[11px] font-mono text-text-tertiary">
                  {doc.chunks > 0 ? doc.chunks : '—'}
                </p>
                <p className="text-[10px] text-text-tertiary font-mono">{doc.updated}</p>
                <div className={`flex items-center gap-1 ${s.color}`}>
                  <Icon className="w-3 h-3" />
                  <span className="text-[10px] font-medium">{s.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-text-tertiary text-center">
        Document Sourcing Agent + upload pipeline chưa implement · Coming Sprint 2
      </p>
    </div>
  );
}
