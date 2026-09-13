import { InvoiceProrateService } from "@/modules/finance";
import type { IPelangganRepository } from "../domain/ports/IPelangganRepository";
import { PelangganRepository } from "../repositories/PelangganRepository";
import {
  notifyUpgradeCancelled,
  notifyUpgradeRequested,
} from "./package-upgrade.notifications";

const ACTIVE_CUSTOMER_STATUS = "AKTIF";

export type CustomerPackageUpgradeErrorCode =
  | "CUSTOMER_NOT_FOUND"
  | "CURRENT_PACKAGE_NOT_FOUND"
  | "CUSTOMER_NOT_ACTIVE"
  | "UPGRADE_ALREADY_PENDING"
  | "NO_PENDING_UPGRADE"
  | "PACKAGE_NOT_AVAILABLE";

/** Kegagalan yang bisa ditampilkan ke pelanggan, dengan kode untuk mapping HTTP. */
export class CustomerPackageUpgradeError extends Error {
  readonly code: CustomerPackageUpgradeErrorCode;

  constructor(message: string, code: CustomerPackageUpgradeErrorCode) {
    super(message);
    this.name = "CustomerPackageUpgradeError";
    this.code = code;
  }
}

export interface UpgradeRequestResult {
  scheduledFor: Date;
  package: {
    id: string;
    nama: string;
    harga: number;
  };
}

/** Kontrak minimal yang dipakai dari modul finance. */
type PackageChangeScheduler = Pick<InvoiceProrateService, "applyPackageChange">;

/**
 * Pengajuan upgrade paket oleh pelanggan sendiri lewat portal.
 *
 * Perubahan selalu dijadwalkan pada jatuh tempo berikutnya (`NEXT_CYCLE`) tanpa
 * prorate. Why: pelanggan tidak boleh memicu tagihan pro-rata di luar siklus
 * tanpa persetujuan pembayaran, dan penjadwalan bisa dibatalkan sebelum
 * diterapkan. Cron `PendingPackageApplierService` yang menerapkannya.
 */
export class CustomerPackageUpgradeService {
  private readonly pelangganRepository: IPelangganRepository;
  private readonly packageChangeScheduler: PackageChangeScheduler;

  constructor(
    pelangganRepository: IPelangganRepository = new PelangganRepository(),
    packageChangeScheduler: PackageChangeScheduler = new InvoiceProrateService(),
  ) {
    this.pelangganRepository = pelangganRepository;
    this.packageChangeScheduler = packageChangeScheduler;
  }

  /** Ajukan upgrade ke paket tujuan; berlaku pada siklus tagihan berikutnya. */
  async requestUpgrade(
    customerId: string,
    targetPackageId: string,
  ): Promise<UpgradeRequestResult> {
    const customer =
      await this.pelangganRepository.findByIdWithPackage(customerId);
    if (!customer) {
      throw new CustomerPackageUpgradeError(
        "Data pelanggan tidak ditemukan",
        "CUSTOMER_NOT_FOUND",
      );
    }

    const currentPackage = customer.hargaPaket;
    if (!currentPackage) {
      throw new CustomerPackageUpgradeError(
        "Paket langganan saat ini tidak ditemukan",
        "CURRENT_PACKAGE_NOT_FOUND",
      );
    }

    if (customer.status !== ACTIVE_CUSTOMER_STATUS) {
      throw new CustomerPackageUpgradeError(
        "Layanan Anda sedang tidak aktif. Hubungi customer service terlebih dahulu.",
        "CUSTOMER_NOT_ACTIVE",
      );
    }

    if (customer.pendingPackageId) {
      throw new CustomerPackageUpgradeError(
        "Sudah ada pengajuan upgrade yang menunggu diterapkan",
        "UPGRADE_ALREADY_PENDING",
      );
    }

    const targetPackage = await this.pelangganRepository.findUpgradeCandidate(
      targetPackageId,
      { minPrice: currentPackage.harga, siteId: customer.siteId },
    );
    if (!targetPackage) {
      throw new CustomerPackageUpgradeError(
        "Paket yang dipilih tidak tersedia untuk lokasi layanan Anda",
        "PACKAGE_NOT_AVAILABLE",
      );
    }

    const result = await this.packageChangeScheduler.applyPackageChange({
      pelangganId: customer.id,
      oldHargaPaketId: currentPackage.id,
      newHargaPaketId: targetPackage.id,
      prorateOption: "NONE",
      downgradeAdjustment: "NONE",
      upgradeApplyTime: "NEXT_CYCLE",
    });

    const scheduledFor = result.scheduledFor ?? customer.jatuhTempo;

    notifyUpgradeRequested({
      customerId: customer.id,
      customerName: customer.nama,
      currentPackageName: currentPackage.name,
      targetPackageName: targetPackage.name,
      applyAt: scheduledFor,
      siteId: customer.siteId,
      tenantId: customer.tenantId,
    });

    return {
      scheduledFor,
      package: {
        id: targetPackage.id,
        nama: targetPackage.name,
        harga: targetPackage.harga,
      },
    };
  }

  /** Batalkan pengajuan upgrade yang belum diterapkan. */
  async cancelUpgrade(customerId: string): Promise<{ cancelled: true }> {
    const customer =
      await this.pelangganRepository.findByIdWithPackage(customerId);
    if (!customer) {
      throw new CustomerPackageUpgradeError(
        "Data pelanggan tidak ditemukan",
        "CUSTOMER_NOT_FOUND",
      );
    }

    if (!customer.pendingPackageId) {
      throw new CustomerPackageUpgradeError(
        "Tidak ada pengajuan upgrade yang bisa dibatalkan",
        "NO_PENDING_UPGRADE",
      );
    }

    await this.pelangganRepository.cancelPendingPackage(customer.id);

    notifyUpgradeCancelled({
      customerId: customer.id,
      customerName: customer.nama,
      targetPackageName: customer.pendingPackage?.name ?? "paket baru",
      siteId: customer.siteId,
      tenantId: customer.tenantId,
    });

    return { cancelled: true };
  }
}

let customerPackageUpgradeServiceInstance: CustomerPackageUpgradeService | null =
  null;

/** Singleton accessor untuk dipakai di API route. */
export function getCustomerPackageUpgradeService(): CustomerPackageUpgradeService {
  if (!customerPackageUpgradeServiceInstance) {
    customerPackageUpgradeServiceInstance = new CustomerPackageUpgradeService();
  }
  return customerPackageUpgradeServiceInstance;
}
