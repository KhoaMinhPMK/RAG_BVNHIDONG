'use client';

/**
 * ReportPDF — generates a professional A4 PDF with proper Vietnamese support
 * Uses @react-pdf/renderer with Noto Serif Vietnamese fonts (woff2)
 * Usage: await downloadReportPDF(data)  — triggers instant browser download
 */

import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer';

// ── Register Times New Roman (Windows built-in TTF — full Unicode + Vietnamese) ──
Font.register({
  family: 'TimesRoman',
  fonts: [
    { src: '/fonts/Times-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/Times-Bold.ttf',    fontWeight: 700 },
    { src: '/fonts/Times-Italic.ttf',  fontWeight: 400, fontStyle: 'italic' },
  ],
});

Font.registerHyphenationCallback(word => [word]); // disable hyphenation

// ── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    fontFamily: 'TimesRoman',
    fontSize: 12,
    color: '#111',
    paddingTop: 20,
    paddingBottom: 24,
    paddingLeft: 26,
    paddingRight: 20,
    lineHeight: 1.5,
  },
  // Header (administrative style)
  headRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  headLeft: { width: '44%' },
  headRight: { width: '52%' },
  officeTop: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase' },
  officeSub: { fontSize: 9, marginTop: 1, textTransform: 'uppercase' },
  nationTitle: { fontSize: 11, fontWeight: 700, textAlign: 'center', textTransform: 'uppercase' },
  nationSub: { fontSize: 9.5, textAlign: 'center', marginTop: 1 },
  nationRule: { borderBottomWidth: 1, borderBottomColor: '#111', width: '60%', alignSelf: 'center', marginTop: 3 },
  rule:        { borderBottomWidth: 0.8, borderBottomColor: '#b8b8b8', marginVertical: 6 },
  ruleHeavy:   { borderBottomWidth: 1.2, borderBottomColor: '#666', marginVertical: 4 },
  // Document title
  docCode:     { fontSize: 10, textAlign: 'left', marginBottom: 3 },
  docTitle:    { fontSize: 15, fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', marginTop: 2, marginBottom: 2 },
  docSubtitle: { fontSize: 10, textAlign: 'center', marginBottom: 6 },
  placeDate:   { fontSize: 10, textAlign: 'right', marginBottom: 6, fontStyle: 'italic' },
  // Patient info table
  infoRow:     { flexDirection: 'row', marginBottom: 5 },
  infoLabel:   { width: 70, fontWeight: 700, fontSize: 10.5 },
  infoValue:   { flex: 1, fontSize: 10.5 },
  infoLabelR:  { width: 65, fontWeight: 700, fontSize: 10.5, marginLeft: 12 },
  infoValueR:  { flex: 1, fontSize: 10.5 },
  // Section
  secTitle:    { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginTop: 10, marginBottom: 3 },
  secBody:     { fontSize: 12, lineHeight: 1.52, textAlign: 'justify' },
  // Signature
  sigDate:     { fontSize: 10, textAlign: 'right', marginTop: 10, marginBottom: 14, fontStyle: 'italic' },
  sigRow:      { flexDirection: 'row', marginTop: 2, justifyContent: 'space-between' },
  sigBox:      { width: '42%', alignItems: 'center' },
  sigTitle:    { fontSize: 11, fontWeight: 700, textAlign: 'center', marginBottom: 2, textTransform: 'uppercase' },
  sigNote:     { fontSize: 9, textAlign: 'center' },
  sigLine:     { borderBottomWidth: 0.8, borderBottomColor: '#666', width: '82%', marginTop: 24, marginBottom: 4 },
  // Footer
  footer:      { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  footerText:  { fontSize: 8.5, color: '#777' },
  // Detection table
  tableHeader: { flexDirection: 'row', backgroundColor: '#f3f4f6', paddingVertical: 3, paddingHorizontal: 4, marginTop: 4, borderBottomWidth: 0.8, borderBottomColor: '#d0d0d0' },
  tableRow:    { flexDirection: 'row', paddingVertical: 2.5, paddingHorizontal: 4, borderBottomWidth: 0.6, borderBottomColor: '#ececec' },
  tableCell:   { fontSize: 10 },
  col1: { width: '6%' },
  col2: { flex: 1 },
  col3: { width: '14%', textAlign: 'right' },
});

// ── Types ───────────────────────────────────────────────────────────────────
export interface ReportPDFData {
  isOfficial: boolean;
  patientRef: string;
  age: string;
  gender: string;
  date: string;
  symptoms: string;
  spo2: string;
  crp?: string;
  episodeId: string;
  generatedAt: string;
  indication: string;
  vitals: string;
  labs: string;
  findings: string;
  impression: string;
  recommendation: string;
  doctorNote?: string;
  detections?: Array<{ label: string; confidence: string }>;
}

