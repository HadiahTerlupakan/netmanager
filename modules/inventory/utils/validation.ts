import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/auth";
import type { Session } from "next-auth";
import type { UserSession } from "@/lib/auth";

interface SiteRef {
  id: string;
}

interface UserSiteAssignment {
  siteId: string;
}

interface InventorySiteScopeInput {
  actorType: "user" | "mitra";
  isSuperAdmin: boolean;
  permissions?: string[];
}

interface InventoryAssignedSiteInput {
  primarySite?: SiteRef | null;
  userSites?: UserSiteAssignment[] | null;
  mitraSiteId?: string | null;
}

interface InventoryActorScopeUser {
  id: string;
  role?: {
    name?: string | null;
    permission?: Array<{
      resource: string;
      action: string;
    }>;
  } | null;
  sites?: SiteRef | null;
  userSites?: UserSiteAssignment[] | null;
}

interface InventoryActorScopeMitra {
  id: string;
  siteId?: string | null;
}

interface InventoryActorScopeInput {
  user?: InventoryActorScopeUser | null;
  mitra?: InventoryActorScopeMitra | null;
  isSuperAdmin?: boolean;
}

interface InventoryActorScopeResult {
  actor: { type: "user" | "mitra"; id: string; userId?: string };
  allowedSiteIds: string[];
  isRestricted: boolean;
  userPermissions: string[];
}

export type ValidatedGudangSiteAccessResult = {
  allowed: boolean;
  error?: string;
  gudang?: {
    id: string;
    tenantId: string | null;
    sites: Array<{
      id: string;
    }>;
  };
};

function getLegacySiteId(user: UserSession): string | undefined {
  return Reflect.get(user, "siteId") as string | undefined;
}

function getSessionAssignedSiteIds(user: UserSession): string[] {
  return Array.from(
    new Set(
      [
        ...(user.siteIds || []),
        user.primarySiteId,
        getLegacySiteId(user),
      ].filter((siteId): siteId is string => Boolean(siteId)),
    ),
  );
}

/**
 * Sumbu pembatasan yang berlaku untuk seluruh pergerakan stok.
 *
 * Setiap daftar inventory punya sumbunya sendiri (`masuk:`, `keluar:`,
 * `transfer:`), tetapi semuanya pada akhirnya berbicara tentang gudang. Orang
 * yang dibatasi per-site untuk gudang atau barang tidak seharusnya melihat
 * mutasi gudang site lain hanya karena sumbu spesifik mutasi itu tidak
 * dinyalakan admin.
 *
 * Disatukan di sini supaya tiap daftar tidak lagi menebak sendiri — dulu
 * `transfer` dan `keluar` tidak memuat sumbu gudang sama sekali, sementara
 * `masuk` memuat sebagian.
 */
export const PEMBATASAN_SITE_GUDANG = [
  "barang:site_only",
  "gudang:site_only",
] as const;

/**
 * Validate site-scoped akses user ke Gudang berdasarkan RBAC dan Site restrictions.
 */
export async function validateGudangSiteAccess(
  session: Session,
  gudangId: string,
): Promise<ValidatedGudangSiteAccessResult> {
  const user = session.user as UserSession;
  if (isSuperAdmin(user)) {
    return { allowed: true };
  }

  // Sama seperti `isInventorySiteRestricted`: pemeriksaan ini dulu hanya
  // menyebut `k_barang:site_only`, nama yang tidak pernah dibuat seed maupun
  // tersimpan di basis data. Tanpa ekspansi alias di jalur ini, `.includes`
  // selalu salah — artinya fungsi ini selalu menjawab "boleh", dan pembatasan
  // site pada gudang (transfer, barang masuk, barang keluar, opname) tidak
  // pernah berlaku untuk siapa pun kecuali super admin.
  //
  // Dua nama di bawah yang benar-benar ada, dan persis itulah yang dimaksud
  // peta alias dengan `k_barang:site_only`.
  const hasSiteRestriction = ["barang:site_only", "gudang:site_only"].some(
    (permission) => (user.permissions || []).includes(permission),
  );
  if (!hasSiteRestriction) {
    return { allowed: true };
  }

  const assignedSiteIds = getSessionAssignedSiteIds(user);
  if (assignedSiteIds.length === 0) {
    return {
      allowed: false,
      error:
        "User tidak memiliki Site yang ditugaskan namun dibatasi aksesnya per Site.",
    };
  }

  const gudang = await prisma.gudang.findUnique({
    where: { id: gudangId },
    select: { id: true, tenantId: true, sites: { select: { id: true } } },
  });

  if (!gudang) {
    return { allowed: false, error: "Gudang tidak ditemukan." };
  }

  const trustedGudang = {
    id: gudang.id,
    tenantId: gudang.tenantId,
    sites: gudang.sites.map((site) => ({ id: site.id })),
  };

  if (
    !hasGudangSiteAccess(
      trustedGudang.sites.map((site) => site.id),
      assignedSiteIds,
    )
  ) {
    return {
      allowed: false,
      error: "Anda tidak memiliki akses ke Gudang ini (Beda Site).",
      gudang: trustedGudang,
    };
  }

  return { allowed: true, gudang: trustedGudang };
}

