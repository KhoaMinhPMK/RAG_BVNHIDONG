# Medical Hierarchical Chunking Algorithm Spec

## 0. Document Metadata

| Field | Value |
| --- | --- |
| Document ID | MHC-ALG-001 |
| Status | Draft for architecture and implementation |
| Scope | RAG ingestion and retrieval for pediatric medical knowledge |
| Primary Surfaces | `apps/api/src/lib/ingestion/chunker.ts`, `apps/api/src/lib/ingestion/service.ts`, `apps/api/src/agents/knowledge.ts`, `packages/rag/src/chunking/semantic-chunker.ts` |
| Related Docs | `_docs/technical/RAG_INGESTION_IMPLEMENTATION_PLAN.md` |

---

## 1. Purpose

This document specifies a production-grade chunking algorithm for medical RAG, optimized for pediatric clinical guidelines, radiology references, internal SOPs, and research papers.

The goal is not just to split documents into smaller pieces. The goal is to produce retrieval units that:

1. preserve clinically meaningful boundaries;
2. retain enough local context for accurate retrieval;
3. support citation and provenance;
4. reconstruct larger context safely at retrieval time;
5. reduce context waste inside the final LLM prompt.

This algorithm is called `Medical Hierarchical Chunking` because it treats the document as a hierarchy of medical content units instead of a flat string.

---

## 2. Problem Definition

### 2.1. Why basic chunking is insufficient

A standard fixed-size or paragraph-first chunker is not enough for clinical RAG because medical documents contain:

- structured recommendations;
- tables with row and header dependencies;
- dosage, thresholds, and numeric criteria;
- section-scoped statements such as contraindications and classification systems;
- OCR noise and page-level artifacts;
- bilingual or mixed-format content;
- references whose meaning changes if headings or neighboring lines are lost.

If chunking fails, retrieval may return:

- a fragment without its heading;
- a table row without its header;
- a recommendation bullet without the qualifying sentence above it;
- a threshold statement without units;
- a sentence cut across chunk boundaries.

### 2.2. Algorithm objective

Given a parsed medical document $D$, produce a set of retrieval units $C = \{c_1, c_2, ..., c_n\}$ such that:

1. each chunk fits within the embedding budget;
2. each chunk is semantically coherent;
3. structural anchors are preserved;
4. neighboring context can be reconstructed later;
5. chunk metadata is rich enough for trust-aware retrieval and citation rendering.

---

## 3. Design Principles

### 3.1. Hierarchy before tokens

The document must first be represented as medical content blocks. Token splitting happens after that.

### 3.2. Boundary scoring over naive slicing

Chunk boundaries must be chosen by a scoring function that balances semantic continuity, structural continuity, and token budget.

### 3.3. Adaptive chunk size

Different medical content types should have different target chunk sizes.

### 3.4. Semantic carry-over instead of blind overlap

Overlap should preserve anchor information such as section titles, table headers, and list context, not just copy the last $N$ tokens.

### 3.5. Retrieval-time reconstruction

Search should operate on smaller, more precise chunks, while prompt assembly should reconstruct parent or neighboring context only when needed.

### 3.6. Provenance is a first-class output

Every chunk must carry enough metadata to support trust ranking, citation spans, and source explanation in the UI.

---

## 4. Terminology

| Term | Meaning |
| --- | --- |
| Raw Document | Original source file after text extraction |
| Block | Smallest structured unit detected from parsing, such as heading, paragraph, bullet, table row |
| Section Node | A logical node in the document tree rooted by headings or major sections |
| Atomic Unit | A merge-ready unit created from one or more blocks |
| Micro Chunk | The primary retrieval unit stored in the vector index |
| Parent Chunk | A higher-level grouping of adjacent micro chunks used for reconstruction |
| Anchor | Structural context carried across chunk boundaries, such as heading path or table header |
| Retrieval Bundle | Final context package assembled for the LLM |

---

## 5. High-Level Architecture

The algorithm has two major phases.

### 5.1. Ingest phase

`Document -> Parse -> Block Graph -> Atomic Units -> Micro Chunks -> Parent Chunks -> Index + Metadata Store`

### 5.2. Retrieval phase

