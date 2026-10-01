import { isSalesEfektif } from "@/modules/presurvei/client";

/** Role beserta izinnya sebagaimana dimuat Prisma. */
export interface RoleDenganIzin {
  isSuperAdmin: boolean;
  permission: { resource: string; action: string }[];
}

/** Izin role sebagai `resource:action`; super admin = wildcard, sama dengan `getUserPermissions`. */
export function daftarIzinRole(role: RoleDenganIzin | null | undefined): string[] {
  if (!role) return [];
  if (role.isSuperAdmin) return ["*"];
  return role.permission.map((izin) => `${izin.resource}:${izin.action}`);
}

/**
 * `isSales` yang dikirim ke aplikasi mobile: kolom user ATAU kepala sales
 * lewat role-nya (`isSalesEfektif`). Menentukan persona Beranda sales.
 */
export function isSalesPengguna(user: {
  isSales: boolean;
  role: RoleDenganIzin | null | undefined;
}): boolean {
  return isSalesEfektif({ isSales: user.isSales, permissions: daftarIzinRole(user.role) });
}
