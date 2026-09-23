// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kabel JSX modal prospek dan hook simpannya.
 *
 * Fungsi murninya diuji tanpa DOM di `presurvei-prospek-form-state.test.ts`.
 * Yang dikunci di sini adalah titik pakainya: medan bersyarat, pemberitahuan
 * kepemilikan, sumber yang tidak bisa disunting pada mode ubah, badan yang
 * benar-benar dikirim `fetch`, penanganan 409 DUPLIKAT beserta "Tetap simpan",
 * dan kunci yang diinvalidasi setelah berhasil.
 *
 * `useSimpanProspek` TIDAK di-mock — ia berjalan dengan `QueryClient` sungguhan
 * dan `fetch` yang distub. `useApi`, `useKampanyeBerjalan`, dan `usePermission` di-mock supaya
 * pengambilan rincian dan daftar kampanye tidak menyentuh jaringan.
 */

const palsu = vi.hoisted(() => ({
  useApi: vi.fn(),
  hasAnyPermission: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  useKampanyeBerjalan: vi.fn(),
}));

vi.mock("@/lib/hooks/useApi", () => ({ useApi: palsu.useApi }));

vi.mock("@/app/admin/presurvei/prospek/useKampanyeBerjalan", () => ({
  useKampanyeBerjalan: palsu.useKampanyeBerjalan,
}));

vi.mock("@/hooks/use-permission", () => ({
  usePermission: () => ({ hasAnyPermission: palsu.hasAnyPermission }),
}));

vi.mock("react-hot-toast", () => ({
  toast: Object.assign(vi.fn(), {
    success: palsu.toastSuccess,
    error: palsu.toastError,
  }),
}));

import {
  ProspekFormModal,
  TEKS_KAMPANYE_TERPOTONG,
} from "@/app/admin/presurvei/prospek/ProspekFormModal";
import type { ModeFormProspek } from "@/app/admin/presurvei/prospek/prospekFormState";
import { KUNCI_KOLOM_PROSPEK } from "@/app/admin/presurvei/prospek/prospekKolomQuery";
import type {
  IklanListItemDto,
  ProspekDetailDto,
} from "@/modules/presurvei/client";

/**
 * Teks kepemilikan ditulis ulang sebagai literal, bukan diimpor dari
 * produksi: ia menyatakan fakta tentang server (`akses-presurvei.ts:41-48`),
 * dan test yang memakai konstanta yang sama tetap hijau bila konstanta itu
 * diganti klaim palsu.
 */
const TEKS_PEMILIK_DIHARAPKAN =
  "Prospek ini akan tercatat atas nama Anda. Penugasan ke sales belum bisa dilakukan dari halaman ini.";

/** Hasil `useKampanyeBerjalan` palsu; dianotasi eksplisit karena TS7018. */
type HasilKampanyePalsu = {
  ringkasan: { pilihan: IklanListItemDto[]; isTerpotong: boolean } | undefined;
  isLoading: boolean;
  isGagal: boolean;
};

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/** Hasil `useApi` palsu; dianotasi eksplisit karena TS7018. */
type HasilApiPalsu = {
  data: unknown;
  error: { message: string } | null;
  isLoading: boolean;
};

/** Respons `fetch` palsu yang dibaca `useSimpanProspek`. */
type ResponsPalsu = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

function respons(status: number, badan: unknown): ResponsPalsu {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => badan,
  };
}

const rincian: ProspekDetailDto = {
  id: "prospek-9",
  nama: "Siti Aminah",
  noTelp: "081299990000",
  alamat: "Jl. Kenanga 4",
  sumber: "IKLAN",
  status: "TERTARIK",
  pemilikId: "sales-3",
  namaPemilik: null,
  paketDiminati: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  email: null,
  latitude: null,
  longitude: null,
  shareloc: null,
  iklanId: "iklan-7",
  registrationId: null,
  referralNama: null,
  catatan: "Minta dihubungi sore",
  canvasingId: null,
  konversiAt: null,
  isSiapDipromosikan: false,
  updatedAt: "2026-09-02T00:00:00.000Z",
};

