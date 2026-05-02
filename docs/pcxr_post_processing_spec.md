# Spec post-processing tu `detections[]` sang `llm_ready_payload`

## 1. Muc dich

Tai lieu nay dinh nghia lop post-processing nam giua PCXR detector va lop LLM. Muc tieu cua lop nay la:

- nhan raw detections tu model object detection;
- chuyen raw output thanh payload co cau truc, on dinh, de LLM co the doc;
- bo sung cac rule an toan, provenance va summary o muc cau truc;
- tranh de LLM doc truc tiep du lieu qua thap cap va tu suy dien khong kiem soat.

Tai lieu nay khong thay doi contract goc cua detector. Detector van co the tiep tuc tra ve `bbox`, `label`, `score` nhu hien tai.

## 2. Pham vi

Phu hop voi detector PCXR dang co output dang:

```json
{
  "image_id": "abc123",
  "detections": [
    {
      "bbox": [525, 666, 934, 1126],
      "label": "Consolidation",
      "score": 0.81
    },
    {
      "bbox": [154, 435, 346, 627],
      "label": "Pleural effusion",
      "score": 0.67
    }
  ]
}
```

Spec nay cung ho tro adapter tu raw MMDetection / DINO output:

- `pred_instances.bboxes`
- `pred_instances.labels`
- `pred_instances.scores`

thanh dang `detections[]` chuan hoa truoc khi post-processing.

## 3. Nguyen tac thiet ke

| Ma | Nguyen tac | Dien giai |
| --- | --- | --- |
| PP-01 | Keep raw output intact | Lop post-processing khong sua raw detector output goc; moi bien doi phai co trace. |
| PP-02 | Deterministic | Cung mot input va cung mot config phai sinh cung mot `llm_ready_payload`. |
| PP-03 | Version everything | Label map, threshold policy, processor version va schema version deu phai duoc version hoa. |
| PP-04 | Fail closed | Detection loi, bbox loi, label khong biet, payload thieu field phai bi chan hoac gan co ro rang. |
| PP-05 | No hallucinated anatomy | Khong suy ra laterality, zone, severity neu khong co rule hoac mo hinh bo tro da duoc phe duyet. |
| PP-06 | LLM reads structured evidence only | LLM chi doc payload da duoc chuan hoa, khong doc `pred_instances` raw. |
| PP-07 | No final diagnosis generation | Lop nay khong duoc tu dong bien detection thanh ket luan chuyen mon cuoi cung. |

## 4. Dau vao va dau ra

### 4.1. Dau vao bat buoc cho post-processor

| Truong | Kieu | Bat buoc | Ghi chu |
| --- | --- | --- | --- |
| `image_id` | string | Co | ID anh da duoc ingestion |
| `detections[]` | array | Co | Danh sach object detection |
| `model_name` | string | Nen co | Ten detector |
| `model_version` | string | Nen co | Phuc vu audit |
| `generated_at` | string | Nen co | ISO 8601 |
| `image_width` | integer | Nen co | De validate bbox |
| `image_height` | integer | Nen co | De validate bbox |
| `episode_id` | string | Tuy chon | Neu co patient context |

### 4.2. Cau truc `detections[]`

Moi detection sau adapter phai co:

```json
{
  "bbox": [525, 666, 934, 1126],
  "label": "Consolidation",
  "score": 0.81
}
```

Trong do:

- `bbox` la `[x_min, y_min, x_max, y_max]` theo pixel coordinates;
- `label` la nhan da duoc map thanh ten class;
- `score` nam trong doan `[0, 1]`.

### 4.3. Dau ra cua lop post-processing

Lop post-processing phai sinh ra 2 lop output:

1. `post_processed_output`: du lieu cau truc day du cho backend, UI va audit.
2. `llm_ready_payload`: payload rut gon, on dinh, chi gom nhung field ma LLM duoc phep doc.

## 5. Pipeline xu ly chi tiet

### 5.1. Step 0 - Adapter tu raw detector output sang `detections[]`

