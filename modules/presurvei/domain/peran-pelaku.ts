/**
 * Peran pelaku kegiatan: sales atau bukan, beserta departemennya.
 *
 * Murni: tidak mengimpor apa pun dari luar folder domain.
 *
 * Presurvei boleh dipakai siapa pun yang diberi izin `m_presurvei`/`presurvei`
 * lewat role — sales, teknisi, atau admin yang mencatat telepon dari web.
 * Laporan perlu membedakan kegiatan sales dari yang lain, dan pembedanya
 * `User.isSales`: definisi "sales" yang sama dengan penugasan prospek
 * (`repositories/SalesRepository.ts`).
 *
 * Peran dan departemen adalah keadaan user SAAT INI, bukan saat kegiatan
 * dicatat — tidak ada snapshot di baris kegiatan. Teknisi yang kemudian
 * dijadikan sales ikut membawa seluruh kegiatan lamanya ke kelompok "Sales".
 */

import { isSatuTenant, type IdentitasSalesBertenant } from "./nama-sales";

/** Peran pelaku kegiatan, sekaligus sumber union-nya. */
export const PERAN_PELAKU = ["SALES", "NON_SALES"] as const;

export type PeranPelaku = (typeof PERAN_PELAKU)[number];

/**
 * Nilai `User.isSales` untuk tiap peran — dipakai filter repository.
 * `Record` memaksa peran baru dijawab saat kompilasi.
 */
export const IS_SALES_PER_PERAN: Record<PeranPelaku, boolean> = {
  SALES: true,
  NON_SALES: false,
};

/** Departemen pelaku hasil join, beserta tenant pemiliknya untuk dijaga. */
export interface DepartemenPelakuBertenant {
  name: string;
  tenantId: string | null;
}

/**
 * Identitas pelaku kegiatan hasil join (`SERTAKAN_PELAKU`).
 *
 * `isSales` dan `departments` opsional di tipe supaya baris yang diambil
 * tanpa kolom itu tetap bisa dipetakan — hasilnya null, bukan tebakan.
 */
export interface IdentitasPelakuBertenant extends IdentitasSalesBertenant {
  isSales?: boolean;
  departments?: DepartemenPelakuBertenant | null;
}

/**
 * Peran pelaku, atau null bila tidak boleh/tidak bisa ditentukan.
 *
 * Penjaga tenant per baris sama dengan `namaSalesSatuTenant`: pelaku dari
 * tenant lain tidak membocorkan apa pun tentang dirinya, termasuk apakah ia
 * sales. `isSales` yang tidak ikut ter-select dijawab null, bukan
 * `NON_SALES` — menebak "bukan sales" akan memindahkan kegiatan sales ke
 * kelompok yang salah tanpa jejak.
 */
export function peranPelakuSatuTenant(
  identitas: IdentitasPelakuBertenant | null | undefined,
  tenantIdBaris: string | null,
): PeranPelaku | null {
  if (!isSatuTenant(identitas, tenantIdBaris)) return null;
  if (typeof identitas.isSales !== "boolean") return null;
  return identitas.isSales ? "SALES" : "NON_SALES";
}

/**
 * Nama departemen pelaku, atau null bila tidak boleh ditampilkan.
 *
 * Dua penjaga, keduanya per baris: pelakunya harus satu tenant dengan baris,
 * DAN departemennya juga. `include` bersarang tidak disaring ekstensi tenant
 * (lihat `namaSalesSatuTenant`), jadi user yang `departmentId`-nya menunjuk
 * departemen tenant lain akan membawa nama departemen itu ke layar.
 *
 * Departemen tak bertenant sengaja dianggap null pada baris bertenant, walau
 * ekstensi memperlakukan `Departments` sebagai referensi global yang
 * meloloskan baris `tenantId` null (`lib/prisma-extension.ts:52`): label ini
 * harus sepakat dengan dropdown filter (`DepartemenRepository`,
 * `where: { tenantId }`) dan dengan `DepartmentRepository` modul roles, yang
 * sama-sama tidak menawarkan departemen tak bertenant. Per 2026-09-24
 * produksi tidak punya departemen tak bertenant.
 */
export function departemenPelakuSatuTenant(
  identitas: IdentitasPelakuBertenant | null | undefined,
  tenantIdBaris: string | null,
): string | null {
  if (!isSatuTenant(identitas, tenantIdBaris)) return null;
  const departemen = identitas.departments;
  if (!departemen) return null;
  if (departemen.tenantId !== tenantIdBaris) return null;
  return departemen.name;
}
