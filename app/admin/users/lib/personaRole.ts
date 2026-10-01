import {
  isSalesDariPersona,
  toPersonaKaryawan,
  type PersonaKaryawan,
} from "@/modules/roles/client";

/** Role minimal yang dibutuhkan untuk membaca persona di form user. */
export interface RoleBerpersona {
  id: string;
  name: string;
  /** Dari `GET /api/roles`; nilai asing/kosong diperlakukan STAFF. */
  persona?: string;
}

/** Persona role terpilih di form user, beserta turunan status sales-nya. */
export interface PersonaRoleTerpilih {
  roleId: string;
  namaRole: string;
  persona: PersonaKaryawan;
  /** `User.isSales` yang akan disimpan server untuk role ini. */
  isSales: boolean;
}

/** Cari role terpilih dan baca persona-nya; null bila belum ada role dipilih. */
export function personaRoleTerpilih(
  roles: readonly RoleBerpersona[],
  roleId: string,
): PersonaRoleTerpilih | null {
  const role = roles.find((kandidat) => kandidat.id === roleId);
  if (!role) return null;
  const persona = toPersonaKaryawan(role.persona);
  return {
    roleId: role.id,
    namaRole: role.name,
    persona,
    isSales: isSalesDariPersona(persona),
  };
}

/** Tautan ke halaman ubah role (Pengaturan → Hak Akses). */
export function tautanUbahRole(roleId: string): string {
  return `/admin/pengaturan/hak-akses/${roleId}`;
}
