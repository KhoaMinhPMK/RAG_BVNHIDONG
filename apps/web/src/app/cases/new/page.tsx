'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, ImageIcon, X, Check, ChevronRight, Loader2, File } from 'lucide-react';
import { createEpisode } from '@/lib/api/client';
import { PageTransition } from '@/components/ui/page-transition';
import { FileItemSkeleton, ProgressSkeleton } from '@/components/ui/loading-skeleton';

interface PatientInfo {
  age: string;
  gender: string;
  pid: string;
  date: string;
  ward: string;
  symptoms: string;
  days: string;
  spo2: string;
  temp: string;
  crp: string;
  wbc: string;
}

interface UploadFile {
  id: string;
  name: string;
  size: number;
  info: PatientInfo;
}

const blankInfo = (): PatientInfo => ({
  age: '', gender: 'Nam', pid: '', date: new Date().toISOString().slice(0, 10),
  ward: '', symptoms: '', days: '', spo2: '', temp: '', crp: '', wbc: '',
});

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function NewCasePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    const allowed = ['image/png', 'image/jpeg', 'application/dicom'];
    const added: UploadFile[] = [];
    for (const file of Array.from(incoming)) {
      if (file.size > 10 * 1024 * 1024) continue;
      if (!allowed.includes(file.type) && !file.name.endsWith('.dcm')) continue;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      added.push({ id, name: file.name, size: file.size, info: blankInfo() });
    }
    setFiles(prev => {
      const next = [...prev, ...added];
      if (next.length > 0 && activeId === null) setActiveId(next[0].id);
      return next;
    });
    if (added.length > 0 && activeId === null) setActiveId(added[0].id);
  }, [activeId]);

  const removeFile = (id: string) => {
    setFiles(prev => {
      const next = prev.filter(f => f.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
  };

  const updateInfo = (id: string, patch: Partial<PatientInfo>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, info: { ...f.info, ...patch } } : f));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleSubmit = async () => {
    if (!activeFile) return;
    const { info } = activeFile;
    if (!info.pid || !info.date) {
      setUploadError('Vui lòng điền Mã BN và Ngày nhập viện.');
      return;
    }
    setSubmitting(true);
    setUploadStatus('uploading');
    setUploadProgress(30);
    setUploadError(null);

    try {
      const res = await createEpisode({
        patient_ref: info.pid,
        age: info.age || undefined,
        gender: info.gender || undefined,
        date: info.date,
        symptoms: info.symptoms || undefined,
        spo2: info.spo2 || undefined,
        crp: info.crp || undefined,
      });

      setUploadProgress(100);
      if (res.success && res.episode) {
        setUploadStatus('done');
        setTimeout(() => {
          router.push(`/cases/${res.episode.episode_id}?step=detection`);
        }, 400);
      } else {
        setUploadStatus('error');
        setUploadError(res.error?.message || 'Không thể tạo ca. Vui lòng thử lại.');
        setSubmitting(false);
      }
    } catch {
      setUploadStatus('error');
      setUploadError('Lỗi kết nối tới server. Vui lòng thử lại.');
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const activeFile = files.find(f => f.id === activeId);
  const info = activeFile?.info;
  const getInfoValue = (field: keyof PatientInfo) => info?.[field] ?? '';

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Worklist
        </Link>
        <ChevronRight className="w-3 h-3 text-text-tertiary" />
        <span className="text-xs font-semibold text-text-primary">Tạo ca mới</span>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0 text-[10px]">
        {[
          { n: 1, label: 'Tải ảnh & thông tin' },
          { n: 2, label: 'Chạy PCXR detection' },
          { n: 3, label: 'Xem xét kết quả' },
        ].map((s, i, arr) => (
          <div key={s.n} className="flex items-center gap-0">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm ${s.n === 1 ? 'bg-brand-primary text-white' : 'bg-background-secondary border border-border text-text-tertiary'}`}>
              <span className="font-bold">{s.n}</span>
              <span className={s.n === 1 ? 'text-white' : 'text-text-tertiary'}>{s.label}</span>
            </div>
            {i < arr.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-text-tertiary mx-0.5" />}
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        {/* Left — file list + drop zone */}
        <div className="w-64 shrink-0 flex flex-col gap-3">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-sm cursor-pointer transition-colors flex flex-col items-center justify-center py-8 gap-2 ${
              dragging ? 'border-brand-primary bg-brand-light/10' : 'border-border bg-surface hover:border-brand-primary hover:bg-background-secondary'
            }`}
          >
            <div className="w-10 h-10 rounded-sm border border-border bg-background-secondary flex items-center justify-center">
              <Upload className="w-5 h-5 text-text-tertiary" />
            </div>
            <div className="text-center px-3">
              <p className="text-xs font-medium text-text-primary">Kéo thả ảnh vào đây</p>
              <p className="text-[10px] text-text-tertiary mt-0.5">hoặc nhấn để chọn file</p>
            </div>
            <div className="flex items-center gap-1.5">
              {['PNG', 'JPG', 'DICOM'].map(t => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 bg-background-tertiary border border-border rounded-sm text-text-tertiary">{t}</span>
              ))}
              <span className="text-[10px] text-text-tertiary">· ≤10 MB</span>
            </div>
            <input
              ref={inputRef} type="file" multiple
              accept="image/png,image/jpeg,.dcm"
              className="hidden"
              onChange={e => addFiles(e.target.files)}
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="border border-border rounded-sm bg-surface flex flex-col">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Đã chọn ({files.length})</span>
              </div>
              <div className="divide-y divide-border max-h-64 overflow-y-auto">
                {files.map(f => {
                  const isActive = f.id === activeId;
                  const filled = Object.values(f.info).filter(Boolean).length;
                  const total = Object.keys(f.info).length;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setActiveId(f.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${isActive ? 'bg-brand-light/10' : 'hover:bg-background-secondary'}`}
                    >
                      <File className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-brand-primary' : 'text-text-tertiary'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] font-medium truncate ${isActive ? 'text-brand-primary' : 'text-text-primary'}`}>{f.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-text-tertiary">{formatSize(f.size)}</span>
                          <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                            <div className="h-full bg-brand-primary/50 rounded-full transition-all" style={{ width: `${(filled / total) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); removeFile(f.id); }}
                        className="w-4 h-4 flex items-center justify-center rounded-sm hover:bg-border text-text-tertiary hover:text-text-primary transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Submit */}
          {files.length > 0 && (
            <div className="flex flex-col gap-2">
              {uploadStatus === 'uploading' && (
                <div className="border border-border rounded-sm bg-surface p-3 space-y-2">
                  <ProgressSkeleton />
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-primary" />
                    <span className="text-[10px] text-text-secondary">Đang tải lên... {uploadProgress}%</span>
                  </div>
                </div>
              )}
              {uploadStatus === 'processing' && (
                <div className="border border-semantic-warning/30 rounded-sm bg-semantic-warning/5 p-3 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-semantic-warning" />
                  <span className="text-[10px] text-text-secondary">Đang xử lý ảnh... Vui lòng đợi</span>
                </div>
              )}
              {uploadStatus === 'error' && (
                <div className="border border-semantic-error/30 rounded-sm bg-semantic-error/5 p-3 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-semantic-error">Lỗi tải lên: {uploadError}</span>
                  <button
                    onClick={handleSubmit}
                    className="text-[10px] px-2 py-1 bg-semantic-error text-white rounded-sm hover:opacity-90"
                  >
                    Thử lại
                  </button>
                </div>
              )}
              <button
                onClick={handleSubmit}
                disabled={submitting || uploadStatus === 'uploading' || uploadStatus === 'processing'}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-primary text-white text-xs font-semibold rounded-sm hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {submitting ? 'Đang tạo ca...' : `Tạo ${files.length} ca & chạy phân tích`}
              </button>
            </div>
          )}
        </div>

        {/* Right — info form for active file */}
        <div className="flex-1 min-w-0">
          {!activeFile ? (
            <div className="border border-border rounded-sm bg-surface h-full flex items-center justify-center p-12">
              <div className="text-center">
                <ImageIcon className="w-10 h-10 text-text-tertiary mx-auto" />
                <p className="text-sm font-medium text-text-secondary mt-3">Chưa có ảnh nào</p>
                <p className="text-xs text-text-tertiary mt-1">Kéo thả hoặc chọn file ảnh X-quang để bắt đầu</p>
              </div>
            </div>
          ) : (
            <div className="border border-border rounded-sm bg-surface flex flex-col">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                <File className="w-3.5 h-3.5 text-text-tertiary" />
                <span className="text-xs font-semibold text-text-primary">{activeFile.name}</span>
                <span className="text-[10px] text-text-tertiary ml-auto">{formatSize(activeFile.size)}</span>
              </div>

              <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-4">
                {/* Patient info */}
                <div className="col-span-2">
                  <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-3">Thông tin bệnh nhân</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: 'pid',  label: 'Mã BN',    placeholder: 'BN-2024-...' },
                      { key: 'age',  label: 'Tuổi',     placeholder: 'e.g. 3' },
                      { key: 'date', label: 'Ngày chụp', type: 'date' },
                    ].map(({ key, label, placeholder, type }) => (
                      <div key={key}>
                        <label className="text-[10px] font-medium text-text-tertiary block mb-1">{label}</label>
                        <input type={type ?? 'text'} value={getInfoValue(key as keyof PatientInfo)}
                          onChange={e => updateInfo(activeFile.id, { [key]: e.target.value } as Partial<PatientInfo>)}
                          placeholder={placeholder}
                          className="w-full text-xs border border-border rounded-sm px-2.5 py-1.5 bg-background focus:outline-none focus:border-brand-primary text-text-primary placeholder:text-text-tertiary"
                        />
                      </div>
                    ))}
                    <div>
                      <label className="text-[10px] font-medium text-text-tertiary block mb-1">Giới tính</label>
                      <select value={info?.gender} onChange={e => updateInfo(activeFile.id, { gender: e.target.value })}
                        className="w-full text-xs border border-border rounded-sm px-2.5 py-1.5 bg-background focus:outline-none focus:border-brand-primary text-text-primary">
                        <option>Nam</option><option>Nữ</option><option>Khác</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-text-tertiary block mb-1">Khoa</label>
                      <input value={info?.ward} onChange={e => updateInfo(activeFile.id, { ward: e.target.value })}
                        placeholder="Nhi hô hấp"
                        className="w-full text-xs border border-border rounded-sm px-2.5 py-1.5 bg-background focus:outline-none focus:border-brand-primary text-text-primary placeholder:text-text-tertiary"
                      />
                    </div>
                  </div>
                </div>

                {/* Clinical */}
                <div>
                  <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-3">Lâm sàng</p>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] font-medium text-text-tertiary block mb-1">Triệu chứng chính</label>
                      <textarea value={info?.symptoms} onChange={e => updateInfo(activeFile.id, { symptoms: e.target.value })}
                        placeholder="Sốt, ho, thở nhanh..."
                        rows={2}
                        className="w-full text-xs border border-border rounded-sm px-2.5 py-1.5 bg-background focus:outline-none focus:border-brand-primary text-text-primary placeholder:text-text-tertiary resize-none"
                      />
                    </div>
                    {[
                      { key: 'days', label: 'Số ngày bệnh',  placeholder: 'e.g. 3',   unit: 'ngày' },
                      { key: 'spo2', label: 'SpO₂',          placeholder: 'e.g. 94',   unit: '%' },
                      { key: 'temp', label: 'Nhiệt độ',      placeholder: 'e.g. 38.5', unit: '°C' },
                    ].map(({ key, label, placeholder, unit }) => (
                      <div key={key}>
                        <label className="text-[10px] font-medium text-text-tertiary block mb-1">{label}</label>
                        <div className="relative">
                          <input value={getInfoValue(key as keyof PatientInfo)}
                            onChange={e => updateInfo(activeFile.id, { [key]: e.target.value } as Partial<PatientInfo>)}
                            placeholder={placeholder}
                            className="w-full text-xs border border-border rounded-sm px-2.5 py-1.5 pr-8 bg-background focus:outline-none focus:border-brand-primary text-text-primary placeholder:text-text-tertiary"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-text-tertiary">{unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lab */}
                <div>
                  <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-3">Xét nghiệm</p>
                  <div className="space-y-2">
                    <p className="text-[10px] text-text-tertiary italic">Không bắt buộc · Cải thiện độ chính xác giải thích</p>
                    {[
                      { key: 'crp', label: 'CRP',       placeholder: 'e.g. 45.2', unit: 'mg/L' },
                      { key: 'wbc', label: 'WBC',       placeholder: 'e.g. 14.5', unit: '×10³/μL' },
                    ].map(({ key, label, placeholder, unit }) => (
                      <div key={key}>
                        <label className="text-[10px] font-medium text-text-tertiary block mb-1">{label}</label>
                        <div className="relative">
                          <input value={getInfoValue(key as keyof PatientInfo)}
                            onChange={e => updateInfo(activeFile.id, { [key]: e.target.value } as Partial<PatientInfo>)}
                            placeholder={placeholder}
                            className="w-full text-xs border border-border rounded-sm px-2.5 py-1.5 pr-16 bg-background focus:outline-none focus:border-brand-primary text-text-primary placeholder:text-text-tertiary"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-text-tertiary">{unit}</span>
                        </div>
                      </div>
                    ))}

                    {/* File completeness indicator */}
                    <div className="mt-4 pt-3 border-t border-border">
                      <p className="text-[10px] font-semibold text-text-tertiary mb-2">Trạng thái điền thông tin</p>
                      {files.map(f => {
                        const filled = Object.values(f.info).filter(Boolean).length;
                        const total = Object.keys(f.info).length;
                        const pct = Math.round((filled / total) * 100);
                        return (
                          <div key={f.id} className="flex items-center gap-2 mb-1.5">
                            {pct === 100
                              ? <Check className="w-3 h-3 text-semantic-success shrink-0" />
                              : <div className="w-3 h-3 rounded-full border border-border shrink-0" />
                            }
                            <p className="text-[10px] text-text-secondary truncate flex-1">{f.name}</p>
                            <span className="text-[10px] text-text-tertiary font-mono">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Notice */}
                <div className="col-span-2 bg-background-secondary border border-border rounded-sm px-3 py-2">
                  <p className="text-[10px] text-text-tertiary leading-relaxed">
                    Ảnh sẽ được đưa qua PCXR detection pipeline · Kết quả detection trong ~5 giây
                    · Thông tin lâm sàng được dùng bởi Explainer Agent để giải thích ngữ cảnh
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </PageTransition>
  );
}