`Query -> Intent Analysis -> Candidate Search on Micro Chunks -> Rerank -> Neighbor Expansion -> Parent Reconstruction -> Prompt Packing`

---

## 6. Core Data Structures

The following TypeScript-like structures define the algorithm contract.

### 6.1. Parsed medical document

```ts
type MedicalDocument = {
  documentId: string;
  sourcePath: string;
  documentType: 'guideline' | 'internal_sop' | 'research_paper' | 'radiology_reference' | 'policy' | 'other';
  language: 'vi' | 'en' | 'mixed';
  effectiveDate?: string;
  title: string;
  pages: MedicalPage[];
  metadata: {
    source: string;
    institution?: string;
    specialty?: string;
    ageGroup?: 'pediatric' | 'adult' | 'mixed';
    tags?: string[];
  };
};
```

### 6.2. Page model

```ts
type MedicalPage = {
  pageNumber: number;
  blocks: MedicalBlock[];
  pageHeader?: string;
  pageFooter?: string;
};
```

### 6.3. Block model

```ts
type BlockType =
  | 'heading'
  | 'paragraph'
  | 'bullet_item'
  | 'numbered_item'
  | 'table'
  | 'table_header'
  | 'table_row'
  | 'caption'
  | 'footnote'
  | 'reference'
  | 'metadata_line'
  | 'quote'
  | 'ocr_noise';

type MedicalBlock = {
  blockId: string;
  pageNumber: number;
  blockType: BlockType;
  text: string;
  normalizedText: string;
  tokenCount: number;
  sectionPath: string[];
  headingLevel?: number;
  listId?: string;
  tableId?: string;
  tableHeaderId?: string;
  rowIndex?: number;
  localIndex: number;
  bbox?: { x: number; y: number; width: number; height: number };
  features: {
    startsWithRecommendationCue: boolean;
    containsThreshold: boolean;
    containsUnits: boolean;
    containsAgeBand: boolean;
    containsDosage: boolean;
    containsCitationRef: boolean;
    looksLikeContinuation: boolean;
  };
};
```

### 6.4. Atomic unit

Atomic units are the merge candidates used by the boundary scorer. A long paragraph may become multiple atomic units if it exceeds a safe token budget.

```ts
type AtomicUnit = {
  atomicId: string;
  sourceBlockIds: string[];
  text: string;
  tokenCount: number;
  blockType: BlockType;
  sectionPath: string[];
  pageRange: [number, number];
  localOrder: number;
  embedding?: number[];
  semanticSummary?: string;
  anchors: ChunkAnchor[];
};
```

### 6.5. Chunk anchor

```ts
type ChunkAnchor = {
  anchorType: 'heading_path' | 'table_header' | 'list_header' | 'carry_sentence' | 'units_context' | 'page_context';
  text: string;
  priority: number;
};
```

### 6.6. Micro chunk

```ts
type MicroChunk = {
  chunkId: string;
  documentId: string;
  parentChunkId: string;
  sectionPath: string[];
  blockTypes: BlockType[];
  pageRange: [number, number];
  localOrderStart: number;
  localOrderEnd: number;
  contentText: string;
  promptText: string;
  embeddingText: string;
  tokenCount: number;
  anchorTokens: number;
  contentTokens: number;
  metadata: {
    trustTier: 'internal' | 'reference';
    source: string;
    documentType: MedicalDocument['documentType'];
    language: MedicalDocument['language'];
    ageGroup?: 'pediatric' | 'adult' | 'mixed';
    hasThreshold: boolean;
    hasDosage: boolean;
    hasTable: boolean;
    hasRecommendations: boolean;
  };
};
```

### 6.7. Parent chunk

```ts
type ParentChunk = {
  parentChunkId: string;
  documentId: string;
  sectionPath: string[];
  chunkIds: string[];
  summaryText: string;
  totalTokens: number;
  pageRange: [number, number];
};
```

### 6.8. Retrieval candidate

```ts
type RetrievalCandidate = {
  chunkId: string;
  parentChunkId: string;
  documentId: string;
  vectorScore: number;
  lexicalScore: number;
  metadataScore: number;
  hierarchyScore: number;
  supportScore: number;
  finalScore: number;
};
```

### 6.9. Retrieval bundle

