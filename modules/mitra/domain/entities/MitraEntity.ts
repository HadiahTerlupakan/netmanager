export interface MitraWalletEntity {
  id: string;
  balance: number;
  totalEarnings: number;
  totalWithdrawn: number;
}

export interface FaceVerificationLogEntity {
  id: string;
  latitude: number;
  longitude: number;
  photoUrl: string;
  deviceInfo: string | null;
  createdAt: Date;
}

export interface MitraEntity {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  mitraType: string;
  isActive: boolean;
  siteId: string | null;
  tenantId: string | null;
  mitraRateWoPsb: number | null;
  mitraRateWoMaintenance: number | null;
  mitraRateCanvasing: number | null;
  mitraRateFeePelanggan: number | null;
  enableFeePelanggan: boolean;
  mixradiusOwnerNames: string[];
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
  targetHarian: number | null;
  minWithdrawal: number | null;
  garansiHari: number | null;
  slaGaransiJam: number | null;
  penaltyPsb: number | null;
  penaltyMaintenance: number | null;
  nik: string | null;
  tempatLahir: string | null;
  tanggalLahir: Date | null;
  alamat: string | null;
  latitudeRumah: number | null;
  longitudeRumah: number | null;
  fotoDiri: string | null;
  fotoKtp: string | null;
  fotoSim: string | null;
  fotoKk: string | null;
  requiresFaceVerification: boolean;
  lastFaceVerification: Date | null;
  createdAt: Date;
  mitraWallet: MitraWalletEntity | null;
  faceVerificationLogs?: FaceVerificationLogEntity[];
}

export interface MitraStatsEntity {
  totalTeknisi: number;
  totalSales: number;
  totalActive: number;
  totalBalance: number;
}

export interface MitraSummaryEntity {
  id: string;
  name: string | null;
  email: string;
  mitraType: string;
  siteId: string | null;
}

export interface MitraListEntity {
  mitras: MitraEntity[];
  total: number;
  page: number;
  totalPages: number;
}

export interface FaceVerificationLogListEntity {
  logs: FaceVerificationLogEntity[];
  total: number;
  page: number;
  totalPages: number;
}

export interface MitraPushTokenEntity {
  id: string;
  pushToken: string | null;
}
