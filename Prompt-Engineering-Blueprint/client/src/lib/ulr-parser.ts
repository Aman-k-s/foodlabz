/**
 * Utility to decode and validate NABL ULRs.
 * Regex: /^(TC|CC|RC)\d{4}\d{2}[0-9][0-9A-F]{8}[FP]$/i
 */

export interface UlrSegment {
  type: string;
  certNumber: string;
  year: string;
  locationNode: string;
  ledger: string;
  scopeFlag: 'F' | 'P' | string;
  isValid: boolean;
}

export const ULR_REGEX = /^(TC|CC|RC)(\d{4})(\d{2})([0-9])([0-9A-F]{8})([FP])$/i;

export function parseUlr(ulr: string): UlrSegment {
  const normalized = ulr.trim().toUpperCase();
  const match = normalized.match(ULR_REGEX);

  if (!match) {
    return {
      type: '',
      certNumber: '',
      year: '',
      locationNode: '',
      ledger: '',
      scopeFlag: '',
      isValid: false,
    };
  }

  return {
    type: match[1],
    certNumber: match[2],
    year: match[3],
    locationNode: match[4],
    ledger: match[5],
    scopeFlag: match[6],
    isValid: true,
  };
}

export function formatUlrSegment(segment: UlrSegment): string {
  if (!segment.isValid) return '';
  return `${segment.type} ${segment.certNumber} ${segment.year} ${segment.locationNode} ${segment.ledger} ${segment.scopeFlag}`;
}
