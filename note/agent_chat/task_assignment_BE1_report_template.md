---
timestamp: 2026-05-02T12:21:00Z
from: Kiro (Coordinator)
to: BE1 (agentBE)
type: TASK_ASSIGNMENT
---

# 🎯 TASK ASSIGNMENT - BE1 (Task #8)

**Agent:** BE1 (Backend Core Developer)  
**Task:** #8 - Design and implement medical report template system  
**Priority:** 🟡 HIGH  
**Estimated:** 4 hours  
**Branch:** `feature/report-template-system`

---

## 🛠️ TOOLS AVAILABLE TO YOU

**You have access to:**
- ✅ **Git CLI** - Full git commands
- ✅ **MCP Tools** - Composio integration
- ✅ **File system** - Read, Write, Edit files
- ✅ **Bash** - Run any shell commands
- ✅ **Python packages** - Install reportlab, python-docx, etc.

---

## 📋 CONTEXT

**Problem:** Medical reports MUST follow strict administrative standards:
- Proper headers with hospital logo
- Structured tables with correct alignment
- Images positioned correctly
- Signature areas
- Professional formatting
- **NOT free-form AI-generated text**

**Reference:** `/mnt/e/project/webrag/note/de_cuong_nghien_cuu.md`
- Phần II, mục 5: Report drafting requirements
- Must be "chuẩn hành chính" (administrative standard)

---

## 🎯 TASK DETAILS

**Goal:**
Create a structured report generation system that produces professional medical reports in PDF format with standardized templates.

**Components to build:**
1. Report template structure
2. PDF generator using ReportLab
3. Data binding engine
4. API endpoint for report generation
5. Integration with Detection API and RAG

---

## 📄 REPORT STRUCTURE REQUIRED

### **1. Header (Fixed)**
```
┌────────────────────────────────────────────────────┐
│  [LOGO]          BỆNH VIỆN NHI ĐỒNG                │
│                  Khoa Hô Hấp                       │
│                                                    │
│        BÁO CÁO KẾT QUẢ CHẨN ĐOÁN HÌNH ẢNH        │
│              (Hỗ trợ bởi trí tuệ nhân tạo)        │
└────────────────────────────────────────────────────┘
```

### **2. Patient Information Table**
```
┌─────────────────────────────────────────┐
│ Họ tên:  {{patient_name}}               │
│ Tuổi:    {{age}}        Giới: {{gender}}│
│ Mã BN:   {{patient_id}}                 │
│ Ngày vào: {{admission_date}}            │
│ Số phim:  {{accession_number}}          │
└─────────────────────────────────────────┘
```

### **3. X-ray Results Section**
```
┌──────────────────────────────────────────────────┐
│ I. KẾT QUẢ CHỤP X-QUANG NGỰC                     │
├──────────────────────────────────────────────────┤
│ Tư thế chụp:     {{position}}                    │
│ Chất lượng ảnh:  {{quality}}                     │
│                                                  │
│ [X-ray Image]         [Heatmap Overlay]         │
│                                                  │
│ Vùng phát hiện bất thường:                       │
│  • {{finding_1}}                                 │
│  • {{finding_2}}                                 │
└──────────────────────────────────────────────────┘
```

### **4. Clinical Data Table**
```
┌──────────────────────────────────────────────────┐
│ II. DỮ LIỆU LÂM SÀNG                             │
├──────────────────────────────────────────────────┤
│ Triệu chứng:                                     │
│  • Sốt:         {{fever_days}} ngày              │
│  • Ho:          {{cough}}                        │
│  • SpO2:        {{spo2}}%                        │
│                                                  │
│ Xét nghiệm:                                      │
│  ┌─────────────┬──────────┬──────────┐          │
│  │ Chỉ số      │ Kết quả  │ Bình thường│        │
│  ├─────────────┼──────────┼──────────┤          │
│  │ CRP         │ {{crp}}  │ <10 mg/L │          │
│  │ Bạch cầu    │ {{wbc}}  │ 4-10 G/L │          │
│  └─────────────┴──────────┴──────────┘          │
└──────────────────────────────────────────────────┘
```

