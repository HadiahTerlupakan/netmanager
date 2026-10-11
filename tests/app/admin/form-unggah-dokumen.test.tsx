// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  bongkarPanggung,
  cari,
  isiMedan,
  pasangPanggung,
  render,
  responsJson,
  tungguSampai,
  type Panggung,
} from "../presurvei-jsdom-harness";

/**
 * Form unggah lampiran dokumen planning.
 *
 * Tanpa form ini dukungan PDF di server hanya bisa dipakai lewat curl: tab
 * Dokumen dulu cuma menampilkan daftar, dan satu-satunya jalur unggah adalah
 * popup titik di tab Peta — yang hanya menerima gambar dan selalu menautkan
 * berkasnya ke sebuah titik.
 */

const palsu = vi.hoisted(() => ({
  invalidate: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/hooks/useInvalidate", () => ({
  useInvalidatePlanningRelated: () => palsu.invalidate,
}));

vi.mock("react-hot-toast", async () =>
  (await import("../presurvei-jsdom-harness")).modulToastPalsu(
    palsu.toastSuccess,
    palsu.toastError,
  ),
);

import { FormUnggahDokumen } from "@/app/admin/planning/[id]/FormUnggahDokumen";

let panggung: Panggung;

function berkas(name: string, type: string): File {
  return new File(["x"], name, { type });
}

/** Memilih berkas seperti pemakai; `files` hanya bisa diisi secara paksa. */
async function pilihBerkas(file: File): Promise<void> {
  const input = cari<HTMLInputElement>("#berkas-dokumen");
  expect(input, "input berkas tidak ditemukan").not.toBeNull();
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  const { act } = await import("react");
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function pilihanKategori(): string[] {
  return [...document.body.querySelectorAll("#kategori-dokumen option")].map(
    (opsi) => (opsi as HTMLOptionElement).value,
  );
}

describe("FormUnggahDokumen", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(responsJson(201, { success: true })),
    );
    panggung = pasangPanggung();
    await render(panggung, <FormUnggahDokumen planningId="plan-1" />);
  });

  afterEach(async () => {
    await bongkarPanggung(panggung);
    vi.unstubAllGlobals();
  });

  it("menawarkan kategori berkas dokumen, bukan hanya kategori gambar", () => {
    // Dua kategori inilah yang dulu ditolak validator karena unggahnya hanya
    // menerima gambar — keduanya memang berkas PDF.
    expect(pilihanKategori()).toContain("APPROVAL_DOCUMENT");
    expect(pilihanKategori()).toContain("TECHNICAL_DRAWING");
  });

  it("tidak menawarkan SURVEY_PHOTO: itu selalu menempel pada satu titik", () => {
    expect(pilihanKategori()).not.toContain("SURVEY_PHOTO");
  });

  it("menamai pilihannya untuk manusia, bukan dengan nilai enum", () => {
    const label = [
      ...document.body.querySelectorAll("#kategori-dokumen option"),
    ].map((opsi) => opsi.textContent);
    expect(label).toContain("Dokumen izin / persetujuan");
    // Daftar dokumen di bawah form memakai peta label yang sama; kalau yang
    // tampil di sini nilai enum, keduanya sudah menyimpang.
    expect(label).not.toContain("APPROVAL_DOCUMENT");
  });

  it("menerima gambar maupun PDF pada atribut accept", () => {
    const input = cari<HTMLInputElement>("#berkas-dokumen");
    expect(input.accept).toContain("application/pdf");
    expect(input.accept).toContain("image/*");
  });

  it("mengirim multipart ke endpoint dokumen dengan kategori terpilih", async () => {
    await isiMedan("#kategori-dokumen", "TECHNICAL_DRAWING");
    await isiMedan("#keterangan-dokumen", "Gambar galian RW 04");
    await pilihBerkas(berkas("gambar.pdf", "application/pdf"));

    await tungguSampai(
      () =>
        (fetch as unknown as { mock: { calls: unknown[] } }).mock.calls
          .length === 1,
      "permintaan unggah terkirim",
    );

    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toBe("/api/planning/plan-1/documents");
    const formData = init.body as FormData;
    expect(formData.get("category")).toBe("TECHNICAL_DRAWING");
    expect(formData.get("description")).toBe("Gambar galian RW 04");
    expect((formData.get("file") as File).name).toBe("gambar.pdf");
    // Lampiran tingkat proyek tidak menempel ke titik mana pun; kalau `nodeId`
    // ikut terkirim, server akan memaksa kategorinya menjadi SURVEY_PHOTO.
    expect(formData.get("nodeId")).toBeNull();
  });

  it("menyegarkan daftar dokumen setelah unggah berhasil", async () => {
    await pilihBerkas(berkas("izin.pdf", "application/pdf"));

    await tungguSampai(
      () => palsu.invalidate.mock.calls.length > 0,
      "daftar dokumen disegarkan",
    );
    expect(palsu.toastSuccess).toHaveBeenCalled();
  });

  it("menyampaikan pesan server saat unggah ditolak", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          responsJson(400, { error: "Ukuran PDF maksimal 15MB" }),
        ),
    );

    await pilihBerkas(berkas("besar.pdf", "application/pdf"));

    await tungguSampai(
      () => palsu.toastError.mock.calls.length > 0,
      "pesan galat tersampaikan",
    );
    expect(palsu.toastError).toHaveBeenCalledWith("Ukuran PDF maksimal 15MB");
    // Daftar dokumen tidak boleh disegarkan seolah ada yang tersimpan.
    expect(palsu.invalidate).not.toHaveBeenCalled();
  });

  it("mengosongkan input setelah unggah supaya berkas yang sama bisa dicoba lagi", async () => {
    await pilihBerkas(berkas("izin.pdf", "application/pdf"));

    await tungguSampai(
      () => palsu.toastSuccess.mock.calls.length > 0,
      "unggah selesai",
    );
    // Tanpa ini, memilih berkas yang sama dua kali tidak memicu `change`, dan
    // unggah ulang setelah gagal tampak diam saja.
    expect(cari<HTMLInputElement>("#berkas-dokumen").value).toBe("");
  });
});