```ts
type RetrievalBundle = {
  bundleId: string;
  documentId: string;
  parentChunkId: string;
  chunkIds: string[];
  assembledText: string;
  citations: Array<{
    chunkId: string;
    pageRange: [number, number];
    sectionPath: string[];
    source: string;
  }>;
  tokenCount: number;
};
```

---

## 7. Content-Type Policy

The algorithm uses different target sizes and boundary rules depending on content type.

| Content Type | Target Tokens | Soft Max | Hard Max | Anchor Strategy |
| --- | --- | --- | --- | --- |
| Narrative guideline text | 420 | 520 | 580 | heading path + carry sentence |
| Internal SOP paragraph | 360 | 460 | 520 | heading path + warning context |
| Recommendation bullets | 180 | 260 | 320 | list header + sibling bullet context |
| Table row groups | 220 | 320 | 420 | table header + unit context |
| Research paper prose | 520 | 650 | 760 | heading path + prior sentence |
| Classification criteria | 140 | 220 | 280 | heading path + criteria label |

Notes:

- `Target Tokens` is the preferred assembly size.
- `Soft Max` is where merge penalties begin.
- `Hard Max` is a hard stop.
- Table and list chunks are intentionally smaller and more anchored.

---

## 8. Ingest Algorithm

### 8.1. Step 1: Normalize document text

Input text must be normalized, but medically significant text must not be destroyed.

Required normalization rules:

1. remove OCR artifacts and duplicated headers or footers;
2. normalize whitespace and line endings;
3. preserve units such as `mg`, `mmHg`, `%`, `SpO2`, `kg`;
4. preserve decimal separators and inequality expressions like `< 92%`, `>= 50`;
5. preserve table row delimiters if available;
6. detect repeated page decorations and downweight them as noise.

Output: `MedicalDocument` with cleaned page text.

### 8.2. Step 2: Build block graph

The parser must transform each page into blocks.

Block detection priority:

1. heading;
2. table and row blocks;
3. bullet and numbered list items;
4. paragraph;
5. caption, footnote, references;
6. noise.

If the parser cannot identify layout, fallback heuristics should still attempt to detect:

- numbered headings like `1.`, `2.1.`, `III.`;
- medical headings such as `Definition`, `Indication`, `Contraindication`, `Treatment`, `Dose`, `Impression`;
- list patterns like `-`, `*`, `+`, `(1)`, `a)`.

Output: an ordered block graph with section paths.

### 8.3. Step 3: Build section tree

Every heading updates the active section path.

Example:

```txt
Hospital Care for Children
  -> Pneumonia
    -> Severe Pneumonia
      -> Treatment
```

This path becomes metadata on all descendant blocks until the next heading changes scope.

### 8.4. Step 4: Generate atomic units

Atomic units are derived from blocks using the following rules.

1. `heading` remains its own atomic unit only if needed as an anchor, not as a standalone retrieval unit.
2. `paragraph` becomes one atomic unit unless it exceeds the safe atomic budget.
3. Overlong paragraphs are split by sentence first.
4. Overlong sentences are split by clause only if they exceed the hard atomic budget.
5. `bullet_item` and `numbered_item` remain independent units but keep their list identifier.
6. `table_row` units must retain a pointer to the active table header.
7. captions and footnotes are usually not independent retrieval units unless tied to figures or tables.

Safe atomic budget recommendation:

- narrative blocks: 120 to 180 tokens;
- bullets: 60 to 120 tokens;
- table rows: 40 to 100 tokens with header metadata.

### 8.5. Step 5: Compute local semantic features

Each atomic unit may receive a local embedding for adjacency scoring.

The embedding for boundary decisions can use:

- the same embedding model used for retrieval; or
- a lighter local encoder if ingest cost matters.

Caching rule:

- compute embeddings only once per atomic unit;
- reuse them in both merge scoring and optional offline quality metrics.

### 8.6. Step 6: Merge atomic units into micro chunks

Chunk assembly is a greedy local optimization constrained by section boundaries and hard token budgets.

#### 8.6.1. Merge scoring function

For two adjacent atomic units $u_i$ and $u_{i+1}$, define:

