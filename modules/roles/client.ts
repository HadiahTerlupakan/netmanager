/**
 * Public API modul roles untuk komponen klien.
 *
 * Hanya berisi tipe, konstanta, dan fungsi murni — TIDAK meng-export service
 * atau repository, sehingga aman diimpor dari client component tanpa menarik
 * Prisma ke bundle browser.
 *
 * Client component: `import { ... } from "@/modules/roles/client"`
 * Server/API route: `import { ... } from "@/modules/roles"` (barrel penuh)
 */

export {
  DESKRIPSI_PERSONA_KARYAWAN,
  LABEL_PERSONA_KARYAWAN,
  PERSONA_KARYAWAN,
  PERSONA_KARYAWAN_DEFAULT,
  isPersonaKaryawan,
  isSalesDariPersona,
  toPersonaKaryawan,
  type PersonaKaryawan,
} from "./domain/persona-karyawan";

export {
  CATATAN_RESOURCE_MOBILE_PER_PERSONA,
  IZIN_INTI_PER_PERSONA,
  IZIN_STANDAR_MOBILE_PER_PERSONA,
  RESOURCE_MOBILE_MATRIKS,
  RESOURCE_MOBILE_PER_PERSONA,
  formatPeringatanIzinInti,
  getIzinIntiHilang,
  getIzinTakTerlihatDiHp,
  isResourceMobileMatriks,
  isResourceMobileRelevan,
  terapkanIzinStandarMobile,
  type IzinIntiMobile,
  type ResourceMobileMatriks,
} from "./domain/izin-mobile-persona";
