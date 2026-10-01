import { describe, expect, it } from "vitest";

import {
  JENIS_BAWAAN,
  KUNCI_KESALAHAN_FORM,
  nilaiAwalPenugasan,
  nilaiUbahDariRencana,
  periksaAlasanBatal,
  periksaFormPenugasan,
  periksaFormUbahRencana,
  PESAN_ALASAN_PENDEK,
  PESAN_SALES_WAJIB,
  PESAN_TANGGAL_LAMPAU,
  PESAN_TANPA_PERUBAHAN,
  PESAN_TUJUAN_PANJANG,
  PESAN_TUJUAN_WAJIB,
  type NilaiFormPenugasan,
} from "@/app/admin/presurvei/rencana/rencanaFormState";
import { PESAN_JAM_TIDAK_SAH } from "@/app/admin/presurvei/rencana/rencanaFormState";
import {
  ALASAN_BATAL_MAKS,
  TUJUAN_RENCANA_MAKS,
} from "@/modules/presurvei/client";

const HARI_INI = "2026-09-26";

const NILAI_SAH: NilaiFormPenugasan = Object.freeze({
  salesId: "sales-1",
  tanggal: "2026-09-28",
  jam: "",
  jenis: "SURVEI_LOKASI",
  tujuan: "  Survei ODP blok C  ",
  alamat: "",
});

describe("form penugasan", () => {
  it("nilai awal bertanggal hari ini dengan jenis kunjungan", () => {
    expect(nilaiAwalPenugasan(HARI_INI)).toEqual({
      salesId: "",
      tanggal: HARI_INI,
      jam: "",
      jenis: JENIS_BAWAAN,
      tujuan: "",
      alamat: "",
    });
    expect(JENIS_BAWAAN).toBe("KUNJUNGAN");
  });

  it("membentuk muatan rapi tanpa alamat kosong", () => {
    expect(periksaFormPenugasan(NILAI_SAH, HARI_INI)).toEqual({
      success: true,
      muatan: {
        salesId: "sales-1",
        tanggal: "2026-09-28",
        jenis: "SURVEI_LOKASI",
        tujuan: "Survei ODP blok C",
      },
    });
  });

  it("membawa alamat yang diisi", () => {
    const hasil = periksaFormPenugasan(
      { ...NILAI_SAH, alamat: " Jl. Melati 3 " },
      HARI_INI,
    );
    expect(hasil.success && hasil.muatan.alamat).toBe("Jl. Melati 3");
  });

  it("tanggal hari ini sah, kemarin ditolak", () => {
    expect(
      periksaFormPenugasan({ ...NILAI_SAH, tanggal: HARI_INI }, HARI_INI)
        .success,
    ).toBe(true);
    expect(
      periksaFormPenugasan({ ...NILAI_SAH, tanggal: "2026-09-25" }, HARI_INI),
    ).toEqual({ success: false, kesalahan: { tanggal: PESAN_TANGGAL_LAMPAU } });
  });

  it("sales wajib dipilih — tanpa sales server membuat rencana MANDIRI", () => {
    expect(
      periksaFormPenugasan({ ...NILAI_SAH, salesId: "" }, HARI_INI),
    ).toEqual({ success: false, kesalahan: { salesId: PESAN_SALES_WAJIB } });
  });

  it("tujuan kosong (spasi saja) dan kepanjangan ditolak", () => {
    expect(
      periksaFormPenugasan({ ...NILAI_SAH, tujuan: "   " }, HARI_INI),
    ).toEqual({ success: false, kesalahan: { tujuan: PESAN_TUJUAN_WAJIB } });
    expect(
      periksaFormPenugasan(
        { ...NILAI_SAH, tujuan: "x".repeat(TUJUAN_RENCANA_MAKS + 1) },
        HARI_INI,
      ),
    ).toEqual({ success: false, kesalahan: { tujuan: PESAN_TUJUAN_PANJANG } });
  });

  it("mengumpulkan semua kesalahan sekaligus", () => {
    const hasil = periksaFormPenugasan(nilaiAwalPenugasan(HARI_INI), HARI_INI);
    if (hasil.success !== false)
      throw new Error("Form kosong tidak boleh lolos");
    expect(Object.keys(hasil.kesalahan).sort()).toEqual(["salesId", "tujuan"]);
  });
});

