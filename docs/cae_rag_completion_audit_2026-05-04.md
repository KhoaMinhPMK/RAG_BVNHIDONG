# CAE + RAG Completion Audit

Ngày cập nhật: 2026-05-04

## 1. Delta vừa triển khai

- CAE dock đã có loading theo stage thay vì chỉ spinner chung: thu thập ca bệnh, truy xuất evidence, tổng hợp kết quả, chuẩn bị tác vụ hoặc patch.
- CAE dock đã phân loại degraded state theo nhóm dễ hiểu hơn: timeout, bằng chứng yếu, patch bị guardrail chặn, lỗi route hoặc backend.
- Knowledge upload đã có job id thật, polling progress thật theo stage `pending -> parsing -> chunking -> embedding -> storing -> completed`.
- Upload PDF giờ được giữ lại thành source artifact bền vững và reingest cập nhật lại chính document cũ thay vì tạo document record mới rồi bỏ rơi bản cũ.
- Đã có script backfill artifact theo `checksum` cho legacy documents: `apps/api/src/scripts/backfill-document-artifacts.ts`.
- Retrieval của Knowledge Agent giờ là hybrid dense + lexical, và ranking đã cộng thêm lexical coverage, chunk corroboration và alias tiếng Việt không dấu.
- Đã có benchmark script cho reranking hiện tại: `apps/api/src/scripts/benchmark-knowledge-ranking.ts`, với bộ fixture nội bộ đang cho `dense top1 = 0/3` và `reranked top1 = 3/3`.
- `packages/rag` không còn export chunker cũ ra public API; runtime chunking contract chỉ còn nằm ở `apps/api`.

## 2. Cơ chế loading hiện có

### 2.1. Global và route-level

- `apps/web/src/components/ui/route-loader.tsx`
  - Đã có thanh progress mỏng ở top khi route đổi.
  - Hiện đang ẩn theo timer 300ms cố định, chưa bám theo trạng thái route thực sự.

- `apps/web/src/components/ui/loading-spinner.tsx`
  - Đã có spinner base, inline spinner và full-page overlay.
  - Chưa có stage model hay semantic loading theo domain.

- `apps/web/src/components/ui/loading-skeleton.tsx`
  - Đã có skeleton cho worklist, detection, explanation, draft, chat message, file item, progress và case detail.
  - Đây là lớp loading tĩnh, chưa kết nối với trạng thái pipeline backend.

### 2.2. Worklist và case upload

- `apps/web/src/app/page.tsx`
  - Đã có initial loading, polling 30 giây, countdown và trạng thái lỗi kết nối.
  - Chưa có optimistic refresh từng card hoặc diff highlight khi trạng thái case đổi.

- `apps/web/src/app/cases/new/page.tsx`
  - Đã có `uploading`, `processing`, `error`, progress bar và retry.
  - Chưa có stage từ server như `stored`, `queued`, `detected`, `indexing`.

### 2.3. Knowledge upload và ingestion

- `apps/web/src/app/knowledge/page.tsx`
  - Đã có trạng thái `uploading`, `done`, `error`.
   - Đã poll được job ingest thật và render progress bar theo stage backend.
   - Đã hiển thị được message theo stage và số chunks đã xử lý khi backend trả về.
   - Chưa có resume job sau khi refresh page hoặc reconnect sau server restart.

- `apps/api/src/lib/ingestion/types.ts`
  - Đã có type `IngestionJob` với các trạng thái `pending | parsing | chunking | embedding | storing | completed | failed`.
   - Đã có route đọc job và callback progress chạy thật từ ingestion service.
   - Hiện job store vẫn là in-memory, chưa có persistence hoặc SSE.

### 2.4. CAE / explain / draft

- `apps/web/src/components/cae/CAEDock.tsx`
  - Đã có auto-collapse, run history, evidence rail, trace toggle.
  - Mới bổ sung stage-based live loading cho run hiện tại.
  - Phân loại degraded state hiện đang suy ra từ `toolCalls` và `error` string phía client.
  - Chưa có `stage_start` hoặc `stage_done` event từ backend.