### **5. AI Analysis Results**
```
┌──────────────────────────────────────────────────┐
│ III. KẾT QUẢ PHÂN TÍCH TRÍ TUỆ NHÂN TẠO         │
├──────────────────────────────────────────────────┤
│ Mô hình:     {{model_name}} v{{version}}         │
│ Ngày phân tích: {{analysis_date}}                │
│                                                  │
│ Đánh giá nguy cơ viêm phổi:                      │
│  • Xác suất:  {{probability}}%                   │
│  • Độ tin cậy: {{confidence}}                    │
│  • Phân loại:  {{classification}}                │
│                                                  │
│ Căn cứ đánh giá:                                 │
│  • Hình ảnh: {{image_evidence}}                  │
│  • Lâm sàng: {{clinical_evidence}}               │
└──────────────────────────────────────────────────┘
```

### **6. References (from RAG)**
```
┌──────────────────────────────────────────────────┐
│ IV. TÀI LIỆU THAM KHẢO                           │
├──────────────────────────────────────────────────┤
│ [1] {{reference_title_1}}                        │
│     {{source_1}} - {{date_1}}                    │
│ [2] {{reference_title_2}}                        │
└──────────────────────────────────────────────────┘
```

### **7. Footer (Fixed)**
```
┌──────────────────────────────────────────────────┐
│ ⚠️ LƯU Ý QUAN TRỌNG:                             │
│ Đây là kết quả hỗ trợ chẩn đoán bằng trí tuệ    │
│ nhân tạo. Kết luận cuối cùng phải được xác nhận  │
│ bởi bác sỹ có chuyên môn.                        │
│                                                  │
│ Bác sỹ đọc kết quả: _______________              │
│ Chữ ký:             _______________              │
│ Ngày:               _______________              │
│                                                  │
│ Mã truy xuất: {{trace_id}}                       │
└──────────────────────────────────────────────────┘
```

---

## 🔧 IMPLEMENTATION STEPS

### **Step 1: Create branch**
```bash
git checkout main
git pull origin main
git checkout -b feature/report-template-system
```

### **Step 2: Note về dependencies**

Package.json đã có các dependencies cần thiết:
- **Node:** vitest, supertest, @types/supertest, @vitest/coverage-v8 ✅
- **Python:** reportlab sẽ được gọi qua subprocess (không cần cài đặt trong Node environment)

**KHÔNG CHẠY yarn install** - chỉ viết code. Python report generator sẽ chạy riêng biệt.

### **Step 3: Create report generator**

**File:** `apps/api/src/lib/reports/generator.ts`

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

interface ReportData {
  // Patient info
  patient_name: string;
  age: number;
  gender: string;
  patient_id: string;
  admission_date: string;
  accession_number: string;
  
  // X-ray info
  xray_path: string;
  heatmap_path: string;
  position: string;
  quality: string;
  findings: string[];
  
  // Clinical data
  fever_days: number;
  cough: string;
  spo2: number;
  crp: number;
  wbc: number;
  neutrophil: number;
  
  // AI results
  model_name: string;
  model_version: string;
  analysis_date: string;
  probability: number;
  confidence: string;
  classification: string;
  image_evidence: string;
  clinical_evidence: string;
  
  // RAG references
  references: Array<{
    title: string;
    source: string;
    date: string;
  }>;
  
  // Metadata
  trace_id: string;
}

export class ReportGenerator {
  /**
   * Generate PDF report from structured data
   */
  async generateReport(data: ReportData): Promise<string> {
    // Call Python script to generate PDF
    const scriptPath = path.join(__dirname, 'generate_pdf.py');
    const dataPath = path.join('/tmp', `report_data_${data.trace_id}.json`);
    const outputPath = path.join('/tmp', `report_${data.trace_id}.pdf`);
    
    // Write data to temp file
    await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
    
    // Execute Python script
    const { stdout, stderr } = await execAsync(
      `python3 ${scriptPath} ${dataPath} ${outputPath}`
    );
    
    if (stderr) {
      throw new Error(`PDF generation failed: ${stderr}`);
    }
    
    return outputPath;
  }
}
```

### **Step 4: Create Python PDF generator**

**File:** `apps/api/src/lib/reports/generate_pdf.py`

```python
#!/usr/bin/env python3
import sys
import json
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

def create_header():
    """Create report header"""
    styles = getSampleStyleSheet()
    header_style = ParagraphStyle(
        'CustomHeader',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=colors.HexColor('#1a1a1a'),
        spaceAfter=30,
        alignment=TA_CENTER
    )
    
    return [
        Paragraph("BỆNH VIỆN NHI ĐỒNG", header_style),
        Paragraph("Khoa Hô Hấp", styles['Normal']),
        Spacer(1, 0.5*cm),
        Paragraph("BÁO CÁO KẾT QUẢ CHẨN ĐOÁN HÌNH ẢNH", header_style),
        Paragraph("(Hỗ trợ bởi trí tuệ nhân tạo)", styles['Italic']),
        Spacer(1, 1*cm)
    ]

