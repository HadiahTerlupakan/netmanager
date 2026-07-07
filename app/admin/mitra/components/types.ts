export interface Site {
  id: string;
  code: string;
  name: string;
}

export interface Mitra {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  mitraType: "MITRA_TEKNISI" | "MITRA_SALES";
  isActive: boolean;
  siteId: string | null;
  mitraRateWoPsb: number | null;
  mitraRateWoMaintenance: number | null;
  mitraRateCanvasing: number | null;
  minWithdrawal: number | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
  garansiHari: number | null;
  slaGaransiJam: number | null;
  penaltyPsb: number | null;
  penaltyMaintenance: number | null;
  nik: string | null;
  tempatLahir: string | null;
  tanggalLahir: string | null;
  alamat: string | null;
  latitudeRumah: number | null;
  longitudeRumah: number | null;
  fotoDiri: string | null;
  fotoKtp: string | null;
  fotoSim: string | null;
  fotoKk: string | null;
  requiresFaceVerification: boolean;
  enableFeePelanggan?: boolean;
  targetHarian?: number;
  mitraRateFeePelanggan?: number;
  mixradiusOwnerNames?: string[];
  sites: { name: string } | null;
  role: { name: string } | null;
  mitraWallet: {
    id: string;
    balance: number;
    totalEarnings: number;
    totalWithdrawn: number;
  } | null;
  createdAt: string;
}

export interface MitraTransaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
}

export interface Stats {
  totalTeknisi: number;
  totalSales: number;
  totalActive: number;
  totalBalance: number;
}

export interface MitraFormState {
  name: string;
  email: string;
  password: string;
  phone: string;
  employeeType: "MITRA_TEKNISI" | "MITRA_SALES";
  siteId: string;
  mitraRateWoPsb: string;
  mitraRateWoMaintenance: string;
  mitraRateCanvasing: string;
  minWithdrawal: string;
  bankName: string;
  bankAccountNo: string;
  bankAccountName: string;
  targetHarian: string;
  garansiHari: string;
  slaGaransiJam: string;
  penaltyPsb: string;
  penaltyMaintenance: string;
  mitraRateFeePelanggan: string;
  enableFeePelanggan: boolean;
  mixradiusOwnerNames: string[];
  nik: string;
  tempatLahir: string;
  tanggalLahir: string;
  alamat: string;
  latitudeRumah: string;
  longitudeRumah: string;
  fotoDiri: string;
  fotoKtp: string;
  fotoSim: string;
  fotoKk: string;
}

export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === undefined || amount === null) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
};
