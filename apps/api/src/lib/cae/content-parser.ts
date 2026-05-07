/**
 * Content Parser for CAE Structured Output
 *
 * Parses raw LLM text output into structured blocks.
 * Handles markdown-like syntax and extracts citations.
 */

import type {
  RenderableBlock,
  CitationAnchor,
  UIAction,
  ParsedContent,
} from '../../types/cae-output.js';

interface ParserContext {
  trustLevelMap: Record<string, 'internal' | 'reference'>;
  episodeId: string;
  findingIds?: string[];
}

/**
 * Parse raw text content into structured blocks
 */
export function parseContentToBlocks(
  content: string,
  context: ParserContext
): ParsedContent {
  const blocks: RenderableBlock[] = [];
  const citations: CitationAnchor[] = [];
  const actions: UIAction[] = [];

  // Split content into sections
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

  let currentBlockText = '';
  let blockIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = normalizeMarkdownLine(lines[i]);

    if (!line || line.startsWith('<|')) {
      if (currentBlockText) {
        blocks.push(createParagraphBlock(currentBlockText));
      }
      break;
    }

    if (looksLikeTableLine(line) && i + 1 < lines.length && looksLikeTableLine(lines[i + 1])) {
      if (currentBlockText) {
        blocks.push(createParagraphBlock(currentBlockText));
        blockIndex++;
        currentBlockText = '';
      }

      const tableLines = [line];
      while (i + 1 < lines.length && looksLikeTableLine(lines[i + 1])) {
        i++;
        tableLines.push(normalizeMarkdownLine(lines[i]));
      }

      const tableBlock = parseTable(tableLines.join('\n'));
      if (tableBlock) {
        blocks.push(tableBlock);
        blockIndex++;
        continue;
      }
    }

    if (line.match(/^#{1,6}\s/)) {
      if (currentBlockText) {
        blocks.push(createParagraphBlock(currentBlockText));
        blockIndex++;
        currentBlockText = '';
      }

      const headingText = normalizeMarkdownLine(line.replace(/^#{1,6}\s+/, ''));
      blocks.push(blocks.length === 0 ? { type: 'summary', text: headingText } : createParagraphBlock(headingText));
      blockIndex++;
      continue;
    }

    // Detect warnings (lines starting with ⚠, WARNING, CAUTION, etc.)
    if (line.match(/^(⚠|WARNING|CAUTION|⚡|CRITICAL)/i)) {
      if (currentBlockText) {
        blocks.push(createParagraphBlock(currentBlockText));
        blockIndex++;
        currentBlockText = '';
      }

      const severity = line.match(/CRITICAL|⚡/i) ? 'high'
        : line.match(/CAUTION|⚠/i) ? 'caution'
        : 'info';

      const text = line.replace(/^(⚠|WARNING|CAUTION|⚡|CRITICAL):?\s*/i, '');
      blocks.push({ type: 'warning', severity, text });
      blockIndex++;
      continue;
    }

    // Detect bullet lists (lines starting with -, *, •)
    if (line.match(/^[-*•]\s|^\d+\.\s/)) {
      if (currentBlockText) {
        blocks.push(createParagraphBlock(currentBlockText));
        blockIndex++;
        currentBlockText = '';
      }

      const items: string[] = [line.replace(/^[-*•]\s|^\d+\.\s/, '')];

      // Collect consecutive bullet points
      while (i + 1 < lines.length && normalizeMarkdownLine(lines[i + 1]).match(/^[-*•]\s|^\d+\.\s/)) {
        i++;
        items.push(normalizeMarkdownLine(lines[i]).replace(/^[-*•]\s|^\d+\.\s/, ''));
      }

      blocks.push({ type: 'bullet_list', items });
      blockIndex++;
      continue;
    }

    // Detect summary (first paragraph or lines with SUMMARY marker)
    if (blocks.length === 0 && !currentBlockText) {
      // First paragraph is summary
      currentBlockText = line;

      // Collect until empty line or special marker
      while (i + 1 < lines.length && lines[i + 1] && !lines[i + 1].match(/^([-*•]|⚠|WARNING)/i)) {
        i++;
        currentBlockText += ' ' + lines[i];
      }

      blocks.push({ type: 'summary', text: currentBlockText });
      blockIndex++;
      currentBlockText = '';
      continue;
    }

    // Accumulate regular text
    currentBlockText += (currentBlockText ? ' ' : '') + line;
  }

  // Flush remaining text
  if (currentBlockText) {
    blocks.push(createParagraphBlock(currentBlockText));
  }

  // Extract citations from all blocks
  extractCitations(blocks, citations, context);

  // Generate UI actions based on content
  generateUIActions(blocks, actions, context);

  return { blocks, citations, actions };
}

function createParagraphBlock(text: string): RenderableBlock {
  return { type: 'paragraph', text };
}

function looksLikeTableLine(line: string): boolean {
  return line.includes('|') && line.split('|').filter(Boolean).length >= 2;
}

function normalizeMarkdownLine(line: string): string {
  return line
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^>\s*/, '')
    .trim();
}

/**
 * Extract citation markers [1], [2] from blocks and create CitationAnchor objects
 */
function extractCitations(
  blocks: RenderableBlock[],
  citations: CitationAnchor[],
  context: ParserContext
): void {
  blocks.forEach((block, blockIndex) => {
    let text = '';

    if (block.type === 'paragraph' || block.type === 'summary') {
      text = block.text;
    } else if (block.type === 'bullet_list') {
      text = block.items.join(' ');
    } else if (block.type === 'warning') {
      text = block.text;
    }

    // Find all [N] markers
    const matches = text.matchAll(/\[(\d+)\]/g);

    for (const match of matches) {
      const citationId = match[1];

      // Check if already added
      if (citations.some(c => c.citationId === citationId)) {
        continue;
      }

      // Create placeholder citation (will be enriched by knowledge base results)
      citations.push({
        citationId,
        blockIndex,
        trustLevel: 'reference', // Default, will be updated
        documentId: `doc-${citationId}`,
        documentTitle: `Source ${citationId}`,
        excerpt: '',
        similarity: 0.8,
      });
    }
  });
}

/**
 * Generate UI actions based on content analysis
 */
function generateUIActions(
  blocks: RenderableBlock[],
  actions: UIAction[],
  context: ParserContext
): void {
  // Check if content mentions specific findings
  const findingKeywords = [
    'đông đặc', 'tràn dịch', 'thâm nhiễm', 'tổn thương',
    'infiltrate', 'effusion', 'opacity', 'consolidation'
  ];

  const hasFindings = blocks.some(block => {
    const text = block.type === 'paragraph' || block.type === 'summary'
      ? block.text.toLowerCase()
      : '';
    return findingKeywords.some(kw => text.includes(kw));
  });

  if (hasFindings && context.findingIds && context.findingIds.length > 0) {
    // Suggest focusing on first finding
    actions.push({
      type: 'focus_finding',
      findingId: context.findingIds[0],
      zoom: 1.5,
      ttlMs: 5000,
    });
  }

  // Check if content has high-severity warnings
  const hasHighWarning = blocks.some(
    block => block.type === 'warning' && block.severity === 'high'
  );

  if (hasHighWarning) {
    actions.push({
      type: 'dock_state',
      state: 'focus',
    });
  }
}

/**
 * Enrich citations with actual knowledge base results
 */
export function enrichCitations(
  citations: CitationAnchor[],
  kbResults: Array<{
    document_id: string;
    document_title: string;
    content: string;
    similarity: number;
    source?: string;
    version?: string;
    effective_date?: string;
  }>,
  trustLevelMap: Record<string, 'internal' | 'reference'>
): void {
  kbResults.forEach((result, index) => {
    const citationId = String(index + 1);
    const citation = citations.find(c => c.citationId === citationId);

    if (citation) {
      citation.documentId = result.document_id;
      citation.documentTitle = result.document_title;
      citation.excerpt = result.content.slice(0, 300);
      citation.similarity = result.similarity;
      citation.trustLevel = trustLevelMap[result.document_id] ||
        (result.source === 'Internal' ? 'internal' : 'reference');
      citation.version = result.version;
      citation.effectiveDate = result.effective_date;
    }
  });
}

/**
 * Parse table from markdown-like syntax
 */
export function parseTable(text: string): RenderableBlock | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  if (lines.length < 2) return null;

  // Check if it looks like a table (has | separators)
  if (!lines[0].includes('|')) return null;

  const columns = lines[0].split('|').map(c => c.trim()).filter(Boolean);

  // Skip separator line if present (e.g., |---|---|)
  const dataStart = lines[1].match(/^[\s|:-]+$/) ? 2 : 1;

  const rows = lines.slice(dataStart).map(line =>
    line.split('|').map(c => c.trim()).filter(Boolean)
  );

  return {
    type: 'table',
    columns,
    rows,
  };
}
