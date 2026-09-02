import { Status, TipePelanggan } from "../types/pelanggan.enums";

import { CustomerEventDispatcher } from "@/modules/events";
import { getResellerCustomerRelationService } from "@/modules/reseller";
import { logger } from "@/lib/logger";
import { prisma } from "@/modules/database";
import type { IPelangganRepository } from "../domain/ports/IPelangganRepository";
import { PelangganRepository } from "../repositories/PelangganRepository";
import {
  canAccessPelangganBySite,
  getTenantScopedWhereById,
  hashPasswordLogin,
  hasPasswordLoginChanged,
  normalizeText,
  normalizeUpdatePayload,
  sanitizePelangganResponse,
} from "./pelanggan-admin-mutation.helpers";

export class PelangganAdminMutationError extends Error {
  constructor(
    message: string,
    public readonly code: "BAD_REQUEST" | "FORBIDDEN" | "NOT_FOUND",
  ) {
    super(message);
    this.name = "PelangganAdminMutationError";
  }
}

export type AdminMutationSession = {
  user: {
    tenantId?: string | null;
    isSuperAdmin?: boolean | null;
    role?: string | null;
  };
};

export type UpdatePppByIdInput = {
  id: string;
  existingStatus?: Status;
  session: AdminMutationSession;
  /** Kapan perubahan paket diterapkan. Default IMMEDIATE (backward compatible). */
  upgradeApplyTime?: "IMMEDIATE" | "NEXT_CYCLE";
  /** Opsi prorate saat paket berubah. Default NONE (tidak ada prorate). */
  prorateOption?: "NONE" | "PRORATE_CHARGE" | "PRORATE_CREDIT";
  /** Perlakuan kredit saat downgrade. Default NONE. */
  downgradeAdjustment?: "NONE" | "REFUND" | "CREDIT";
  /** ID user yang melakukan perubahan, untuk audit log ProratePaymentLog. */
  userId?: string;
  data: {
    idPelanggan: string;
    nama: string;
    username: string;
    password: string;
    hargaPaketId: string;
    resellerId?: string | null;
    resellerOutletId?: string | null;
    tipe: string | null;
    tanggalAktif: Date | string;
    jatuhTempo: Date | string;
    status: string | null;
    autoIsolir: boolean;
    email: string | null;
    siteId: string | null;
    invoiceAction: string | null;
    passwordLogin: string | null;
  };
};

export type DeletePppByIdInput = {
  id: string;
  session: AdminMutationSession;
};

export class PelangganAdminMutationService {
  private readonly pelangganRepository: IPelangganRepository;

  constructor(
    pelangganRepository: IPelangganRepository = new PelangganRepository(),
  ) {
    this.pelangganRepository = pelangganRepository;
  }

  /** Update PPP customer data from admin flow. */
  async updatePppById(input: UpdatePppByIdInput) {
    try {
      const normalizedData = normalizeUpdatePayload(input.data);
      const existingPelanggan = await this.getExistingPelanggan(input);
      this.assertSiteAccess(input.session, existingPelanggan.siteId);
      this.assertSiteAccess(input.session, normalizedData.siteId);
      await getResellerCustomerRelationService().validateCustomerRelation({
        tenantId: input.session.user.tenantId ?? null,
        resellerId: normalizedData.resellerId,
        resellerOutletId: normalizedData.resellerOutletId,
      });
      const updatePayload = await this.buildUpdatePayload(
        existingPelanggan,
        normalizedData,
      );
      const packageChanged =
        existingPelanggan.hargaPaketId !== normalizedData.hargaPaketId;

      const pelanggan = await this.pelangganRepository.updateAdminPppById(
        input.id,
        updatePayload.data,
      );

      // Phase 7D: Handle prorate + scheduled package change (best-effort)
      if (packageChanged) {
        try {
          const { InvoiceProrateService } = await import("@/modules/finance");
          const prorateResult =
            await new InvoiceProrateService().applyPackageChange({
              pelangganId: pelanggan.id,
              oldHargaPaketId: existingPelanggan.hargaPaketId,
              newHargaPaketId: normalizedData.hargaPaketId,
              prorateOption: input.prorateOption ?? "NONE",
              downgradeAdjustment: input.downgradeAdjustment ?? "NONE",
              upgradeApplyTime: input.upgradeApplyTime ?? "IMMEDIATE",
              userId: input.userId,
            });

          // NEXT_CYCLE: InvoiceProrateService sudah revert hargaPaketId di DB.
          // Patch object in-memory supaya syncUpdatedCustomer tidak detect package change
          // (PACKAGE_CHANGED tidak di-emit sekarang — PendingPackageApplier yang emit nanti).
          if (!prorateResult.applied) {
            pelanggan.hargaPaketId = existingPelanggan.hargaPaketId;
          }
        } catch (prorateError) {
          logger.error(
            "[PelangganAdminMutationService] Prorate gagal (best-effort), update tetap dilanjutkan:",
            prorateError instanceof Error ? prorateError : undefined,
          );
        }
      }

      await this.syncUpdatedCustomer(input, existingPelanggan, pelanggan);
      const invoiceActionFailed = await this.handleInvoiceAction(
        normalizedData.invoiceAction,
        pelanggan.id,
      );
      return {
        ...sanitizePelangganResponse(pelanggan),
        ...(invoiceActionFailed ? { invoiceActionFailed: true } : {}),
      };
    } catch (error) {
      throw this.mapMutationError(error);
    }
  }