$$
M(u_i, u_{i+1}) =
w_s S_{semantic} +
w_h S_{heading} +
w_t S_{type} +
w_l S_{list} +
w_r S_{table} +
w_n S_{numeric} +
w_c S_{citation} +
w_p S_{page} -
w_b P_{boundary} -
w_o P_{overflow} -
w_x P_{shift}
$$

Where:

- $S_{semantic}$: cosine similarity of atomic unit embeddings.
- $S_{heading}$: structural continuity score based on section path.
- $S_{type}$: compatibility score between block types.
- $S_{list}$: list continuity score if both units belong to the same list.
- $S_{table}$: table continuity score if units share table identity or header.
- $S_{numeric}$: bonus if adjacent units share threshold, unit, or criteria patterns.
- $S_{citation}$: bonus if both units reference the same source or local citation pattern.
- $S_{page}$: bonus if page transition looks like continuation.
- $P_{boundary}$: penalty if the next unit begins a new strong boundary.
- $P_{overflow}$: penalty if merged tokens exceed target or soft max.
- $P_{shift}$: semantic topic shift penalty.

#### 8.6.2. Feature definitions

Suggested normalized definitions:

$$
S_{semantic} = \cos(\mathbf{e_i}, \mathbf{e_{i+1}})
$$

$$
S_{heading} =
\begin{cases}
1.0 & \text{same section path} \\
0.6 & \text{sibling section under same parent} \\
0.0 & \text{different branch}
\end{cases}
$$

$$
S_{type} =
\begin{cases}
1.0 & \text{same compatible block family} \\
0.5 & \text{narrative to recommendation transition} \\
0.0 & \text{incompatible structure}
\end{cases}
$$

$$
P_{overflow} = \max(0, \frac{T_{projected} - T_{target}}{T_{target}})
$$

$$
P_{shift} = 1 - S_{semantic}
$$

#### 8.6.3. Default weights

Suggested starting weights:

| Feature | Weight |
| --- | --- |
| $w_s$ | 0.32 |
| $w_h$ | 0.18 |
| $w_t$ | 0.10 |
| $w_l$ | 0.10 |
| $w_r$ | 0.10 |
| $w_n$ | 0.06 |
| $w_c$ | 0.04 |
| $w_p$ | 0.03 |
| $w_b$ | 0.18 |
| $w_o$ | 0.24 |
| $w_x$ | 0.12 |

These weights are starting values, not universal constants.

#### 8.6.4. Merge decision rule

Let `currentChunk` end with unit $u_i$ and candidate next unit be $u_{i+1}$.

Append $u_{i+1}$ to `currentChunk` if and only if:

1. projected tokens do not exceed `hardMax`; and
2. either projected tokens remain under `targetTokens`, or `M(u_i, u_{i+1}) >= tau_merge`.

Suggested threshold:

$$
\tau_{merge} = 0.45
$$

with content-specific tuning.

### 8.7. Step 7: Build semantic carry-over anchors

Instead of duplicating the last $N$ raw tokens from the previous chunk, the next chunk should inherit a small set of anchors.

Anchor generation policy:

1. always include current heading path;
2. if inside a table, include table header;
3. if inside a list, include list header or introductory sentence;
4. if the previous chunk ends mid-argument, include the last complete carry sentence;
5. if numeric thresholds or units are needed, include unit context.

Important distinction:

- `embeddingText` should be concise and not overloaded with duplicated overlap;
- `promptText` can include anchors for downstream LLM reconstruction.

This prevents duplicated overlap from distorting vector space while still preserving context for generation.

### 8.8. Step 8: Build parent chunks

Parent chunks group adjacent micro chunks within the same section.

Rules:

1. parent chunks must not cross strong section boundaries;
2. parent chunks usually hold 2 to 5 micro chunks;
3. parent chunk summary should be generated from section heading and first sentence cues;
4. parent chunks are not the primary ANN index unit, but they are needed for reconstruction and citation grouping.

### 8.9. Step 9: Persist graph and metadata

Minimum storage model:

1. `micro_chunks` or current `chunks` table extended with hierarchy metadata;
2. `parent_chunks` table or a parent index encoded in metadata;
3. adjacency edges: previous and next chunk ids;
4. anchor data either in JSON metadata or dedicated columns.

Recommended metadata fields beyond the current repo state:

