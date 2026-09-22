import { describe, expect, it } from "vitest";

/**
 * Nilai enum presurvei sengaja ditulis dua kali: sekali di `prisma/schema.prisma`
 * sebagai enum PostgreSQL, sekali di `domain/entities/` sebagai const array.
 * Duplikasi itu keputusan yang benar — folder `domain/` wajib bebas dari
 * `@prisma/client` supaya aturan bisnisnya bisa diuji tanpa database dan tidak
 * terikat detail penyimpanan.
 *
 * Yang tidak boleh terjadi adalah kedua daftar itu menyimpang. Menambah nilai
 * di Prisma tapi lupa di const array membuat mapper (`row.hasil as KegiatanHasil`)
 * menerima nilai tak dikenal tanpa suara dan meneruskannya ke klien; sebaliknya
 * validator akan menolak nilai baru yang sah dengan pesan membingungkan.
 * Berkas ini satu-satunya pengikat kedua daftar tersebut.
 *
 * Mengimpor `@prisma/client` di sini diperbolehkan: larangan itu berlaku untuk
 * `modules/presurvei/domain/`, bukan untuk test.
 *
 * Dibandingkan sebagai himpunan, bukan urutan — penataan ulang salah satu sisi
 * bukan bug dan tidak boleh membuat test ini merah.
 */

import {
  PresurveiChannelIklan,
  PresurveiHasilKegiatan,
  PresurveiJenisKegiatan,
  PresurveiStatusProspek,
  PresurveiSumberProspek,
} from "@prisma/client";

import { IKLAN_CHANNELS } from "@/modules/presurvei/domain/entities/Iklan";
import {
  KEGIATAN_HASIL,
  KEGIATAN_JENIS,
} from "@/modules/presurvei/domain/entities/Kegiatan";
import {
  PROSPEK_STATUSES,
  PROSPEK_SUMBER,
} from "@/modules/presurvei/domain/entities/Prospek";

const sebagaiHimpunan = (nilai: readonly string[]): string[] =>
  [...nilai].sort();

describe("paritas enum Prisma dengan const array domain", () => {
  it("channel iklan sama di kedua sisi", () => {
    expect(sebagaiHimpunan(IKLAN_CHANNELS)).toEqual(
      sebagaiHimpunan(Object.values(PresurveiChannelIklan)),
    );
  });

  it("jenis kegiatan sama di kedua sisi", () => {
    expect(sebagaiHimpunan(KEGIATAN_JENIS)).toEqual(
      sebagaiHimpunan(Object.values(PresurveiJenisKegiatan)),
    );
  });

  it("hasil kegiatan sama di kedua sisi", () => {
    expect(sebagaiHimpunan(KEGIATAN_HASIL)).toEqual(
      sebagaiHimpunan(Object.values(PresurveiHasilKegiatan)),
    );
  });

  it("status prospek sama di kedua sisi", () => {
    expect(sebagaiHimpunan(PROSPEK_STATUSES)).toEqual(
      sebagaiHimpunan(Object.values(PresurveiStatusProspek)),
    );
  });

  it("sumber prospek sama di kedua sisi", () => {
    expect(sebagaiHimpunan(PROSPEK_SUMBER)).toEqual(
      sebagaiHimpunan(Object.values(PresurveiSumberProspek)),
    );
  });
});