Neu detector tra ve dang raw arrays, adapter phai chuyen sang object array.

Input vi du:

```python
pred_instances.bboxes
pred_instances.labels
pred_instances.scores
```

Output chuan hoa:

```json
{
  "detections": [
    {
      "bbox": [525, 666, 934, 1126],
      "label": "Consolidation",
      "score": 0.81
    }
  ]
}
```

Yeu cau:

- so luong phan tu cua `bboxes`, `labels`, `scores` phai bang nhau;
- label id phai map duoc qua `label_map_version`;
- neu co phan tu khong map duoc label, detection do phai bi bo va duoc log voi ly do `unknown_label`.

### 5.2. Step 1 - Input validation

Post-processor phai validate:

- `image_id` ton tai;
- `detections` la array;
- moi `bbox` co 4 so;
- `x_min < x_max`, `y_min < y_max`;
- `score` nam trong `[0, 1]`;
- `label` khong rong.

Neu `image_width` va `image_height` co mat, bbox phai duoc kiem tra nam trong bien anh. Neu vuot bien, he thong co the:

- clamp bbox vao bien anh va gan flag `bbox_clamped`; hoac
- loai detection va gan ly do `invalid_bbox`.

Chinh sach can duoc chot mot lan, khong de moi service tu quyet dinh.

### 5.3. Step 2 - Label canonicalization

Muc tieu cua buoc nay la bien cac ten nhan khac nhau ve mot nhan chuan.

Vi du:

- `Consolidation` -> `consolidation`
- `Pleural effusion` -> `pleural_effusion`
- `Cardiomegaly` -> `cardiomegaly`

Moi detection giu lai phai co them:

- `label_code`: nhan chuan machine-readable;
- `display_label`: nhan hien thi cho UI;
- `source_label`: nhan detector goc.

### 5.4. Step 3 - Threshold filtering

Post-processor phai ap dung nguong theo tung nhan hoac nguong mac dinh.

Vi du config:

```json
{
  "default_threshold": 0.5,
  "per_label_threshold": {
    "consolidation": 0.6,
    "pleural_effusion": 0.55
  }
}
```

Rule:

- neu `score < threshold(label)` thi detection bi bo;
- detection bi bo phai duoc luu vao `dropped_detections[]` kem ly do `below_threshold`;
- threshold policy phai duoc version hoa bang `threshold_policy_version`.

### 5.5. Step 4 - Deduplication / overlap handling

Mac du detector co the da co NMS, lop post-processing van nen co lop dedup cuoi de tranh trung lap bat thuong.

Rule de xuat:

- neu 2 detection cung `label_code` va IoU >= nguong, giu detection co `score` cao hon;
- detection bi loai phai duoc log voi ly do `duplicate_overlap`;
- neu 2 detection khac label nhung overlap cao, khong tu dong gom lai, chi gan co `overlapping_multi_label` neu can.

### 5.6. Step 5 - Sorting va ranking

Danh sach detection giu lai phai duoc sap xep:

1. theo `score` giam dan;
2. neu bang nhau thi theo `label_code` tang dan;
3. neu van bang nhau thi theo `bbox` lexical order.

Moi detection giu lai phai co them:

- `rank`: 1, 2, 3...;
- `reportable`: boolean;
- `retained`: true.

### 5.7. Step 6 - Derived image-level summary

Post-processor phai sinh summary o muc anh, khong phai chi de LLM ma con de UI, audit va dashboard.

Truong summary toi thieu:

- `abnormality_present`: `true` neu sau threshold con it nhat 1 detection;
- `finding_count`: so detection giu lai;
- `top_finding`: nhan cua detection rank 1, neu co;
- `max_score`: score cao nhat, neu co;
- `label_counts`: so luong theo nhan.

Luon ap dung guardrail sau:

- `finding_count = 0` khong duoc tu dong dien giai thanh `normal` neu detector khong co class `no_finding` da duoc validate rieng.
- LLM phai nhan duoc note ro rang khi khong co detection giu lai, vi do co the la `no retained detection`, khong phai `normal chest x-ray`.

