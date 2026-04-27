/**
 * PelangganMapper
 *
 * Transforms Prisma entities to domain entities and DTOs.
 */

import type {
  DiscountType,
  DurasiUnit,
  Pelanggan,
  Status,
  TipePelanggan,
} from "@prisma/client";
import type {
  PelangganEntity,
  PelangganWithPackageEntity,
} from "../domain/entities/PelangganEntity";
import type {
  PelangganDetailDTO,
  PelangganListItemDTO,
  PelangganOptionDTO,
  PelangganPortalDTO,
  PaymentHistoryItemDTO,
} from "../dto/PelangganDTO";

export class PelangganMapper {
  /** Map Prisma pelanggan into domain entity. */
  static toDomain(entity: Pelanggan): PelangganEntity {
    return { ...entity };
  }

  /** Map Prisma pelanggan with relations into domain entity. */
  static toDomainWithPackage<T extends PelangganWithPackageEntity>(entity: T) {
    return { ...entity } satisfies PelangganWithPackageEntity;
  }

  /** Map domain entity into list item DTO. */
  static toListItem(entity: PelangganWithPackageEntity): PelangganListItemDTO {
    return {
      id: entity.id,
      idPelanggan: entity.idPelanggan,
      nama: entity.nama,
      username: entity.username,
      noTelp: entity.noTelp,
      status: entity.status as Status,
      tipe: entity.tipe as TipePelanggan,
      jatuhTempo: entity.jatuhTempo.toISOString(),
      paketName: entity.hargaPaket?.name ?? null,
      paketHarga: entity.hargaPaket?.harga ?? null,
      siteName: entity.site?.name ?? null,
    };
  }

  /** Map domain entities into list item DTOs. */
  static toListItems(
    entities: PelangganWithPackageEntity[],
  ): PelangganListItemDTO[] {
    return entities.map((entity) => this.toListItem(entity));
  }

  /** Map domain entity into detail DTO. */
  static toDetail(entity: PelangganWithPackageEntity): PelangganDetailDTO {
    return {
      id: entity.id,
      idPelanggan: entity.idPelanggan,
      nama: entity.nama,
      username: entity.username,
      email: entity.email,
      noTelp: entity.noTelp,
      status: entity.status as Status,
      tipe: entity.tipe as TipePelanggan,
      tanggalAktif: entity.tanggalAktif.toISOString(),
      jatuhTempo: entity.jatuhTempo.toISOString(),
      autoIsolir: entity.autoIsolir,
      alamat: entity.alamat,
      lokasi: {
        provinsi: entity.provinsi,
        kabupatenKota: entity.kabupatenKota,
        kecamatan: entity.kecamatan,
        kelurahanDesa: entity.kelurahanDesa,
      },
      koordinat: {
        latitude: entity.latitude ?? null,
        longitude: entity.longitude ?? null,
      },
      dokumen: {
        jenisDokumen: entity.jenisDokumen ?? null,
        noDokumen: entity.noDokumen ?? null,
        fileKTP: entity.fileKTP ?? null,
        fileRumahSekitar: entity.fileRumahSekitar ?? null,
        fileBAST: entity.fileBAST ?? null,
      },
      paket: this.mapPackageDetail(entity),
      billing: {
        usePPN: entity.usePPN ?? false,
        useDiscount: entity.useDiscount ?? false,
        useProrate: entity.useProrate ?? false,
        discountType: (entity.discountType as DiscountType | null) ?? null,
        discountValue: entity.discountValue ?? null,
        discountDuration: entity.discountDuration ?? null,
        discountDurationUnit:
          (entity.discountDurationUnit as DurasiUnit | null) ?? null,
        biayaInstalasi: entity.biayaInstalasi ?? null,
        biayaSewaPerangkat: entity.biayaSewaPerangkat ?? null,
        biayaLainnya: entity.biayaLainnya ?? null,
      },
      syncStatus: entity.syncStatus ?? null,
      syncError: entity.syncError ?? null,
      catatan: entity.catatan ?? null,
      createdAt: entity.createdAt?.toISOString() ?? new Date(0).toISOString(),
      updatedAt: entity.updatedAt?.toISOString() ?? new Date(0).toISOString(),
    };
  }

