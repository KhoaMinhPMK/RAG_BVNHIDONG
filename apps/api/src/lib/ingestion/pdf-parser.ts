/**
 * PDF Parser
 *
 * Extracts text and metadata from PDF documents.
 * Handles medical documents with proper text extraction and cleaning.
 */

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import crypto from 'crypto';
import { ParsedDocument, DocumentMetadata } from './types.js';
import { logger } from '../utils/logger.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

// Helper to parse PDF buffer (pdf-parse v1.1.1 API)
async function parsePDFBuffer(buffer: Buffer): Promise<any> {
  return await pdfParse(buffer);
}

// ============================================================================
// PDF Parsing
// ============================================================================

export class PDFParser {
  /**
   * Parse a PDF file and extract content + metadata
   */
  async parsePDF(filePath: string): Promise<ParsedDocument> {
    try {
      logger.info('Parsing PDF', { filePath });

      // Read PDF file
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await parsePDFBuffer(dataBuffer);

      // Extract text content
      let content = pdfData.text;

      // Clean up text
      content = this.cleanText(content);

      // Extract metadata from filename or frontmatter
      const metadata = await this.extractMetadata(filePath, content);

      // Calculate stats
      const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;

      logger.info('PDF parsed successfully', {
        filePath,
        pageCount: pdfData.numpages,
        wordCount,
      });

      return {
        content,
        metadata,
        page_count: pdfData.numpages,
        word_count: wordCount,
      };
    } catch (error) {
      logger.error('PDF parsing failed', { filePath, error });
      throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean extracted text
   * - Remove excessive whitespace
   * - Fix common OCR errors
   * - Normalize line breaks
   */
  private cleanText(text: string): string {
    let cleaned = text;

    // Normalize line breaks
    cleaned = cleaned.replace(/\r\n/g, '\n');
    cleaned = cleaned.replace(/\r/g, '\n');

    // Remove excessive blank lines (more than 2 consecutive)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Remove excessive spaces
    cleaned = cleaned.replace(/ {2,}/g, ' ');

    // Trim each line
    cleaned = cleaned
      .split('\n')
      .map(line => line.trim())
      .join('\n');

    // Remove leading/trailing whitespace
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * Extract metadata from PDF
   *
   * Priority:
   * 1. Frontmatter in PDF (if exists)
   * 2. Companion .md file with same name
   * 3. Filename parsing
   * 4. Default values
   */
  private async extractMetadata(
    filePath: string,
    content: string
  ): Promise<DocumentMetadata> {
    // Try to find companion .md file
    const mdPath = filePath.replace(/\.pdf$/i, '.md');
    let frontmatter: any = null;

    try {
      const mdContent = await fs.readFile(mdPath, 'utf-8');
      const parsed = matter(mdContent);
      frontmatter = parsed.data;
      logger.info('Found companion metadata file', { mdPath });
    } catch (error) {
      // No companion file, that's okay
      logger.debug('No companion metadata file', { mdPath });
    }

    // Parse filename for metadata
    const filename = path.basename(filePath, '.pdf');
    const filenameMetadata = this.parseFilename(filename);

    // Merge metadata (frontmatter takes priority)
    const metadata: DocumentMetadata = {
      title: frontmatter?.title || filenameMetadata.title || filename,
      version: frontmatter?.version || filenameMetadata.version || 'v1.0',
      effective_date: frontmatter?.effective_date || filenameMetadata.effective_date || new Date().toISOString().split('T')[0],
      source: frontmatter?.source || filePath,
      document_type: frontmatter?.document_type || filenameMetadata.document_type || 'reference',
      specialty: frontmatter?.specialty || filenameMetadata.specialty,
      tags: frontmatter?.tags || [],
      authors: frontmatter?.authors || [],
      institution: frontmatter?.institution,
    };

    return metadata;
  }

  /**
   * Parse filename for metadata hints
   *
   * Examples:
   * - "WHO_Pneumonia_Guidelines_2024_v2.1.pdf"
   * - "BVNHIDONG_Protocol_Xray_v1.0_2024-01-15.pdf"
   */
  private parseFilename(filename: string): Partial<DocumentMetadata> {
    const metadata: Partial<DocumentMetadata> = {};

    // Extract version (v1.0, v2.1, etc.)
    const versionMatch = filename.match(/v(\d+\.\d+)/i);
    if (versionMatch) {
      metadata.version = versionMatch[0];
    }

    // Extract date (YYYY-MM-DD or YYYY)
    const dateMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      metadata.effective_date = dateMatch[0];
    } else {
      const yearMatch = filename.match(/(\d{4})/);
      if (yearMatch) {
        metadata.effective_date = `${yearMatch[0]}-01-01`;
      }
    }

    // Detect document type from keywords
    const lowerFilename = filename.toLowerCase();
    if (lowerFilename.includes('guideline') || lowerFilename.includes('huong-dan')) {
      metadata.document_type = 'guideline';
    } else if (lowerFilename.includes('protocol') || lowerFilename.includes('quy-trinh')) {
      metadata.document_type = 'protocol';
    } else if (lowerFilename.includes('research') || lowerFilename.includes('nghien-cuu')) {
      metadata.document_type = 'research';
    }

    // Detect specialty
    if (lowerFilename.includes('pneumonia') || lowerFilename.includes('viem-phoi')) {
      metadata.specialty = 'Pediatric Pneumonia';
    } else if (lowerFilename.includes('xray') || lowerFilename.includes('x-quang')) {
      metadata.specialty = 'Radiology';
    }

    // Extract title (remove version, date, extension)
    let title = filename
      .replace(/v\d+\.\d+/gi, '')
      .replace(/\d{4}-\d{2}-\d{2}/g, '')
      .replace(/\d{4}/g, '')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (title) {
      metadata.title = title;
    }

    return metadata;
  }

  /**
   * Calculate content hash for deduplication
   */
  calculateContentHash(content: string): string {
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');
  }

  /**
   * Batch parse multiple PDFs
   */
  async parseBatch(filePaths: string[]): Promise<ParsedDocument[]> {
    logger.info('Batch parsing PDFs', { count: filePaths.length });

    const results: ParsedDocument[] = [];
    const errors: Array<{ path: string; error: string }> = [];

    for (const filePath of filePaths) {
      try {
        const parsed = await this.parsePDF(filePath);
        results.push(parsed);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ path: filePath, error: errorMsg });
        logger.error('Failed to parse PDF in batch', { filePath, error: errorMsg });
      }
    }

    logger.info('Batch parsing complete', {
      total: filePaths.length,
      success: results.length,
      failed: errors.length,
    });

    if (errors.length > 0) {
      logger.warn('Some PDFs failed to parse', { errors });
    }

    return results;
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const pdfParser = new PDFParser();
