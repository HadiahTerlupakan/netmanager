import { clientLogger } from "@/lib/client-logger";
import type { UserDetailDTO } from "@/modules/users";

export interface ReferenceDepartment {
  id: string;
  name: string;
}

export interface ReferenceRole {
  id: string;
  name: string;
  description?: string;
}

export interface ReferenceSite {
  id: string;
  code: string;
  name: string;
}

export interface ReferenceTenant {
  id: string;
  name: string;
}

/** Ambil detail user admin beserta relasinya. */
export async function fetchAdminUserDetail(
  userId: string,
): Promise<UserDetailDTO | null> {
  const res = await fetch(`/api/admin/users/${userId}`);
  if (!res.ok) {
    const fallback = await res.json().catch(() => ({}));
    throw new Error(fallback?.error || "Gagal memuat data user");
  }
  const data = await res.json();
  return (data.data?.user ?? null) as UserDetailDTO | null;
}

/** Ambil daftar departemen untuk opsi form. */
export async function fetchDepartments(): Promise<ReferenceDepartment[]> {
  try {
    const res = await fetch("/api/admin/departments");
    if (!res.ok) return [];
    const data = await res.json();
    const depts = data.data || [];
    return Array.isArray(depts) ? (depts as ReferenceDepartment[]) : [];
  } catch (error) {
    clientLogger.error("Error fetching departments:", error);
    return [];
  }
}

/** Ambil daftar role yang boleh di-assign admin. */
export async function fetchRoles(): Promise<ReferenceRole[]> {
  try {
    const res = await fetch("/api/roles?filterRestricted=true");
    if (!res.ok) return [];
    const data = await res.json();
    const roles = data.data ?? data;
    return Array.isArray(roles) ? (roles as ReferenceRole[]) : [];
  } catch (error) {
    clientLogger.error("Error fetching roles:", error);
    return [];
  }
}

/** Ambil daftar site aktif untuk opsi form. */
export async function fetchActiveSites(): Promise<ReferenceSite[]> {
  try {
    const res = await fetch("/api/admin/sites?activeOnly=true");
    if (!res.ok) return [];
    const data = await res.json();
    const sites = data.data || [];
    return Array.isArray(sites) ? (sites as ReferenceSite[]) : [];
  } catch (error) {
    clientLogger.error("Error fetching sites:", error);
    return [];
  }
}

/** Ambil daftar tenant untuk admin yang boleh akses multi-tenant. */
export async function fetchTenants(): Promise<ReferenceTenant[]> {
  try {
    const res = await fetch("/api/admin/tenants");
    if (!res.ok) return [];
    const data = await res.json();
    const tenants = data.data || [];
    return Array.isArray(tenants) ? (tenants as ReferenceTenant[]) : [];
  } catch (error) {
    clientLogger.error("Error fetching tenants:", error);
    return [];
  }
}

/** Update user admin berdasarkan payload form. */
export async function updateAdminUser(
  userId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`/api/admin/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Gagal mengupdate akun user");
  }
}

/** Simpan kuota cuti untuk tahun berjalan. */
export async function saveLeaveQuotas(
  userId: string,
  quotas: Record<string, number>,
): Promise<void> {
  const res = await fetch("/api/admin/leave-balance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      year: new Date().getFullYear(),
      quotas,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Gagal menyimpan kuota cuti");
  }
}
