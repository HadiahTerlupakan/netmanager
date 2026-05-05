import { hash } from "bcryptjs";

import { logger } from "@/lib/logger";
import { checkGlobalIdentifier } from "@/lib/validations/global-identifier";
import { CustomerEventDispatcher } from "@/modules/events";

import {
  afterCustomerCreate,
  afterCustomerUpdate,
  beforeCustomerDelete,
} from "@/lib/hooks/radius-sync-hooks";
import type {
  PelangganEntity,
  PelangganWithPackageEntity,
} from "../domain/entities/PelangganEntity";
import type {
  CreatePelangganDTO,
  IPelangganRepository,
} from "../domain/ports/IPelangganRepository";
import type { Status } from "@prisma/client";
import type { CreatePelangganInput } from "./pelanggan-service.contracts";

export async function validateCreatePelangganInput(
  repository: IPelangganRepository,
  data: CreatePelangganInput,
) {
  await validateGlobalIdentifier(data.idPelanggan.trim(), "ID Pelanggan");
  await validateGlobalIdentifier(data.username.trim(), "Username");

  if (data.email) {
    await validateGlobalIdentifier(data.email.trim(), "Email");
  }

  const hargaPaketExists = await repository.checkHargaPaketExists(
    data.hargaPaketId,
  );
  if (!hargaPaketExists) {
    throw new Error("Harga Paket tidak ditemukan");
  }
}

export async function buildCreatePelangganData(
  data: CreatePelangganInput,
): Promise<CreatePelangganDTO> {
  const passwordHash = await hash(data.passwordLogin.trim(), 12);

  return {
    idPelanggan: data.idPelanggan.trim(),
    nama: data.nama.trim(),
    username: data.username.trim(),
    password: data.password.trim(),
    passwordHash,
    hargaPaketId: data.hargaPaketId,
    tipe: data.tipe,
    tanggalAktif: parseLocalDate(data.tanggalAktif),
    jatuhTempo: parseLocalDate(data.jatuhTempo),
    status: data.status,
    autoIsolir: data.autoIsolir,
    alamat: trimNullable(data.alamat),
    provinsi: trimNullable(data.provinsi),
    kabupatenKota: trimNullable(data.kabupatenKota),
    kelurahanDesa: trimNullable(data.kelurahanDesa),
    kecamatan: trimNullable(data.kecamatan),
    noTelp: trimNullable(data.noTelp),
    email: trimNullable(data.email),
    latitude: data.latitude || null,
    longitude: data.longitude || null,
    jenisDokumen: data.jenisDokumen || null,
    noDokumen: trimNullable(data.noDokumen),
    fileKTP: data.fileKTP || null,
    fileRumahSekitar: data.fileRumahSekitar || null,
    fileBAST: data.fileBAST || null,
    catatan: trimNullable(data.catatan),
    usePPN: data.usePPN ?? true,
    useDiscount: data.useDiscount ?? false,
    useProrate: data.useProrate ?? false,
    discountType: data.discountType,
    discountValue: data.discountValue,
    discountDuration: data.discountDuration,
    discountDurationUnit: data.discountDurationUnit,
    biayaInstalasi: data.biayaInstalasi,
    biayaInstalasiIsRecurring: data.biayaInstalasiIsRecurring ?? false,
    biayaInstalasiDiskon: data.biayaInstalasiDiskon,
    biayaSewaPerangkat: data.biayaSewaPerangkat,
    biayaSewaPerangkatIsRecurring: data.biayaSewaPerangkatIsRecurring ?? true,
    biayaSewaPerangkatDiskon: data.biayaSewaPerangkatDiskon,
    biayaLainnya: data.biayaLainnya,
    biayaLainnyaIsRecurring: data.biayaLainnyaIsRecurring ?? false,
    biayaLainnyaDiskon: data.biayaLainnyaDiskon,
    keteranganBiayaLainnya: trimNullable(data.keteranganBiayaLainnya),
    odpId: trimNullable(data.odpId),
    siteId: data.siteId,
  };
}

