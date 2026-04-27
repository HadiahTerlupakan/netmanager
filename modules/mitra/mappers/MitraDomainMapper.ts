import type {
  Prisma,
  Mitra,
  MitraWallet,
  FaceVerificationLog,
  WithdrawRequest,
  MitraTransaction,
} from "@prisma/client-mitra";
import { MitraType } from "@prisma/client-mitra";
import type {
  FaceVerificationLogEntity,
  MitraEntity,
  MitraPushTokenEntity,
  MitraStatsEntity,
  MitraSummaryEntity,
} from "../domain/entities/MitraEntity";
import type {
  MitraTransactionEntity,
  MitraTypeEntity,
  MitraWalletEntity,
  WalletSummaryEntity,
} from "../domain/entities/MitraWalletEntity";
import type {
  WithdrawRequestEntity,
  WithdrawRequestWalletEntity,
} from "../domain/entities/WithdrawRequestEntity";

/** Map Prisma wallet model into pure wallet entity. */
export function toMitraWalletEntity(
  wallet: Pick<
    MitraWallet,
    "id" | "mitraId" | "balance" | "totalEarnings" | "totalWithdrawn"
  >,
): MitraWalletEntity {
  return {
    id: wallet.id,
    mitraId: wallet.mitraId,
    balance: wallet.balance.toNumber(),
    totalEarnings: wallet.totalEarnings.toNumber(),
    totalWithdrawn: wallet.totalWithdrawn.toNumber(),
  };
}

/** Map Prisma face verification log into pure entity. */
export function toFaceVerificationLogEntity(
  log: Pick<
    FaceVerificationLog,
    "id" | "latitude" | "longitude" | "photoUrl" | "deviceInfo" | "createdAt"
  >,
): FaceVerificationLogEntity {
  return { ...log };
}

/** Map Prisma mitra projection into pure mitra entity. */
export function toMitraEntity(
  mitra: Pick<
    Mitra,
    | "id"
    | "name"
    | "email"
    | "phone"
    | "mitraType"
    | "isActive"
    | "siteId"
    | "tenantId"
    | "mitraRateWoPsb"
    | "mitraRateWoMaintenance"
    | "mitraRateCanvasing"
    | "mitraRateFeePelanggan"
    | "enableFeePelanggan"
    | "mixradiusOwnerNames"
    | "bankName"
    | "bankAccountNo"
    | "bankAccountName"
    | "targetHarian"
    | "minWithdrawal"
    | "garansiHari"
    | "slaGaransiJam"
    | "penaltyPsb"
    | "penaltyMaintenance"
    | "nik"
    | "tempatLahir"
    | "tanggalLahir"
    | "alamat"
    | "latitudeRumah"
    | "longitudeRumah"
    | "fotoDiri"
    | "fotoKtp"
    | "fotoSim"
    | "fotoKk"
    | "requiresFaceVerification"
    | "lastFaceVerification"
    | "createdAt"
  > & {
    mitraWallet?: Pick<
      MitraWallet,
      "id" | "mitraId" | "balance" | "totalEarnings" | "totalWithdrawn"
    > | null;
    faceVerificationLogs?: Array<
      Pick<
        FaceVerificationLog,
        | "id"
        | "latitude"
        | "longitude"
        | "photoUrl"
        | "deviceInfo"
        | "createdAt"
      >
    >;
  },
): MitraEntity {
  return {
    id: mitra.id,
    name: mitra.name,
    email: mitra.email,
    phone: mitra.phone,
    mitraType: mitra.mitraType,
    isActive: mitra.isActive,
    siteId: mitra.siteId,
    tenantId: mitra.tenantId,
    mitraRateWoPsb: mitra.mitraRateWoPsb,
    mitraRateWoMaintenance: mitra.mitraRateWoMaintenance,
    mitraRateCanvasing: mitra.mitraRateCanvasing,
    mitraRateFeePelanggan: mitra.mitraRateFeePelanggan,
    enableFeePelanggan: mitra.enableFeePelanggan ?? false,
    mixradiusOwnerNames: mitra.mixradiusOwnerNames,
    bankName: mitra.bankName,
    bankAccountNo: mitra.bankAccountNo,
    bankAccountName: mitra.bankAccountName,
    targetHarian: mitra.targetHarian,
    minWithdrawal: mitra.minWithdrawal,
    garansiHari: mitra.garansiHari,
    slaGaransiJam: mitra.slaGaransiJam,
    penaltyPsb: mitra.penaltyPsb,
    penaltyMaintenance: mitra.penaltyMaintenance,
    nik: mitra.nik,
    tempatLahir: mitra.tempatLahir,
    tanggalLahir: mitra.tanggalLahir,
    alamat: mitra.alamat,
    latitudeRumah: mitra.latitudeRumah,
    longitudeRumah: mitra.longitudeRumah,
    fotoDiri: mitra.fotoDiri,
    fotoKtp: mitra.fotoKtp,
    fotoSim: mitra.fotoSim,
    fotoKk: mitra.fotoKk,
    requiresFaceVerification: mitra.requiresFaceVerification,
    lastFaceVerification: mitra.lastFaceVerification,
    createdAt: mitra.createdAt,
    mitraWallet: mitra.mitraWallet
      ? toMitraWalletEntity(mitra.mitraWallet)
      : null,
    faceVerificationLogs: mitra.faceVerificationLogs?.map(
      toFaceVerificationLogEntity,
    ),
  };
}

