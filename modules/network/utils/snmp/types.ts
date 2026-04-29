/** Represents one raw SNMP walk result item. */
export interface SnmpWalkResult {
  oid: string;
  value: unknown;
  type?: number;
}

/** Sequence gap information for OID validation. */
export interface OidGap {
  from: string;
  to: string;
  count: number;
}

/** Validation result for walked OID sequences. */
export interface OidSequenceValidation {
  isValid: boolean;
  gaps: OidGap[];
  warnings: string[];
}