const kampanye: IklanListItemDto[] = [
  {
    id: "iklan-jalan",
    nama: "Promo September",
    kode: "promo-sep",
    channel: "META",
    tanggalMulai: "2026-09-01T00:00:00.000Z",
    tanggalSelesai: null,
    isAktif: true,
    isBerjalan: true,
  },
  {
    id: "iklan-belum",
    nama: "Promo Oktober",
    kode: "promo-okt",
    channel: "META",
    tanggalMulai: "2026-10-01T00:00:00.000Z",
    tanggalSelesai: null,
    isAktif: true,
    isBerjalan: false,
  },
];

const bentrok = [
  {
    id: "prospek-lama",
    nama: "Budi Lama",
    status: "DIHUBUNGI",
    pemilikId: "sales-3",
  },
];

const badanDuplikat = {
  success: false,
  error: "Sudah ada prospek aktif dengan nomor telepon ini",
  code: "DUPLIKAT",
  details: { duplikat: bentrok },
};

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;
let mockFetch: ReturnType<typeof vi.fn>;
let onClose: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  document.body.innerHTML = "";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  queryClient = new QueryClient();
  vi.spyOn(queryClient, "invalidateQueries");
  mockFetch = vi.fn();
  vi.stubGlobal("fetch", mockFetch);
  onClose = vi.fn<() => void>();
  palsu.hasAnyPermission.mockReset();
  palsu.hasAnyPermission.mockReturnValue(true);
  palsu.toastSuccess.mockReset();
  palsu.toastError.mockReset();
  palsu.useApi.mockReset();
  palsu.useApi.mockImplementation((key: string | null): HasilApiPalsu => {
    if (key === "/api/presurvei/prospek/prospek-9") {
      return { data: rincian, error: null, isLoading: false };
    }
    return { data: undefined, error: null, isLoading: false };
  });
  palsu.useKampanyeBerjalan.mockReset();
  palsu.useKampanyeBerjalan.mockImplementation(
    (isBolehMemuat: boolean): HasilKampanyePalsu =>
      isBolehMemuat
        ? {
            ringkasan: {
              pilihan: kampanye.filter((iklan) => iklan.isBerjalan),
              isTerpotong: false,
            },
            isLoading: false,
            isGagal: false,
          }
        : { ringkasan: undefined, isLoading: false, isGagal: false },
  );
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

async function renderModal(mode: ModeFormProspek, isOpen = true) {
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <ProspekFormModal mode={mode} isOpen={isOpen} onClose={onClose} />
      </QueryClientProvider>,
    );
  });
}

/** Seluruh panggilan `invalidateQueries`, persis dan berurutan. */
function panggilanInvalidasi(): unknown[] {
  return vi.mocked(queryClient.invalidateQueries).mock.calls;
}

function tombolSimpan(): HTMLButtonElement {
  return cari<HTMLButtonElement>('button[type="submit"]');
}

/** Elemen di dalam modal; modal dirender lewat portal ke `document.body`. */
function cari<T extends Element>(selektor: string): T | null {
  return document.body.querySelector<T>(selektor);
}

/** Isi medan seperti pemakai mengetik, supaya `onChange` React terpanggil. */
async function isi(selektor: string, nilai: string) {
  const elemen = cari<HTMLInputElement | HTMLSelectElement>(selektor);
  expect(elemen).not.toBeNull();
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(elemen),
    "value",
  ).set;
  await act(async () => {
    setter.call(elemen, nilai);
    const jenisEvent = elemen.tagName === "SELECT" ? "change" : "input";
    elemen.dispatchEvent(new Event(jenisEvent, { bubbles: true }));
  });
}

