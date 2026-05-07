export interface KnowledgeDocument {
  document_id: string;
  title: string;
  version: string;
  content: string;
  effective_date: string;
  status: string;
  similarity?: number;
  lexical_score?: number;
  matched_terms?: string[];
}

const GUIDANCE_QUERY_PATTERN = /\b(symptom|symptoms|treat|treatment|therapy|diagnos(?:e|is)|guideline|guidelines|manag(?:e|ement)|prevent(?:ion)?|complication|recommendation|antibiotic|antibiotics)\b/i;
const RESEARCH_QUERY_PATTERN = /\b(dataset|study|research|deep learning|machine learning|model|models|algorithm|ai)\b/i;
const GUIDANCE_TITLE_PATTERN = /\b(who|guideline|pocket book|hospital care)\b/i;
const RESEARCH_TITLE_PATTERN = /\b(study|dataset|deep learning|scientific data)\b/i;

function getCoverageBonus(query: string, matchedTerms: string[]): number {
  const queryTerms = new Set(
    query
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .split(/\s+/u)
      .filter((term) => term.length >= 4)
  );

  if (queryTerms.size === 0 || matchedTerms.length === 0) {
    return 0;
  }

  const uniqueMatchedTerms = new Set(matchedTerms.map((term) => term.toLowerCase()));
  return Math.min(0.18, (uniqueMatchedTerms.size / queryTerms.size) * 0.18);
}

function getKnowledgeDocumentBonus(query: string, title: string): number {
  const normalizedQuery = query.toLowerCase();
  const normalizedTitle = title.toLowerCase();

  if (GUIDANCE_QUERY_PATTERN.test(normalizedQuery)) {
    if (GUIDANCE_TITLE_PATTERN.test(normalizedTitle)) {
      return 0.3;
    }

    if (RESEARCH_TITLE_PATTERN.test(normalizedTitle)) {
      return -0.05;
    }
  }

  if (RESEARCH_QUERY_PATTERN.test(normalizedQuery)) {
    if (RESEARCH_TITLE_PATTERN.test(normalizedTitle)) {
      return 0.15;
    }

    if (GUIDANCE_TITLE_PATTERN.test(normalizedTitle)) {
      return -0.02;
    }
  }

  return 0;
}

export function rankKnowledgeDocuments(
  query: string,
  matches: KnowledgeDocument[],
  maxResults: number
): KnowledgeDocument[] {
  const groupedDocuments = new Map<
    string,
    {
      document: KnowledgeDocument;
      contents: string[];
      bestSimilarity: number;
      bestLexicalScore: number;
      matchedTerms: Set<string>;
      firstIndex: number;
    }
  >();

  matches.forEach((match, index) => {
    const existing = groupedDocuments.get(match.document_id);
    const trimmedContent = match.content.trim();

    if (!existing) {
      groupedDocuments.set(match.document_id, {
        document: { ...match },
        contents: trimmedContent ? [trimmedContent] : [],
        bestSimilarity: match.similarity ?? 0,
        bestLexicalScore: match.lexical_score ?? 0,
        matchedTerms: new Set(match.matched_terms ?? []),
        firstIndex: index,
      });
      return;
    }

    if (
      trimmedContent &&
      !existing.contents.includes(trimmedContent) &&
      existing.contents.length < 3
    ) {
      existing.contents.push(trimmedContent);
    }

    if ((match.similarity ?? 0) > existing.bestSimilarity) {
      existing.bestSimilarity = match.similarity ?? 0;
      existing.document = { ...existing.document, ...match };
    }

    if ((match.lexical_score ?? 0) > existing.bestLexicalScore) {
      existing.bestLexicalScore = match.lexical_score ?? 0;
    }

    for (const matchedTerm of match.matched_terms ?? []) {
      existing.matchedTerms.add(matchedTerm);
    }
  });

  return Array.from(groupedDocuments.values())
    .map(({ document, contents, bestSimilarity, bestLexicalScore, matchedTerms, firstIndex }) => ({
      document: {
        ...document,
        content: contents.join('\n\n'),
        similarity: bestSimilarity,
        lexical_score: bestLexicalScore,
        matched_terms: Array.from(matchedTerms),
      },
      score:
        bestSimilarity +
        bestLexicalScore * 0.24 +
        getCoverageBonus(query, Array.from(matchedTerms)) +
        Math.min(0.08, Math.max(contents.length - 1, 0) * 0.04) +
        getKnowledgeDocumentBonus(query, document.title),
      firstIndex,
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if ((right.document.similarity ?? 0) !== (left.document.similarity ?? 0)) {
        return (right.document.similarity ?? 0) - (left.document.similarity ?? 0);
      }

      return left.firstIndex - right.firstIndex;
    })
    .slice(0, maxResults)
    .map(({ document }) => document);
}

export function detectKnowledgeAnswerStatus(
  answer: string
): 'insufficient_evidence' | 'out_of_scope' | null {
  const normalizedAnswer = answer.trim().toUpperCase();

  if (normalizedAnswer.startsWith('INSUFFICIENT_EVIDENCE')) {
    return 'insufficient_evidence';
  }

  if (normalizedAnswer.startsWith('OUT_OF_SCOPE')) {
    return 'out_of_scope';
  }

  return null;
}