describe("form jadwal ulang", () => {
  const asal = { tanggal: "2026-09-20", jam: null as string | null, tujuan: "Follow-up" };

  it("isian awal dari rencana", () => {
    expect(nilaiUbahDariRencana(asal)).toEqual({ ...asal, jam: "" });
  });

  it("hanya mengirim medan yang berubah", () => {
    expect(
      periksaFormUbahRencana(
        { tanggal: "2026-09-30", jam: "", tujuan: "Follow-up" },
        asal,
        HARI_INI,
      ),
    ).toEqual({ success: true, muatan: { tanggal: "2026-09-30" } });
  });

  it("tanggal lama yang sudah lewat boleh dipertahankan saat hanya tujuan diubah", () => {
    // Rencana TERLEWAT: tanggalnya < hari ini, tapi tidak ikut dikirim.
    expect(
      periksaFormUbahRencana(
        { tanggal: "2026-09-20", jam: "", tujuan: "Tawarkan promo" },
        asal,
        HARI_INI,
      ),
    ).toEqual({ success: true, muatan: { tujuan: "Tawarkan promo" } });
  });

  it("jadwal ulang ke tanggal lampau ditolak", () => {
    expect(
      periksaFormUbahRencana(
        { tanggal: "2026-09-21", jam: "", tujuan: "Follow-up" },
        asal,
        HARI_INI,
      ),
    ).toEqual({ success: false, kesalahan: { tanggal: PESAN_TANGGAL_LAMPAU } });
  });

  it("tanpa perubahan (termasuk spasi tambahan) tidak dikirim", () => {
    expect(
      periksaFormUbahRencana(
        { tanggal: "2026-09-20", jam: "", tujuan: " Follow-up " },
        asal,
        HARI_INI,
      ),
    ).toEqual({
      success: false,
      kesalahan: { [KUNCI_KESALAHAN_FORM]: PESAN_TANPA_PERUBAHAN },
    });
  });
});

describe("alasan batal", () => {
  it("minimal 3 karakter setelah dirapikan", () => {
    expect(periksaAlasanBatal("  ab ")).toEqual({
      success: false,
      kesalahan: { alasan: PESAN_ALASAN_PENDEK },
    });
    expect(periksaAlasanBatal(" Hujan ")).toEqual({
      success: true,
      muatan: { alasan: "Hujan" },
    });
  });

  it("menolak alasan melebihi batas", () => {
    expect(periksaAlasanBatal("x".repeat(ALASAN_BATAL_MAKS + 1)).success).toBe(
      false,
    );
  });
});

describe("jam rencana", () => {
  const asal = { tanggal: "2026-09-27", jam: "09:00", tujuan: "Demo" };

  it("penugasan membawa jam bila diisi, tanpa jam bila kosong", () => {
    const denganJam = periksaFormPenugasan({ ...NILAI_SAH, jam: "13:30" }, HARI_INI);
    expect(denganJam.success && denganJam.muatan.jam).toBe("13:30");
    const tanpaJam = periksaFormPenugasan(NILAI_SAH, HARI_INI);
    expect(tanpaJam.success && "jam" in tanpaJam.muatan).toBe(false);
  });

  it("jam tidak berformat HH:mm ditolak", () => {
    expect(periksaFormPenugasan({ ...NILAI_SAH, jam: "25:00" }, HARI_INI)).toMatchObject({
      success: false,
      kesalahan: { jam: PESAN_JAM_TIDAK_SAH },
    });
  });

  it("mengosongkan jam saat ubah mengirim jam: null", () => {
    expect(
      periksaFormUbahRencana({ tanggal: "2026-09-27", jam: "", tujuan: "Demo" }, asal, HARI_INI),
    ).toEqual({ success: true, muatan: { jam: null } });
  });

  it("jam yang sama tidak dianggap perubahan", () => {
    expect(
      periksaFormUbahRencana({ tanggal: "2026-09-27", jam: "09:00", tujuan: "Demo" }, asal, HARI_INI),
    ).toMatchObject({ success: false });
  });
});
