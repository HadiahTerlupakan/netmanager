/**
 * Pure pelanggan domain entities for pelanggan module.
 */

export type PelangganDiscountType = "PERCENT" | "FIXED";
export type PelangganDurationUnit = "HARI" | "BULAN" | "TAHUN" | string;

export interface PelangganSiteEntity {
  id: string;
  name: string;
}

export interface PelangganBandwidthEntity {
  name: string;
  maxLimitDownload: string | null;
  maxLimitUpload: string | null;
  downloadSpeed?: number | null;
  uploadSpeed?: number | null;
}

export interface PelangganProfilePppRouterEntity {
  name: string;
}

export interface PelangganProfilePppEntity {
  name?: string | null;
  mikroTikRouter?: PelangganProfilePppRouterEntity | null;
}

export interface PelangganPackageEntity {
  id: string;
  name: string;
  harga: number;
  durasi: number;
  durasiUnit?: string;
  description?: string | null;
  featured?: boolean;
  usePPN?: boolean;
  ppnPercentage?: number | null;
  useDiscount?: boolean;
  discountType?: PelangganDiscountType | null;
  discountValue?: number | null;
  profilePPP?: PelangganProfilePppEntity | null;
  bandwidth?: PelangganBandwidthEntity | null;
}

export interface PelangganOdpEntity {
  name: string;
  location: string | null;
}

export interface PelangganEntity {
  id: string;
  idPelanggan: string;
  nama: string;
  username: string;
  password?: string | null;
  passwordHash?: string | null;
  hargaPaketId?: string;
  tipe: string;
  tanggalAktif: Date;
  jatuhTempo: Date;
  status: string;
  autoIsolir: boolean;
  alamat: string | null;
  provinsi: string | null;
  kabupatenKota: string | null;
  kelurahanDesa: string | null;
  kecamatan: string | null;
  noTelp: string | null;
  email: string | null;
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
  discountType?: PelangganDiscountType | null;
  discountValue?: number | null;
  discountDuration?: number | null;
  discountDurationUnit?: PelangganDurationUnit | null;
  biayaInstalasi?: number | null;
  biayaSewaPerangkat?: number | null;
  biayaLainnya?: number | null;
  syncStatus?: string | null;
  syncError?: string | null;
  tenantId?: string | null;
  siteId?: string | null;
  pushToken?: string | null;
  userId?: string | null;
  is2FAEnabled?: boolean;
  isBillNotifEnabled?: boolean;
  isPromoEnabled?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PelangganWithPackageEntity extends PelangganEntity {
  site?: PelangganSiteEntity | null;
  hargaPaket?: PelangganPackageEntity | null;
  odp?: PelangganOdpEntity | null;
}

export interface PelangganAuthEntity {
  id: string;
  idPelanggan: string;
  nama: string;
  username: string;
  email: string | null;
  status: string;
  passwordHash: string | null;
  tenantId: string | null;
}

export interface PelangganAdminMutationEntity {
  id: string;
  username: string;
  password: string;
  passwordHash: string | null;
  hargaPaketId: string;
  tipe: string;
  status: string;
  autoIsolir: boolean;
  siteId: string | null;
}

export interface PelangganAdminDeleteEntity {
  id: string;
  nama: string;
  username: string;
  siteId: string | null;
  tenantId: string | null;
}

export interface PelangganAdminMutationContextEntity {
  id: string;
  username: string;
  status: string;
  siteId: string | null;
  nama: string;
}

export interface PelangganProfilePreferenceEntity {
  id: string;
  noTelp: string | null;
  is2FAEnabled: boolean;
  isBillNotifEnabled: boolean;
  isPromoEnabled: boolean;
  updatedAt: Date;
}

export interface EligibleBillingCustomerEntity {
  id: string;
  nama: string;
  jatuhTempo: Date;
  userId: string | null;
  usePPN: boolean;
  tipe: string;
  status: string;
  hargaPaketId: string;
  paketName: string;
  paketHarga: number;
  paketUsePPN: boolean;
  paketPpnPercentage: number | null;
}

export interface PelangganPushTokenEntity {
  id: string;
  pushToken: string | null;
}