- `section_path`
- `page_start`, `page_end`
- `block_types`
- `parent_chunk_id`
- `trust_tier`
- `document_type`
- `has_table`
- `has_recommendations`
- `has_threshold`
- `has_dosage`

---

## 9. Ingest Pseudocode

```ts
function ingestDocument(document: MedicalDocument, config: ChunkingConfig): IngestOutput {
  const normalized = normalizeDocument(document);
  const blockGraph = buildBlockGraph(normalized);
  const sectionTree = buildSectionTree(blockGraph);
  const atomicUnits = createAtomicUnits(sectionTree, config.atomicPolicy);

  const unitEmbeddings = embedAtomicUnitsIfNeeded(atomicUnits, config.boundaryEmbedding);

  const microChunks: MicroChunk[] = [];
  let current = createEmptyChunk();

  for (const unit of atomicUnits) {
    if (current.isEmpty()) {
      current = startChunk(unit, config);
      continue;
    }

    const score = computeMergeScore(current.lastUnit, unit, current, config.weights);
    const projectedTokens = estimateProjectedTokens(current, unit, config);

    if (projectedTokens <= config.hardMax(current.contentType) &&
        (projectedTokens <= config.targetTokens(current.contentType) || score >= config.tauMerge)) {
      current.append(unit);
    } else {
      microChunks.push(finalizeChunk(current, config));
      current = startChunk(unit, config);
    }
  }

  if (!current.isEmpty()) {
    microChunks.push(finalizeChunk(current, config));
  }

  const parentChunks = buildParentChunks(microChunks, config.parentPolicy);
  const persisted = persistHierarchy(normalized, microChunks, parentChunks, config);

  return persisted;
}
```

---

## 10. Retrieval Algorithm

### 10.1. Step 1: Query intent analysis

Before retrieval, classify the query intent. This influences ranking and reconstruction.

Suggested intent classes:

- `definition`
- `diagnostic_criteria`
- `severity_threshold`
- `treatment_recommendation`
- `dose_lookup`
- `radiology_interpretation`
- `comparison_or_differential`
- `internal_policy`
- `summary`

Intent analysis can be rule-based initially and upgraded later.

### 10.2. Step 2: Query representation

Construct:

1. vector embedding for semantic search;
2. lexical terms for BM25 or text search;
3. metadata filters such as language, source tier, specialty, document type.

### 10.3. Step 3: Candidate retrieval on micro chunks

Use hybrid retrieval.

1. ANN vector search on micro chunks for semantic recall.
2. lexical search on chunk text and heading path for exact phrase support.
3. metadata filtering for scope control.

Recommended first-stage candidate counts:

- top 40 vector candidates;
- top 20 lexical candidates;
- union after deduplication.

### 10.4. Step 4: Candidate reranking

Define the retrieval score as:

$$
R(c) =
a V(c) +
b L(c) +
c T(c) +
d H(c) +
e N(c) -
f D(c)
$$

Where:

- $V(c)$: normalized vector similarity;
- $L(c)$: lexical match score;
- $T(c)$: trust and metadata score;
- $H(c)$: hierarchy alignment score;
- $N(c)$: neighbor support score;
- $D(c)$: noise or staleness penalty.

Suggested interpretations:

- `trust score` boosts internal hospital documents when query asks for operational guidance;
- `hierarchy score` boosts chunks whose section headings align with intent;
- `neighbor support` boosts candidates whose neighbors also rank well in the same section;
- `noise penalty` suppresses captions, references, or OCR fragments unless query intent explicitly requires them.

### 10.5. Step 5: Neighbor expansion

For top reranked micro chunks, expand context only when justified.

Expansion rules:

1. if candidate belongs to a table row group, pull the relevant table header and sibling rows;
2. if candidate is a bullet recommendation, pull neighboring bullets under the same list if they stay within budget;
3. if candidate is narrative text, pull previous or next micro chunk only if the same parent chunk and semantic continuity remain high;
4. if candidate is a severity or dose criterion, ensure unit context is preserved.

This avoids sending incomplete evidence into the answer model.

### 10.6. Step 6: Parent reconstruction

Multiple selected micro chunks from the same parent chunk should be grouped before prompt packing.

Bundle construction policy:

