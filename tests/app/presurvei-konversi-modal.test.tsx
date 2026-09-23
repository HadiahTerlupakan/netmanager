// @vitest-environment jsdom

import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kabel modal konversi dan hook dua langkahnya.
 *
 * Fungsi murninya diuji tanpa DOM di `presurvei-konversi-form-state.test.ts`.
 * Yang dikunci di sini: urutan dan badan kedua permintaan, dilewatinya PATCH
 * untuk prospek yang sudah DEAL, pesan setengah jalan, kunci yang
 * diinvalidasi (persis, lewat `mock.calls`), dan teks petunjuk yang dilihat
 * pemakai.
 *
 * `useJadikanCanvasing` dan `useInvalidatePresurveiKonversi` TIDAK di-mock —
 * keduanya berjalan dengan `QueryClient` sungguhan dan `fetch` yang distub.
 */

const palsu = vi.hoisted(() => ({
  useApi: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/hooks/useApi", () => ({ useApi: palsu.useApi }));

vi.mock("react-hot-toast", () => ({
  toast: Object.assign(vi.fn(), {
    success: palsu.toastSuccess,
    error: palsu.toastError,
  }),
}));

import { KonversiModal } from "@/app/admin/presurvei/prospek/KonversiModal";
import type { ProspekDetailDto } from "@/modules/presurvei/client";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/*
 * Teks yang dilihat pemakai ditulis ulang sebagai literal, bukan diimpor dari
 * produksi: masing-masing menyatakan fakta tentang server, dan test yang
 * memakai konstanta yang sama tetap hijau bila konstanta itu diganti klaim
 * palsu.
 */
const PETUNJUK_KABEL =
  "Kosongkan untuk memakai estimasi kabel dari survei lokasi terakhir prospek ini. Bila survei itu tidak mencatatnya, mencatat 0 meter, atau belum ada survei, dipakai 1 meter.";
const PETUNJUK_ODP =
  "Kosongkan untuk memakai ODP terdekat dari survei lokasi terakhir prospek ini, bila dicatat.";
const TEKS_DUA_LANGKAH =
  "Menyimpan akan memindahkan prospek ini ke Deal lebih dulu, lalu membuat canvasing.";

/** Hasil `useApi` palsu; dianotasi eksplisit karena TS7018. */
type HasilApiPalsu = {
  data: unknown;
  error: { message: string } | null;
  isLoading: boolean;
};

/** Respons `fetch` palsu. */
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

function rincian(ubahan: Partial<ProspekDetailDto>): ProspekDetailDto {
  return {
    id: "p-5",
    nama: "Rina Wati",
    noTelp: "081277770000",
    alamat: "Jl. Melati 3",
    sumber: "LAPANGAN",
    status: "NEGOSIASI",
    pemilikId: "sales-3",
    namaPemilik: null,
    paketDiminati: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    email: null,
    latitude: null,
    longitude: null,
    shareloc: null,
    iklanId: null,
    registrationId: null,
    referralNama: null,
    catatan: null,
    canvasingId: null,
    konversiAt: null,
    isSiapDipromosikan: false,
    updatedAt: "2026-09-02T00:00:00.000Z",
    ...ubahan,
  };
}

const URL_RINCIAN = "/api/presurvei/prospek/p-5";
const URL_KONVERSI = "/api/presurvei/prospek/p-5/jadikan-canvasing";

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;
let mockFetch: ReturnType<typeof vi.fn>;
let onClose: ReturnType<typeof vi.fn<() => void>>;

function pakaiRincian(prospek: ProspekDetailDto) {
  palsu.useApi.mockImplementation(
    (key: string): HasilApiPalsu =>
      key === URL_RINCIAN
        ? { data: prospek, error: null, isLoading: false }
        : { data: undefined, error: null, isLoading: false },
  );
}

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
  palsu.toastSuccess.mockReset();
  palsu.toastError.mockReset();
  palsu.useApi.mockReset();
  pakaiRincian(rincian({}));
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

async function renderModal() {
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <KonversiModal prospekId="p-5" isOpen onClose={onClose} />
      </QueryClientProvider>,
    );
  });
}

function cari<T extends Element>(selektor: string): T | null {
  return document.body.querySelector<T>(selektor);
}

