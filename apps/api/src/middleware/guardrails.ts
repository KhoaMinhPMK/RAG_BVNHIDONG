import { logger } from '../utils/logger.js';
import type { ApiResponse, ErrorCode } from '../types/api.js';

/**
 * Guardrails Middleware - Enforce safety rules for LLM outputs
 * Based on yeu_cau_he_thong_rag.md Section 7
 */

interface GuardrailViolation {
  code: ErrorCode;
  message: string;
  details?: any;
}

/**
 * Check if response contains diagnosis keywords (forbidden)
 */
function checkNoDiagnosis(text: string): GuardrailViolation | null {
  const diagnosisKeywords = [
    'chẩn đoán là',
    'bệnh nhân bị',
    'kết luận',
    'xác định bệnh',
    'chắc chắn là',
    'diagnosed with',
    'patient has',
    'confirmed diagnosis',
  ];

  const lowerText = text.toLowerCase();
  const foundKeyword = diagnosisKeywords.find((kw) => lowerText.includes(kw.toLowerCase()));

  if (foundKeyword) {
    return {
      code: 'POLICY_BLOCKED',
      message: 'Response contains forbidden diagnosis statement',
      details: { keyword: foundKeyword },
    };
  }

  return null;
}

/**
 * Check if response contains prescription keywords (forbidden)
 */
function checkNoPrescription(text: string): GuardrailViolation | null {
  const prescriptionKeywords = [
    'kê đơn',
    'dùng thuốc',
    'liều lượng',
    'uống',
    'tiêm',
    'prescribe',
    'medication',
    'dosage',
    'administer',
    'treatment plan',
    'y lệnh',
  ];

  const lowerText = text.toLowerCase();
  const foundKeyword = prescriptionKeywords.find((kw) => lowerText.includes(kw.toLowerCase()));

  if (foundKeyword) {
    return {
      code: 'POLICY_BLOCKED',
      message: 'Response contains forbidden prescription statement',
      details: { keyword: foundKeyword },
    };
  }

  return null;
}

/**
 * Check if response has required citations
 */
function checkCitationRequired(
  text: string,
  citations: any[] | undefined
): GuardrailViolation | null {
  // If response is substantive (> 50 chars) but has no citations
  if (text.length > 50 && (!citations || citations.length === 0)) {
    return {
      code: 'POLICY_BLOCKED',
      message: 'Substantive response must include citations',
      details: { textLength: text.length, citationCount: 0 },
    };
  }

  return null;
}

/**
 * Check if response is out of scope
 */
function checkOutOfScope(text: string): boolean {
  const outOfScopeIndicators = [
    'OUT_OF_SCOPE',
    'ngoài phạm vi',
    'không thuộc chuyên môn',
    'out of scope',
    'beyond my expertise',
  ];

  const lowerText = text.toLowerCase();
  return outOfScopeIndicators.some((indicator) => lowerText.includes(indicator.toLowerCase()));
}

/**
 * Check if response indicates insufficient evidence
 */
function checkInsufficientEvidence(text: string): boolean {
  const insufficientIndicators = [
    'INSUFFICIENT_EVIDENCE',
    'không đủ bằng chứng',
    'thiếu thông tin',
    'insufficient evidence',
    'not enough information',
    'cần bổ sung',
  ];

  const lowerText = text.toLowerCase();
  return insufficientIndicators.some((indicator) => lowerText.includes(indicator.toLowerCase()));
}

/**
 * Sanitize response - remove sensitive patterns
 */
function sanitizeResponse(text: string): string {
  // Remove potential PII patterns (basic)
  let sanitized = text;

  // Remove phone numbers (Vietnamese format)
  sanitized = sanitized.replace(/\b0\d{9}\b/g, '[REDACTED_PHONE]');

  // Remove email addresses
  sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]');

  // Remove potential ID numbers (basic pattern)
  sanitized = sanitized.replace(/\b\d{9,12}\b/g, '[REDACTED_ID]');

  return sanitized;
}