export async function syncCreatedCustomerToRadius(
  repository: IPelangganRepository,
  pelanggan: PelangganWithPackageEntity,
) {
  try {
    const syncResult = await afterCustomerCreate(undefined, pelanggan.id);
    if (!syncResult.success) {
      logger.warn(
        "[RADIUS] Auto-sync failed for customer:",
        pelanggan.username,
        syncResult.error,
      );
      await repository.updateSyncStatus(
        pelanggan.id,
        "FAILED",
        syncResult.error,
      );
      return;
    }

    await repository.updateSyncStatus(pelanggan.id, "SYNCED", null);
  } catch (syncError: unknown) {
    logger.error("[RADIUS] Auto-sync error:", syncError);
    const errorMessage =
      syncError instanceof Error ? syncError.message : "Terjadi kesalahan";
    await repository.updateSyncStatus(pelanggan.id, "FAILED", errorMessage);
  }
}

export async function triggerCustomerBilling(
  pelangganId: string,
  billingAction: CreatePelangganInput["billingAction"],
) {
  try {
    const { AutomaticBillingService } = await import("@/modules/finance");
    if (
      billingAction === "CREATE_PAID_INVOICE" ||
      billingAction === "CREATE_UNPAID_INVOICE"
    ) {
      await AutomaticBillingService.generateImmediateInvoice(
        pelangganId,
        billingAction === "CREATE_PAID_INVOICE",
      );
      return;
    }

    await AutomaticBillingService.checkAndGenerateRealtimeInvoice(pelangganId);
  } catch (billingErr) {
    logger.error(
      "[Billing] Failed to trigger invoice generation for new customer:",
      billingErr,
    );
  }
}

export function publishCreatedCustomerEvent(
  pelanggan: PelangganWithPackageEntity,
) {
  CustomerEventDispatcher.onCreated({
    customerId: pelanggan.id,
    customerName: pelanggan.nama,
    packageId: pelanggan.hargaPaketId,
    tenantId: pelanggan.tenantId ?? undefined,
  }).catch((err) =>
    logger.error(
      "Failed to publish CUSTOMER_CREATED event",
      err instanceof Error ? err : undefined,
    ),
  );
}

export async function validateDeletedCustomer(
  repository: IPelangganRepository,
  id: string,
) {
  const existing = await repository.findById(id);
  if (!existing) {
    throw new Error("Pelanggan tidak ditemukan");
  }

  const syncResult = await beforeCustomerDelete(undefined, existing.username);
  if (!syncResult.success) {
    throw new Error(
      syncResult.error || "Gagal menghapus pelanggan dari RADIUS",
    );
  }

  return existing;
}

export async function syncUpdatedCustomerStatus(
  repository: IPelangganRepository,
  input: {
    id: string;
    existing: PelangganEntity;
    pelanggan: PelangganEntity;
  },
) {
  const syncResult = await afterCustomerUpdate(undefined, input.id, {
    statusChanged: input.existing.status !== input.pelanggan.status,
    oldStatus: input.existing.status as Status,
    newStatus: input.pelanggan.status as Status,
  });

  if (!syncResult.success) {
    await repository.updateSyncStatus(
      input.id,
      "FAILED",
      syncResult.error || "Gagal sinkronisasi pelanggan ke RADIUS",
    );
    return;
  }

  await repository.updateSyncStatus(input.id, "SYNCED", null);
}

async function validateGlobalIdentifier(value: string, label: string) {
  if (label === "ID Pelanggan" && !/^\d{8}$/.test(value)) {
    throw new Error("ID Pelanggan harus 8 digit angka");
  }

  const globalCheck = await checkGlobalIdentifier(value);
  if (globalCheck.exists) {
    throw new Error(`${label} sudah digunakan sebagai ${globalCheck.role}`);
  }
}

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function trimNullable(value?: string | null) {
  return value?.trim() || null;
}
