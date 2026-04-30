import type {
  EmployeeType,
  MitraType,
  WithdrawMethod,
} from "../types/mitra.enums";

export interface CreateMitraDTO {
  name: string;
  email: string;
  password: string;
  phone?: string;
  employeeType: "MITRA_TEKNISI" | "MITRA_SALES";
  departmentId?: string;
  siteId?: string;
  roleId?: string;
  mitraRateWoPsb?: number;
  mitraRateWoMaintenance?: number;
  mitraRateCanvasing?: number;
  mitraRateFeePelanggan?: number;
  enableFeePelanggan?: boolean;
  mixradiusOwnerNames?: string[];
  bankName?: string;
  bankAccountNo?: string;
  bankAccountName?: string;
  targetHarian?: number;
  minWithdrawal?: number;
  garansiHari?: number;
  slaGaransiJam?: number;
  penaltyPsb?: number;
  penaltyMaintenance?: number;
  nik?: string;
  tempatLahir?: string;
  tanggalLahir?: string | Date;
  alamat?: string;
  latitudeRumah?: number;
  longitudeRumah?: number;
  fotoDiri?: string;
  fotoKtp?: string;
  fotoSim?: string;
  fotoKk?: string;
  requiresFaceVerification?: boolean;
  tenantId?: string;
}

export interface UpdateMitraDTO {
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
  employeeType?: "MITRA_TEKNISI" | "MITRA_SALES";
  departmentId?: string;
  siteId?: string;
  roleId?: string;
  mitraRateWoPsb?: number;
  mitraRateWoMaintenance?: number;
  mitraRateCanvasing?: number;
  mitraRateFeePelanggan?: number;
  enableFeePelanggan?: boolean;
  mixradiusOwnerNames?: string[];
  bankName?: string;
  bankAccountNo?: string;
  bankAccountName?: string;
  targetHarian?: number;
  minWithdrawal?: number;
  garansiHari?: number;
  slaGaransiJam?: number;
  penaltyPsb?: number;
  penaltyMaintenance?: number;
  isActive?: boolean;
  nik?: string;
  tempatLahir?: string;
  tanggalLahir?: string | Date;
  alamat?: string;
  latitudeRumah?: number;
  longitudeRumah?: number;
  fotoDiri?: string;
  fotoKtp?: string;
  fotoSim?: string;
  fotoKk?: string;
  requiresFaceVerification?: boolean;
  tenantId?: string;
}

export interface MitraFilters {
  search?: string;
  employeeType?: EmployeeType;
  isActive?: boolean;
  departmentId?: string;
  siteId?: string;
  tenantId?: string;
}

export interface WithdrawRequestDTO {
  amount: number;
  method: WithdrawMethod;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  notes?: string;
}

export interface MitraWithDetails {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  mitraType: MitraType;
  isActive: boolean;
  mitraRateWoPsb: number | null;
  mitraRateWoMaintenance: number | null;
  mitraRateCanvasing?: number | null;
  mitraRateFeePelanggan?: number | null;
  enableFeePelanggan?: boolean;
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
  departments: { name: string } | null;
  sites: { name: string } | null;
  role: { name: string } | null;
  mitraWallet: {
    id: string;
    balance: number;
    totalEarnings: number;
    totalWithdrawn: number;
  } | null;
  createdAt: Date;
}