  /** Get existing pelanggan within admin mutation scope. */
  private async getExistingPelanggan(input: UpdatePppByIdInput) {
    const scope = getTenantScopedWhereById(input.session, input.id);
    const existingPelanggan =
      await this.pelangganRepository.findForAdminMutation(
        input.id,
        "tenantId" in scope ? scope.tenantId : undefined,
      );

    if (!existingPelanggan) {
      throw new PelangganAdminMutationError(
        "Pelanggan tidak ditemukan",
        "NOT_FOUND",
      );
    }

    return existingPelanggan;
  }

  /** Ensure session can access requested pelanggan site. */
  private assertSiteAccess(
    session: AdminMutationSession,
    siteId: string | null | undefined,
  ) {
    if (canAccessPelangganBySite(session, siteId)) {
      return;
    }

    throw new PelangganAdminMutationError("Akses ditolak", "FORBIDDEN");
  }

  /** Build normalized repository payload and sync metadata. */
  private async buildUpdatePayload(
    existingPelanggan: Awaited<
      ReturnType<IPelangganRepository["findForAdminMutation"]>
    >,
    normalizedData: ReturnType<typeof normalizeUpdatePayload>,
  ) {
    const nextIdPelanggan = normalizeText(normalizedData.idPelanggan);
    const nextNama = normalizeText(normalizedData.nama);
    const nextUsername = normalizeText(normalizedData.username);
    const nextPassword = normalizeText(normalizedData.password);
    const nextPasswordLogin = normalizeText(normalizedData.passwordLogin);
    const nextTipe = normalizedData.tipe ?? TipePelanggan.REGULER;
    const nextStatus = normalizedData.status ?? Status.AKTIF;
    const nextEmail = normalizeText(normalizedData.email) || null;
    const passwordLoginChanged = await hasPasswordLoginChanged(
      existingPelanggan?.passwordHash ?? null,
      nextPasswordLogin || null,
    );
    const nextPasswordHash = await hashPasswordLogin(nextPasswordLogin);

    return {
      data: {
        idPelanggan: nextIdPelanggan,
        nama: nextNama,
        username: nextUsername,
        password: nextPassword,
        hargaPaketId: normalizedData.hargaPaketId,
        resellerId: normalizedData.resellerId,
        resellerOutletId: normalizedData.resellerOutletId,
        tipe: nextTipe,
        tanggalAktif: normalizedData.tanggalAktif,
        jatuhTempo: normalizedData.jatuhTempo,
        status: nextStatus,
        autoIsolir: normalizedData.autoIsolir,
        email: nextEmail,
        siteId: normalizedData.siteId,
        ...(nextPasswordHash ? { passwordHash: nextPasswordHash } : {}),
      },
      packageChanged:
        existingPelanggan?.hargaPaketId !== normalizedData.hargaPaketId ||
        existingPelanggan?.tipe !== nextTipe,
      passwordChanged:
        existingPelanggan?.password !== nextPassword || passwordLoginChanged,
    };
  }

