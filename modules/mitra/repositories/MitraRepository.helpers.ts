import { createInsensitiveContainsFilter } from "@/lib/prisma-search-filters";
import { MitraType, type Prisma } from "@prisma/client-mitra";
import type {
  CreateMitraDTO,
  MitraFilters,
  UpdateMitraDTO,
} from "../dto/MitraDTO";

/** Build Prisma filter for mitra listing queries. */
export function buildMitraWhere(filters: MitraFilters): Prisma.MitraWhereInput {
  return {
    ...(filters.employeeType && {
      mitraType: filters.employeeType as Prisma.EnumMitraTypeFilter,
    }),
    ...(filters.isActive !== undefined && { isActive: filters.isActive }),
    ...(filters.siteId && { siteId: filters.siteId }),
    ...(filters.allowedSiteIds &&
      filters.allowedSiteIds.length > 0 && {
        siteId: { in: filters.allowedSiteIds },
      }),
    ...(filters.tenantId && { tenantId: filters.tenantId }),
    ...(filters.search && {
      OR: [
        { name: createInsensitiveContainsFilter(filters.search) },
        { email: createInsensitiveContainsFilter(filters.search) },
        { phone: createInsensitiveContainsFilter(filters.search) },
      ],
    }),
  };
}

/** Return select projection for public mitra ID card. */
export function getMitraIdCardSelect() {
  return {
    id: true,
    name: true,
    mitraType: true,
    nik: true,
    fotoDiri: true,
    phone: true,
    createdAt: true,
    siteId: true,
  } as const;
}

/** Return select projection for mitra list screens. */
export function getMitraListSelect() {
  return {
    ...getMitraBasicFields(),
    ...getMitraRateFields(),
    ...getMitraBankFields(),
    ...getMitraPersonalFields(),
    ...getMitraVerificationFields(),
  } as const;
}

function getMitraBasicFields() {
  return {
    id: true,
    name: true,
    email: true,
    phone: true,
    mitraType: true,
    isActive: true,
    siteId: true,
    tenantId: true,
    createdAt: true,
    mitraWallet: true,
  } as const;
}

function getMitraRateFields() {
  return {
    mitraRateWoPsb: true,
    mitraRateWoMaintenance: true,
    mitraRateCanvasing: true,
    targetHarian: true,
    minWithdrawal: true,
    garansiHari: true,
    slaGaransiJam: true,
    penaltyPsb: true,
    penaltyMaintenance: true,
  } as const;
}

function getMitraBankFields() {
  return {
    bankName: true,
    bankAccountNo: true,
    bankAccountName: true,
  } as const;
}

function getMitraPersonalFields() {
  return {
    nik: true,
    tempatLahir: true,
    tanggalLahir: true,
    alamat: true,
    latitudeRumah: true,
    longitudeRumah: true,
  } as const;
}

function getMitraVerificationFields() {
  return {
    fotoDiri: true,
    fotoKtp: true,
    fotoSim: true,
    fotoKk: true,
    requiresFaceVerification: true,
    lastFaceVerification: true,
  } as const;
}

/** Build create payload for mitra persistence. */
export function buildCreateMitraData(
  id: string,
  passwordHash: string,
  payload: CreateMitraDTO,
): Prisma.MitraUncheckedCreateInput {
  return {
    id,
    name: payload.name,
    email: payload.email,
    passwordHash,
    phone: payload.phone,
    mitraType: resolveMitraType(payload.employeeType),
    siteId: payload.siteId,
    tenantId: payload.tenantId,
    mitraRateWoPsb: payload.mitraRateWoPsb,
    mitraRateWoMaintenance: payload.mitraRateWoMaintenance,
    mitraRateCanvasing: payload.mitraRateCanvasing,
    bankName: payload.bankName,
    bankAccountNo: payload.bankAccountNo,
    bankAccountName: payload.bankAccountName,
    targetHarian: payload.targetHarian,
    minWithdrawal: payload.minWithdrawal,
    garansiHari: payload.garansiHari,
    slaGaransiJam: payload.slaGaransiJam,
    penaltyPsb: payload.penaltyPsb,
    penaltyMaintenance: payload.penaltyMaintenance,
    nik: payload.nik,
    tempatLahir: payload.tempatLahir,
    tanggalLahir: payload.tanggalLahir
      ? new Date(payload.tanggalLahir)
      : undefined,
    alamat: payload.alamat,
    latitudeRumah: payload.latitudeRumah,
    longitudeRumah: payload.longitudeRumah,
    fotoDiri: payload.fotoDiri,
    fotoKtp: payload.fotoKtp,
    fotoSim: payload.fotoSim,
    fotoKk: payload.fotoKk,
    requiresFaceVerification: payload.requiresFaceVerification ?? false,
    isActive: true,
  };
}