/** Map Prisma mitra type projection into pure entity. */
export function toMitraTypeEntity(input: {
  mitraType: MitraType;
}): MitraTypeEntity {
  return { mitraType: input.mitraType };
}

/** Map Prisma transaction into pure transaction entity. */
export function toMitraTransactionEntity(
  transaction: Pick<
    MitraTransaction,
    | "id"
    | "walletId"
    | "amount"
    | "type"
    | "description"
    | "referenceId"
    | "referenceType"
    | "createdAt"
  >,
): MitraTransactionEntity {
  return {
    id: transaction.id,
    walletId: transaction.walletId,
    amount: transaction.amount.toNumber(),
    type: transaction.type,
    description: transaction.description,
    referenceId: transaction.referenceId,
    referenceType: transaction.referenceType,
    createdAt: transaction.createdAt,
  };
}

/** Map wallet summary projection into pure summary entity. */
export function toWalletSummaryEntity(input: {
  balance: Prisma.Decimal;
  totalEarnings: Prisma.Decimal;
  totalWithdrawn: Prisma.Decimal;
  earningsThisMonth: Prisma.Decimal | number;
  earningsCount: number;
}): WalletSummaryEntity {
  return {
    balance: input.balance.toNumber(),
    totalEarnings: input.totalEarnings.toNumber(),
    totalWithdrawn: input.totalWithdrawn.toNumber(),
    earningsThisMonth:
      typeof input.earningsThisMonth === "number"
        ? input.earningsThisMonth
        : input.earningsThisMonth.toNumber(),
    earningsCount: input.earningsCount,
  };
}

/** Map Prisma withdraw wallet projection into pure entity. */
export function toWithdrawRequestWalletEntity(input: {
  id: string;
  balance: Prisma.Decimal | number;
  mitra?: {
    id: string;
    name: string | null;
    email: string;
    mitraType: string;
  } | null;
}): WithdrawRequestWalletEntity {
  return {
    id: input.id,
    balance: toNumberValue(input.balance),
    mitra: input.mitra
      ? {
          id: input.mitra.id,
          name: input.mitra.name,
          email: input.mitra.email,
          mitraType: input.mitra.mitraType,
        }
      : undefined,
  };
}

/** Map Prisma withdraw request into pure entity. */
export function toWithdrawRequestEntity(
  request: Pick<
    WithdrawRequest,
    | "id"
    | "mitraId"
    | "mitraWalletId"
    | "amount"
    | "method"
    | "status"
    | "bankName"
    | "bankAccountNo"
    | "bankAccountName"
    | "notes"
    | "rejectionReason"
    | "processedById"
    | "processedAt"
    | "createdAt"
  > & {
    mitraWallet?: {
      id: string;
      balance: Prisma.Decimal | number;
      mitra?: {
        id: string;
        name: string | null;
        email: string;
        mitraType: string;
      } | null;
    } | null;
  },
): WithdrawRequestEntity {
  return {
    id: request.id,
    mitraId: request.mitraId,
    mitraWalletId: request.mitraWalletId,
    amount: toNumberValue(request.amount),
    method: request.method,
    status: request.status,
    bankName: request.bankName,
    bankAccountNo: request.bankAccountNo,
    bankAccountName: request.bankAccountName,
    notes: request.notes,
    rejectionReason: request.rejectionReason,
    processedById: request.processedById,
    processedAt: request.processedAt,
    createdAt: request.createdAt,
    mitraWallet: request.mitraWallet
      ? toWithdrawRequestWalletEntity(request.mitraWallet)
      : undefined,
  };
}

/** Map raw mitra aggregate into pure stats entity. */
export function toMitraStatsEntity(input: MitraStatsEntity): MitraStatsEntity {
  return { ...input };
}

/** Map raw push token projection into pure entity. */
export function toMitraPushTokenEntity(input: {
  id: string;
  pushToken: string | null;
}): MitraPushTokenEntity {
  return { ...input };
}

/** Map raw mitra summary projection into pure entity. */
export function toMitraSummaryEntity(input: {
  id: string;
  name: string | null;
  email: string;
  mitraType: string;
  siteId: string | null;
}): MitraSummaryEntity {
  return { ...input };
}

function toNumberValue(value: Prisma.Decimal | number): number {
  return typeof value === "number" ? value : value.toNumber();
}