async function isi(selektor: string, nilai: string) {
  const elemen = cari<HTMLInputElement>(selektor);
  expect(elemen).not.toBeNull();
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(elemen),
    "value",
  ).set;
  await act(async () => {
    setter.call(elemen, nilai);
    elemen.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function simpan() {
  const tombol = cari<HTMLButtonElement>('button[type="submit"]');
  expect(tombol).not.toBeNull();
  await act(async () => {
    tombol.click();
  });
  // `fetch` palsu dan `.json()`-nya resolve di microtask berikutnya; dua
  // langkah berarti dua putaran.
  for (let putaran = 0; putaran < 3; putaran += 1) {
    await act(async () => {
      await new Promise((selesai) => setTimeout(selesai, 0));
    });
  }
}

async function isiMedanWajib() {
  await isi("#konversi-ktp", "3201234567890001");
  await isi("#konversi-paket", "20 Mbps");
}

/** URL, method, dan badan panggilan `fetch` ke-`indeks`. */
function permintaan(indeks: number) {
  const [url, init] = mockFetch.mock.calls[indeks] as [string, RequestInit];
  return {
    url,
    method: init.method,
    badan: JSON.parse(init.body as string) as unknown,
  };
}

function panggilanInvalidasi(): unknown[] {
  return vi.mocked(queryClient.invalidateQueries).mock.calls;
}

describe("KonversiModal — prospek yang belum DEAL", () => {
  it("memberi tahu bahwa simpan akan memindahkan prospek ke Deal", async () => {
    await renderModal();

    expect(document.body.textContent).toContain(TEKS_DUA_LANGKAH);
  });

  it("memindahkan ke DEAL lebih dulu, lalu membuat canvasing", async () => {
    mockFetch
      .mockResolvedValueOnce(
        respons(200, { success: true, data: rincian({ status: "DEAL" }) }),
      )
      .mockResolvedValueOnce(
        respons(200, { success: true, data: { canvasingId: "cv-1" } }),
      );
    await renderModal();
    await isiMedanWajib();
    await isi("#konversi-kabel", "75");

    await simpan();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(permintaan(0)).toEqual({
      url: URL_RINCIAN,
      method: "PATCH",
      badan: { status: "DEAL" },
    });
    expect(permintaan(1)).toEqual({
      url: URL_KONVERSI,
      method: "POST",
      badan: {
        noKtp: "3201234567890001",
        paket: "20 Mbps",
        kabel: 75,
        odp: null,
        sn: null,
        fotoKtp: null,
      },
    });
  });

  it("membuang kolom asal, kolom DEAL, rincian, dan daftar canvasing setelah berhasil", async () => {
    mockFetch
      .mockResolvedValueOnce(respons(200, { success: true }))
      .mockResolvedValueOnce(respons(200, { success: true }));
    await renderModal();
    await isiMedanWajib();

    await simpan();

    expect(panggilanInvalidasi()).toEqual([
      [{ queryKey: ["presurvei-prospek-kolom", "NEGOSIASI"] }],
      [{ queryKey: ["presurvei-prospek-kolom", "DEAL"] }],
      [{ queryKey: [URL_RINCIAN] }],
      [{ queryKey: ["canvasing-list"] }],
    ]);
    expect(palsu.toastSuccess).toHaveBeenCalledWith(
      "Prospek berhasil dijadikan canvasing",
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("tidak mengirim kabel yang dikosongkan, supaya server memakai survei", async () => {
    mockFetch
      .mockResolvedValueOnce(respons(200, { success: true }))
      .mockResolvedValueOnce(respons(200, { success: true }));
    await renderModal();
    await isiMedanWajib();

    await simpan();

    expect(permintaan(1).badan).not.toHaveProperty("kabel");
  });

  it("berhenti tanpa membuat canvasing bila PATCH ditolak", async () => {
    mockFetch.mockResolvedValueOnce(
      respons(409, {
        success: false,
        error:
          "Prospek berstatus TERTARIK tidak bisa langsung dipindah ke DEAL",
      }),
    );
    await renderModal();
    await isiMedanWajib();

    await simpan();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(palsu.toastError).toHaveBeenCalledWith(
      "Prospek berstatus TERTARIK tidak bisa langsung dipindah ke DEAL",
    );
    expect(panggilanInvalidasi()).toEqual([]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("mengatakan status sudah Deal bila canvasing gagal dibuat setelah PATCH", async () => {
    mockFetch
      .mockResolvedValueOnce(respons(200, { success: true }))
      .mockResolvedValueOnce(
        respons(400, { success: false, error: "Panjang kabel tidak valid" }),
      );
    await renderModal();
    await isiMedanWajib();

    await simpan();

    expect(palsu.toastError).toHaveBeenCalledWith(
      'Status prospek sudah menjadi Deal, tetapi canvasing belum dibuat: Panjang kabel tidak valid. Perbaiki isian lalu simpan lagi, atau ulangi nanti lewat tombol "Jadikan canvasing" di kartunya.',
      { duration: 8000 },
    );
    // Kartunya sudah pindah ke DEAL; daftar canvasing tidak berubah.
    expect(panggilanInvalidasi()).toEqual([
      [{ queryKey: ["presurvei-prospek-kolom", "NEGOSIASI"] }],
      [{ queryKey: ["presurvei-prospek-kolom", "DEAL"] }],
      [{ queryKey: [URL_RINCIAN] }],
    ]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("memakai pesan setengah jalan juga saat jaringan putus di langkah kedua", async () => {
    mockFetch
      .mockResolvedValueOnce(respons(200, { success: true }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await renderModal();
    await isiMedanWajib();

    await simpan();

    expect(palsu.toastError).toHaveBeenCalledWith(
      'Status prospek sudah menjadi Deal, tetapi canvasing belum dibuat: Gagal menjadikan prospek canvasing. Perbaiki isian lalu simpan lagi, atau ulangi nanti lewat tombol "Jadikan canvasing" di kartunya.',
      { duration: 8000 },
    );
  });

  it("tidak mengirim PATCH lagi selama rincian belum diambil ulang", async () => {
    // `useApi` di sini statis: memodelkan jendela sebelum pengambilan ulang
    // rincian selesai (atau saat ia gagal). Versi yang memodelkan pengambilan
    // ulang ada di blok "setelah rincian diambil ulang".
    mockFetch
      .mockResolvedValueOnce(respons(200, { success: true }))
      .mockResolvedValueOnce(
        respons(400, { success: false, error: "Nomor KTP tidak valid" }),
      )
      .mockResolvedValueOnce(respons(200, { success: true }));
    await renderModal();
    await isiMedanWajib();
    await simpan();

    await simpan();

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(permintaan(2).url).toBe(URL_KONVERSI);
    expect(permintaan(2).method).toBe("POST");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe("setelah rincian diambil ulang", () => {
    /**
     * Memodelkan produksi: `useApi` palsu di sini adalah `useQuery` sungguhan
     * berkunci `[url]`, seperti `useApi` asli. Cabang setengah jalan
     * menginvalidasi `[URL_RINCIAN]`, query aktif itu diambil ulang, dan
     * `KonversiModal` render ulang dengan rincian berstatus apa pun yang kini
     * dipegang "server" — DEAL begitu PATCH diterima.
     */
    function rincianIkutServer() {
      let statusServer: ProspekDetailDto["status"] = "NEGOSIASI";
      palsu.useApi.mockImplementation((key: string): HasilApiPalsu => {
        const kueri = useQuery({
          queryKey: [key],
          queryFn: async () => rincian({ status: statusServer }),
          retry: false,
        });
        return {
          data: kueri.data,
          error: null,
          isLoading: kueri.isLoading,
        };
      });
      return () => {
        statusServer = "DEAL";
      };
    }

    /** Render lalu tunggu query rincian pertama selesai. */
    async function renderSetelahRincianTiba() {
      await renderModal();
      await act(async () => {
        await new Promise((selesai) => setTimeout(selesai, 0));
      });
      expect(cari("#konversi-ktp")).not.toBeNull();
    }

    it("simpan ulang tidak mengirim PATCH dan membuang kolom DEAL saja", async () => {
      const terimaPatch = rincianIkutServer();
      mockFetch
        .mockImplementationOnce(async () => {
          terimaPatch();
          return respons(200, { success: true });
        })
        .mockResolvedValueOnce(
          respons(400, { success: false, error: "Nomor KTP tidak valid" }),
        )
        .mockResolvedValueOnce(respons(200, { success: true }));
      await renderSetelahRincianTiba();
      await isiMedanWajib();
      await simpan();
      vi.mocked(queryClient.invalidateQueries).mockClear();

      await simpan();

      expect(
        mockFetch.mock.calls.map((_, indeks) => {
          const { method, url } = permintaan(indeks);
          return `${method} ${url}`;
        }),
      ).toEqual([
        `PATCH ${URL_RINCIAN}`,
        `POST ${URL_KONVERSI}`,
        `POST ${URL_KONVERSI}`,
      ]);
      expect(panggilanInvalidasi()).toEqual([
        [{ queryKey: ["presurvei-prospek-kolom", "DEAL"] }],
        [{ queryKey: [URL_RINCIAN] }],
        [{ queryKey: ["canvasing-list"] }],
      ]);
      expect(document.body.textContent).not.toContain(TEKS_DUA_LANGKAH);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("kegagalan simpan ulang memakai pesan server apa adanya, bukan pesan setengah jalan", async () => {
      // Statusnya memang sudah Deal, dan kepala modal menampilkannya; pesan
      // setengah jalan hanya untuk kegagalan pertama setelah PATCH.
      const terimaPatch = rincianIkutServer();
      mockFetch
        .mockImplementationOnce(async () => {
          terimaPatch();
          return respons(200, { success: true });
        })
        .mockResolvedValueOnce(
          respons(400, { success: false, error: "Nomor KTP tidak valid" }),
        )
        .mockResolvedValueOnce(
          respons(400, { success: false, error: "Paket tidak dikenal" }),
        );
      await renderSetelahRincianTiba();
      await isiMedanWajib();
      await simpan();

      await simpan();

      expect(palsu.toastError.mock.calls).toEqual([
        [
          'Status prospek sudah menjadi Deal, tetapi canvasing belum dibuat: Nomor KTP tidak valid. Perbaiki isian lalu simpan lagi, atau ulangi nanti lewat tombol "Jadikan canvasing" di kartunya.',
          { duration: 8000 },
        ],
        ["Paket tidak dikenal"],
      ]);
      expect(document.body.textContent).toContain("Rina Wati — Deal");
    });
  });

  it("menolak kabel nol sebelum mengirim apa pun", async () => {
    await renderModal();
    await isiMedanWajib();
    await isi("#konversi-kabel", "0");

    await simpan();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Panjang kabel minimal 1 meter",
    );
  });

  it("tidak mengirim apa pun bila medan wajib kosong", async () => {
    await renderModal();

    await simpan();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Nomor KTP harus 16–20 karakter",
    );
  });
});

describe("KonversiModal — prospek yang sudah DEAL", () => {
  beforeEach(() => {
    pakaiRincian(rincian({ status: "DEAL" }));
  });

  it("langsung membuat canvasing tanpa PATCH", async () => {
    mockFetch.mockResolvedValueOnce(respons(200, { success: true }));
    await renderModal();
    await isiMedanWajib();

    await simpan();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(permintaan(0).url).toBe(URL_KONVERSI);
    expect(permintaan(0).method).toBe("POST");
    expect(document.body.textContent).not.toContain(TEKS_DUA_LANGKAH);
    expect(panggilanInvalidasi()).toEqual([
      [{ queryKey: ["presurvei-prospek-kolom", "DEAL"] }],
      [{ queryKey: [URL_RINCIAN] }],
      [{ queryKey: ["canvasing-list"] }],
    ]);
  });

  it("menampilkan pesan server apa adanya bila konversi ditolak", async () => {
    mockFetch.mockResolvedValueOnce(
      respons(409, {
        success: false,
        error: "Prospek ini sudah pernah dijadikan canvasing",
      }),
    );
    await renderModal();
    await isiMedanWajib();

    await simpan();

    expect(palsu.toastError).toHaveBeenCalledWith(
      "Prospek ini sudah pernah dijadikan canvasing",
    );
    expect(panggilanInvalidasi()).toEqual([]);
  });
});

describe("KonversiModal — tampilan", () => {
  it("menjelaskan apa yang dipakai server untuk kabel dan ODP yang kosong", async () => {
    await renderModal();

    expect(document.body.textContent).toContain(PETUNJUK_KABEL);
    expect(document.body.textContent).toContain(PETUNJUK_ODP);
  });

  it("tidak menampilkan form untuk prospek yang sudah punya canvasing", async () => {
    pakaiRincian(rincian({ status: "DEAL", canvasingId: "cv-lama" }));

    await renderModal();

    expect(cari("#konversi-ktp")).toBeNull();
    expect(document.body.textContent).toContain(
      "Prospek ini sudah dijadikan canvasing.",
    );
  });

  it("memuat rincian dari endpoint prospek yang dipilih", async () => {
    await renderModal();

    expect(palsu.useApi).toHaveBeenCalledWith(URL_RINCIAN);
  });
});