1. group by `documentId + parentChunkId`;
2. deduplicate repeated anchors;
3. preserve original order;
4. retain chunk-level citation pointers.

### 10.7. Step 7: Prompt packing

The final LLM context should be packed using a budget-aware policy.

Recommended strategy:

1. reserve budget for system prompt and user question;
2. allocate context budget per source group;
3. prefer diversity across sources until enough supporting evidence is collected;
4. within each bundle, keep heading path and citation markers;
5. drop duplicated overlap text, keep anchors only once.

### 10.8. Step 8: Output citation mapping

Each bundle must preserve:

- source title;
- page range;
- section path;
- chunk ids used;
- local span references if available.

This is necessary for UI evidence rails and trustworthy response rendering.

---

## 11. Retrieval Pseudocode

```ts
function retrieve(query: string, config: RetrievalConfig): RetrievalBundle[] {
  const intent = classifyIntent(query);
  const queryVector = embedQuery(query);
  const lexicalTerms = extractLexicalTerms(query, intent);
  const filters = deriveMetadataFilters(query, intent, config);

  const vectorCandidates = annSearch(queryVector, filters, config.vectorTopK);
  const lexicalCandidates = lexicalSearch(lexicalTerms, filters, config.lexicalTopK);
  const merged = dedupeCandidates(vectorCandidates, lexicalCandidates);

  const reranked = merged
    .map(c => rerankCandidate(c, intent, config.weights))
    .sort(byFinalScoreDesc)
    .slice(0, config.rerankTopK);

  const expanded = reranked.flatMap(c => expandNeighborsIfNeeded(c, intent, config));
  const grouped = groupIntoParentBundles(expanded);
  const packed = packBundlesForPrompt(grouped, config.promptBudget);

  return packed;
}
```

---

## 12. Edge Case Policies

### 12.1. Tables

Tables must never be chunked as naked rows without header context.

Policy:

1. create a `table_header` block;
2. group 2 to 6 rows depending on token density;
3. include unit context and column headers as anchors;
4. if table is very wide, split by row groups, not by raw token windows.

### 12.2. Recommendation lists

Recommendations often appear as bullets whose meaning depends on the introductory sentence.

Policy:

1. the introduction sentence becomes a list anchor;
2. each bullet may be indexed individually if short;
3. sibling bullets can be reconstructed together during neighbor expansion.

### 12.3. Numeric thresholds and dosage

Thresholds and dosage values are high-risk if detached from units.

Policy:

1. if a chunk contains dosage or threshold values, force-preserve unit context;
2. boost merge or anchor retention around numeric criteria;
3. suppress splitting directly between number and unit if possible.

### 12.4. OCR or noisy scans

Policy:

1. downweight or exclude blocks classified as `ocr_noise`;
2. if a page is too noisy, fallback to section-level chunking with lower confidence metadata;
3. mark chunks produced from degraded text with a retrieval penalty.

### 12.5. Mixed-language documents

Policy:

1. detect dominant language per block;
2. allow mixed-language parent chunks only if same section and semantic continuity remain high;
3. surface language in metadata for retrieval filtering.

### 12.6. Cross-page continuity

Policy:

1. if the last block of page $p$ and first block of page $p+1$ have strong structural and semantic continuity, allow chunk continuation across pages;
2. store page range metadata explicitly.

---

## 13. Storage Model Recommendation for This Repo

### 13.1. Minimum viable evolution

The current repo stores flat chunks in `chunks`. To support hierarchical chunking without a full redesign, extend the active schema with metadata fields in JSON first.

Required additions:

- `section_path`
- `parent_chunk_id`
- `page_start`
- `page_end`
- `block_types`
- `anchor_summary`
- `document_type`
- `trust_tier`

### 13.2. Preferred future schema

```sql
parent_chunks(
  id uuid primary key,
  document_id uuid not null,
  section_path text[],
  summary_text text,
  page_start int,
  page_end int,
  token_count int
)

micro_chunks(
  id uuid primary key,
  parent_chunk_id uuid not null,
  document_id uuid not null,
  content text not null,
  prompt_text text not null,
  embedding vector(768),
  section_path text[],
  page_start int,
  page_end int,
  local_order_start int,
  local_order_end int,
  metadata jsonb
)

chunk_edges(
  from_chunk_id uuid not null,
  to_chunk_id uuid not null,
  edge_type text not null
)
```

