/**
 * Entitas domain iklan presurvei.
 *
 * Murni: tidak mengimpor apa pun dari luar folder domain.
 */

export const IKLAN_CHANNELS = [
  "META",
  "GOOGLE",
  "TIKTOK",
  "WHATSAPP",
  "OFFLINE",
  "LAINNYA",
] as const;

export type IklanChannel = (typeof IKLAN_CHANNELS)[number];

export interface IklanEntity {
  id: string;
  nama: string;
  kode: string;
  channel: IklanChannel;
  tanggalMulai: Date;
  tanggalSelesai: Date | null;
  biaya: number | null;
  penanggungJawabId: string | null;
  isAktif: boolean;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
