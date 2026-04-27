import { compare, hash } from "bcryptjs";
import { Status, TipePelanggan } from "@prisma/client";

import {
  afterCustomerUpdate,
  beforeCustomerDelete,
} from "@/lib/hooks/radius-sync-hooks";
import { prisma } from "@/modules/database";
import { canAccessSite } from "@/modules/roles";
import type { IPelangganRepository } from "../domain/ports/IPelangganRepository";
import { PelangganRepository } from "../repositories/PelangganRepository";

export class PelangganAdminMutationError extends Error {
  constructor(
    message: string,
    public readonly code: "BAD_REQUEST" | "FORBIDDEN" | "NOT_FOUND",
  ) {
    super(message);
    this.name = "PelangganAdminMutationError";
  }
}

type AdminMutationSession = {
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

const getTenantScopedWhereById = (
  session: AdminMutationSession,
  id: string,
) => {
  const tenantId = session.user.tenantId ?? null;
  const isSuperAdmin = Boolean(
    session.user.isSuperAdmin || session.user.role === "SUPER_ADMIN",
  );

  if (!tenantId && !isSuperAdmin) {
    throw new PelangganAdminMutationError(
      "Akses ditolak: tenant tidak teridentifikasi",
      "FORBIDDEN",
    );
  }

  return tenantId ? { id, tenantId } : { id };
};

const canAccessPelangganBySite = (
  session: AdminMutationSession,
  siteId: string | null | undefined,
) => {
  if (!session.user.role || session.user.role === "SUPER_ADMIN") return true;
  return canAccessSite(
    session as Parameters<typeof canAccessSite>[0],
    "pelanggan",
    siteId,
  );
};

const sanitizePelangganResponse = <
  T extends { password?: string | null; passwordHash?: string | null },
>(
  pelanggan: T,
): Omit<T, "password" | "passwordHash"> => {
  const {
    password: _password,
    passwordHash: _passwordHash,
    ...safePelanggan
  } = pelanggan;
  return safePelanggan;
};

const normalizeText = (value: string | null | undefined) => value?.trim() ?? "";

const parseEnumValue = <T extends string>(
  value: string | null,
  enumObject: Record<string, T>,
): T | null => {
  if (!value) return null;
  const normalized = value.toUpperCase();
  return (
    ((Object.values(enumObject) as string[]).find(
      (v) => v.toUpperCase() === normalized,
    ) as T) ?? null
  );
};

const toDate = (value: Date | string) =>
  value instanceof Date ? value : new Date(value);

const assertRequiredPppFields = (data: UpdatePppByIdInput["data"]) => {
  if (
    !data.idPelanggan ||
    !data.nama ||
    !data.username ||
    !data.password ||
    !data.hargaPaketId ||
    !data.tanggalAktif ||
    !data.jatuhTempo
  ) {
    throw new PelangganAdminMutationError(
      "Semua field wajib harus diisi",
      "BAD_REQUEST",
    );
  }
};

const assertValidDate = (value: Date | string, errorMessage: string) => {
  const parsedDate = toDate(value);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new PelangganAdminMutationError(errorMessage, "BAD_REQUEST");
  }

  return parsedDate;
};

const normalizeUpdatePayload = (data: UpdatePppByIdInput["data"]) => {
  assertRequiredPppFields(data);

  return {
    idPelanggan: data.idPelanggan,
    nama: data.nama,
    username: data.username,
    password: data.password,
    hargaPaketId: data.hargaPaketId,
    tipe: parseEnumValue(data.tipe, TipePelanggan),
    tanggalAktif: assertValidDate(
      data.tanggalAktif,
      "Tanggal aktif tidak valid",
    ),
    jatuhTempo: assertValidDate(
      data.jatuhTempo,
      "Tanggal jatuh tempo tidak valid",
    ),
    status: parseEnumValue(data.status, Status),
    autoIsolir: data.autoIsolir,
    email: data.email,
    siteId: data.siteId === "" ? null : data.siteId,
    invoiceAction: data.invoiceAction,
    passwordLogin: data.passwordLogin,
  };
};

