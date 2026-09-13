import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PelangganMapper } from "../mappers/PelangganMapper";
import { ACTIVE_PACKAGE_STATUS } from "./pelanggan-repository.constants";
import type { Status } from "@prisma/client";

/** Update customer profile preferences. */
export function updateProfile(id: string, data: UpdateProfileData) {
  return prisma.pelanggan.update({
    where: { id },
    data: { ...data, updatedAt: new Date() },
    select: buildProfilePreferenceSelect(),
  });
}

/** Get password hash for verification. */
export async function getPasswordHash(id: string): Promise<string | null> {
  const customer = await prisma.pelanggan.findUnique({
    where: { id },
    select: { passwordHash: true },
  });

  return customer?.passwordHash || null;
}

/** Update sync status after RADIUS operation. */
export async function updateSyncStatus(
  id: string,
  status: string,
  error?: string | null,
) {
  const pelanggan = await prisma.pelanggan.update({
    where: { id },
    data: buildSyncStatusData(status, error),
  });

  return PelangganMapper.toDomain(pelanggan);
}

/** Get auth payload by identifier. */
export function findByIdentifierForAuth(identifier: string) {
  return prisma.pelanggan.findFirst({
    where: buildAuthIdentifierWhere(identifier),
    select: buildAuthPayloadSelect(),
  });
}

/**
 * Get upgrade package options above current package price.
 *
 * Discope ke site pelanggan mengikuti konvensi `HargaPaketRepository.findAll`:
 * paket milik site tersebut plus paket global (`siteId` null). Filter tenant
 * tidak ditulis di sini karena sudah dipasang otomatis oleh extension
 * `withTenantIsolation` pada client `prisma`.
 */
export function findUpgradePackageOptions(
  currentPrice: number,
  limit: number,
  siteId?: string | null,
) {
  return prisma.hargaPaket.findMany({
    where: {
      status: ACTIVE_PACKAGE_STATUS as Status,
      harga: { gt: currentPrice },
      ...buildSiteScope(siteId),
    },
    include: { bandwidth: true },
    orderBy: { harga: "asc" },
    take: limit,
  });
}

/**
 * Get one package that is a valid upgrade target for a customer.
 *
 * Memakai predikat yang sama dengan `findUpgradePackageOptions` (aktif, lebih
 * mahal dari paket sekarang, dalam site pelanggan atau global) supaya opsi yang
 * ditampilkan dan opsi yang boleh diajukan tidak pernah berbeda.
 */
export function findUpgradeCandidate(
  packageId: string,
  options: { minPrice: number; siteId?: string | null },
) {
  return prisma.hargaPaket.findFirst({
    where: {
      id: packageId,
      status: ACTIVE_PACKAGE_STATUS as Status,
      harga: { gt: options.minPrice },
      ...buildSiteScope(options.siteId),
    },
    select: { id: true, name: true, harga: true },
  });
}

function buildSiteScope(siteId?: string | null) {
  if (!siteId) return {};
  return { OR: [{ siteId }, { siteId: null }] };
}

function buildProfilePreferenceSelect() {
  return {
    id: true,
    noTelp: true,
    is2FAEnabled: true,
    isBillNotifEnabled: true,
    isPromoEnabled: true,
    updatedAt: true,
  };
}

function buildSyncStatusData(status: string, error?: string | null) {
  const data: Prisma.PelangganUpdateInput = {
    syncStatus: status,
    syncError: error,
    updatedAt: new Date(),
  };
  if (status === "FAILED") data.syncRetryCount = { increment: 1 };
  if (status === "SYNCED")
    return { ...data, syncRetryCount: 0, lastSyncedAt: new Date() };
  return data;
}

function buildAuthIdentifierWhere(identifier: string) {
  return {
    OR: [
      { idPelanggan: identifier.toUpperCase() },
      { email: identifier.toLowerCase() },
    ],
  };
}

function buildAuthPayloadSelect() {
  return {
    id: true,
    idPelanggan: true,
    nama: true,
    username: true,
    email: true,
    status: true,
    passwordHash: true,
    tenantId: true,
  };
}

type UpdateProfileData = {
  noTelp?: string;
  passwordHash?: string;
  is2FAEnabled?: boolean;
  isBillNotifEnabled?: boolean;
  isPromoEnabled?: boolean;
};
