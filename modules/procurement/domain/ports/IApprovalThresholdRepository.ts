import type {
  ApprovalThreshold,
  ApprovalThresholdScope,
} from "../entities/ApprovalThreshold";

export interface ApprovalThresholdCreateInput {
  scope: ApprovalThresholdScope;
  roleId: string;
  minAmount: number;
  maxAmount: number | null;
  description?: string | null;
  isActive?: boolean;
  tenantId: string | null;
}

export interface ApprovalThresholdUpdateInput {
  minAmount?: number;
  maxAmount?: number | null;
  description?: string | null;
  isActive?: boolean;
}

export interface ApprovalThresholdListFilter {
  tenantId: string | null;
  scope?: ApprovalThresholdScope;
  isActive?: boolean;
  roleId?: string;
}

export interface ApprovalThresholdWithRole extends ApprovalThreshold {
  role: { id: string; name: string } | null;
}

export interface IApprovalThresholdRepository {
  create(input: ApprovalThresholdCreateInput): Promise<ApprovalThreshold>;
  update(
    id: string,
    input: ApprovalThresholdUpdateInput,
  ): Promise<ApprovalThreshold>;
  findById(id: string): Promise<ApprovalThreshold | null>;
  list(
    filter: ApprovalThresholdListFilter,
  ): Promise<ApprovalThresholdWithRole[]>;
  delete(id: string): Promise<void>;

  /**
   * Cari threshold yang aktif & cover `amount` untuk scope tertentu.
   * Digunakan oleh service guard saat approve PR/PO.
   */
  findCoveringThreshold(input: {
    tenantId: string | null;
    scope: ApprovalThresholdScope;
    amount: number;
    roleIds: string[];
  }): Promise<ApprovalThreshold | null>;
}