- `apps/web/src/hooks/useCAEStream.ts`
  - Đã thống nhất SSE cho brief, chat, explain, draft.
  - Chưa có explicit event cho stage progress, cache hit provenance, partial-success taxonomy.

## 3. Cốt lõi thuật toán RAG runtime đang chạy

### 3.1. Ingestion pipeline

Runtime ingestion production hiện đi theo luồng:

1. Parse PDF bằng `pdfParser.parsePDF(...)`.
2. Chuẩn hóa text bằng `cleanText(...)`.
3. Chunk tài liệu bằng `Chunker.createChunks(...)`.
4. Validate chunks.
5. Embed theo batch.
6. Lưu chunk + embedding vào bảng `chunks`.

### 3.2. Retrieval pipeline

Knowledge query runtime hiện đi theo luồng:

1. Sinh embedding cho query.
2. Gọi Supabase RPC `match_document_chunks` với:
   - `match_threshold = 0.5`
   - `match_count = max(maxResults * 5, maxResults)`
3. Đồng thời chạy lexical retrieval trên bảng `chunks` bằng `content.ilike` cho tập term fallback.
4. Annotate lexical signal trên cả dense candidates lẫn lexical candidates.
5. Group các chunk match theo document.
6. Gộp tối đa 3 đoạn nội dung riêng biệt cho mỗi tài liệu.
7. Chấm điểm document theo:
   - `bestSimilarity`
   - `bestLexicalScore`
   - độ phủ matched terms trên query
   - số chunk corroborate cho cùng document
   - bonus hoặc penalty nhẹ theo pattern query và title document.
8. Lấy top documents.
9. Dựng prompt grounded cho LLM.
10. Detect sentinel response `INSUFFICIENT_EVIDENCE` hoặc `OUT_OF_SCOPE`.
11. Trả answer + citations.

### 3.3. Ranking hiện có

`apps/api/src/agents/knowledge-ranking.ts` hiện làm ba việc chính:

- khử trùng lặp document khi nhiều chunk cùng match;
- giữ `bestSimilarity` làm nền;
- cộng lexical coverage và chunk corroboration;
- cộng bonus nhẹ cho guideline khi query thiên về điều trị hoặc quản lý, và bonus khác cho paper hoặc dataset khi query thiên về research.

Điểm cần hiểu rõ: đây vẫn chưa phải reranker thực thụ kiểu cross-encoder. Nó là heuristic reranking mạnh hơn trên tập hybrid candidates.

### 3.4. Fallback retrieval hiện có

Khi vector search lỗi hoặc không trả kết quả:

- hệ thống tách term từ query;
- query bảng `chunks` bằng `content.ilike`;
- lấy document metadata tương ứng;
- đi qua cùng hàm ranking phía trên.

Mới cập nhật hôm nay:

- term extraction giữ được Unicode tiếng Việt;
- có thêm alias không dấu để hỗ trợ corpora pha trộn;
- không còn làm vỡ `viêm phổi` thành fragment vô nghĩa kiểu `vi`, `m`, `ph`.

## 4. Chunking chi tiết của RAG runtime

### 4.1. Runtime chunker thật sự

Chunker production hiện nằm ở:

- `apps/api/src/lib/ingestion/chunker.ts`
- `apps/api/src/lib/utils/tokenizer.ts`

Không phải file `packages/rag/src/chunking/semantic-chunker.ts`.

### 4.2. Chiến lược chunking hiện tại

- tokenizer dùng `tiktoken`, không phải word-count estimate;
- mặc định runtime:
  - `max_tokens = 512`
  - `overlap_tokens = 50`
  - `preserve_paragraphs = true`
  - `preserve_sentences = true`

Luồng chunking cụ thể:

1. `cleanText` chuẩn hóa Unicode NFC, bỏ zero-width char, control char, normalize line endings.
2. Nếu bật preserve paragraph:
   - split theo paragraph bằng `\n\n+`;
   - gom nhiều paragraph vào cùng chunk cho tới khi gần chạm ngưỡng token.
3. Nếu một paragraph vượt ngưỡng:
   - tách tiếp theo sentence.
4. Nếu sentence vẫn quá dài:
   - rơi xuống tách theo token thật bằng tokenizer.