export function isInventorySiteRestricted(
  input: InventorySiteScopeInput,
): boolean {
  if (input.actorType === "mitra") {
    return true;
  }

  if (input.isSuperAdmin) {
    return false;
  }

  // `m_barang`, bukan `k_barang`: tidak ada satu pun permission berawalan
  // `k_barang` yang dibuat seed maupun tersimpan di basis data — resource yang
  // ada hanya `barang`, `m_barang`, `m_barang_masuk`, `m_barang_keluar`. Selama
  // pemeriksaan ini menyebut nama yang tidak pernah bisa dimiliki siapa pun, ia
  // selalu mengembalikan false: seluruh mesin pembatasan site di bawahnya
  // (`ensureMobileAssignedSite`, `getMobileScopedSiteIds`) tidak pernah
  // menyala, dan teknisi mana pun bisa menarik stok dari gudang site lain
  // walau toggle "Batasi ke Site Sendiri" sudah dinyalakan admin.
  //
  // Ditemukan saat QA 8 Okt 2026: teknisi bersite Headquarters ditawari dan
  // berhasil memakai Gudang Jakarta Selatan.
  return (input.permissions || []).includes("m_barang:site_only");
}

export function getAssignedInventorySiteIds(
  input: InventoryAssignedSiteInput,
): string[] {
  return Array.from(
    new Set(
      [
        ...(input.userSites?.map((site) => site.siteId) || []),
        input.primarySite?.id,
        input.mitraSiteId,
      ].filter((siteId): siteId is string => Boolean(siteId)),
    ),
  );
}

export function buildGudangSiteFilter(siteIds: string[]): {
  sites: { some: { id: { in: string[] } } };
} {
  return {
    sites: {
      some: {
        id: { in: siteIds },
      },
    },
  };
}

export function hasGudangSiteAccess(
  gudangSiteIds: string[],
  allowedSiteIds: string[],
): boolean {
  return (
    allowedSiteIds.length > 0 &&
    gudangSiteIds.some((siteId) => allowedSiteIds.includes(siteId))
  );
}

export function buildInventoryActorFilter(actor: {
  type: "user" | "mitra";
  id: string;
}): Record<string, unknown> {
  return actor.type === "user"
    ? { OR: [{ userId: actor.id }, { actorType: "user", actorId: actor.id }] }
    : { actorType: "mitra", actorId: actor.id };
}

export function resolveInventoryActorScope(
  input: InventoryActorScopeInput,
): InventoryActorScopeResult | null {
  const userPermissions =
    input.user?.role?.permission?.map(
      (permission) => `${permission.resource}:${permission.action}`,
    ) || [];
  const allowedSiteIds = getAssignedInventorySiteIds({
    primarySite: input.user?.sites ? { id: input.user.sites.id } : null,
    userSites: input.user?.userSites || null,
    mitraSiteId: input.mitra?.siteId,
  });
  const isRestricted = isInventorySiteRestricted({
    actorType: input.mitra ? "mitra" : "user",
    isSuperAdmin: input.isSuperAdmin || false,
    permissions: userPermissions,
  });

  if (!input.user && !input.mitra) {
    return null;
  }

  if (input.user) {
    return {
      actor: { type: "user", id: input.user.id, userId: input.user.id },
      allowedSiteIds,
      isRestricted,
      userPermissions,
    };
  }

  return {
    actor: { type: "mitra", id: input.mitra!.id },
    allowedSiteIds,
    isRestricted,
    userPermissions,
  };
}

export function validateInventoryGudangAccess(input: {
  isRestricted: boolean;
  allowedSiteIds: string[];
  gudangSiteIds: string[];
}): { allowed: boolean; error?: string } {
  if (!input.isRestricted) {
    return { allowed: true };
  }

  if (input.allowedSiteIds.length === 0) {
    return {
      allowed: false,
      error: "Akses ditolak: Tidak ada site yang ditugaskan",
    };
  }

  if (!hasGudangSiteAccess(input.gudangSiteIds, input.allowedSiteIds)) {
    return {
      allowed: false,
      error: "Akses ditolak: Gudang di luar site Anda",
    };
  }

  return { allowed: true };
}
