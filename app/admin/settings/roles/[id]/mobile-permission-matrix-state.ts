/**
 * Logika murni matriks Mobile App di form role: memilah kelompok izin mobile
 * menurut relevansinya bagi persona terpilih dan menyusun peringatannya.
 * Aturan relevansinya ada di `@/modules/roles/client` (izin-mobile-persona).
 */

import { PERMISSION_GROUPS_MOBILE } from "@/lib/permission-config";
import {
  formatPeringatanIzinInti,
  getIzinIntiHilang,
  getIzinTakTerlihatDiHp,
  isResourceMobileRelevan,
  type PersonaKaryawan,
} from "@/modules/roles/client";

/** Satu kelompok matriks beserta resource yang ditampilkan di bagian itu. */
export interface KelompokIzinMobile {
  groupName: string;
  resources: readonly string[];
}

/** Kelompok matriks mobile yang dipilah: dipakai tampilan vs tidak tampil di HP. */
export interface PemilahanMatriksMobile {
  relevan: KelompokIzinMobile[];
  tidakRelevan: KelompokIzinMobile[];
}

/** Ringkasan peringatan matriks mobile untuk persona & izin saat ini. */
export interface PeringatanMatriksMobile {
  /** Izin tercentang yang tidak akan terlihat di HP persona ini. */
  izinTakTerlihat: string[];
  /** Kalimat peringatan izin inti yang belum dicentang. */
  peringatanIntiHilang: string[];
}

type KelompokMobile = Record<string, readonly string[]>;

/**
 * Pilah tiap kelompok `PERMISSION_GROUPS_MOBILE` per resource: resource yang
 * dipakai persona masuk `relevan`, sisanya `tidakRelevan`. Satu kelompok bisa
 * muncul di kedua bagian (mis. Kehadiran untuk Sales: Lembur tidak dipakai).
 */
export function pilahKelompokMobile(
  persona: PersonaKaryawan,
  kelompok: KelompokMobile = PERMISSION_GROUPS_MOBILE,
): PemilahanMatriksMobile {
  const relevan: KelompokIzinMobile[] = [];
  const tidakRelevan: KelompokIzinMobile[] = [];
  for (const [groupName, resources] of Object.entries(kelompok)) {
    const dipakai = resources.filter((r) => isResourceMobileRelevan(persona, r));
    const takDipakai = resources.filter(
      (r) => !isResourceMobileRelevan(persona, r),
    );
    if (dipakai.length > 0) relevan.push({ groupName, resources: dipakai });
    if (takDipakai.length > 0) {
      tidakRelevan.push({ groupName, resources: takDipakai });
    }
  }
  return { relevan, tidakRelevan };
}

/** Susun peringatan matriks mobile (izin tak terlihat & izin inti hilang). */
export function getPeringatanMatriksMobile(
  persona: PersonaKaryawan,
  permissions: readonly string[],
): PeringatanMatriksMobile {
  return {
    izinTakTerlihat: getIzinTakTerlihatDiHp(persona, permissions),
    peringatanIntiHilang: getIzinIntiHilang(persona, permissions).map((inti) =>
      formatPeringatanIzinInti(persona, inti),
    ),
  };
}

/** Kunci buka/tutup kelompok matriks mobile; bagian tak relevan diberi kunci sendiri. */
export function getKunciKelompokMobile(
  groupName: string,
  isRelevan: boolean,
): string {
  return isRelevan ? `employee-${groupName}` : `employee-lain-${groupName}`;
}
