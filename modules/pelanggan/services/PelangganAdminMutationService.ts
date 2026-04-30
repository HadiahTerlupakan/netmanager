import { Status, TipePelanggan } from "../types/pelanggan.enums";

import {
  afterCustomerUpdate,
  beforeCustomerDelete,
} from "@/lib/hooks/radius-sync-hooks";
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
  data: {
    idPelanggan: string;
    nama: string;
    username: string;
    password: string;
    hargaPaketId: string;
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
      const updatePayload = await this.buildUpdatePayload(
        existingPelanggan,
        normalizedData,
      );
      const pelanggan = await this.pelangganRepository.updateAdminPppById(
        input.id,
        updatePayload.data,
      );

      await this.syncUpdatedCustomer(
        input,
        existingPelanggan,
        pelanggan,
        updatePayload,
      );
      await this.handleInvoiceAction(
        normalizedData.invoiceAction,
        pelanggan.id,
      );
      return sanitizePelangganResponse(pelanggan);
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
    updatePayload: { packageChanged: boolean; passwordChanged: boolean },
  ) {
    await afterCustomerUpdate(prisma, input.id, {
      statusChanged: existingPelanggan.status !== pelanggan.status,
      oldStatus: (input.existingStatus ?? existingPelanggan.status) as Status,
      newStatus: pelanggan.status as Status,
      oldUsername: existingPelanggan.username,
      newUsername: pelanggan.username,
      packageChanged: updatePayload.packageChanged,
      passwordChanged: updatePayload.passwordChanged,
    });
  }

  /** Run optional invoice action after customer update. */
  private async handleInvoiceAction(
    invoiceAction: string | null,
    pelangganId: string,
  ) {
    if (invoiceAction !== "VOID_AND_CREATE_NEW") {
      return;
    }

    const { AutomaticBillingService } = await import("@/modules/finance");
    await AutomaticBillingService.generateImmediateInvoice(pelangganId, false);
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

  /** Delete PPP customer from admin flow after access and sync checks. */
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

    const deleteSyncResult = await beforeCustomerDelete(
      prisma,
      pelanggan.username,
    );
    if (!deleteSyncResult.success) {
      throw new PelangganAdminMutationError(
        deleteSyncResult.error ?? "Gagal menghapus pelanggan dari RADIUS",
        "BAD_REQUEST",
      );
    }

    await this.pelangganRepository.delete(id);

    return {
      nama: pelanggan.nama,
      username: pelanggan.username,
    };
  }
}
