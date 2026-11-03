import type {
  ResellerEntity,
  ResellerStatusValue,
} from "../domain/entities/ResellerEntity";
import type { IResellerRepository } from "../domain/ports/IResellerRepository";
import { isPartnershipActive } from "../domain/reseller-compliance";
import { ResellerValidationError } from "../errors/reseller-errors";
import { ResellerRepository } from "../repositories/ResellerRepository";
import { ResellerComplianceService } from "./ResellerComplianceService";

const ACTIVE_STATUS = "ACTIVE";

/** Pesan penolakan per status kemitraan yang tidak boleh menerima pelanggan. */
const INACTIVE_PARTNERSHIP_MESSAGES: Record<
  Exclude<ResellerStatusValue, "ACTIVE">,
  string
> = {
  INACTIVE:
    "Reseller tidak aktif; pilih reseller aktif atau kosongkan reseller",
  SUSPENDED:
    "Kemitraan reseller sedang ditangguhkan; pelanggan baru tidak bisa ditambahkan",
  TERMINATED:
    "Kemitraan reseller sudah diakhiri; pelanggan baru tidak bisa ditambahkan",
};

/** Gerbang kepatuhan yang dipakai saat pelanggan baru ditugaskan. */
export type NewCustomerComplianceGate = Pick<
  ResellerComplianceService,
  "assertCanAcceptNewCustomer"
>;

export interface CustomerResellerRelationInput {
  readonly tenantId: string | null;
  readonly resellerId?: string | null;
  readonly resellerOutletId?: string | null;
  /**
   * Reseller pelanggan saat ini (edit). Gerbang kepatuhan hanya berlaku bila
   * pelanggan baru masuk ke reseller ini; pelanggan lama tidak terdampak.
   */
  readonly currentResellerId?: string | null;
}

export interface CustomerResellerRelationResult {
  readonly resellerId: string | null;
  readonly resellerOutletId: string | null;
}

export class ResellerCustomerRelationService {
  constructor(
    private readonly repository: IResellerRepository = new ResellerRepository(),
    private readonly complianceGate: NewCustomerComplianceGate = new ResellerComplianceService(),
  ) {}

  /**
   * Validate customer reseller/outlet relation before persisting pelanggan.
   * `tenantId` harus tenant pelanggan, bukan tenant sesi. Setiap pelanggaran
   * dilempar sebagai `ResellerValidationError` (400): yang salah adalah
   * pilihan di form pelanggan, bukan resource yang diminta.
   * Reseller wajib ACTIVE; bila tenant mewajibkan kepatuhan, reseller yang
   * baru dipilih juga harus patuh (izin + PKS aktif).
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
    // Pelanggan lama yang tetap di reseller yang sama (mis. pindah outlet)
    // tidak dihadang status kemitraan maupun gerbang kepatuhan.
    const isNewToReseller = resellerId !== (input.currentResellerId ?? null);
    if (isNewToReseller) {
      this.assertPartnershipActive(reseller);
      await this.complianceGate.assertCanAcceptNewCustomer(
        input.tenantId,
        reseller,
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

  private assertPartnershipActive(reseller: ResellerEntity): void {
    const status = reseller.status;
    if (isPartnershipActive(status)) return;
    throw new ResellerValidationError(INACTIVE_PARTNERSHIP_MESSAGES[status]);
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
