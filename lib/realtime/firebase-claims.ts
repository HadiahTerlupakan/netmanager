import { isSuperAdmin } from "@/lib/auth/super-admin";

/** Staf masuk lewat sesi NextAuth; pelanggan lewat cookie portal pelanggan. */
export type RealtimeAudience = "staff" | "customer";

/** Rute pencetak token custom Firebase untuk tiap jenis pengguna realtime. */
export const REALTIME_TOKEN_PATHS: Record<RealtimeAudience, string> = {
  staff: "/api/auth/firebase-token",
  customer: "/api/customer/firebase-token",
};

/** Klaim token custom Firebase realtime; namanya dibaca aturan Firestore. */
export interface RealtimeClaims {
  role: string;
  tenantId: string | null;
  departmentId: string | null;
  siteId: string | null;
  primarySiteId: string | null;
  accessAdminPanel: boolean;
  accessEmployeePanel: boolean;
  isSuperAdmin: boolean;
}

/** Bagian sesi yang menentukan klaim token Firebase realtime. */
export interface RealtimeClaimsSource {
  role?: string | null;
  tenantId?: string | null;
  departmentId?: string | null;
  siteId?: string | null;
  primarySiteId?: string | null;
  accessAdminPanel?: boolean;
  accessEmployeePanel?: boolean;
  isSuperAdmin?: boolean;
}

/**
 * Klaim token custom Firebase untuk realtime staf, yang dibaca aturan
 * Firestore. Satu sumber untuk route pembuat token dan untuk klien yang
 * memeriksa apakah token yang sedang dipakai masih sesuai dengan sesinya.
 */
export function buildRealtimeClaims(
  user: RealtimeClaimsSource,
): RealtimeClaims {
  const isUserSuperAdmin = isSuperAdmin(user);
  const primarySiteId = user.primarySiteId ?? user.siteId ?? null;
  return {
    role: isUserSuperAdmin ? "SUPER_ADMIN" : (user.role ?? "USER"),
    tenantId: user.tenantId ?? null,
    departmentId: user.departmentId ?? null,
    siteId: primarySiteId,
    primarySiteId,
    accessAdminPanel: user.accessAdminPanel ?? false,
    accessEmployeePanel: user.accessEmployeePanel ?? false,
    isSuperAdmin: isUserSuperAdmin,
  };
}

/**
 * Klaim token pelanggan portal. Aturan Firestore membuka `users/<uid>/events`
 * untuk pemilik uid, dan di sanalah pengumuman, balasan, dan pesan tiket
 * pelanggan dikirim; pelanggan tidak butuh lebih. Setiap klaim staf ditulis
 * dengan nilai terendah karena klaim token custom menimpa klaim yang pernah
 * disimpan untuk uid yang sama: rute token mobile menyimpan `tenantId`, dan
 * aturan `seTenant()` membuka event tiket dan work order se-tenant kepada
 * pemegang tenant yang cocok.
 */
export function buildCustomerRealtimeClaims(): RealtimeClaims {
  return {
    role: "CUSTOMER",
    tenantId: null,
    departmentId: null,
    siteId: null,
    primarySiteId: null,
    accessAdminPanel: false,
    accessEmployeePanel: false,
    isSuperAdmin: false,
  };
}

/** Klaim yang seharusnya dibawa token realtime untuk sesi ini. */
export function getExpectedRealtimeClaims(
  audience: RealtimeAudience,
  session: RealtimeClaimsSource,
): RealtimeClaims {
  return audience === "customer"
    ? buildCustomerRealtimeClaims()
    : buildRealtimeClaims(session);
}

/** Apakah token yang sedang dipakai membawa semua klaim yang diharapkan. */
export function hasRealtimeClaims(
  tokenClaims: Record<string, unknown>,
  expected: RealtimeClaims,
): boolean {
  return Object.entries(expected).every(
    ([name, value]) => (tokenClaims[name] ?? null) === value,
  );
}
