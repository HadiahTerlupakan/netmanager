import { hash } from "bcryptjs";

import { logger } from "@/lib/logger";
import { checkGlobalIdentifier } from "@/lib/validations/global-identifier";
import { CustomerEventDispatcher } from "@/modules/events";
import { getResellerCustomerRelationService } from "@/modules/reseller";
import type {
  PelangganEntity,
  PelangganWithPackageEntity,
} from "../domain/entities/PelangganEntity";
import type {
  CreatePelangganDTO,
  IPelangganRepository,
} from "../domain/ports/IPelangganRepository";
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

  await getResellerCustomerRelationService().validateCustomerRelation({
    tenantId: null,
    resellerId: data.resellerId,
    resellerOutletId: data.resellerOutletId,
  });
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
    resellerId: trimNullable(data.resellerId),
    resellerOutletId: trimNullable(data.resellerOutletId),
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
    // Publish event ke BullMQ — handler async yang akan sync ke MikroTik/RADIUS
    await CustomerEventDispatcher.onCreated({
      customerId: pelanggan.id,
      customerName: pelanggan.nama,
      packageId: pelanggan.hargaPaketId,
      tenantId: pelanggan.tenantId ?? undefined,
    });
    // Status PENDING karena sync dikerjakan async oleh worker
    await repository.updateSyncStatus(pelanggan.id, "PENDING", null);
  } catch (err) {
    logger.error(
      "[Pelanggan] Gagal publish CUSTOMER_CREATED event:",
      err instanceof Error ? err : undefined,
    );
    const errorMessage =
      err instanceof Error ? err.message : "Terjadi kesalahan";
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

export async function validateDeletedCustomer(
  repository: IPelangganRepository,
  id: string,
) {
  const existing = await repository.findById(id);
  if (!existing) {
    throw new Error("Pelanggan tidak ditemukan");
  }
  // Event CUSTOMER_DELETED di-emit oleh caller setelah record benar-benar terhapus
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
  try {
    const statusChanged = input.existing.status !== input.pelanggan.status;

    if (!statusChanged) {
      // Tidak ada perubahan status — emit generic update event
      await CustomerEventDispatcher.onUpdated({
        customerId: input.pelanggan.id,
        customerName: input.pelanggan.nama,
        packageId: input.pelanggan.hargaPaketId,
        tenantId: input.pelanggan.tenantId ?? undefined,
      });
      await repository.updateSyncStatus(input.id, "PENDING", null);
      return;
    }

    const newStatus = input.pelanggan.status;
    const basePayload = {
      customerId: input.pelanggan.id,
      customerName: input.pelanggan.nama,
      oldStatus: input.existing.status,
      tenantId: input.pelanggan.tenantId ?? undefined,
    };

    // Pilih dispatcher sesuai transisi status
    if (newStatus === "ISOLIR") {
      await CustomerEventDispatcher.onIsolated({ ...basePayload, newStatus });
    } else if (newStatus === "AKTIF") {
      await CustomerEventDispatcher.onActivated({ ...basePayload, newStatus });
    } else {
      // NONAKTIF, DISMANTLE, MAINTENANCE → suspended
      await CustomerEventDispatcher.onSuspended({ ...basePayload, newStatus });
    }

    // Status PENDING karena sync dikerjakan async oleh worker
    await repository.updateSyncStatus(input.id, "PENDING", null);
  } catch (err) {
    logger.error(
      "[Pelanggan] Gagal publish customer lifecycle event:",
      err instanceof Error ? err : undefined,
    );
    const errorMessage =
      err instanceof Error ? err.message : "Terjadi kesalahan";
    await repository.updateSyncStatus(input.id, "FAILED", errorMessage);
  }
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
