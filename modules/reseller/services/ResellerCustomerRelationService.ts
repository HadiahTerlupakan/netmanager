import type { IResellerRepository } from "../domain/ports/IResellerRepository";
import { ResellerRepository } from "../repositories/ResellerRepository";

const ACTIVE_STATUS = "ACTIVE";

export interface CustomerResellerRelationInput {
  readonly tenantId: string | null;
  readonly resellerId?: string | null;
  readonly resellerOutletId?: string | null;
}

export interface CustomerResellerRelationResult {
  readonly resellerId: string | null;
  readonly resellerOutletId: string | null;
}

export class ResellerCustomerRelationService {
  constructor(
    private readonly repository: IResellerRepository = new ResellerRepository(),
  ) {}

  /** Validate customer reseller/outlet relation before persisting pelanggan. */
  async validateCustomerRelation(
    input: CustomerResellerRelationInput,
  ): Promise<CustomerResellerRelationResult> {
    const resellerId = input.resellerId?.trim() || null;
    const resellerOutletId = input.resellerOutletId?.trim() || null;

    if (!resellerId && resellerOutletId) {
      throw new Error("Reseller wajib dipilih saat outlet reseller diisi");
    }
    if (!resellerId) {
      return { resellerId: null, resellerOutletId: null };
    }

    const reseller = await this.repository.findById(input.tenantId, resellerId);
    if (!reseller) {
      throw new Error("Reseller tidak ditemukan");
    }
    if (reseller.status !== ACTIVE_STATUS) {
      throw new Error("Reseller tidak aktif");
    }
    if (!resellerOutletId) {
      return { resellerId, resellerOutletId: null };
    }

    const outlet = await this.repository.findOutletById(
      input.tenantId,
      resellerOutletId,
    );
    if (!outlet) {
      throw new Error("Outlet tidak ditemukan");
    }
    if (outlet.resellerId !== resellerId) {
      throw new Error("Outlet tidak sesuai dengan reseller");
    }
    if (outlet.status !== ACTIVE_STATUS) {
      throw new Error("Outlet tidak aktif");
    }
    return { resellerId, resellerOutletId };
  }
}

let customerRelationService: ResellerCustomerRelationService | null = null;

/** Get singleton reseller customer relation service. */
export function getResellerCustomerRelationService(): ResellerCustomerRelationService {
  if (!customerRelationService) {
    customerRelationService = new ResellerCustomerRelationService();
  }
  return customerRelationService;
}