const hasPasswordLoginChanged = async (
  existingPasswordHash: string | null,
  nextPasswordLogin: string | null,
) => {
  if (!nextPasswordLogin) return false;
  if (!existingPasswordHash) return true;

  try {
    return !(await compare(
      normalizeText(nextPasswordLogin),
      existingPasswordHash,
    ));
  } catch {
    return true;
  }
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
    const { id, existingStatus, session, data } = input;
    const normalizedData = normalizeUpdatePayload(data);

    const scope = getTenantScopedWhereById(session, id);
    const existingPelanggan =
      await this.pelangganRepository.findForAdminMutation(
        id,
        "tenantId" in scope ? scope.tenantId : undefined,
      );

    if (!existingPelanggan) {
      throw new PelangganAdminMutationError(
        "Pelanggan tidak ditemukan",
        "NOT_FOUND",
      );
    }

    if (!canAccessPelangganBySite(session, existingPelanggan.siteId)) {
      throw new PelangganAdminMutationError("Akses ditolak", "FORBIDDEN");
    }

    if (!canAccessPelangganBySite(session, normalizedData.siteId)) {
      throw new PelangganAdminMutationError("Akses ditolak", "FORBIDDEN");
    }

    const nextIdPelanggan = normalizeText(normalizedData.idPelanggan);
    const nextNama = normalizeText(normalizedData.nama);
    const nextUsername = normalizeText(normalizedData.username);
    const nextPassword = normalizeText(normalizedData.password);
    const nextHargaPaketId = normalizedData.hargaPaketId;
    const nextTipe = normalizedData.tipe ?? TipePelanggan.REGULER;
    const nextStatus = normalizedData.status ?? Status.AKTIF;
    const nextEmail = normalizeText(normalizedData.email) || null;
    const nextSiteId = normalizedData.siteId;
    const nextPasswordLogin = normalizeText(normalizedData.passwordLogin);
    const nextPasswordHash = nextPasswordLogin
      ? await hash(nextPasswordLogin, 12)
      : null;
    const passwordLoginChanged = await hasPasswordLoginChanged(
      existingPelanggan.passwordHash ?? null,
      nextPasswordLogin || null,
    );

    const pelanggan = await this.pelangganRepository.updateAdminPppById(id, {
      idPelanggan: nextIdPelanggan,
      nama: nextNama,
      username: nextUsername,
      password: nextPassword,
      hargaPaketId: nextHargaPaketId,
      tipe: nextTipe,
      tanggalAktif: normalizedData.tanggalAktif,
      jatuhTempo: normalizedData.jatuhTempo,
      status: nextStatus,
      autoIsolir: normalizedData.autoIsolir,
      email: nextEmail,
      siteId: nextSiteId,
      ...(nextPasswordHash ? { passwordHash: nextPasswordHash } : {}),
    });

    await afterCustomerUpdate(prisma, id, {
      statusChanged: existingPelanggan.status !== pelanggan.status,
      oldStatus: (existingStatus ?? existingPelanggan.status) as Status,
      newStatus: pelanggan.status as Status,
      oldUsername: existingPelanggan.username,
      newUsername: pelanggan.username,
      packageChanged:
        existingPelanggan.hargaPaketId !== nextHargaPaketId ||
        existingPelanggan.tipe !== nextTipe,
      passwordChanged:
        existingPelanggan.password !== nextPassword || passwordLoginChanged,
    });

    if (normalizedData.invoiceAction === "VOID_AND_CREATE_NEW") {
      const { AutomaticBillingService } = await import("@/modules/finance");
      await AutomaticBillingService.generateImmediateInvoice(
        pelanggan.id,
        false,
      );
    }

    return sanitizePelangganResponse(pelanggan);
  }

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
