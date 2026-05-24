/**
 * Scope approval threshold.
 * - PURCHASE_REQUEST: rule untuk approve PR
 * - PURCHASE_ORDER: rule untuk approve PO (atau gating create PO ≥ nominal)
 */
export type ApprovalThresholdScope = "PURCHASE_REQUEST" | "PURCHASE_ORDER";

export const APPROVAL_THRESHOLD_SCOPES: readonly ApprovalThresholdScope[] = [
  "PURCHASE_REQUEST",
  "PURCHASE_ORDER",
] as const;

export interface ApprovalThreshold {
  id: string;
  scope: ApprovalThresholdScope;
  roleId: string;
  minAmount: number;
  /** null artinya tidak ada batas atas. */
  maxAmount: number | null;
  description: string | null;
  isActive: boolean;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