def create_patient_table(data):
    """Create patient information table"""
    patient_data = [
        ['Họ tên:', data['patient_name']],
        ['Tuổi:', f"{data['age']}"],
        ['Giới:', data['gender']],
        ['Mã BN:', data['patient_id']],
        ['Ngày vào:', data['admission_date']],
        ['Số phim:', data['accession_number']]
    ]
    
    table = Table(patient_data, colWidths=[4*cm, 12*cm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f0f0f0')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey)
    ]))
    
    return table

def create_xray_section(data):
    """Create X-ray results section with images"""
    elements = []
    
    # Section title
    styles = getSampleStyleSheet()
    elements.append(Paragraph("I. KẾT QUẢ CHỤP X-QUANG NGỰC", styles['Heading2']))
    elements.append(Spacer(1, 0.5*cm))
    
    # Images side by side
    if data.get('xray_path') and data.get('heatmap_path'):
        img_table = Table([
            [
                Image(data['xray_path'], width=7*cm, height=7*cm),
                Image(data['heatmap_path'], width=7*cm, height=7*cm)
            ],
            ['Ảnh X-quang gốc', 'Vùng phát hiện bất thường']
        ])
        img_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(img_table)
    
    elements.append(Spacer(1, 0.5*cm))
    
    # Findings
    findings_text = "<br/>".join([f"• {f}" for f in data.get('findings', [])])
    elements.append(Paragraph(f"<b>Vùng phát hiện bất thường:</b><br/>{findings_text}", styles['Normal']))
    
    return elements

def create_clinical_table(data):
    """Create clinical data table"""
    elements = []
    styles = getSampleStyleSheet()
    
    elements.append(Paragraph("II. DỮ LIỆU LÂM SÀNG", styles['Heading2']))
    elements.append(Spacer(1, 0.5*cm))
    
    # Symptoms
    symptoms_data = [
        ['Triệu chứng', 'Kết quả'],
        ['Sốt', f"{data.get('fever_days', 0)} ngày"],
        ['Ho', data.get('cough', 'Không')],
        ['SpO2', f"{data.get('spo2', 0)}%"]
    ]
    
    symptoms_table = Table(symptoms_data, colWidths=[8*cm, 8*cm])
    symptoms_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4a90e2')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey)
    ]))
    elements.append(symptoms_table)
    elements.append(Spacer(1, 0.5*cm))
    
    # Lab results
    lab_data = [
        ['Chỉ số', 'Kết quả', 'Bình thường'],
        ['CRP', f"{data.get('crp', 0)} mg/L", '<10 mg/L'],
        ['Bạch cầu', f"{data.get('wbc', 0)} G/L", '4-10 G/L'],
        ['Neutrophil', f"{data.get('neutrophil', 0)}%", '40-70%']
    ]
    
    lab_table = Table(lab_data, colWidths=[5*cm, 5*cm, 6*cm])
    lab_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4a90e2')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey)
    ]))
    elements.append(lab_table)
    
    return elements

def create_ai_results(data):
    """Create AI analysis results section"""
    elements = []
    styles = getSampleStyleSheet()
    
    elements.append(Paragraph("III. KẾT QUẢ PHÂN TÍCH TRÍ TUỆ NHÂN TẠO", styles['Heading2']))
    elements.append(Spacer(1, 0.5*cm))
    
    ai_data = [
        ['Mô hình:', f"{data.get('model_name', 'N/A')} v{data.get('model_version', 'N/A')}"],
        ['Ngày phân tích:', data.get('analysis_date', 'N/A')],
        ['Xác suất viêm phổi:', f"{data.get('probability', 0)}%"],
        ['Độ tin cậy:', data.get('confidence', 'N/A')],
        ['Phân loại:', data.get('classification', 'N/A')]
    ]
    
    ai_table = Table(ai_data, colWidths=[6*cm, 10*cm])
    ai_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f0f0f0')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey)
    ]))
    elements.append(ai_table)
    
    return elements

