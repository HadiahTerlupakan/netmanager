import type { RenewPelangganInput } from "../validators/pelanggan-renewal";
import type { IPelangganRepository } from "../domain/ports/IPelangganRepository";
import { PelangganRepository } from "../repositories/PelangganRepository";
import {
  canAccessPelangganBySite,
  getTenantScopedWhereById,
} from "./pelanggan-admin-mutation.helpers";
import {
  PelangganAdminMutationError,
  type AdminMutationSession,
} from "./PelangganAdminMutationService";

/**
 * Perpanjangan layanan dari halaman admin.
 *
 * Bagian pelanggan hanya menjaga akses tenant dan site; penerbitan serta
 * pelunasan invoice milik modul finance.
 */
export class PelangganRenewalService {
  constructor(
    private readonly pelangganRepository: IPelangganRepository = new PelangganRepository(),
  ) {}

  /** Cek akses ke pelanggan lalu perpanjang siklus tagihannya. */
  async renew(input: {
    id: string;
    session: AdminMutationSession;
    userId: string;
    data: RenewPelangganInput;
  }) {
    await this.assertCanRenew(input.id, input.session);

    const { CustomerRenewalService } = await import("@/modules/finance");
    return new CustomerRenewalService().renewCurrentCycle({
      pelangganId: input.id,
      statusBayar: input.data.statusBayar,
      paymentMethod: input.data.paymentMethod,
      reference: input.data.reference || null,
      notes: input.data.notes || null,
      userId: input.userId,
    });
  }

  private async assertCanRenew(id: string, session: AdminMutationSession) {
    const scope = getTenantScopedWhereById(session, id);
    const pelanggan = await this.pelangganRepository.findForAdminMutation(
      id,
      "tenantId" in scope ? scope.tenantId : undefined,
    );
    if (!pelanggan) {
      throw new PelangganAdminMutationError(
        "Pelanggan tidak ditemukan",
        "NOT_FOUND",
      );
    }
    if (!canAccessPelangganBySite(session, pelanggan.siteId)) {
      throw new PelangganAdminMutationError("Akses ditolak", "FORBIDDEN");
    }
  }
}