// ── PDF Document ─────────────────────────────────────────────────────────────
export function ReportPDFDocument({ data }: { data: ReportPDFData }) {
  const Section = ({ num, title, body }: { num: string; title: string; body: string }) => (
    <View wrap={false}>
      <Text style={s.secTitle}>{num}. {title}</Text>
      <Text style={s.secBody}>{body || 'Chưa có thông tin.'}</Text>
    </View>
  );

  return (
    <Document
      title={`Báo cáo X-quang — ${data.patientRef}`}
      author="WebRAG Clinical AI"
      subject="Phân tích X-quang ngực nhi khoa"
      creator="WebRAG v1"
    >
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.headRow}>
          <View style={s.headLeft}>
            <Text style={s.officeTop}>Bệnh viện Nhi Trung Ương</Text>
            <Text style={s.officeSub}>Khoa Chẩn đoán hình ảnh</Text>
          </View>
          <View style={s.headRight}>
            <Text style={s.nationTitle}>Cộng hòa xã hội chủ nghĩa Việt Nam</Text>
            <Text style={s.nationSub}>Độc lập - Tự do - Hạnh phúc</Text>
            <View style={s.nationRule} />
          </View>
        </View>

        <Text style={s.docCode}>Số: {data.episodeId.slice(0, 8).toUpperCase()}/BC-XQNK</Text>
        <Text style={s.docTitle}>Báo cáo phân tích X-quang ngực nhi khoa</Text>
        <Text style={s.docSubtitle}>Về kết quả đọc phim X-quang ngực bệnh nhi</Text>
        <Text style={s.placeDate}>Hà Nội, ngày {data.date}</Text>
        <View style={s.ruleHeavy} />

        {/* Patient info */}
        <Text style={[s.secTitle, { marginTop: 0 }]}>Thông tin bệnh nhân</Text>
        <View style={s.rule} />
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Mã ca:</Text>
          <Text style={s.infoValue}>{data.patientRef}</Text>
          <Text style={s.infoLabelR}>Ngày chụp:</Text>
          <Text style={s.infoValueR}>{data.date}</Text>
        </View>
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Tuổi:</Text>
          <Text style={s.infoValue}>{data.age}</Text>
          <Text style={s.infoLabelR}>Giới tính:</Text>
          <Text style={s.infoValueR}>{data.gender}</Text>
        </View>
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Triệu chứng:</Text>
          <Text style={s.infoValue}>{data.symptoms || '—'}</Text>
          <Text style={s.infoLabelR}>SpO₂:</Text>
          <Text style={s.infoValueR}>{data.spo2 || '—'}</Text>
        </View>

        <View style={[s.rule, { marginTop: 8 }]} />

        {/* Clinical sections */}
        <Section num="I"   title="Lý do chỉ định chụp"      body={data.indication} />
        <Section num="II"  title="Mô tả hình ảnh X-quang"   body={data.findings} />
        <Section num="III" title="Kết luận"                  body={data.impression} />
        <Section num="IV"  title="Đề xuất xử lý"             body={data.recommendation} />
        {data.doctorNote && data.doctorNote !== 'Chưa ghi nhận trong hồ sơ tại thời điểm lập báo cáo.' && (
          <Section num="V" title="Ý kiến bác sĩ" body={data.doctorNote} />
        )}

        {/* AI Detection table (appendix) */}
        {data.detections && data.detections.length > 0 && (
          <View wrap={false}>
            <View style={[s.rule, { marginTop: 10 }]} />
            <Text style={s.secTitle}>Phụ lục — Kết quả phát hiện AI</Text>
            <View style={s.tableHeader}>
              <Text style={[s.tableCell, s.col1]}>#</Text>
              <Text style={[s.tableCell, s.col2]}>Bất thường phát hiện</Text>
              <Text style={[s.tableCell, s.col3]}>Độ tin cậy</Text>
            </View>
            {data.detections.map((d, i) => (
              <View key={i} style={s.tableRow}>
                <Text style={[s.tableCell, s.col1]}>{i + 1}</Text>
                <Text style={[s.tableCell, s.col2]}>{d.label}</Text>
                <Text style={[s.tableCell, s.col3]}>{d.confidence}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Signature */}
        <Text style={s.sigDate}>Ngày {data.date}</Text>
        <View style={s.sigRow}>
          <View style={s.sigBox}>
            <Text style={s.sigTitle}>Bác sĩ đọc phim</Text>
            <Text style={s.sigNote}>(Ký và ghi rõ họ tên)</Text>
            <View style={s.sigLine} />
          </View>
          <View style={s.sigBox}>
            <Text style={s.sigTitle}>Trưởng khoa</Text>
            <Text style={s.sigNote}>(Ký và ghi rõ họ tên)</Text>
            <View style={s.sigLine} />
          </View>
        </View>

        {/* Footer */}
        <View style={[s.rule, { marginTop: 12 }]} />
        <View style={s.footer}>
          <Text style={s.footerText}>Tạo lúc: {data.generatedAt}</Text>
          <Text style={s.footerText}>Mã hồ sơ: {data.patientRef}</Text>
        </View>
      </Page>
    </Document>
  );
}

// ── Download helper ──────────────────────────────────────────────────────────
export async function downloadReportPDF(data: ReportPDFData): Promise<void> {
  const blob = await pdf(<ReportPDFDocument data={data} />).toBlob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const name = `bao-cao-xquang-${data.patientRef.replace(/\s+/g, '-')}-${data.date.replace(/\//g, '-')}.pdf`;
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