### 5.8. Step 7 - Safety and review flags

Post-processor phai sinh cac co an toan co cau truc.

Toi thieu gom:

- `requires_human_review`: mac dinh `true` cho workflow lam sang;
- `low_confidence`: `true` neu `max_score < review_confidence_threshold`;
- `multi_finding_case`: `true` neu so nhan giu lai >= nguong cau hinh;
- `flags[]`: danh sach co nhu `below_review_threshold`, `overlapping_multi_label`, `no_retained_detection`, `bbox_clamped`.

Neu sau nay co them image quality service hoac OOD service, co the noi them cac co:

- `image_quality_flags[]`;
- `ood_flag`.

### 5.9. Step 8 - Optional anatomy enrichment

Laterality, anatomical zone, upper/mid/lower lung khong phai output goc cua detector. Chi duoc them neu co:

- rule engine tin cay dua tren lung mask hoac anchor anatomy; hoac
- mo hinh bo tro da duoc kiem dinh.

Neu khong co, phai de `anatomy` = `null` hoac bo trong, khong duoc tu suy ra.

### 5.10. Step 9 - Assemble `post_processed_output`

`post_processed_output` la payload day du cho backend va audit. No phai gom:

- provenance detector;
- raw detection count;
- dropped detection count;
- retained detections[];
- summary;
- safety;
- version cua processor.

### 5.11. Step 10 - Assemble `llm_ready_payload`

`llm_ready_payload` la payload rut gon cho LLM. Payload nay phai co:

- `schema_version`;
- `image_id`;
- `episode_id` neu co;
- `generated_at`;
- `source_model`;
- `prediction_summary`;
- `findings[]`;
- `safety`;
- `usage_guardrails`.

LLM khong can doc:

- raw arrays goc cua MMDetection;
- `pred_instances`;
- detection bi loai;
- bbox khong hop le;
- thong tin ky thuat thap cap khong phuc vu explanation.

## 6. Dinh nghia object sau post-processing

### 6.1. `retained_detection`

```json
{
  "finding_id": "det_001",
  "source_label": "Consolidation",
  "label_code": "consolidation",
  "display_label": "Consolidation",
  "score": 0.81,
  "bbox": [525, 666, 934, 1126],
  "rank": 1,
  "reportable": true,
  "anatomy": null,
  "flags": []
}
```

### 6.2. `dropped_detection`

```json
{
  "source_label": "Pleural effusion",
  "score": 0.22,
  "bbox": [154, 435, 346, 627],
  "drop_reason": "below_threshold"
}
```

### 6.3. `prediction_summary`

```json
{
  "abnormality_present": true,
  "finding_count": 2,
  "top_finding": "consolidation",
  "max_score": 0.81,
  "label_counts": {
    "consolidation": 1,
    "pleural_effusion": 1
  },
  "note": "No retained detection does not imply normal image."
}
```

### 6.4. `usage_guardrails`

```json
{
  "allowed_use": [
    "explanation_drafting",
    "report_drafting"
  ],
  "forbidden_use": [
    "final_diagnosis",
    "treatment_recommendation",
    "discharge_decision"
  ]
}
```

## 7. Contract de xuat cho `llm_ready_payload`