  /** Map domain entity into portal DTO. */
  static toPortal(entity: PelangganWithPackageEntity): PelangganPortalDTO {
    return {
      id: entity.id,
      idPelanggan: entity.idPelanggan,
      nama: entity.nama,
      username: entity.username,
      email: entity.email,
      noTelp: entity.noTelp,
      alamat: entity.alamat,
      status: entity.status as Status,
      tipe: entity.tipe as TipePelanggan,
      tanggalAktif: entity.tanggalAktif.toISOString(),
      jatuhTempo: entity.jatuhTempo.toISOString(),
      lokasi: {
        provinsi: entity.provinsi,
        kabupatenKota: entity.kabupatenKota,
        kecamatan: entity.kecamatan,
        kelurahanDesa: entity.kelurahanDesa,
      },
      preferences: {
        is2FAEnabled: entity.is2FAEnabled ?? false,
        isBillNotifEnabled: entity.isBillNotifEnabled ?? false,
        isPromoEnabled: entity.isPromoEnabled ?? false,
      },
      paket: this.mapPortalPackage(entity),
    };
  }

  /** Map domain entity into option DTO. */
  static toOption(entity: PelangganEntity): PelangganOptionDTO {
    return {
      id: entity.id,
      idPelanggan: entity.idPelanggan,
      nama: entity.nama,
      username: entity.username,
    };
  }

  /** Map domain entities into option DTOs. */
  static toOptions(entities: PelangganEntity[]): PelangganOptionDTO[] {
    return entities.map((entity) => this.toOption(entity));
  }

  /** Map payment payload into payment history DTO. */
  static toPaymentHistory(payment: {
    id: string;
    amount: number | { toNumber(): number };
    paymentDate: Date;
    paymentMethod: string | null;
    reference: string | null;
    notes: string | null;
    verifiedAt: Date | null;
    invoice: { invoiceNumber: string; status: string } | null;
  }): PaymentHistoryItemDTO {
    return {
      id: payment.id,
      amount:
        typeof payment.amount === "number"
          ? payment.amount
          : payment.amount.toNumber(),
      paymentDate: payment.paymentDate.toISOString(),
      paymentMethod: payment.paymentMethod,
      reference: payment.reference,
      notes: payment.notes,
      invoice: payment.invoice
        ? {
            invoiceNumber: payment.invoice.invoiceNumber,
            status: payment.invoice.status,
          }
        : null,
      verified: Boolean(payment.verifiedAt),
    };
  }

  /** Map payment payload list into DTOs. */
  static toPaymentHistoryList(
    payments: Parameters<typeof PelangganMapper.toPaymentHistory>[0][],
  ): PaymentHistoryItemDTO[] {
    return payments.map((payment) => this.toPaymentHistory(payment));
  }

  private static mapPackageDetail(entity: PelangganWithPackageEntity) {
    if (!entity.hargaPaket) {
      return null;
    }

    return {
      id: entity.hargaPaket.id,
      nama: entity.hargaPaket.name,
      harga: entity.hargaPaket.harga,
      durasi: entity.hargaPaket.durasi,
      bandwidth: entity.hargaPaket.bandwidth
        ? {
            nama: entity.hargaPaket.bandwidth.name,
            download: entity.hargaPaket.bandwidth.maxLimitDownload,
            upload: entity.hargaPaket.bandwidth.maxLimitUpload,
          }
        : null,
    };
  }

  private static mapPortalPackage(entity: PelangganWithPackageEntity) {
    if (!entity.hargaPaket) {
      return null;
    }

    return {
      nama: entity.hargaPaket.name,
      harga: entity.hargaPaket.harga,
      durasi: entity.hargaPaket.durasi,
      kecepatan: entity.hargaPaket.description ?? null,
      bandwidth: entity.hargaPaket.bandwidth
        ? {
            nama: entity.hargaPaket.bandwidth.name,
            download: entity.hargaPaket.bandwidth.maxLimitDownload,
            upload: entity.hargaPaket.bandwidth.maxLimitUpload,
          }
        : null,
    };
  }
}
