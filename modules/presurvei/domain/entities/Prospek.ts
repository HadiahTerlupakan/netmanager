/**
 * Entitas domain prospek presurvei.
 *
 * Murni: tidak mengimpor apa pun dari luar folder domain.
 */

export const PROSPEK_STATUSES = [
  "BARU",
  "DIHUBUNGI",
  "TERTARIK",
  "NEGOSIASI",
  "DEAL",
  "TIDAK_MINAT",
  "TIDAK_LAYAK",
] as const;

export type ProspekStatus = (typeof PROSPEK_STATUSES)[number];

export const PROSPEK_SUMBER = [
  "LAPANGAN",
  "IKLAN",
  "WEBSITE",
  "REFERRAL",
  "WALK_IN",
] as const;

export type ProspekSumber = (typeof PROSPEK_SUMBER)[number];

export interface ProspekEntity {
  id: string;
  nama: string;
  noTelp: string;
  email: string | null;
  alamat: string;
  latitude: number | null;
  longitude: number | null;
  shareloc: string | null;
  sumber: ProspekSumber;
  iklanId: string | null;
  registrationId: string | null;
  referralNama: string | null;
  status: ProspekStatus;
  pemilikId: string | null;
  /**
   * Label pemilik (`tentukanNamaSales`), null bila tak bertuan atau pemiliknya
   * tidak bisa ditampilkan — termasuk pemilik dari tenant lain
   * (`namaSalesSatuTenant`).
   */
  namaPemilik: string | null;
  paketDiminati: string | null;
  catatan: string | null;
  canvasingId: string | null;
  konversiAt: Date | null;
  siteId: string | null;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
