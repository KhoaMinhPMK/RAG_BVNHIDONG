import { describe, expect, it } from 'vitest';

import {
  detectKnowledgeAnswerStatus,
  rankKnowledgeDocuments,
  type KnowledgeDocument,
} from '../agents/knowledge-ranking.js';

function createMatch(overrides: Partial<KnowledgeDocument>): KnowledgeDocument {
  return {
    document_id: 'doc',
    title: 'Untitled',
    version: 'v1.0',
    content: 'content',
    effective_date: '2026-01-01',
    status: 'active',
    similarity: 0,
    ...overrides,
  };
}

describe('rankKnowledgeDocuments', () => {
  it('deduplicates repeated documents and promotes guidance sources for treatment questions', () => {
    const ranked = rankKnowledgeDocuments(
      'Treatment guidelines for pediatric pneumonia',
      [
        createMatch({
          document_id: 'perch',
          title:
            'PERCH Study: Deep Learning for Pediatric Chest X-ray Interpretation (Chen et al., 2021)',
          content: 'perch chunk one',
          similarity: 0.72,
        }),
        createMatch({
          document_id: 'perch',
          title:
            'PERCH Study: Deep Learning for Pediatric Chest X-ray Interpretation (Chen et al., 2021)',
          content: 'perch chunk two',
          similarity: 0.69,
        }),
        createMatch({
          document_id: 'who',
          title: 'WHO Pocket Book: Hospital Care for Children (3rd Edition)',
          content: 'who guidance chunk',
          similarity: 0.57,
        }),
        createMatch({
          document_id: 'vindr',
          title: 'VinDr-PCXR: Open Large-Scale Pediatric Chest X-ray Dataset (Nguyen et al., 2023)',
          content: 'vindr dataset chunk',
          similarity: 0.52,
        }),
      ],
      3
    );

    expect(ranked).toHaveLength(3);
    expect(new Set(ranked.map((document) => document.document_id)).size).toBe(3);
    expect(ranked[0]?.document_id).toBe('who');
    expect(ranked.find((document) => document.document_id === 'perch')?.content).toContain(
      'perch chunk one'
    );
    expect(ranked.find((document) => document.document_id === 'perch')?.content).toContain(
      'perch chunk two'
    );
  });

  it('keeps research documents ahead for research-oriented queries', () => {
    const ranked = rankKnowledgeDocuments(
      'Deep learning models for pediatric chest x-ray analysis',
      [
        createMatch({
          document_id: 'perch',
          title:
            'PERCH Study: Deep Learning for Pediatric Chest X-ray Interpretation (Chen et al., 2021)',
          content: 'perch research chunk',
          similarity: 0.65,
        }),
        createMatch({
          document_id: 'who',
          title: 'WHO Pocket Book: Hospital Care for Children (3rd Edition)',
          content: 'who guidance chunk',
          similarity: 0.6,
        }),
      ],
      2
    );

    expect(ranked[0]?.document_id).toBe('perch');
  });

  it('lets lexical coverage rescue documents with weaker dense similarity', () => {
    const ranked = rankKnowledgeDocuments(
      'Guideline antibiotic treatment for pediatric pneumonia',
      [
        createMatch({
          document_id: 'generic-research',
          title: 'PERCH Study: Deep Learning for Pediatric Chest X-ray Interpretation',
          content: 'deep learning dataset benchmark',
          similarity: 0.71,
          lexical_score: 0.1,
          matched_terms: ['pediatric'],
        }),
        createMatch({
          document_id: 'who-guideline',
          title: 'WHO Pocket Book: Hospital Care for Children',
          content: 'antibiotic treatment guideline for pneumonia in children',
          similarity: 0.55,
          lexical_score: 0.8,
          matched_terms: ['guideline', 'antibiotic', 'treatment', 'pneumonia'],
        }),
      ],
      2
    );

    expect(ranked[0]?.document_id).toBe('who-guideline');
  });
});

describe('detectKnowledgeAnswerStatus', () => {
  it('detects sentinel prefixes even when the model appends extra prose', () => {
    expect(
      detectKnowledgeAnswerStatus('INSUFFICIENT_EVIDENCE\n\nTrích dẫn: chưa đủ dữ liệu')
    ).toBe('insufficient_evidence');
    expect(detectKnowledgeAnswerStatus('OUT_OF_SCOPE vì câu hỏi không thuộc nhi khoa')).toBe(
      'out_of_scope'
    );
    expect(detectKnowledgeAnswerStatus('Đây là câu trả lời bình thường')).toBeNull();
  });
});