def create_footer(data):
    """Create report footer with disclaimer"""
    styles = getSampleStyleSheet()
    warning_style = ParagraphStyle(
        'Warning',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#d32f2f'),
        spaceAfter=20
    )
    
    return [
        Spacer(1, 1*cm),
        Paragraph("⚠️ LƯU Ý QUAN TRỌNG:", warning_style),
        Paragraph(
            "Đây là kết quả hỗ trợ chẩn đoán bằng trí tuệ nhân tạo. "
            "Kết luận cuối cùng phải được xác nhận bởi bác sỹ có chuyên môn.",
            styles['Normal']
        ),
        Spacer(1, 1*cm),
        Paragraph("Bác sỹ đọc kết quả: _______________", styles['Normal']),
        Paragraph("Chữ ký: _______________", styles['Normal']),
        Paragraph("Ngày: _______________", styles['Normal']),
        Spacer(1, 0.5*cm),
        Paragraph(f"Mã truy xuất: {data.get('trace_id', 'N/A')}", styles['Italic'])
    ]

def generate_report(data_path, output_path):
    """Main function to generate PDF report"""
    # Load data
    with open(data_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Create PDF
    doc = SimpleDocTemplate(output_path, pagesize=A4)
    story = []
    
    # Build report sections
    story.extend(create_header())
    story.append(create_patient_table(data))
    story.append(Spacer(1, 1*cm))
    story.extend(create_xray_section(data))
    story.append(Spacer(1, 1*cm))
    story.extend(create_clinical_table(data))
    story.append(Spacer(1, 1*cm))
    story.extend(create_ai_results(data))
    story.extend(create_footer(data))
    
    # Build PDF
    doc.build(story)
    print(f"Report generated: {output_path}")

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python generate_pdf.py <data_json> <output_pdf>")
        sys.exit(1)
    
    generate_report(sys.argv[1], sys.argv[2])
```

### **Step 5: Create API endpoint**

**File:** `apps/api/src/routes/reports.ts`

```typescript
import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { ReportGenerator } from '../lib/reports/generator';
import { logger } from '../utils/logger';

const router = Router();
const reportGenerator = new ReportGenerator();

/**
 * POST /api/reports/generate
 * Generate medical report PDF
 */
router.post(
  '/generate',
  authenticateJWT,
  requirePermission('reports:create'),
  async (req, res) => {
    try {
      const { episode_id } = req.body;
      
      // Fetch episode data, detection results, RAG context
      // ... (integrate with existing APIs)
      
      const reportData = {
        // ... aggregate data from episode, detection, RAG
      };
      
      const pdfPath = await reportGenerator.generateReport(reportData);
      
      // Return PDF file
      res.download(pdfPath, `report_${episode_id}.pdf`);
    } catch (error) {
      logger.error('Report generation error', { error });
      res.status(500).json({ error: 'Failed to generate report' });
    }
  }
);

export default router;
```

### **Step 6: Test**

```bash
# Test PDF generation
curl -X POST http://localhost:3005/api/reports/generate \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{"episode_id": "test-episode-id"}'
```

### **Step 7: Commit**

```bash
git add apps/api/src/lib/reports/
git add apps/api/src/routes/reports.ts
git commit -m "feat(api): add medical report template system

- Add ReportGenerator class for PDF generation
- Create Python script with ReportLab for structured reports
- Add POST /api/reports/generate endpoint
- Implement standardized medical report template
- Include patient info, X-ray images, clinical data, AI results
- Add disclaimer and signature area

Template follows hospital administrative standards
Complies with de_cuong_nghien_cuu.md requirements
Output: Professional PDF reports for medical documentation"
```

**IMPORTANT:** Do NOT add "Co-Authored-By: Claude" line!

### **Step 8: Push**

```bash
git push origin feature/report-template-system
```

### **Step 9: Report completion**

Post summary of what you did.

---

## ✅ DEFINITION OF DONE

- [x] Report template structure defined
- [x] Python PDF generator with ReportLab
- [x] TypeScript wrapper for generator
- [x] API endpoint created
- [x] Proper formatting (tables, images, headers)
- [x] Signature area included
- [x] Disclaimer added
- [x] Tested with sample data
- [x] Commit message follows format
- [x] NO "Co-Authored-By" line
- [x] Branch pushed

---

## 🚨 IMPORTANT NOTES

1. **NO "Co-Authored-By" in commits** - User wants only their name
2. **Follow administrative standards** - Proper formatting is critical
3. **Use structured templates** - NOT free-form AI text
4. **Professional output** - This is for medical documentation

---

**Start time:** 12:21 VN  
**Expected completion:** 16:21 VN  
**Status:** 🔄 ASSIGNED - Ready to start