/**
 * Main guardrail validation function
 */
export function validateResponse(
  response: any,
  options: {
    requireCitations?: boolean;
    allowDiagnosis?: boolean;
    allowPrescription?: boolean;
  } = {}
): { valid: boolean; violations: GuardrailViolation[]; sanitized?: any } {
  const violations: GuardrailViolation[] = [];

  // Extract text content
  const text = response.answer || response.explanation || response.response || '';

  // Check 1: No diagnosis (unless explicitly allowed)
  if (!options.allowDiagnosis) {
    const diagnosisViolation = checkNoDiagnosis(text);
    if (diagnosisViolation) {
      violations.push(diagnosisViolation);
    }
  }

  // Check 2: No prescription (unless explicitly allowed)
  if (!options.allowPrescription) {
    const prescriptionViolation = checkNoPrescription(text);
    if (prescriptionViolation) {
      violations.push(prescriptionViolation);
    }
  }

  // Check 3: Citation required (if enabled)
  if (options.requireCitations !== false) {
    const citationViolation = checkCitationRequired(text, response.citations);
    if (citationViolation) {
      violations.push(citationViolation);
    }
  }

  // Check 4: Out of scope detection (not a violation, just status)
  const isOutOfScope = checkOutOfScope(text);
  if (isOutOfScope && response.status !== 'out_of_scope') {
    response.status = 'out_of_scope';
  }

  // Check 5: Insufficient evidence detection (not a violation, just status)
  const isInsufficientEvidence = checkInsufficientEvidence(text);
  if (isInsufficientEvidence && response.status !== 'insufficient_evidence') {
    response.status = 'insufficient_evidence';
  }

  // Sanitize response
  const sanitized = {
    ...response,
    answer: response.answer ? sanitizeResponse(response.answer) : undefined,
    explanation: response.explanation ? sanitizeResponse(response.explanation) : undefined,
  };

  return {
    valid: violations.length === 0,
    violations,
    sanitized,
  };
}

/**
 * Express middleware wrapper
 */
export function guardrailsMiddleware(
  options: {
    requireCitations?: boolean;
    allowDiagnosis?: boolean;
    allowPrescription?: boolean;
  } = {}
) {
  return (req: any, res: any, next: any) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to validate before sending
    res.json = (body: any) => {
      // Only validate successful responses
      if (body.success !== false) {
        const validation = validateResponse(body, options);

        if (!validation.valid) {
          logger.warn('Guardrail violation detected', {
            path: req.path,
            violations: validation.violations,
          });

          // Return error response
          return originalJson({
            success: false,
            error: {
              code: validation.violations[0].code,
              message: validation.violations[0].message,
              details: validation.violations[0].details,
            },
          });
        }

        // Use sanitized response
        return originalJson(validation.sanitized);
      }

      // Pass through error responses
      return originalJson(body);
    };

    next();
  };
}

/**
 * Validate draft report fields
 */
export function validateDraftFields(fields: any[]): GuardrailViolation[] {
  const violations: GuardrailViolation[] = [];

  for (const field of fields) {
    // Check if AI-generated field has provenance
    if (field.source === 'ai' && (!field.provenance || field.provenance.length === 0)) {
      violations.push({
        code: 'POLICY_BLOCKED',
        message: `AI-generated field "${field.field_id}" missing provenance`,
        details: { field_id: field.field_id },
      });
    }

    // Check for diagnosis in field value
    const diagnosisViolation = checkNoDiagnosis(field.value);
    if (diagnosisViolation) {
      violations.push({
        ...diagnosisViolation,
        details: { field_id: field.field_id, ...diagnosisViolation.details },
      });
    }

    // Check for prescription in field value
    const prescriptionViolation = checkNoPrescription(field.value);
    if (prescriptionViolation) {
      violations.push({
        ...prescriptionViolation,
        details: { field_id: field.field_id, ...prescriptionViolation.details },
      });
    }
  }

  return violations;
}