  /** Sync side effects after admin PPP customer update. */
  private async syncUpdatedCustomer(
    input: UpdatePppByIdInput,
    existingPelanggan: NonNullable<
      Awaited<ReturnType<IPelangganRepository["findForAdminMutation"]>>
    >,
    pelanggan: Awaited<ReturnType<IPelangganRepository["updateAdminPppById"]>>,
  ) {
    try {
      const statusChanged = existingPelanggan.status !== pelanggan.status;
      const oldStatus = (input.existingStatus ??
        existingPelanggan.status) as string;
      const newStatus = pelanggan.status as string;

      // Detect package change dan emit PACKAGE_CHANGED sebelum status event
      const packageChanged =
        existingPelanggan.hargaPaketId !== pelanggan.hargaPaketId;

      if (packageChanged) {
        await this.emitPackageChangedEvent(input, existingPelanggan, pelanggan);
      }

      if (!statusChanged) {
        // Tidak ada perubahan status — emit generic update event
        await CustomerEventDispatcher.onUpdated({
          customerId: pelanggan.id,
          customerName: pelanggan.nama,
          packageId: pelanggan.hargaPaketId,
          tenantId: pelanggan.tenantId ?? undefined,
        });
        return;
      }

      const basePayload = {
        customerId: pelanggan.id,
        customerName: pelanggan.nama,
        oldStatus,
        tenantId: pelanggan.tenantId ?? undefined,
      };

      // Pilih dispatcher sesuai transisi status
      if (newStatus === "ISOLIR") {
        await CustomerEventDispatcher.onIsolated({ ...basePayload, newStatus });
      } else if (newStatus === "AKTIF") {
        await CustomerEventDispatcher.onActivated({
          ...basePayload,
          newStatus,
        });
      } else {
        // NONAKTIF, DISMANTLE, MAINTENANCE → suspended
        await CustomerEventDispatcher.onSuspended({
          ...basePayload,
          newStatus,
        });
      }
    } catch (err) {
      logger.error(
        "[Pelanggan] Gagal publish customer update event (admin mutation):",
        err instanceof Error ? err : undefined,
      );
    }
  }

  /**
   * Emit PACKAGE_CHANGED event saat hargaPaketId pelanggan berubah.
   * Fetch context paket lama dan baru untuk payload lengkap.
   */
  private async emitPackageChangedEvent(
    input: UpdatePppByIdInput,
    existingPelanggan: NonNullable<
      Awaited<ReturnType<IPelangganRepository["findForAdminMutation"]>>
    >,
    pelanggan: Awaited<ReturnType<IPelangganRepository["updateAdminPppById"]>>,
  ) {
    try {
      const ctx = await this.resolvePackageContext(
        existingPelanggan.hargaPaketId,
        pelanggan.hargaPaketId,
      );

      const applyTime = input.upgradeApplyTime ?? "IMMEDIATE";

      const { BillingEventDispatcher } = await import("@/modules/events");
      await BillingEventDispatcher.onPackageChanged({
        customerId: pelanggan.id,
        customerName: pelanggan.nama,
        oldPackageId: existingPelanggan.hargaPaketId,
        newPackageId: pelanggan.hargaPaketId,
        oldProfileName: ctx.oldProfileName,
        newProfileName: ctx.newProfileName,
        oldPackagePrice: ctx.oldPackagePrice,
        newPackagePrice: ctx.newPackagePrice,
        applyTime,
        tenantId: pelanggan.tenantId ?? undefined,
      });
    } catch (err) {
      logger.error(
        "[Pelanggan] Gagal publish PACKAGE_CHANGED event:",
        err instanceof Error ? err : undefined,
      );
      // Tidak throw — update sudah sukses, event emit best-effort
    }
  }

