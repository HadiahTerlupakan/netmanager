import { describe, expect, it } from "vitest";

import {
  applyPppClientFieldChange,
  type PppClientFormCoreFields,
} from "@/app/admin/pelanggan/ppp/shared/form";

const SEBELUM: PppClientFormCoreFields = {
  idPelanggan: "67863587",
  nama: "TES LAB 02",
  password: "",
  passwordLogin: "",
  username: "tes-lab-02",
  tanggalAktif: "2026-10-24",
  hargaPaketId: "pkg-5m",
  jatuhTempo: "2027-01-05",
};

const hitung = (tanggalAktif?: string, hargaPaketId?: string) =>
  `dihitung:${tanggalAktif}:${hargaPaketId}`;

function ubah(
  name: string,
  value: string,
  jatuhTempoTetapSaatGantiPaket?: boolean,
) {
  return applyPppClientFieldChange({
    prev: { ...SEBELUM },
    name,
    value,
    checked: false,
    type: "select-one",
    calculateJatuhTempo: hitung,
    jatuhTempoTetapSaatGantiPaket,
  });
}

/**
 * Mengganti paket pelanggan lama dari Edit Pelanggan menghitung ulang jatuh
 * tempo dari tanggal aktif: tes-lab-02 yang sudah membayar sampai 5 Jan 2027
 * turun ke 23 Nov 2026 setelah di-upgrade (31 Okt 2026).
 */
describe("jatuh tempo di form pelanggan PPP", () => {
  it("form edit: ganti paket tidak menggeser jatuh tempo yang sudah dibayar", () => {
    const hasil = ubah("hargaPaketId", "pkg-10m", true);

    expect(hasil.updated.jatuhTempo).toBe("2027-01-05");
    expect(hasil.shouldResetManualDueDate).toBe(false);
  });

  it("form edit: ganti tanggal aktif tetap menghitung ulang", () => {
    const hasil = ubah("tanggalAktif", "2026-10-25", true);

    expect(hasil.updated.jatuhTempo).toBe("dihitung:2026-10-25:pkg-5m");
  });

  it("form pelanggan baru: ganti paket menghitung jatuh tempo dari paketnya", () => {
    const hasil = ubah("hargaPaketId", "pkg-10m");

    expect(hasil.updated.jatuhTempo).toBe("dihitung:2026-10-24:pkg-10m");
    expect(hasil.shouldResetManualDueDate).toBe(true);
  });
});
