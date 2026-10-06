import {
  jenisLingkupDariIzin,
  type JenisLingkupPresurvei,
} from "@/modules/roles";

import { RencanaRepository } from "../repositories/RencanaRepository";

/**
 * Sales mana saja yang boleh dilihat seorang pemanggil.
 *
 * Satu jawaban untuk seluruh modul sales — rencana, prospek, dan canvasing —
 * supaya ketiganya tidak berbeda pendapat soal siapa "tim saya". Sebelumnya
 * hanya rencana yang mengenal tingkat TIM, sehingga kepala sales bisa mengatur
 * agenda timnya tapi tidak melihat prospek maupun canvasing anggotanya.
 *
 * Lingkupnya mengikuti `jenisLingkupDariIzin`: SEMUA untuk admin, TIM untuk
 * kepala sales (berizin menugaskan), SENDIRI untuk sales biasa.
 */
export class LingkupSalesService {
  constructor(private readonly repository = new RencanaRepository()) {}

  /**
   * Id sales dalam lingkup pemanggil, atau `undefined` bila ia boleh melihat
   * seluruh tenant.
   *
   * `undefined` sengaja dibedakan dari array kosong: yang pertama berarti
   * "tanpa batas", yang kedua berarti "tidak ada satu pun" — menukarnya
   * membuka seluruh tenant kepada orang yang semestinya tidak melihat apa pun.
   */
  async idSalesTerlihat(input: {
    penggunaId: string;
    tenantId: string;
    permissions: string[];
  }): Promise<string[] | undefined> {
    const jenis = jenisLingkupDariIzin(input.permissions);
    if (jenis === "SEMUA") return undefined;
    if (jenis === "SENDIRI") return [input.penggunaId];

    const anggotaIds = await this.repository.anggotaTim(
      input.penggunaId,
      input.tenantId,
    );
    return [input.penggunaId, ...anggotaIds];
  }

  /**
   * Id sales terlihat bagi pemanggil yang modulnya **sudah** menolak melihat
   * seluruh tenant. Selalu mengembalikan daftar, tak pernah `undefined`.
   *
   * Izin "lihat semua" tiap modul berdiri sendiri: canvasing memakai
   * `canvasing:read`/`verify`, prospek memakai `presurvei:read`, sedangkan
   * lingkup di sini memakai `presurvei_rencana:view_all`. Karena berbeda,
   * jawaban "tanpa batas" dari sini bisa membatalkan penolakan yang baru saja
   * dibuat modul pemanggil — pemegang `presurvei_rencana:view_all` tanpa
   * `canvasing:read` akan melihat seluruh canvasing tenant. Maka di jalur ini
   * "tanpa batas" dan "kosong" sama-sama dikerucutkan ke milik sendiri:
   * lingkup sales hanya boleh mempersempit, tidak pernah melebarkan.
   */
  async idSalesTerlihatTanpaMelebarkan(input: {
    penggunaId: string;
    tenantId: string | null | undefined;
    permissions: string[];
  }): Promise<string[]> {
    if (!input.tenantId) return [input.penggunaId];

    const terlihat = await this.idSalesTerlihat({
      penggunaId: input.penggunaId,
      tenantId: input.tenantId,
      permissions: input.permissions,
    });
    return terlihat === undefined || terlihat.length === 0
      ? [input.penggunaId]
      : terlihat;
  }

  /** Jenis lingkup pemanggil, tanpa menyentuh database. */
  jenis(permissions: string[]): JenisLingkupPresurvei {
    return jenisLingkupDariIzin(permissions);
  }
}
