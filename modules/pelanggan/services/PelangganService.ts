import type {
  FilterOptions,
  IPelangganRepository,
} from "../domain/ports/IPelangganRepository";
import type {
  PelangganEntity,
  PelangganWithPackageEntity,
} from "../domain/entities/PelangganEntity";
import { PelangganRepository } from "../repositories/PelangganRepository";
import type {
  Status,
  TipePelanggan,
  DiscountType,
  DurasiUnit,
} from "@prisma/client";
import { hash } from "bcryptjs";
import {
  afterCustomerCreate,
  afterCustomerUpdate,
  beforeCustomerDelete,
} from "@/lib/hooks/radius-sync-hooks";
import { checkGlobalIdentifier } from "@/lib/validations/global-identifier";
import { CustomerEventDispatcher } from "@/modules/events";
import { logger } from "@/lib/logger";

export interface CreatePelangganInput {
  idPelanggan: string;
  nama: string;
  username: string;
  password: string; // PPPoE password
  passwordLogin: string; // Portal login password
  hargaPaketId: string;
  tipe: TipePelanggan;
  tanggalAktif: string; // YYYY-MM-DD format
  jatuhTempo: string; // YYYY-MM-DD format
  status: Status;
  autoIsolir?: boolean;
  alamat?: string | null;
  provinsi?: string | null;
  kabupatenKota?: string | null;
  kelurahanDesa?: string | null;
  kecamatan?: string | null;
  noTelp?: string | null;
  email?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  jenisDokumen?: string | null;
  noDokumen?: string | null;
  fileKTP?: string | null;
  fileRumahSekitar?: string | null;
  fileBAST?: string | null;
  catatan?: string | null;
  usePPN?: boolean;
  useDiscount?: boolean;
  useProrate?: boolean;
  discountType?: DiscountType | null;
  discountValue?: number | null;
  discountDuration?: number | null;
  discountDurationUnit?: DurasiUnit | null;
  biayaInstalasi?: number | null;
  biayaInstalasiIsRecurring?: boolean;
  biayaInstalasiDiskon?: number | null;
  biayaSewaPerangkat?: number | null;
  biayaSewaPerangkatIsRecurring?: boolean;
  biayaSewaPerangkatDiskon?: number | null;
  biayaLainnya?: number | null;
  biayaLainnyaIsRecurring?: boolean;
  biayaLainnyaDiskon?: number | null;
  keteranganBiayaLainnya?: string | null;
  odpId?: string | null;
  siteId?: string | null;
  billingAction?:
    | "CREATE_PAID_INVOICE"
    | "CREATE_UNPAID_INVOICE"
    | "DO_NOTHING";
}

export class PelangganService {
  private pelangganRepository: IPelangganRepository;

  constructor(
    pelangganRepository: IPelangganRepository = new PelangganRepository(),
  ) {
    this.pelangganRepository = pelangganRepository;
  }

  /** Get all customers using optional filters. */
  async getAllPelanggan(
    filter?: FilterOptions,
  ): Promise<PelangganWithPackageEntity[]> {
    return this.pelangganRepository.findAll(filter);
  }

  /** Get paginated customers using optional filters. */
  async getAllPelangganPaginated(
    filter?: FilterOptions,
    page: number = 1,
    limit: number = 10,
  ) {
    return this.pelangganRepository.findAllPaginated(filter, page, limit);
  }

  /** Get customer by internal id. */
  async getPelanggan(id: string): Promise<PelangganEntity | null> {
    return this.pelangganRepository.findById(id);
  }

  /** Get customer by customer code. */
  async getPelangganByIdPelanggan(
    idPelanggan: string,
  ): Promise<PelangganEntity | null> {
    return this.pelangganRepository.findByIdPelanggan(idPelanggan);
  }

