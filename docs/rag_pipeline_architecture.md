# RAG Pipeline Architecture — WebRAG Y Tế Nhi Khoa

## Tổng quan hệ thống

Hệ thống RAG (Retrieval-Augmented Generation) được xây dựng để hỗ trợ bác sĩ Nhi khoa tra cứu tài liệu y tế bằng tiếng Việt, trong khi kho tài liệu chủ yếu là tiếng Anh (WHO, nghiên cứu quốc tế). Pipeline gồm 3 giai đoạn chính: **Ingestion** (nạp tài liệu), **Retrieval** (truy xuất), và **Generation** (sinh câu trả lời).

---

## GIAI ĐOẠN 1 — INGESTION (Nạp & Xử lý Tài liệu)

### 1.1 PDF Parsing
- **Input**: File PDF (nghiên cứu, guideline, sách giáo khoa)
- **Xử lý**: Trích xuất văn bản thô, phát hiện cấu trúc đề mục (numbered headings, ALL-CAPS headings, tiêu đề có dấu hai chấm)
- **Output**: `ParsedDocument` gồm các `ParsedSection` với heading hierarchy

### 1.2 Section-Aware Chunking
- **Thuật toán**: Ưu tiên chia theo section, fallback sang flat chunking
- **Tham số**: max_tokens=512, overlap_tokens=50, preserve sentences/paragraphs
- **Contextual Prefix**: Mỗi chunk được gắn tiền tố `[Tài liệu: {title} | Phần: {heading}]` trước khi embedding (theo Anthropic Contextual Retrieval)
- **Output**: Mảng `DocumentChunk` với đầy đủ metadata (document_id, section_title, heading_hierarchy, context_prefix)

### 1.3 Batch Embedding
- **Model**: `nomic-embed-text` (Ollama local, qua Cloudflare Tunnel)
- **Dimensions**: 768 chiều
- **Đặc điểm**: `nomic-embed-text` hỗ trợ cross-lingual — embedding tiếng Việt và tiếng Anh trong cùng không gian vector
- **Xử lý**: Batch size=10, retry 3 lần, progress tracking
- **Embedding text**: `context_prefix + "\n\n" + chunk_content`

### 1.4 Storage (Supabase + pgvector)
- **Bảng**: `documents` (metadata), `chunks` (nội dung + vector)
- **Index**: HNSW (Hierarchical Navigable Small World) cho vector search, cosine similarity
- **BM25**: Column `content_tsv` là `tsvector GENERATED` từ `to_tsvector('english', content)` — tự động cập nhật khi insert/update
- **GIN Index**: Trên `content_tsv` cho full-text search

---

## GIAI ĐOẠN 2 — RETRIEVAL (Truy xuất Thông minh)

### Bước 2.1 — Query Intelligence (Song song, ~0.5-1s)

Khi bác sĩ gửi query tiếng Việt, 4 tác vụ sau chạy **đồng thời**:

#### A. Query Rewriter
- **Model**: qwen2.5:7b (Ollama), temperature=0.1
- **Mục đích**: Viết lại câu hỏi ngắn/mơ hồ thành truy vấn y khoa rõ ràng hơn
- **Ví dụ**: `"viêm phổi trẻ"` → `"Phác đồ điều trị viêm phổi ở trẻ em dưới 5 tuổi theo hướng dẫn WHO"`
- **Skip**: Bỏ qua nếu query >= 12 từ (đã đủ cụ thể)

#### B. Multi-Query Generator
- **Model**: qwen2.5:7b, temperature=0.7
- **Mục đích**: Tạo 3 biến thể diễn đạt khác nhau để tăng recall
- **Kỹ thuật**: Từ đồng nghĩa, góc nhìn khác, mức độ chi tiết khác
- **Ví dụ output**:
  - `"điều trị tăng huyết áp cần những phương pháp gì"`
  - `"cách thức điều trị bệnh tăng huyết áp"`
  - `"phương pháp điều trị tăng huyết áp hiệu quả nhất"`

#### C. HyDE — Hypothetical Document Embeddings
- **Model**: qwen2.5:7b, temperature=0.4
- **Mục đích**: Viết một đoạn văn giả định (~80 từ) như thể là trích đoạn tài liệu y khoa trả lời câu hỏi, rồi embed đoạn văn đó thay vì embed query
- **Lý do**: Tài liệu y khoa dùng ngôn ngữ kỹ thuật khác với câu hỏi của bác sĩ — embedding đoạn văn giả định rút ngắn khoảng cách ngữ nghĩa
- **Reference**: Gao et al., "Precise Zero-Shot Dense Retrieval without Relevance Labels" (2022)

#### D. Translate to English (Cross-Lingual BM25)
- **Model**: qwen2.5:7b, temperature=0.0
- **Mục đích**: Dịch query tiếng Việt sang keywords tiếng Anh y khoa để BM25 có thể match tài liệu tiếng Anh
- **Tiêu chuẩn thuật ngữ**: ICD-10, MeSH preferred
- **Ví dụ**: `"điều trị viêm phổi ở trẻ em"` → `"pneumonia treatment children"`
- **Skip**: Nếu query đã là ASCII/English (vietnameseRatio < 0.05)