```json
{
  "schema_version": "pcxr-llm-ready-payload/v1",
  "image_id": "abc123",
  "episode_id": "ep_0001",
  "generated_at": "2026-04-29T10:15:30Z",
  "source_model": {
    "model_name": "pcxr_dino",
    "model_version": "v1.0.0",
    "pipeline_run_id": "run_0001"
  },
  "prediction_summary": {
    "abnormality_present": true,
    "finding_count": 2,
    "top_finding": "consolidation",
    "max_score": 0.81,
    "label_counts": {
      "consolidation": 1,
      "pleural_effusion": 1
    },
    "note": "No retained detection does not imply normal image."
  },
  "findings": [
    {
      "finding_id": "det_001",
      "label": "Consolidation",
      "label_code": "consolidation",
      "score": 0.81,
      "bbox": [525, 666, 934, 1126],
      "rank": 1,
      "anatomy": null,
      "flags": []
    },
    {
      "finding_id": "det_002",
      "label": "Pleural effusion",
      "label_code": "pleural_effusion",
      "score": 0.67,
      "bbox": [154, 435, 346, 627],
      "rank": 2,
      "anatomy": null,
      "flags": []
    }
  ],
  "safety": {
    "requires_human_review": true,
    "low_confidence": false,
    "flags": []
  },
  "usage_guardrails": {
    "allowed_use": [
      "explanation_drafting",
      "report_drafting"
    ],
    "forbidden_use": [
      "final_diagnosis",
      "treatment_recommendation",
      "discharge_decision"
    ]
  }
}
```

## 8. Vi du end-to-end transform

### 8.1. Raw input

```json
{
  "image_id": "abc123",
  "model_name": "pcxr_dino",
  "model_version": "v1.0.0",
  "detections": [
    {
      "bbox": [525, 666, 934, 1126],
      "label": "Consolidation",
      "score": 0.81
    },
    {
      "bbox": [154, 435, 346, 627],
      "label": "Pleural effusion",
      "score": 0.67
    },
    {
      "bbox": [160, 440, 344, 620],
      "label": "Pleural effusion",
      "score": 0.21
    }
  ]
}
```

### 8.2. Sau threshold va dedup

- detection `Pleural effusion` score 0.21 bi bo vi `below_threshold`;
- 2 detection con lai duoc giu va rank.

### 8.3. LLM-ready outcome

- `finding_count = 2`;
- `top_finding = consolidation`;
- `requires_human_review = true`;
- khong co suy dien them ve laterality hoac severity neu chua co anatomy enrichment.

## 9. Acceptance criteria cho implementation

| Ma | Tieu chi |
| --- | --- |
| PP-A-01 | Cung mot input va config phai sinh cung mot `llm_ready_payload`. |
| PP-A-02 | Moi detection bi bo phai co `drop_reason` trong trace. |
| PP-A-03 | Khong co detection nao score duoi threshold xuat hien trong `findings[]` cua `llm_ready_payload`. |
| PP-A-04 | `finding_count = 0` khong duoc tu dong chuyen thanh `normal`. |
| PP-A-05 | `llm_ready_payload` phai co `usage_guardrails`. |
| PP-A-06 | `model_version`, `processor_version`, `schema_version` va `threshold_policy_version` phai truy vet duoc. |
| PP-A-07 | Khong duoc sinh laterality hoac zone neu anatomy enrichment khong san sang. |

## 10. Pseudocode de xuat

```python
def post_process_detector_output(payload, config):
    detections = adapt_raw_output(payload, config.label_map)
    validated = validate_detections(detections, payload.get("image_width"), payload.get("image_height"))
    canonicalized = canonicalize_labels(validated, config.label_map)
    filtered, dropped_low_score = apply_thresholds(canonicalized, config.thresholds)
    retained, dropped_duplicates = deduplicate(filtered, config.iou_threshold)
    ranked = rank_detections(retained)
    summary = build_image_summary(ranked)
    safety = build_safety_flags(ranked, summary, config.review_rules)
    post_processed_output = build_post_processed_output(payload, ranked, dropped_low_score + dropped_duplicates, summary, safety, config)
    llm_ready_payload = build_llm_ready_payload(post_processed_output, config.guardrails)
    return post_processed_output, llm_ready_payload
```

## 11. Ket luan

Raw detector output hien tai cua PCXR la hop ly cho tang model. Lop post-processing nay la noi bo sung cac rule can thiet de:

- bien detection thanh evidence co cau truc;
- cho UI va LLM doc an toan;
- giu provenance va audit trail;
- tranh de LLM tu suy dien nhung thu detector khong thuc su tra ve.