/** Build update payload for mitra persistence. */
export function buildUpdateMitraData(
  payload: UpdateMitraDTO,
  passwordHash?: string,
): Prisma.MitraUncheckedUpdateInput {
  const mitraType = payload.employeeType
    ? resolveMitraType(payload.employeeType)
    : undefined;

  return {
    ...(payload.name && { name: payload.name }),
    ...(payload.email && { email: payload.email }),
    ...(passwordHash && { passwordHash }),
    ...(payload.phone !== undefined && { phone: payload.phone }),
    ...(mitraType && { mitraType }),
    ...(payload.siteId !== undefined && { siteId: payload.siteId }),
    ...(payload.mitraRateWoPsb !== undefined && {
      mitraRateWoPsb: payload.mitraRateWoPsb,
    }),
    ...(payload.mitraRateWoMaintenance !== undefined && {
      mitraRateWoMaintenance: payload.mitraRateWoMaintenance,
    }),
    ...(payload.mitraRateCanvasing !== undefined && {
      mitraRateCanvasing: payload.mitraRateCanvasing,
    }),
    ...(payload.bankName !== undefined && { bankName: payload.bankName }),
    ...(payload.bankAccountNo !== undefined && {
      bankAccountNo: payload.bankAccountNo,
    }),
    ...(payload.bankAccountName !== undefined && {
      bankAccountName: payload.bankAccountName,
    }),
    ...(payload.targetHarian !== undefined && {
      targetHarian: payload.targetHarian,
    }),
    ...(payload.minWithdrawal !== undefined && {
      minWithdrawal: payload.minWithdrawal,
    }),
    ...(payload.garansiHari !== undefined && {
      garansiHari: payload.garansiHari,
    }),
    ...(payload.slaGaransiJam !== undefined && {
      slaGaransiJam: payload.slaGaransiJam,
    }),
    ...(payload.penaltyPsb !== undefined && {
      penaltyPsb: payload.penaltyPsb,
    }),
    ...(payload.penaltyMaintenance !== undefined && {
      penaltyMaintenance: payload.penaltyMaintenance,
    }),
    ...(payload.nik !== undefined && { nik: payload.nik }),
    ...(payload.tempatLahir !== undefined && {
      tempatLahir: payload.tempatLahir,
    }),
    ...(payload.tanggalLahir !== undefined && {
      tanggalLahir: payload.tanggalLahir
        ? new Date(payload.tanggalLahir)
        : null,
    }),
    ...(payload.alamat !== undefined && { alamat: payload.alamat }),
    ...(payload.latitudeRumah !== undefined && {
      latitudeRumah: payload.latitudeRumah,
    }),
    ...(payload.longitudeRumah !== undefined && {
      longitudeRumah: payload.longitudeRumah,
    }),
    ...(payload.fotoDiri !== undefined && { fotoDiri: payload.fotoDiri }),
    ...(payload.fotoKtp !== undefined && { fotoKtp: payload.fotoKtp }),
    ...(payload.fotoSim !== undefined && { fotoSim: payload.fotoSim }),
    ...(payload.fotoKk !== undefined && { fotoKk: payload.fotoKk }),
    ...(payload.requiresFaceVerification !== undefined && {
      requiresFaceVerification: payload.requiresFaceVerification,
    }),
    ...(payload.isActive !== undefined && { isActive: payload.isActive }),
  };
}

/** Ensure mitra wallet exists inside the current transaction. */
export async function ensureWalletExistsTx(
  tx: Prisma.TransactionClient,
  mitraId: string,
) {
  await tx.mitraWallet.upsert({
    where: { mitraId },
    create: { mitraId },
    update: {},
  });
}

function resolveMitraType(employeeType: string): MitraType {
  return employeeType === "MITRA_SALES"
    ? MitraType.MITRA_SALES
    : MitraType.MITRA_TEKNISI;
}