  /**
   * Fetch nama profile PPP dan harga dari dua paket untuk payload PACKAGE_CHANGED.
   */
  private async resolvePackageContext(
    oldPackageId: string,
    newPackageId: string,
  ) {
    const [oldPackage, newPackage] = await Promise.all([
      prisma.hargaPaket.findUnique({
        where: { id: oldPackageId },
        select: {
          id: true,
          harga: true,
          profilePPP: { select: { name: true } },
        },
      }),
      prisma.hargaPaket.findUnique({
        where: { id: newPackageId },
        select: {
          id: true,
          harga: true,
          profilePPP: { select: { name: true } },
        },
      }),
    ]);

    return {
      oldProfileName: oldPackage?.profilePPP?.name ?? "",
      newProfileName: newPackage?.profilePPP?.name ?? "",
      oldPackagePrice: oldPackage?.harga ?? 0,
      newPackagePrice: newPackage?.harga ?? 0,
    };
  }

  /**
   * Jalankan aksi invoice opsional setelah update pelanggan.
   *
   * Update pelanggan sudah commit dan event sync sudah dipublish sebelum titik
   * ini, jadi kegagalan pembuatan invoice tidak boleh menggagalkan seluruh
   * mutasi: retry oleh admin akan mengulang update dan mem-publish ulang event
   * sync, berpotensi menghasilkan invoice ganda. Kegagalan di-log dan
   * dilaporkan lewat flag `invoiceActionFailed` di response supaya tetap
   * terlihat, bukan ditelan diam-diam.
   *
   * Aksi VOID_AND_CREATE_NEW membatalkan tagihan hidup pelanggan lebih dulu,
   * sesuai label UI "Batalkan & Buat Tagihan Baru".
   *
   * @returns true bila aksi invoice diminta tapi gagal dijalankan.
   */
  private async handleInvoiceAction(
    invoiceAction: string | null,
    pelangganId: string,
  ): Promise<boolean> {
    if (invoiceAction !== "VOID_AND_CREATE_NEW") {
      return false;
    }

    try {
      const { AutomaticBillingService } = await import("@/modules/finance");
      await AutomaticBillingService.replaceOutstandingInvoice(pelangganId);
      return false;
    } catch (invoiceError) {
      logger.error(
        `[PelangganAdminMutationService] Gagal membuat invoice untuk pelanggan ${pelangganId} setelah update ter-commit:`,
        invoiceError instanceof Error ? invoiceError : undefined,
      );
      return true;
    }
  }

  /** Map generic helper errors into route-safe mutation errors. */
  private mapMutationError(error: unknown) {
    if (error instanceof PelangganAdminMutationError) {
      return error;
    }

    const message =
      error instanceof Error ? error.message : "Permintaan tidak valid";
    return new PelangganAdminMutationError(message, "BAD_REQUEST");
  }

  /**
   * Batalkan perubahan paket yang dijadwalkan (pending package change).
   * Menghapus pendingPackageId dan pendingPackageApplyAt dari record pelanggan.
   */
  async cancelPendingPackage(input: {
    id: string;
    session: AdminMutationSession;
  }) {
    const scope = getTenantScopedWhereById(input.session, input.id);
    const result = await this.pelangganRepository.cancelPendingPackage(
      input.id,
      "tenantId" in scope ? scope.tenantId : undefined,
    );

    if (!result.found) {
      throw new PelangganAdminMutationError(
        "Pelanggan tidak ditemukan",
        "NOT_FOUND",
      );
    }

    if (!result.hasPendingPackage) {
      return {
        cancelled: false,
        reason: "Tidak ada perubahan paket yang dijadwalkan",
      };
    }

    return { cancelled: true };
  }

  /** Delete PPP customer from admin flow after access checks. */
  async deletePppById(input: DeletePppByIdInput) {
    const { id, session } = input;

    const scope = getTenantScopedWhereById(session, id);
    const pelanggan = await this.pelangganRepository.findForAdminDelete(
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

    await this.pelangganRepository.delete(id);

    // Emit event setelah record terhapus — handler async cleanup MikroTik/RADIUS
    CustomerEventDispatcher.onDeleted({
      customerId: pelanggan.id,
      customerName: pelanggan.nama,
      username: pelanggan.username,
      tenantId: pelanggan.tenantId ?? undefined,
    }).catch((err) =>
      logger.error(
        "[Pelanggan] Gagal publish CUSTOMER_DELETED event (admin mutation):",
        err instanceof Error ? err : undefined,
      ),
    );

    return {
      nama: pelanggan.nama,
      username: pelanggan.username,
    };
  }
}