---

## 14. Integration Mapping to Current Codebase

### 14.1. Files to evolve

| File | Current role | Required evolution |
| --- | --- | --- |
| `apps/api/src/lib/ingestion/chunker.ts` | paragraph and sentence grouping + token overlap | replace with hierarchical block-to-atomic-unit assembly and anchor-aware overlap |
| `apps/api/src/lib/utils/tokenizer.ts` | token counting and simple split | keep counting, add medical-safe boundary helpers and model-aligned budgeting |
| `apps/api/src/lib/ingestion/service.ts` | parse -> chunk -> embed -> store | persist richer hierarchy metadata and parent-child links |
| `apps/api/src/agents/knowledge.ts` | vector retrieval on flat chunks | add hybrid rerank, neighbor expansion, and parent reconstruction |
| `packages/rag/src/chunking/semantic-chunker.ts` | experimental section-aware chunker | either merge into active API path or retire to avoid drift |

### 14.2. Priority sequence

1. Enrich metadata in current `chunks` storage.
2. Replace raw overlap with semantic anchors.
3. Introduce section-aware parent chunk ids.
4. Add retrieval-time neighbor expansion.
5. Add block type policies for tables and bullet recommendations.

---

## 15. Evaluation Metrics

The algorithm must be evaluated on retrieval quality, not just chunk counts.

### 15.1. Boundary quality

- `Boundary Purity`: percentage of clinically complete statements not split across chunks.
- `Table Integrity`: percentage of retrieved table chunks that retain their header.
- `List Integrity`: percentage of bullet chunks that retain list context.

### 15.2. Retrieval quality

- `Top-k Evidence Hit Rate`: whether gold evidence appears in the top $k$ candidates.
- `Citation Support Rate`: percentage of answers whose cited evidence truly supports the answer.
- `Context Waste Ratio`: proportion of prompt tokens not used by the answer.

### 15.3. System behavior

- `Average Retrieved Tokens per Answer`
- `Neighbor Expansion Trigger Rate`
- `Parent Reconstruction Success Rate`
- `Internal-vs-Reference Source Balance`

### 15.4. Medical safety checks

- `Threshold Preservation Rate`
- `Dosage Preservation Rate`
- `Negation Preservation Rate`
- `Age Band Preservation Rate`

---

## 16. Recommended Initial Configuration

```ts
const MEDICAL_HIERARCHICAL_CHUNKING_CONFIG = {
  tauMerge: 0.45,
  atomicBudgets: {
    paragraph: 180,
    bullet_item: 100,
    table_row: 80,
  },
  targets: {
    guideline: { target: 420, softMax: 520, hardMax: 580 },
    internal_sop: { target: 360, softMax: 460, hardMax: 520 },
    research_paper: { target: 520, softMax: 650, hardMax: 760 },
    recommendation_list: { target: 180, softMax: 260, hardMax: 320 },
    table_group: { target: 220, softMax: 320, hardMax: 420 },
  },
  retrieval: {
    vectorTopK: 40,
    lexicalTopK: 20,
    rerankTopK: 12,
    finalBundles: 4,
  },
};
```

These are starting parameters only. They must be tuned on the project's actual pediatric corpus.

---

## 17. Non-Goals

This spec does not require:

- LLM-based chunking as the default path;
- perfect layout parsing for every PDF;
- full multimodal figure understanding in phase 1;
- rewriting the entire database before metadata-first migration.

LLM-based chunking may still be used later for pathological documents, but it is not the baseline algorithm here.

---

## 18. Final Decision

The recommended design for this repository is:

**Document-structure-aware recursive semantic chunking with adaptive anchor overlap and retrieval-time hierarchical reconstruction.**

That means:

1. parse into blocks first;
2. score boundaries between atomic units;
3. assemble smaller, precise micro chunks;
4. preserve anchors instead of duplicating raw overlap;
5. reconstruct larger context only during retrieval;
6. keep provenance metadata throughout the pipeline.

This is the correct direction if the product goal is not just to retrieve text, but to retrieve clinically supportable evidence for CAE and medical RAG.