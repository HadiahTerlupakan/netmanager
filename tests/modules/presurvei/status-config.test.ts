import { describe, expect, it } from "vitest";

/**
 * Konfigurasi ini memetakan seluruh enum presurvei ke label dan warna. Bentuk
 * `Record<Union, T>` membuat anggota enum baru wajib dijawab saat kompilasi —
 * tanpa itu, status yang ditambahkan nanti akan tampil kosong di UI tanpa
 * satu pun keluhan.
 */

import {
  IKLAN_CHANNEL_CONFIG,
  KEGIATAN_HASIL_CONFIG,
  KEGIATAN_JENIS_CONFIG,
  PROSPEK_STATUS_CONFIG,
  PROSPEK_SUMBER_CONFIG,
  daftarKolomHidup,
  daftarKolomMati,
} from "@/modules/presurvei/utils/statusConfig";
import {
  IKLAN_CHANNELS,
  KEGIATAN_HASIL,
  KEGIATAN_JENIS,
  PROSPEK_STATUSES,
  PROSPEK_SUMBER,
} from "@/modules/presurvei/client";

describe("konfigurasi tampilan status", () => {
  it.each([
    ["status prospek", PROSPEK_STATUSES, PROSPEK_STATUS_CONFIG],
    ["sumber prospek", PROSPEK_SUMBER, PROSPEK_SUMBER_CONFIG],
    ["jenis kegiatan", KEGIATAN_JENIS, KEGIATAN_JENIS_CONFIG],
    ["hasil kegiatan", KEGIATAN_HASIL, KEGIATAN_HASIL_CONFIG],
    ["channel iklan", IKLAN_CHANNELS, IKLAN_CHANNEL_CONFIG],
  ])("memberi label dan warna untuk setiap %s", (_nama, nilai, config) => {
    for (const anggota of nilai) {
      const tampilan = (
        config as Record<string, { label: string; warna: string }>
      )[anggota];
      expect(tampilan?.label.trim().length).toBeGreaterThan(0);
      expect(tampilan?.warna.trim().length).toBeGreaterThan(0);
    }
  });

  it("tidak memakai label yang sama untuk dua status berbeda", () => {
    // Dua status berlabel sama membuat papan kanban mustahil dibaca, dan
    // compiler tidak akan menolaknya karena keduanya string yang sah.
    const label = PROSPEK_STATUSES.map((s) => PROSPEK_STATUS_CONFIG[s].label);
    expect(new Set(label).size).toBe(PROSPEK_STATUSES.length);
  });
});

describe("kolom papan kanban", () => {
  it("membagi seluruh status menjadi kolom hidup dan kolom mati", () => {
    // Status yang tidak masuk salah satunya akan hilang dari papan tanpa
    // gejala — kartunya tidak muncul di mana pun.
    const gabungan = [...daftarKolomHidup(), ...daftarKolomMati()].sort();
    expect(gabungan).toEqual([...PROSPEK_STATUSES].sort());
  });

  it("menempatkan DEAL di kolom hidup dan status gagal di kolom mati", () => {
    expect(daftarKolomHidup()).toContain("DEAL");
    expect(daftarKolomMati()).toEqual(["TIDAK_MINAT", "TIDAK_LAYAK"]);
  });

  it("mengembalikan salinan, bukan array modulnya", () => {
    // Pemanggil yang meng-sort hasilnya akan mengacak urutan kolom papan
    // selamanya bagi seluruh pemakai proses ini.
    daftarKolomHidup().sort();
    expect(daftarKolomHidup()).toEqual([
      "BARU",
      "DIHUBUNGI",
      "TERTARIK",
      "NEGOSIASI",
      "DEAL",
    ]);
  });
});