**Kết quả**: Tổng cộng tối đa 6 query variants (original + rewritten + 3 multi-query + 1 HyDE)

---

### Bước 2.2 — Hybrid Search (Song song cho từng variant)

Mỗi query variant được tìm kiếm qua **2 kênh song song** trong PostgreSQL:

#### Vector Search (Dense Retrieval)
- **Embedding**: query variant → `nomic-embed-text` → vector 768 chiều
- **Thuật toán**: Cosine similarity qua HNSW index
- **Threshold**: similarity >= 0.4
- **Ưu điểm**: Hiểu ngữ nghĩa, cross-lingual (Việt-Anh trong cùng không gian)
- **Weight**: 0.6 (60%)

#### BM25 Full-Text Search (Sparse Retrieval)
- **Input**: English translation của query (từ bước D)
- **Thuật toán**: PostgreSQL `tsvector` với `ts_rank_cd`, OR logic để partial matching
- **Dictionary**: `english` stemming (children → child, treating → treat)
- **Ưu điểm**: Chính xác với thuật ngữ y khoa cụ thể (tên thuốc, mã ICD)
- **Weight**: 0.4 (40%)

#### Hybrid RRF trong SQL (PostgreSQL Function)
```
hybrid_search_chunks(
  query_embedding: vector,   -- cho vector search
  query_text: text,          -- English keywords cho BM25
  vector_weight: 0.6,
  bm25_weight: 0.4,
  rrf_k: 60,
  match_count: 20
)
```
- Kết quả từ 2 kênh được gộp bằng **Reciprocal Rank Fusion (RRF)** ngay trong SQL:
  `rrf_score = 0.6 × 1/(60 + vec_rank) + 0.4 × 1/(60 + bm25_rank)`

---

### Bước 2.3 — Multi-Query RRF Merge

- **Input**: Tối đa 6 danh sách kết quả (một per query variant)
- **Thuật toán**: Reciprocal Rank Fusion — chunk xuất hiện nhiều lần trong nhiều list sẽ được boost score
- **Formula**: `score(chunk) = Σ 1/(k + rank_i)` với k=60
- **Output**: Danh sách merged, deduplicated, ranked by fused score

---

### Bước 2.4 — Heuristic Ranking (Top-20 filter)

- **Module**: `knowledge-ranking.ts`
- **Signals kết hợp**:
  - `vector_score` (cosine similarity)
  - `bm25_score` (lexical relevance)
  - `rrf_score` (combined rank)
  - `lexical_score` (Vietnamese term matching)
  - `section_title` boost (chunk từ section liên quan)
  - Chunk corroboration (cùng section với nhiều chunks khác)
- **Output**: Top-20 candidates cho reranker

---

### Bước 2.5 — Cross-Encoder Reranker (LLM-based)

- **Model**: qwen2.5:7b, temperature=0.0
- **Mục đích**: Đánh giá chính xác độ liên quan của từng cặp (query, chunk) — không chỉ dựa vào vector similarity
- **Cơ chế**: Mỗi chunk được cho điểm 1-5 độc lập
  - 5: Trả lời trực tiếp câu hỏi
  - 4: Liên quan cao
  - 3: Liên quan một phần
  - 2: Ít liên quan
  - 1: Không liên quan
- **Concurrency**: 4 LLM calls song song
- **Threshold**: Loại bỏ chunks có score < 2
- **Latency**: ~1.1 giây cho 5 candidates
- **Output**: Top-N chunks (mặc định N=5) sau lọc

---

## GIAI ĐOẠN 3 — GENERATION (Sinh Câu trả lời)

### Bước 3.1 — Context Assembly
- Top-5 chunks được format thành context với citation headers
- Mỗi chunk có: tên tài liệu, phần, nội dung đầy đủ

### Bước 3.2 — Answer Generation
- **Provider hỗ trợ**: Ollama (local, `qwen2.5:7b`) hoặc MiMo (`mimo-v2.5-pro`, cloud)
- **System prompt**: Bác sĩ Nhi khoa chuyên nghiệp, trả lời dựa trên tài liệu y tế, không dùng emoji, tiếng Việt đầy đủ dấu
- **Output**: Câu trả lời + citation markers

### Bước 3.3 — Faithfulness Check (Post-generation verification)
- **Model**: qwen2.5:7b, temperature=0.0
- **Mục đích**: Kiểm tra sau khi sinh — mọi claim trong câu trả lời có được hỗ trợ bởi context không
- **Verdicts**:
  - `SUPPORTED` (score >= 0.7): Chấp nhận câu trả lời
  - `PARTIAL` (0.4-0.69): Câu trả lời có kèm cảnh báo
  - `UNSUPPORTED` (< 0.4): **Từ chối** — trả về thông báo "không đủ căn cứ"