async function klikTombol(teks: string) {
  const tombol = [...document.body.querySelectorAll("button")].find(
    (elemen) => elemen.textContent.trim() === teks,
  );
  expect(tombol).toBeDefined();
  await act(async () => {
    tombol.click();
  });
  // `fetch` palsu dan `.json()`-nya resolve di microtask berikutnya.
  await act(async () => {
    await new Promise((selesai) => setTimeout(selesai, 0));
  });
}

async function isiMedanWajib() {
  await isi("#prospek-nama", "Budi Baru");
  await isi("#prospek-telp", "081234567890");
  await isi("#prospek-alamat", "Jl. Merdeka 10");
}

/** Badan JSON yang dikirim pada panggilan `fetch` ke-`indeks`. */
function badanTerkirim(indeks: number): Record<string, unknown> {
  const [, init] = mockFetch.mock.calls[indeks] as [string, RequestInit];
  return JSON.parse(init.body as string);
}

describe("ProspekFormModal — mode buat", () => {
  it("memberi tahu bahwa prospek tercatat atas nama pemakai", async () => {
    await renderModal({ jenis: "buat" });

    expect(document.body.textContent).toContain(TEKS_PEMILIK_DIHARAPKAN);
  });

  it("menampilkan pemilih kampanye hanya untuk sumber IKLAN, berisi kampanye berjalan", async () => {
    await renderModal({ jenis: "buat" });
    expect(cari("#prospek-iklan")).toBeNull();

    await isi("#prospek-sumber", "IKLAN");

    const pilihan = [
      ...cari<HTMLSelectElement>("#prospek-iklan").querySelectorAll("option"),
    ].map((opsi) => opsi.value);
    expect(pilihan).toEqual(["", "iklan-jalan"]);
    expect(palsu.useKampanyeBerjalan).toHaveBeenCalledWith(true);
  });

  it("jatuh ke isian ID manual dan berterus terang bila daftar kampanye terpotong", async () => {
    palsu.useKampanyeBerjalan.mockImplementation(
      (): HasilKampanyePalsu => ({
        ringkasan: { pilihan: [kampanye[0]], isTerpotong: true },
        isLoading: false,
        isGagal: false,
      }),
    );
    await renderModal({ jenis: "buat" });

    await isi("#prospek-sumber", "IKLAN");

    expect(cari("#prospek-iklan")?.tagName).toBe("INPUT");
    expect(document.body.textContent).toContain(TEKS_KAMPANYE_TERPOTONG);
  });

  it("jatuh ke isian ID manual bila pemakai tak boleh membaca kampanye", async () => {
    palsu.hasAnyPermission.mockImplementation(
      (izin: string[]) => !izin.includes("presurvei_iklan:read"),
    );
    await renderModal({ jenis: "buat" });

    await isi("#prospek-sumber", "IKLAN");

    expect(cari("#prospek-iklan")?.tagName).toBe("INPUT");
    // Tanpa permission, daftar tidak diminta sama sekali (menghindari 403).
    expect(palsu.useKampanyeBerjalan).not.toHaveBeenCalledWith(true);
  });

  it("menampilkan medan perujuk hanya untuk sumber REFERRAL", async () => {
    await renderModal({ jenis: "buat" });
    expect(cari("#prospek-referral")).toBeNull();

    await isi("#prospek-sumber", "REFERRAL");

    expect(cari("#prospek-referral")).not.toBeNull();
  });

  it("mengirim POST ke koleksi tanpa pemilikId", async () => {
    mockFetch.mockResolvedValue(
      respons(201, { success: true, data: { ...rincian, status: "BARU" } }),
    );
    await renderModal({ jenis: "buat" });
    await isiMedanWajib();

    await klikTombol("Catat Prospek");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe("/api/presurvei/prospek");
    expect(mockFetch.mock.calls[0][1]).toMatchObject({ method: "POST" });
    expect(badanTerkirim(0)).toEqual({
      nama: "Budi Baru",
      noTelp: "081234567890",
      email: null,
      alamat: "Jl. Merdeka 10",
      sumber: "LAPANGAN",
      iklanId: null,
      referralNama: null,
      paketDiminati: null,
      catatan: null,
    });
  });

  it("menginvalidasi kolom status prospek baru lalu menutup modal", async () => {
    mockFetch.mockResolvedValue(
      respons(201, { success: true, data: { ...rincian, status: "BARU" } }),
    );
    await renderModal({ jenis: "buat" });
    await isiMedanWajib();

    await klikTombol("Catat Prospek");

    expect(panggilanInvalidasi()).toEqual([
      [{ queryKey: [KUNCI_KOLOM_PROSPEK, "BARU"] }],
    ]);
    expect(palsu.toastSuccess).toHaveBeenCalledWith("Prospek berhasil dicatat");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("tidak mengirim apa pun bila validasi klien gagal", async () => {
    await renderModal({ jenis: "buat" });

    await klikTombol("Catat Prospek");

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("ProspekFormModal — duplikat nomor telepon", () => {
  it("menampilkan prospek yang bentrok alih-alih toast kesalahan", async () => {
    mockFetch.mockResolvedValueOnce(respons(409, badanDuplikat));
    await renderModal({ jenis: "buat" });
    await isiMedanWajib();

    await klikTombol("Catat Prospek");

    expect(cari('[data-prospek-bentrok="prospek-lama"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Budi Lama");
    expect(palsu.toastError).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("'Tetap simpan' mengirim ulang muatan yang sama dengan abaikanDuplikat", async () => {
    mockFetch
      .mockResolvedValueOnce(respons(409, badanDuplikat))
      .mockResolvedValueOnce(
        respons(201, { success: true, data: { ...rincian, status: "BARU" } }),
      );
    await renderModal({ jenis: "buat" });
    await isiMedanWajib();
    await klikTombol("Catat Prospek");

    await klikTombol("Tetap simpan");

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(badanTerkirim(1)).toEqual({
      ...badanTerkirim(0),
      abaikanDuplikat: true,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("melupakan penolakan duplikat begitu isian diubah", async () => {
    mockFetch.mockResolvedValueOnce(respons(409, badanDuplikat));
    await renderModal({ jenis: "buat" });
    await isiMedanWajib();
    await klikTombol("Catat Prospek");

    await isi("#prospek-telp", "081234567891");

    expect(cari('[data-prospek-bentrok="prospek-lama"]')).toBeNull();
  });

  it("menampilkan 409 berkode lain sebagai kesalahan biasa", async () => {
    mockFetch.mockResolvedValueOnce(
      respons(409, { ...badanDuplikat, code: "INVALID_STATE" }),
    );
    await renderModal({ jenis: "buat" });
    await isiMedanWajib();

    await klikTombol("Catat Prospek");

    expect(cari('[data-prospek-bentrok="prospek-lama"]')).toBeNull();
    expect(palsu.toastError).toHaveBeenCalledTimes(1);
  });
});

describe("ProspekFormModal — mode ubah", () => {
  it("memuat rincian prospek dan menampilkan sumber tanpa bisa disunting", async () => {
    await renderModal({ jenis: "ubah", prospekId: "prospek-9" });

    expect(cari<HTMLInputElement>("#prospek-nama").value).toBe("Siti Aminah");
    expect(cari("#prospek-sumber")).toBeNull();
    expect(cari("#prospek-iklan")).toBeNull();
    expect(document.body.textContent).not.toContain(TEKS_PEMILIK_DIHARAPKAN);
  });

  it("mengirim PATCH ke endpoint detail tanpa sumber, status, maupun pemilik", async () => {
    mockFetch.mockResolvedValue(respons(200, { success: true, data: rincian }));
    await renderModal({ jenis: "ubah", prospekId: "prospek-9" });
    await isi("#prospek-nama", "Siti A.");

    await klikTombol("Simpan Perubahan");

    expect(mockFetch.mock.calls[0][0]).toBe("/api/presurvei/prospek/prospek-9");
    expect(mockFetch.mock.calls[0][1]).toMatchObject({ method: "PATCH" });
    expect(badanTerkirim(0)).toEqual({
      nama: "Siti A.",
      noTelp: "081299990000",
      email: null,
      alamat: "Jl. Kenanga 4",
      paketDiminati: null,
      catatan: "Minta dihubungi sore",
    });
  });

  it("menginvalidasi kolom prospek dan salinan rinciannya", async () => {
    mockFetch.mockResolvedValue(respons(200, { success: true, data: rincian }));
    await renderModal({ jenis: "ubah", prospekId: "prospek-9" });

    await klikTombol("Simpan Perubahan");

    expect(panggilanInvalidasi()).toEqual([
      [{ queryKey: [KUNCI_KOLOM_PROSPEK, "TERTARIK"] }],
      [{ queryKey: ["/api/presurvei/prospek/prospek-9"] }],
    ]);
  });
});

describe("ProspekFormModal — isian dan penguncian", () => {
  it("mempertahankan isian mode buat saat modal ditutup tanpa menyimpan", async () => {
    // Klik overlay atau Escape memanggil `onClose`; papan lalu mengirim
    // `isOpen={false}`. Isian sembilan medan tidak boleh ikut hilang.
    await renderModal({ jenis: "buat" });
    await isi("#prospek-nama", "Budi Baru");

    await renderModal({ jenis: "buat" }, false);
    expect(cari("#prospek-nama")).toBeNull();
    await renderModal({ jenis: "buat" }, true);

    expect(cari<HTMLInputElement>("#prospek-nama").value).toBe("Budi Baru");
  });

  it("mereset isian mode buat setelah simpan berhasil", async () => {
    mockFetch.mockResolvedValue(
      respons(201, { success: true, data: { ...rincian, status: "BARU" } }),
    );
    await renderModal({ jenis: "buat" });
    await isiMedanWajib();
    await klikTombol("Catat Prospek");

    await renderModal({ jenis: "buat" }, false);
    await renderModal({ jenis: "buat" }, true);

    expect(cari<HTMLInputElement>("#prospek-nama").value).toBe("");
  });

  it("mengunci medan dan tombol selama permintaan simpan berjalan", async () => {
    // Tanpa kunci, suntingan di tengah POST tidak membuang penolakan duplikat
    // yang belum tiba, dan "Tetap simpan" kemudian mengirim isian lama.
    let jawab: (nilai: ResponsPalsu) => void = () => undefined;
    mockFetch.mockReturnValue(
      new Promise<ResponsPalsu>((selesai) => {
        jawab = selesai;
      }),
    );
    await renderModal({ jenis: "buat" });
    await isiMedanWajib();

    await klikTombol("Catat Prospek");

    expect(cari<HTMLInputElement>("#prospek-nama").matches(":disabled")).toBe(
      true,
    );
    expect(
      cari<HTMLSelectElement>("#prospek-sumber").matches(":disabled"),
    ).toBe(true);
    expect(tombolSimpan().disabled).toBe(true);

    await act(async () => {
      jawab(respons(409, badanDuplikat));
      await new Promise((selesai) => setTimeout(selesai, 0));
    });

    expect(cari<HTMLInputElement>("#prospek-nama").matches(":disabled")).toBe(
      false,
    );
  });

  it("menonaktifkan simpan biasa selama panel duplikat tampil", async () => {
    mockFetch.mockResolvedValueOnce(respons(409, badanDuplikat));
    await renderModal({ jenis: "buat" });
    await isiMedanWajib();

    await klikTombol("Catat Prospek");

    expect(tombolSimpan().disabled).toBe(true);
  });

  it("hanya mengirim abaikanDuplikat pada percobaan ulang, bukan simpan pertama", async () => {
    mockFetch.mockResolvedValueOnce(respons(409, badanDuplikat));
    await renderModal({ jenis: "buat" });
    await isiMedanWajib();

    await klikTombol("Catat Prospek");

    expect(badanTerkirim(0)).not.toHaveProperty("abaikanDuplikat");
  });
});
