import {
  PERSONA_KARYAWAN_DEFAULT,
  isSalesDariPersona,
  toPersonaKaryawan,
  type PersonaKaryawan,
} from "@/modules/roles/client";

export type { PersonaKaryawan } from "@/modules/roles/client";

/** Role beserta izin dan personanya sebagaimana dimuat Prisma. */
export interface RoleDenganIzin {
  isSuperAdmin: boolean;
  permission: { resource: string; action: string }[];
  /** Kosong pada data/uji lama: diperlakukan STAFF. */
  persona?: PersonaKaryawan | null;
}

/** Izin role sebagai `resource:action`; super admin = wildcard, sama dengan `getUserPermissions`. */
export function daftarIzinRole(role: RoleDenganIzin | null | undefined): string[] {
  if (!role) return [];
  if (role.isSuperAdmin) return ["*"];
  return role.permission.map((izin) => `${izin.resource}:${izin.action}`);
}

/**
 * `isSales` yang dikirim ke aplikasi mobile: semata-mata persona role
 * (`isSalesDariPersona`). Kolom `User.isSales` hanya salinan tersinkron.
 */
export function isSalesPengguna(user: {
  role: Pick<RoleDenganIzin, "persona"> | null | undefined;
}): boolean {
  return isSalesDariPersona(user.role?.persona);
}

/**
 * Nilai `User.isSales` untuk disimpan: turunan persona role yang dipilih.
 * Tanpa role → bukan sales. Dipakai saat user dibuat atau role-nya diubah.
 */
export async function hitungIsSalesDariRole(
  roleId: string | null | undefined,
  findRolePersona: (roleId: string) => Promise<string | null>,
): Promise<boolean> {
  if (!roleId) return false;
  return isSalesDariPersona(toPersonaKaryawan(await findRolePersona(roleId)));
}

/** Persona karyawan untuk aplikasi: persona role, bawaan STAFF. */
export function personaPengguna(user: {
  role: Pick<RoleDenganIzin, "persona"> | null | undefined;
}): PersonaKaryawan {
  return user.role?.persona ?? PERSONA_KARYAWAN_DEFAULT;
}
