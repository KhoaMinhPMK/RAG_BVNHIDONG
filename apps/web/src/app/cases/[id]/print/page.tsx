'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

function PrintPageContent() {
  const sp = useSearchParams();

  const imageId   = sp?.get('imageId')   ?? '—';
  const age       = sp?.get('age')       ?? '—';
  const gender    = sp?.get('gender')    ?? '—';
  const date      = sp?.get('date')      ?? '—';
  const episodeId = sp?.get('episodeId') ?? '—';
  const isOfficial = sp?.get('official') === '1';
  const generatedAt = new Date().toLocaleString('vi-VN');

  const decode = (key: string) => {
    const raw = sp?.get(key);
    return raw ? decodeURIComponent(raw) : 'Chưa ghi nhận trong hồ sơ tại thời điểm lập báo cáo.';
  };

  const sections = [
    { title: 'II. CHỈ ĐỊNH VÀ DỮ LIỆU LÂM SÀNG',   key: null, sub: [
        { label: 'Lý do chỉ định', value: decode('indication') },
        { label: 'Sinh hiệu',      value: decode('vitals') },
        { label: 'Xét nghiệm',     value: decode('labs') },
      ]
    },
    { title: 'III. MÔ TẢ HÌNH ẢNH',        key: 'findings',       sub: [] },
    { title: 'IV. KẾT LUẬN',               key: 'impression',     sub: [] },
    { title: 'V. ĐỀ NGHỊ / HƯỚNG XỬ TRÍ', key: 'recommendation', sub: [] },
    { title: 'VI. GHI CHÚ BÁC SĨ',         key: 'doctorNote',     sub: [] },
  ];

  const detectionsRaw = decode('detections');
  let detections: Array<{ label: string; confidence: string }> = [];
  try { detections = JSON.parse(detectionsRaw); } catch { /* ok */ }

  const fieldsRaw = decode('fields');
  let auditFields: Array<{ label: string; source: string; status: string; provenance: number; value: string }> = [];
  try { auditFields = JSON.parse(fieldsRaw); } catch { /* ok */ }

  const imgSrc = sp?.get('imgSrc') ?? '';

  useEffect(() => {
    const timeout = setTimeout(() => window.print(), 600);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <>
      <style>{`
        @page {
          size: A4;
          margin: 20mm 15mm 20mm 30mm;
        }
        * { box-sizing: border-box; }
        body {
          font-family: 'Times New Roman', Times, serif;
          font-size: 13pt;
          color: #111;
          background: #fff;
          margin: 0;
        }
        .no-print { display: flex; }
        @media print {
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
        }
        h1.doc-title {
          font-size: 16pt;
          font-weight: 700;
          text-align: center;
          text-transform: uppercase;
          margin: 8pt 0 4pt;
        }
        .status-line {
          text-align: center;
          font-size: 10pt;
          font-weight: 700;
          margin-bottom: 12pt;
        }
        .section-title {
          font-size: 12pt;
          font-weight: 700;
          margin: 12pt 0 4pt;
        }
        p { margin: 2pt 0 6pt; line-height: 1.5; }
        table.admin-table {
          width: 100%;
          border-collapse: collapse;
          margin: 8pt 0 12pt;
          font-size: 11pt;
        }
        table.admin-table td {
          border: 1px solid #94a3b8;
          padding: 5pt 7pt;
          vertical-align: top;
        }
        table.audit-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10pt;
          margin: 8pt 0;
        }
        table.audit-table th {
          border: 1px solid #94a3b8;
          background: #f1f5f9;
          padding: 4pt 5pt;
          text-align: left;
          font-weight: 700;
        }
        table.audit-table td {
          border: 1px solid #cbd5e1;
          padding: 4pt 5pt;
          vertical-align: top;
        }
        .sign-block {
          margin-top: 20pt;
          display: flex;
          justify-content: space-around;
          gap: 16pt;
        }
        .sign-col { width: 44%; text-align: center; }
        .sign-col .role { font-size: 11pt; font-weight: 700; text-transform: uppercase; letter-spacing: .3pt; margin-bottom: 2pt; }
        .sign-col .note { font-size: 9.5pt; color: #475569; font-style: italic; margin: 0; }
        .sign-col .date-line { font-size: 9.5pt; color: #475569; margin-bottom: 2pt; }
        .sign-line {
          border-top: 1px solid #334155;
          margin-top: 32pt;
          padding-top: 4pt;
          font-size: 10pt;
          text-align: center;
        }
        .header-row {
          display: flex;
          justify-content: space-between;
          font-size: 11pt;
          margin-bottom: 2pt;
        }
        .draft-watermark {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-40deg);
          font-size: 72pt;
          font-weight: 900;
          color: rgba(0,0,0,0.04);
          white-space: nowrap;
          pointer-events: none;
          z-index: 0;
        }
        .xray-block {
          display: flex; gap: 16pt; align-items: flex-start;
          margin: 6pt 0 12pt;
          background: #f8fafc; border: 1px solid #e2e8f0;
          border-radius: 3pt; padding: 10pt;
        }
        .xray-fig { flex-shrink: 0; text-align: center; }
        .xray-fig img {
          width: 96pt; height: 96pt; object-fit: cover;
          border: 1px solid #94a3b8; display: block; border-radius: 2pt;
        }
        .xray-fig figcaption { font-size: 7.5pt; color: #64748b; margin-top: 4pt; font-style: italic; }
        .xray-text { flex: 1; font-size: 12pt; line-height: 1.65; }
      `}</style>

      {/* Print preview toolbar — hidden when printing */}
      <div className="no-print" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: '#1e293b', color: '#e2e8f0',
        padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12,
        fontSize: 13, borderBottom: '1px solid #334155',
      }}>
        <span style={{ fontWeight: 600 }}>Xem trước PDF · {imageId}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>Bấm In để lưu PDF từ hộp thoại in</span>
        <button
          onClick={() => window.print()}
          style={{
            background: '#2563eb', color: '#fff', border: 'none',
            borderRadius: 4, padding: '6px 14px', fontWeight: 600,
            cursor: 'pointer', fontSize: 13,
          }}
        >
          In / Lưu PDF
        </button>
        <button
          onClick={() => window.close()}
          style={{
            background: 'transparent', color: '#94a3b8', border: '1px solid #334155',
            borderRadius: 4, padding: '6px 10px', cursor: 'pointer', fontSize: 13,
          }}
        >
          Đóng
        </button>
      </div>

      {!isOfficial && <div className="draft-watermark">NHÁP</div>}

      <div style={{ paddingTop: 52 }}>
        {/* ── PAGE 1: OFFICIAL REPORT ── */}
        <div className="header-row">
          <div>
            <strong>BỆNH VIỆN NHI TRUNG ƯƠNG</strong><br />
            <span style={{ fontSize: 11 }}>Khoa Chẩn đoán hình ảnh</span>
          </div>
          <div style={{ textAlign: 'right', fontSize: 11 }}>
            Số phiếu: XR-{imageId.toUpperCase()}<br />
            Mã hồ sơ: EP-{episodeId}
          </div>
        </div>
        <hr style={{ borderTop: '1.5px solid #64748b', margin: '6pt 0' }} />

        <h1 className="doc-title">Phiếu Báo Cáo X-Quang Lồng Ngực</h1>
        <div
          className="status-line"
          style={{ color: isOfficial ? '#166534' : '#b45309' }}
        >
          {isOfficial ? 'BẢN CHÍNH THỨC — ĐÃ DUYỆT' : 'BẢN NHÁP — CHƯA CÓ GIÁ TRỊ PHÁP LÝ'}
        </div>

        <div className="section-title" style={{ marginTop: 0 }}>I. THÔNG TIN HÀNH CHÍNH</div>
        <table className="admin-table">
          <tbody>
            <tr>
              <td><strong>Bệnh nhân:</strong> {age} · {gender}</td>
              <td><strong>Mã hình:</strong> {imageId}</td>
            </tr>
            <tr>
              <td><strong>Ngày chụp:</strong> {date}</td>
              <td><strong>Tạo báo cáo:</strong> {generatedAt}</td>
            </tr>
            <tr>
              <td><strong>Nguồn:</strong> CAE · WebRAG AI Engine</td>
              <td><strong>Trạng thái:</strong> {isOfficial ? 'Chính thức' : 'Nháp'}</td>
            </tr>
          </tbody>
        </table>

        {sections.map((sec) => (
          <div key={sec.title}>
            <div className="section-title">{sec.title}</div>
            {sec.sub.map((row) => (
              <p key={row.label}><strong>{row.label}:</strong> {row.value}</p>
            ))}
            {sec.key && (
              sec.key === 'findings' && imgSrc ? (
                <div className="xray-block">
                  <figure className="xray-fig">
                    <img src={imgSrc} alt="X-quang" />
                    <figcaption>Hình X-quang · {imageId}</figcaption>
                  </figure>
                  <div className="xray-text">{decode(sec.key)}</div>
                </div>
              ) : (
                <p>{decode(sec.key)}</p>
              )
            )}
          </div>
        ))}

        <div className="sign-block">
          <div className="sign-col">
            <p className="date-line">{generatedAt}</p>
            <p className="role">Người lập phiếu</p>
            <p className="note">(Ký, ghi rõ họ tên)</p>
            <div className="sign-line" />
          </div>
          <div className="sign-col">
            <p className="date-line">&nbsp;</p>
            <p className="role">Bác sĩ chẩn đoán hình ảnh</p>
            <p className="note">(Ký, ghi rõ họ tên)</p>
            <div className="sign-line">
              {isOfficial && (
                <strong style={{ color: '#166534' }}>ĐÃ KÝ XÁC NHẬN</strong>
              )}
            </div>
          </div>
        </div>

        {/* ── PAGE 2: AI APPENDIX ── */}
        <div className="page-break" />
        <div className="section-title" style={{ fontSize: 14 }}>PHỤ LỤC KỸ THUẬT AI (NỘI BỘ)</div>
        <p style={{ fontSize: 11 }}>
          Model: CAE → Draft composer &nbsp;|&nbsp; Image ID: {imageId} &nbsp;|&nbsp; Generated: {generatedAt}
        </p>

        <div className="section-title" style={{ fontSize: 11 }}>1. Detection summary</div>
        <table className="audit-table">
          <thead>
            <tr>
              <th>#</th><th>Finding</th><th>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {detections.length > 0
              ? detections.map((d, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{d.label}</td>
                    <td>{d.confidence}</td>
                  </tr>
                ))
              : <tr><td colSpan={3}>Không có detection.</td></tr>
            }
          </tbody>
        </table>

        <div className="section-title" style={{ fontSize: 11 }}>2. Field provenance &amp; review states</div>
        <table className="audit-table">
          <thead>
            <tr>
              <th>#</th><th>Field</th><th>Source</th><th>Status</th><th>Prov.</th><th>Value (preview)</th>
            </tr>
          </thead>
          <tbody>
            {auditFields.length > 0
              ? auditFields.map((f, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{f.label}</td>
                    <td>{f.source}</td>
                    <td>{f.status}</td>
                    <td>{f.provenance}</td>
                    <td style={{ maxWidth: 200, wordBreak: 'break-word' }}>
                      {(f.value ?? '').slice(0, 120)}{(f.value ?? '').length > 120 ? '…' : ''}
                    </td>
                  </tr>
                ))
              : <tr><td colSpan={6}>Không có field.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function PrintPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, fontFamily: 'sans-serif' }}>Đang tải...</div>}>
      <PrintPageContent />
    </Suspense>
  );
}
