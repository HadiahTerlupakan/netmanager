/**
 * Persona karyawan — kerangka tampilan aplikasi mobile (Beranda & tab bawah)
 * yang melekat pada Role. Izin (`m_*`) tetap menentukan isi tiap tampilan.
 *
 * Murni (tanpa Prisma) agar aman dipakai client component lewat
 * `@/modules/roles/client`. Nilainya harus sama dengan enum Prisma
 * `PersonaKaryawan`; kesetaraannya dijaga oleh tes
 * `tests/modules/roles/persona-karyawan.test.ts`.
 *
 * Desain: `docs/architecture/persona-pengguna-design.md`.
 */

export const PERSONA_KARYAWAN = [
  "STAFF",
  "TEKNISI",
  "SALES",
  "FINANCE",
  "DIREKTUR",
] as const;

export type PersonaKaryawan = (typeof PERSONA_KARYAWAN)[number];

/** Persona untuk role yang belum ditentukan (sama dengan default kolom DB). */
export const PERSONA_KARYAWAN_DEFAULT: PersonaKaryawan = "STAFF";

export const LABEL_PERSONA_KARYAWAN: Record<PersonaKaryawan, string> = {
  STAFF: "Staff",
  TEKNISI: "Teknisi",
  SALES: "Sales",
  FINANCE: "Finance",
  DIREKTUR: "Direktur",
};

export const DESKRIPSI_PERSONA_KARYAWAN: Record<PersonaKaryawan, string> = {
  STAFF: "Absen dan fitur kepegawaian (izin, lembur, kalender libur, chat).",
  TEKNISI: "Work order dan pekerjaan lapangan.",
  SALES:
    "Presurvei, rencana kunjungan, dan target. Pengguna role ini otomatis tampil sebagai sales (manajemen sales, target, canvasing).",
  FINANCE:
    "Sementara memakai tampilan Staff sampai tampilan Finance selesai dibuat.",
  DIREKTUR:
    "Sementara memakai tampilan Staff sampai tampilan Direktur selesai dibuat.",
};

/**
 * Satu-satunya aturan "siapa sales": pengguna yang role-nya berpersona SALES.
 * Kolom `User.isSales` adalah turunan dari aturan ini dan disinkronkan
 * otomatis saat user dibuat/diubah role-nya dan saat persona role berubah.
 */
export function isSalesDariPersona(
  persona: PersonaKaryawan | null | undefined,
): boolean {
  return persona === "SALES";
}

/** Cek apakah sebuah nilai adalah persona karyawan yang sah. */
export function isPersonaKaryawan(value: unknown): value is PersonaKaryawan {
  return (
    typeof value === "string" &&
    (PERSONA_KARYAWAN as readonly string[]).includes(value)
  );
}

/** Normalisasi nilai tak tepercaya (mis. respons API) menjadi persona sah. */
export function toPersonaKaryawan(value: unknown): PersonaKaryawan {
  return isPersonaKaryawan(value) ? value : PERSONA_KARYAWAN_DEFAULT;
}
