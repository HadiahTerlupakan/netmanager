import type { MitraWithDetails } from "../dto/MitraDTO";
import type { MitraEntity } from "../domain/entities/MitraEntity";

/** Map pure mitra entity into API DTO. */
export function toMitraDTO(entity: MitraEntity): MitraWithDetails {
  return {
    id: entity.id,
    name: entity.name,
    email: entity.email,
    phone: entity.phone,
    mitraType: entity.mitraType as MitraWithDetails["mitraType"],
    isActive: entity.isActive,
    mitraRateWoPsb: entity.mitraRateWoPsb,
    mitraRateWoMaintenance: entity.mitraRateWoMaintenance,
    mitraRateCanvasing: entity.mitraRateCanvasing,
    mitraRateFeePelanggan: entity.mitraRateFeePelanggan,
    enableFeePelanggan: entity.enableFeePelanggan,
    mixradiusOwnerNames: entity.mixradiusOwnerNames,
    bankName: entity.bankName,
    bankAccountNo: entity.bankAccountNo,
    bankAccountName: entity.bankAccountName,
    targetHarian: entity.targetHarian,
    minWithdrawal: entity.minWithdrawal,
    garansiHari: entity.garansiHari,
    slaGaransiJam: entity.slaGaransiJam,
    penaltyPsb: entity.penaltyPsb,
    penaltyMaintenance: entity.penaltyMaintenance,
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
    departments: null,
    sites: null,
    role: null,
    mitraWallet: entity.mitraWallet
      ? {
          id: entity.mitraWallet.id,
          balance: entity.mitraWallet.balance,
          totalEarnings: entity.mitraWallet.totalEarnings,
          totalWithdrawn: entity.mitraWallet.totalWithdrawn,
        }
      : null,
    createdAt: entity.createdAt,
  };
}
