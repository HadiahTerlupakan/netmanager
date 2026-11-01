import { describe, expect, it, vi } from "vitest";

import {
  PESAN_JAWABAN_RUSAK,
  PESAN_TANPA_KONEKSI,
  requestTransferApi,
  TransferRequestError,
} from "@/components/inventory/transfer/transferRequest";
import { validateTransferForm } from "@/components/inventory/transfer/transferFormValidation";
import {
  TRANSFER_MESSAGES,
  TransferRejectedError,
} from "@/modules/inventory/domain/transfer-errors";
import {
  createTransfer,
  deleteTransfer,
} from "@/modules/inventory/repositories/inventory-repository-transfer-mutation-helpers";

/**
 * Pesan transfer dibaca petugas gudang: harus menyebut nama barang, nama
 * gudang, dan angka stok yang sebenarnya, plus langkah berikutnya.
 */

function buatDb(overrides: {
  barang?: { nama: string } | null;
  gudang?: Record<string, { nama: string } | null>;
  stokTersisa?: {
    stok: number;
    stokBaru: number;
    stokBekas: number;
    stokRusak: number;
  } | null;
  transfer?: unknown;
}) {
  const tx = {
    barang: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          overrides.barang === undefined
            ? { nama: "Kabel Drop" }
            : overrides.barang,
        ),
    },
    gudang: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(
          overrides.gudang?.[where.id] === undefined
            ? { nama: where.id === "g1" ? "Gudang Utama" : "Gudang Cabang" }
            : overrides.gudang[where.id],
        ),
      ),
    },
    barangGudang: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findUnique: vi.fn().mockResolvedValue(overrides.stokTersisa ?? null),
    },
    transferAntarGudang: {
      findUnique: vi.fn().mockResolvedValue(overrides.transfer ?? null),
    },
  };
  const db = {
    $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
  };
  return db as never;
}

const dataTransfer = {
  barangId: "b1",
  dariGudangId: "g1",
  keGudangId: "g2",
  jumlah: 5,
  kondisi: "BEKAS" as const,
  userId: "u1",
  tenantId: "t1",
};

async function tangkap(
  promise: Promise<unknown>,
): Promise<TransferRejectedError> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(TransferRejectedError);
  return error as TransferRejectedError;
}

describe("helper mutasi transfer — pesan penolakan", () => {
  it("stok asal kurang: sebut barang, gudang, kondisi, dan sisa stok", async () => {
    const db = buatDb({
      stokTersisa: { stok: 10, stokBaru: 7, stokBekas: 3, stokRusak: 0 },
    });

    const error = await tangkap(createTransfer(db, dataTransfer as never));

    expect(error.status).toBe(400);
    expect(error.message).toBe(
      'Stok "Kabel Drop" kondisi bekas di gudang Gudang Utama hanya 3, tapi Anda mau memindah 5. Kurangi jumlahnya jadi 3 atau kurang.',
    );
  });

  it("stok asal kosong: katakan kosong, bukan 'hanya 0'", async () => {
    const error = await tangkap(
      createTransfer(buatDb({}), dataTransfer as never),
    );

    expect(error.message).toBe(
      'Stok "Kabel Drop" kondisi bekas di gudang Gudang Utama kosong (0), jadi tidak bisa dipindah. Cek lagi kondisi barangnya, atau pilih gudang asal lain.',
    );
  });

  it("barang terhapus: 404 dengan frasa 'tidak ditemukan'", async () => {
    const error = await tangkap(
      createTransfer(buatDb({ barang: null }), dataTransfer as never),
    );

    expect(error.status).toBe(404);
    expect(error.message).toBe(TRANSFER_MESSAGES.barangTidakAda);
    expect(error.message).toContain("tidak ditemukan");
  });

  it("gudang tujuan nonaktif: sebut gudang tujuan", async () => {
    const error = await tangkap(
      createTransfer(buatDb({ gudang: { g2: null } }), dataTransfer as never),
    );

    expect(error.status).toBe(400);
    expect(error.message).toBe(TRANSFER_MESSAGES.gudangTujuanTidakAktif);
  });

  it("batal transfer saat barang di gudang tujuan sudah berkurang: 409 dengan angka", async () => {
    const db = buatDb({
      transfer: {
        id: "tr1",
        barangId: "b1",
        dariGudangId: "g1",
        keGudangId: "g2",
        jumlah: 5,
        kondisi: "BARU",
        tenantId: "t1",
        barang: { nama: "ONT ZTE" },
        gudangDari: { nama: "Gudang Utama" },
        gudangKe: { nama: "Gudang Cabang" },
      },
      stokTersisa: { stok: 2, stokBaru: 2, stokBekas: 0, stokRusak: 0 },
    });

    const error = await tangkap(deleteTransfer(db, "tr1"));

    expect(error.status).toBe(409);
    expect(error.message).toBe(
      'Transfer ini tidak bisa dibatalkan. Untuk membatalkan, 5 "ONT ZTE" (baru) harus diambil lagi dari gudang Gudang Cabang dan dikembalikan ke gudang Gudang Utama. Tapi di gudang Gudang Cabang sekarang hanya ada 2. Barangnya mungkin sudah dipakai atau dipindah lagi. Tanyakan ke admin cara membetulkan stoknya.',
    );
  });

  it("batal transfer yang sudah tidak ada: 404", async () => {
    const error = await tangkap(deleteTransfer(buatDb({}), "tr-hilang"));

    expect(error.status).toBe(404);
    expect(error.message).toBe(TRANSFER_MESSAGES.transferTidakAda);
  });
});

