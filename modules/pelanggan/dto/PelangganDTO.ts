/**
 * Pelanggan DTOs (Data Transfer Objects)
 *
 * DTOs define the shape of data for API responses and requests.
 */

import type {
  PelangganDiscountTypeValue as DiscountType,
  PelangganDurationUnitValue as DurasiUnit,
  PelangganStatusValue as Status,
  PelangganTypeValue as TipePelanggan,
} from "../types/pelanggan-types";

// ==================== Response DTOs ====================

/**
 * Minimal DTO for list/table views
 */
export interface PelangganListItemDTO {
  id: string;
  idPelanggan: string;
  nama: string;
  username: string;
  noTelp: string | null;
  status: Status;
  tipe: TipePelanggan;
  jatuhTempo: string;
  // Flattened relations
  paketName: string | null;
  paketHarga: number | null;
  siteName: string | null;
}

/**
 * Full DTO for detail views (admin)
 */
export interface PelangganDetailDTO {
  id: string;
  idPelanggan: string;
  nama: string;
  username: string;
  email: string | null;
  noTelp: string | null;
  status: Status;
  tipe: TipePelanggan;
  tanggalAktif: string;
  jatuhTempo: string;
  autoIsolir: boolean;
  // Address
  alamat: string | null;
  lokasi: {
    provinsi: string | null;
    kabupatenKota: string | null;
    kecamatan: string | null;
    kelurahanDesa: string | null;
  };
  koordinat: {
    latitude: number | null;
    longitude: number | null;
  };
  // Documents
  dokumen: {
    jenisDokumen: string | null;
    noDokumen: string | null;
    fileKTP: string | null;
    fileRumahSekitar: string | null;
    fileBAST: string | null;
  };
  // Package info
  paket: {
    id: string;
    nama: string;
    harga: number;
    durasi: number;
    bandwidth: {
      nama: string;
      download: string | null;
      upload: string | null;
    } | null;
  } | null;
  // Billing settings
  billing: {
    usePPN: boolean;
    useDiscount: boolean;
    useProrate: boolean;
    discountType: DiscountType | null;
    discountValue: number | null;
    discountDuration: number | null;
    discountDurationUnit: DurasiUnit | null;
    biayaInstalasi: number | null;
    biayaSewaPerangkat: number | null;
    biayaLainnya: number | null;
  };
  // Sync status
  syncStatus: string | null;
  syncError: string | null;
  // Metadata
  catatan: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO for customer portal (self-service)
 */
export interface PelangganPortalDTO {
  id: string;
  idPelanggan: string;
  nama: string;
  username: string;
  email: string | null;
  noTelp: string | null;
  alamat: string | null;
  status: Status;
  tipe: TipePelanggan;
  tanggalAktif: string;
  jatuhTempo: string;
  lokasi: {
    provinsi: string | null;
    kabupatenKota: string | null;
    kecamatan: string | null;
    kelurahanDesa: string | null;
  };
  preferences: {
    is2FAEnabled: boolean;
    isBillNotifEnabled: boolean;
    isPromoEnabled: boolean;
  };
  paket: {
    nama: string;
    harga: number;
    durasi: number;
    kecepatan: string | null;
    bandwidth: {
      nama: string;
      download: string | null;
      upload: string | null;
    } | null;
  } | null;
}

/**
 * DTO for dropdown/select options
 */
export interface PelangganOptionDTO {
  id: string;
  idPelanggan: string;
  nama: string;
  username: string;
}

/**
 * DTO for payment history
 */
export interface PaymentHistoryItemDTO {
  id: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string | null;
  reference: string | null;
  notes: string | null;
  invoice: {
    invoiceNumber: string;
    status: string;
  } | null;
  verified: boolean;
}

// ==================== Request DTOs ====================

/**
 * DTO for creating new pelanggan
 */
export interface CreatePelangganDTO {
  idPelanggan: string;
  nama: string;
  username: string;
  password: string;
  passwordLogin: string;
  hargaPaketId: string;
  tipe: TipePelanggan;
  tanggalAktif: string;
  jatuhTempo: string;
  status: Status;
  autoIsolir?: boolean;
  alamat?: string;
  provinsi?: string;
  kabupatenKota?: string;
  kelurahanDesa?: string;
  kecamatan?: string;
  noTelp?: string;
  email?: string;
  latitude?: number;
  longitude?: number;
  siteId?: string;
  catatan?: string;
}

/**
 * DTO for updating pelanggan profile (portal)
 */
export interface UpdateProfileDTO {
  noTelp?: string;
  is2FAEnabled?: boolean;
  isBillNotifEnabled?: boolean;
  isPromoEnabled?: boolean;
}
