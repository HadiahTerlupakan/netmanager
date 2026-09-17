import type { MitraWithDetails } from "../dto/MitraDTO";
import type { MitraEntity } from "../domain/entities/MitraEntity";

/** Map pure mitra entity into API DTO. */
export function toMitraDTO(entity: MitraEntity): MitraWithDetails {
  return {
    ...mapMitraProfile(entity),
    ...mapMitraRates(entity),
    ...mapMitraIdentity(entity),
    ...mapMitraDefaults(),
    mitraWallet: mapMitraWallet(entity),
    createdAt: entity.createdAt,
  };
}

function mapMitraProfile(entity: MitraEntity) {
  return {
    id: entity.id,
    name: entity.name,
    email: entity.email,
    phone: entity.phone,
    mitraType: entity.mitraType as MitraWithDetails["mitraType"],
    isActive: entity.isActive,
    siteId: entity.siteId,
  };
}

function mapMitraRates(entity: MitraEntity) {
  return {
    mitraRateWoPsb: entity.mitraRateWoPsb,
    mitraRateWoMaintenance: entity.mitraRateWoMaintenance,
    mitraRateCanvasing: entity.mitraRateCanvasing,
    targetHarian: entity.targetHarian,
    minWithdrawal: entity.minWithdrawal,
    garansiHari: entity.garansiHari,
    slaGaransiJam: entity.slaGaransiJam,
    penaltyPsb: entity.penaltyPsb,
    penaltyMaintenance: entity.penaltyMaintenance,
  };
}

function mapMitraIdentity(entity: MitraEntity) {
  return {
    bankName: entity.bankName,
    bankAccountNo: entity.bankAccountNo,
    bankAccountName: entity.bankAccountName,
    nik: entity.nik,
    tempatLahir: entity.tempatLahir,
    tanggalLahir: entity.tanggalLahir,
    alamat: entity.alamat,
    latitudeRumah: entity.latitudeRumah,
    longitudeRumah: entity.longitudeRumah,
    fotoDiri: entity.fotoDiri,
    fotoKtp: entity.fotoKtp,
    fotoSim: entity.fotoSim,
    fotoKk: entity.fotoKk,
    requiresFaceVerification: entity.requiresFaceVerification,
    lastFaceVerification: entity.lastFaceVerification,
  };
}

function mapMitraDefaults(): Pick<
  MitraWithDetails,
  "departments" | "sites" | "role"
> {
  return { departments: null, sites: null, role: null };
}

function mapMitraWallet(entity: MitraEntity) {
  if (!entity.mitraWallet) return null;
  return {
    id: entity.mitraWallet.id,
    balance: entity.mitraWallet.balance,
    totalEarnings: entity.mitraWallet.totalEarnings,
    totalWithdrawn: entity.mitraWallet.totalWithdrawn,
  };
}