5. Overlap không ghép bừa:
   - hệ thống reserve budget trước bằng `contentMaxTokens = max_tokens - overlap_tokens`;
   - sau đó mới prepend phần overlap từ cuối chunk trước sang đầu chunk sau.

### 4.3. Validation chunk quality

Chunker hiện có kiểm tra:

- chunk quá nhỏ `< 50 tokens`;
- chunk vượt `max_tokens`;
- chunk quá đồng đều, có thể là dấu hiệu split chưa tốt.

### 4.4. Metadata chunk hiện có và còn thiếu

Type đã hỗ trợ:

- `start_page`
- `end_page`
- `section_title`
- `token_count`
- `total_chunks`

Nhưng runtime store hiện mới chắc chắn ghi:

- `token_count`
- `total_chunks`

Các trường page hoặc section chưa được populate đầy đủ trong pipeline parse/chunk/store.

### 4.5. Mismatch đã được dọn một phần

Trước đó repo có lệch giữa tài liệu hoặc code cũ với runtime production:

- `packages/rag/src/chunking/semantic-chunker.ts` nói `768 / 192` và có tokenizer ước lượng đơn giản.
- runtime thật ở `apps/api` đang dùng `512 / 50` và `tiktoken`.

Hiện export surface của `packages/rag` đã bị thu hẹp để file chunker cũ không còn là public API cạnh tranh với runtime. Việc còn lại là dọn tiếp tài liệu cũ nào vẫn mô tả `768 / 192`.

## 5. Danh sách còn thiếu để gọi là hoàn thiện

### 5.1. P0 - Cần làm trước

1. E2E browser verification cho explain và draft sau refactor SSE.
   - Compile đã sạch nhưng chưa có walkthrough live chứng minh flow end-to-end.

2. Dọn tài liệu hoặc ghi chú kỹ thuật cũ còn mô tả chunking `768/192`.
   - Runtime contract đã chốt về `512/50`.
   - Export cũ đã bị gỡ khỏi `packages/rag`, nhưng docs cũ có thể vẫn gây hiểu nhầm cho team.

### 5.2. P1 - Nên làm để chất lượng RAG đủ cứng

1. Reranker thật sự.
   - Hiện đã có benchmark cho heuristic hybrid rerank.
   - Nhưng vẫn chưa có cross-encoder reranking hoặc citation-aware rerank.

2. Expose config retrieval và chunking.
   - `match_threshold = 0.5`, `512`, `50` đang hardcode.
   - Chưa có config registry hoặc admin control an toàn.

3. Chunk provenance chi tiết hơn.
   - Chưa có anchor page hoặc section đáng tin cậy cho citation drawer.

4. Ingestion job persistence hoặc SSE.
   - Progress đã chạy thật nhưng hiện chỉ sống trong memory của API process.
   - Chưa có resume sau restart hoặc push-based updates.

5. Route loader hiện chưa bám navigation settled thật.
   - Đây là load perception gap nhỏ nhưng có thật.

### 5.3. P2 - Dọn để giảm nợ kỹ thuật

1. Legacy `/api/explain` và `/api/draft` vẫn còn vì compatibility.
2. CAE cache provenance và reused-result badge trong spec chưa được expose đầy đủ ra UI clinician.
3. Partial-success taxonomy vẫn chủ yếu suy ra ở frontend, chưa là event contract rõ ràng từ backend.

## 6. Thứ tự triển khai đề xuất tiếp theo

1. Chạy E2E browser verification cho CAE explain và draft.
2. Dọn docs cũ còn mô tả chunking `768/192`.
3. Bổ sung reranker thật sự trên top hybrid candidates.
4. Quyết định giữa persistent job store và SSE cho ingestion progress.
5. Thêm UI affordance cho reingest khi user có quyền admin.

## 7. Kết luận ngắn

Phần CAE streaming surface và khối RAG đã tiến thêm một bước đáng kể. Ba lỗ lớn nhất còn lại hiện là:

- chunking source-of-truth còn lệch giữa runtime và code cũ;
- legacy knowledge documents chưa được backfill source artifact cho reingest;
- retrieval đã có hybrid và heuristic rerank, nhưng chưa có reranker cứng hơn ở lớp sau cùng.