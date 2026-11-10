import { prisma } from "@/modules/database";

import { InventoryPurchaseRequestRepository } from "../repositories/InventoryPurchaseRequestRepository";
import { InventoryRepository } from "../repositories/InventoryRepository";
import {
  ensureMobileAssignedSite,
  getMobileScopedSiteIds,
  requireMobileActorScope,
} from "./mobile-inventory.service-helpers";
import {
  MobileInventoryError,
  type MobileActorLookupInput,
  type MobileInventoryRepository,
} from "./mobile-inventory.types";

/** Jumlah pengajuan per halaman di aplikasi mobile. */
export const MOBILE_RESTOCK_PAGE_SIZE = 20;

const HTTP_FORBIDDEN = 403;
const MITRA_NOT_ALLOWED =
  "Status pengajuan barang hanya untuk karyawan internal.";

type MobileRestockPageSource = Pick<
  InventoryPurchaseRequestRepository,
  "findPurchaseRequestPage"
>;

/** Satu halaman pengajuan restock beserta penanda halaman berikutnya. */
export type MobileRestockPage = Awaited<
  ReturnType<MobileRestockPageSource["findPurchaseRequestPage"]>
>;

/**
 * Daftar pengajuan barang (restock) untuk dilihat dari aplikasi mobile.
 * Hanya membaca: lingkupnya gudang di site akun, sama seperti daftar gudang
 * mobile. Akun tanpa batasan site melihat semua gudang tenant. Mitra ditolak:
 * data pengadaan (pemohon, catatan atasan) khusus karyawan internal, sama
 * seperti tile menu cepatnya yang `internalOnly`.
 */
export class MobileRestockStatusService {
  constructor(
    private readonly actorRepository: Pick<
      MobileInventoryRepository,
      "findMobileActorUser" | "findMobileActorMitra"
    > = new InventoryRepository(),
    private readonly requests: MobileRestockPageSource = new InventoryPurchaseRequestRepository(
      prisma,
    ),
  ) {}

  /** Ambil satu halaman pengajuan restock milik gudang di site pengguna. */
  async getRequestPage(
    input: MobileActorLookupInput & { cursor?: string | null },
  ): Promise<MobileRestockPage> {
    const scope = await requireMobileActorScope(this.actorRepository, input);
    if (scope.actor.type === "mitra") {
      throw new MobileInventoryError(MITRA_NOT_ALLOWED, HTTP_FORBIDDEN);
    }
    ensureMobileAssignedSite(scope);

    return this.requests.findPurchaseRequestPage({
      tenantId: input.tenantId,
      siteIds: getMobileScopedSiteIds(scope),
      limit: MOBILE_RESTOCK_PAGE_SIZE,
      cursor: input.cursor,
    });
  }
}

let mobileRestockStatusServiceInstance: MobileRestockStatusService | null =
  null;

/** Ambil singleton service status pengajuan restock mobile. */
export function getMobileRestockStatusService() {
  if (!mobileRestockStatusServiceInstance) {
    mobileRestockStatusServiceInstance = new MobileRestockStatusService();
  }
  return mobileRestockStatusServiceInstance;
}
