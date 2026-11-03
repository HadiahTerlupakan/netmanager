import type { IResellerRepository } from "../domain/ports/IResellerRepository";
import { ResellerValidationError } from "../errors/reseller-errors";
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

  /**
   * Validate customer reseller/outlet relation before persisting pelanggan.
   * `tenantId` harus tenant pelanggan, bukan tenant sesi. Setiap pelanggaran
   * dilempar sebagai `ResellerValidationError` (400): yang salah adalah
   * pilihan di form pelanggan, bukan resource yang diminta.
   */
  async validateCustomerRelation(
    input: CustomerResellerRelationInput,
  ): Promise<CustomerResellerRelationResult> {
    const resellerId = input.resellerId?.trim() || null;
    const resellerOutletId = input.resellerOutletId?.trim() || null;

    if (!resellerId && resellerOutletId) {
      throw new ResellerValidationError(
        "Reseller wajib dipilih saat outlet reseller diisi",
      );
    }
    if (!resellerId) {
      return { resellerId: null, resellerOutletId: null };
    }

    const reseller = await this.repository.findById(input.tenantId, resellerId);
    if (!reseller) {
      throw new ResellerValidationError(
        "Reseller tidak ditemukan atau sudah dihapus",
      );
    }
    if (reseller.status !== ACTIVE_STATUS) {
      throw new ResellerValidationError(
        "Reseller tidak aktif; pilih reseller aktif atau kosongkan reseller",
      );
    }
    if (!resellerOutletId) {
      return { resellerId, resellerOutletId: null };
    }

    const outlet = await this.repository.findOutletById(
      input.tenantId,
      resellerOutletId,
    );
    if (!outlet) {
      throw new ResellerValidationError(
        "Outlet reseller tidak ditemukan atau sudah dihapus",
      );
    }
    if (outlet.resellerId !== resellerId) {
      throw new ResellerValidationError("Outlet tidak sesuai dengan reseller");
    }
    if (outlet.status !== ACTIVE_STATUS) {
      throw new ResellerValidationError(
        "Outlet reseller tidak aktif; pilih outlet aktif atau kosongkan outlet",
      );
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