  async createPelanggan(
    data: CreatePelangganInput,
  ): Promise<PelangganWithPackageEntity> {
    // Validate ID format (8 digits)
    if (!/^\d{8}$/.test(data.idPelanggan.trim())) {
      throw new Error("ID Pelanggan harus 8 digit angka");
    }

    // Check if ID already exists globally
    const globalIdCheck = await checkGlobalIdentifier(data.idPelanggan.trim());
    if (globalIdCheck.exists) {
      throw new Error(
        `ID Pelanggan sudah digunakan sebagai ${globalIdCheck.role}`,
      );
    }

    // Check if username already exists globally
    const globalUsernameCheck = await checkGlobalIdentifier(
      data.username.trim(),
    );
    if (globalUsernameCheck.exists) {
      throw new Error(
        `Username sudah digunakan sebagai ${globalUsernameCheck.role}`,
      );
    }

    // Check if email already exists globally if provided
    if (data.email) {
      const globalEmailCheck = await checkGlobalIdentifier(data.email.trim());
      if (globalEmailCheck.exists) {
        throw new Error(
          `Email sudah digunakan sebagai ${globalEmailCheck.role}`,
        );
      }
    }

    // Check if HargaPaket exists
    const hargaPaketExists =
      await this.pelangganRepository.checkHargaPaketExists(data.hargaPaketId);
    if (!hargaPaketExists) {
      throw new Error("Harga Paket tidak ditemukan");
    }

    // Hash passwordLogin
    const passwordHash = await hash(data.passwordLogin.trim(), 12);

    // Parse dates
    const parseLocalDate = (dateStr: string): Date => {
      const [year, month, day] = dateStr.split("-").map(Number);
      return new Date(year, month - 1, day);
    };

    // Create pelanggan
    const pelanggan = await this.pelangganRepository.create({
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
      alamat: data.alamat?.trim() || null,
      provinsi: data.provinsi?.trim() || null,
      kabupatenKota: data.kabupatenKota?.trim() || null,
      kelurahanDesa: data.kelurahanDesa?.trim() || null,
      kecamatan: data.kecamatan?.trim() || null,
      noTelp: data.noTelp?.trim() || null,
      email: data.email?.trim() || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      jenisDokumen: data.jenisDokumen || null,
      noDokumen: data.noDokumen?.trim() || null,
      fileKTP: data.fileKTP || null,
      fileRumahSekitar: data.fileRumahSekitar || null,
      fileBAST: data.fileBAST || null,
      catatan: data.catatan?.trim() || null,
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
      keteranganBiayaLainnya: data.keteranganBiayaLainnya?.trim() || null,
      odpId: data.odpId?.trim() || null,
      siteId: data.siteId,
    });

    // RADIUS Auto-Sync Hook
    try {
      const syncResult = await afterCustomerCreate(undefined, pelanggan.id);
      if (!syncResult.success) {
        logger.warn(
          "[RADIUS] Auto-sync failed for customer:",
          pelanggan.username,
          syncResult.error,
        );
        // Update DB with failure
        await this.pelangganRepository.updateSyncStatus(
          pelanggan.id,
          "FAILED",
          syncResult.error,
        );
      } else {
        // Update DB with success
        await this.pelangganRepository.updateSyncStatus(
          pelanggan.id,
          "SYNCED",
          null,
        );
      }
    } catch (syncError: unknown) {
      logger.error("[RADIUS] Auto-sync error:", syncError);
      // Update DB with failure
      const errorMessage =
        syncError instanceof Error ? syncError.message : "Terjadi kesalahan";
      await this.pelangganRepository.updateSyncStatus(
        pelanggan.id,
        "FAILED",
        errorMessage,
      );
    }

    // Handle Invoice Generation based on billingAction
    try {
      const { AutomaticBillingService } = await import("@/modules/finance");
      if (
        data.billingAction === "CREATE_PAID_INVOICE" ||
        data.billingAction === "CREATE_UNPAID_INVOICE"
      ) {
        const isPaid = data.billingAction === "CREATE_PAID_INVOICE";
        await AutomaticBillingService.generateImmediateInvoice(
          pelanggan.id,
          isPaid,
        );
      } else {
        // Postpaid: DO_NOTHING initially, but trigger realtime check
        // in case the jatuhTempo is somehow within the normal billing window
        await AutomaticBillingService.checkAndGenerateRealtimeInvoice(
          pelanggan.id,
        );
      }
    } catch (billingErr) {
      logger.error(
        "[Billing] Failed to trigger invoice generation for new customer:",
        billingErr,
      );
    }

    // Publish domain event
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

    return pelanggan;
  }

  async deletePelanggan(id: string): Promise<PelangganEntity> {
    const existing = await this.pelangganRepository.findById(id);
    if (!existing) {
      throw new Error("Pelanggan tidak ditemukan");
    }

    const syncResult = await beforeCustomerDelete(undefined, existing.username);
    if (!syncResult.success) {
      throw new Error(
        syncResult.error || "Gagal menghapus pelanggan dari RADIUS",
      );
    }

    return this.pelangganRepository.delete(id);
  }

  /** Update customer status and trigger radius synchronization. */
  async updateStatusPelanggan(
    id: string,
    status: Status,
  ): Promise<PelangganEntity> {
    const existing = await this.pelangganRepository.findById(id);
    if (!existing) {
      throw new Error("Pelanggan tidak ditemukan");
    }

    const pelanggan = await this.pelangganRepository.update(id, { status });

    const syncResult = await afterCustomerUpdate(undefined, id, {
      statusChanged: existing.status !== pelanggan.status,
      oldStatus: existing.status as Status,
      newStatus: pelanggan.status as Status,
    });

    if (!syncResult.success) {
      await this.pelangganRepository.updateSyncStatus(
        id,
        "FAILED",
        syncResult.error || "Gagal sinkronisasi pelanggan ke RADIUS",
      );
      return pelanggan;
    }

    await this.pelangganRepository.updateSyncStatus(id, "SYNCED", null);
    return pelanggan;
  }
}

// Singleton instance
let pelangganServiceInstance: PelangganService | null = null;

export function getPelangganService(): PelangganService {
  if (!pelangganServiceInstance) {
    pelangganServiceInstance = new PelangganService();
  }
  return pelangganServiceInstance;
}