describe("validateTransferForm — cek formulir di layar", () => {
  const lengkap = {
    barangId: "b1",
    dariGudangId: "g1",
    keGudangId: "g2",
    jumlah: "3",
    kondisi: "BARU",
  };
  const konteks = {
    barangNama: "Kabel Drop",
    gudangAsalNama: "Gudang Utama",
    stokKondisi: 10,
  };

  it("formulir benar: tidak ada pesan", () => {
    expect(validateTransferForm(lengkap, konteks)).toBe("");
  });

  it("melaporkan semua isian kosong sekaligus", () => {
    expect(
      validateTransferForm(
        {
          barangId: "",
          dariGudangId: "",
          keGudangId: "",
          jumlah: "",
          kondisi: "BARU",
        },
        konteks,
      ).split("\n"),
    ).toEqual([
      TRANSFER_MESSAGES.barangKosong,
      TRANSFER_MESSAGES.gudangAsalKosong,
      TRANSFER_MESSAGES.gudangTujuanKosong,
      TRANSFER_MESSAGES.jumlahKosong,
    ]);
  });

  it("jumlah berkoma tidak dibulatkan diam-diam", () => {
    expect(validateTransferForm({ ...lengkap, jumlah: "5,5" }, konteks)).toBe(
      TRANSFER_MESSAGES.jumlahBerkoma,
    );
  });

  it("jumlah melebihi stok: sebut barang, gudang, dan sisa stok", () => {
    expect(validateTransferForm({ ...lengkap, jumlah: "12" }, konteks)).toBe(
      'Stok "Kabel Drop" kondisi baru di gudang Gudang Utama hanya 10, tapi Anda mau memindah 12. Kurangi jumlahnya jadi 10 atau kurang.',
    );
  });

  it("pesan layar sama persis dengan pesan server", () => {
    expect(
      validateTransferForm({ ...lengkap, keGudangId: "g1" }, konteks),
    ).toBe(TRANSFER_MESSAGES.gudangSama);
  });
});

describe("requestTransferApi — gangguan koneksi dan server", () => {
  it("koneksi putus: minta periksa internet, bukan 'Failed to fetch'", async () => {
    const error = await requestTransferApi(
      () => Promise.reject(new TypeError("Failed to fetch")),
      "cadangan",
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TransferRequestError);
    expect((error as TransferRequestError).message).toBe(PESAN_TANPA_KONEKSI);
    expect((error as TransferRequestError).isServerRejection).toBe(false);
  });

  it("jawaban server bukan JSON: jelaskan server bermasalah", async () => {
    const error = await requestTransferApi(
      () => Promise.resolve(new Response("<html>502</html>", { status: 502 })),
      "cadangan",
    ).catch((e: unknown) => e);

    expect((error as Error).message).toBe(PESAN_JAWABAN_RUSAK);
  });

  it("server menolak: pakai pesan server dan tandai penolakan", async () => {
    const error = await requestTransferApi(
      () =>
        Promise.resolve(
          Response.json(
            { success: false, error: "Stok kurang" },
            { status: 400 },
          ),
        ),
      "cadangan",
    ).catch((e: unknown) => e);

    expect((error as TransferRequestError).message).toBe("Stok kurang");
    expect((error as TransferRequestError).isServerRejection).toBe(true);
  });

  it("berhasil: kembalikan isi data", async () => {
    const result = await requestTransferApi<{ kodeTransfer: string }>(
      () =>
        Promise.resolve(
          Response.json({ success: true, data: { kodeTransfer: "TRF-1" } }),
        ),
      "cadangan",
    );

    expect(result).toEqual({ kodeTransfer: "TRF-1" });
  });
});