- **Mục đích y tế**: Ngăn LLM hallucination trong bối cảnh y tế quan trọng

### Bước 3.4 — Response & Citations
- **Output cuối**: Câu trả lời + danh sách citations (document_id, title, version, effective_date, excerpt)
- **Status codes**: `success`, `insufficient_evidence`, `out_of_scope`
- **Fallback chain**: Nếu hybrid search fail → pure vector search → lexical search

---

## Infrastructure & Tech Stack

| Component | Technology | Chi tiết |
|---|---|---|
| Vector DB | Supabase (PostgreSQL + pgvector) | 768-dim HNSW, cosine similarity |
| BM25 | PostgreSQL tsvector | GIN index, english dictionary, OR logic |
| Embedding model | nomic-embed-text | 768-dim, cross-lingual Việt-Anh |
| Generation model (local) | qwen2.5:7b (Ollama) | Qua Cloudflare Tunnel |
| Generation model (cloud) | mimo-v2.5-pro | OpenAI-compatible API |
| Backend | Express.js + TypeScript ESM | Node.js, port 3005 |
| Frontend | Next.js 14 App Router | TypeScript, Tailwind CSS |
| Env management | dotenvx | Encrypted `.env` |

---

## Knowledge Base hiện tại

| # | Tài liệu | Chunks | Loại |
|---|---|---|---|
| 1 | WHO Pocket Book: Hospital Care for Children (3rd Ed.) | 65 | Clinical guideline |
| 2 | PERCH Study: Deep Learning for Pediatric CXR (Chen et al., 2021) | 34 | Research paper |
| 3 | VinDr-PCXR Dataset Paper (Nguyen et al., 2023) | 30 | Dataset paper |
| **Total** | | **129 chunks** | |

---

## Sơ đồ luồng tổng quát (mô tả cho biểu đồ)

```
[Bác sĩ nhập query tiếng Việt]
          |
          v
  ┌─────────────────────────────────────────────────────┐
  │         QUERY INTELLIGENCE (chạy song song)          │
  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
  │  │ Query Rewrite│  │ Multi-Query  │  │   HyDE    │  │
  │  │  (Việt→Việt) │  │  (3 variants)│  │(giả định) │  │
  │  └──────────────┘  └──────────────┘  └───────────┘  │
  │  ┌─────────────────────────────────────────────────┐ │
  │  │     Translate to English (cho BM25)             │ │
  │  └─────────────────────────────────────────────────┘ │
  └─────────────────────────────────────────────────────┘
          | (tối đa 6 query variants)
          v
  ┌─────────────────────────────────────────────────────┐
  │     HYBRID SEARCH × 6 variants (song song)          │
  │  ┌─────────────────────┐  ┌────────────────────────┐│
  │  │   Vector Search      │  │    BM25 Full-text      ││
  │  │  nomic-embed-text    │  │  tsvector 'english'    ││
  │  │  768-dim cosine sim  │  │  OR logic, stemming    ││
  │  │  weight: 0.6         │  │  weight: 0.4           ││
  │  └─────────────────────┘  └────────────────────────┘│
  │         └──────────────RRF trong SQL─────────────────┘
  └─────────────────────────────────────────────────────┘
          | (6 danh sách kết quả)
          v
  [Multi-Query RRF Merge] → deduplicate + fuse scores
          |
          v
  [Heuristic Ranking] → top-20 candidates
          |
          v
  [Cross-Encoder Reranker] → LLM score 1-5 × 4 parallel → top-5
          |
          v
  ┌─────────────────────────────────────────────────────┐
  │                   GENERATION                         │
  │  [Context Assembly] → [LLM Answer] → [Faithfulness] │
  │                         qwen2.5:7b                   │
  │             UNSUPPORTED → Từ chối trả lời            │
  └─────────────────────────────────────────────────────┘
          |
          v
  [Response + Citations → Bác sĩ]
```

---

## Các kỹ thuật nâng cao được áp dụng

| Kỹ thuật | Mục đích | Nguồn tham khảo |
|---|---|---|
| Contextual Prefix Embedding | Giảm ambiguity khi chunk mất context | Anthropic Contextual Retrieval (2024) |
| HyDE (Hypothetical Document Embeddings) | Thu hẹp khoảng cách ngữ nghĩa query-doc | Gao et al. (2022) |
| Multi-Query + RRF | Tăng recall, giảm phụ thuộc vào một cách diễn đạt | RAG survey best practices |
| Hybrid Dense+Sparse | Kết hợp hiểu nghĩa (vector) + chính xác keyword (BM25) | Pinecone Hybrid Search |
| Cross-Lingual BM25 | Giải quyết mismatch ngôn ngữ Việt query vs Anh doc | Custom solution |
| LLM Cross-Encoder Reranker | Đánh giá chính xác hơn bi-encoder trong retrieval | Cross-encoder literature |
| Faithfulness Check | Ngăn hallucination sau generation | RAGAS framework |
