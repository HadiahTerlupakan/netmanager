import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  pasangRedisIdempotensiDiMemori,
  type RedisIdempotensiDiMemori,
} from "../helpers/redis-idempotensi-di-memori";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger: mockLogger }));

import { redis } from "@/lib/redis";
import { GenericIdempotencyService } from "@/lib/api/idempotency";

/**
 * `GenericIdempotencyService` asli di atas Redis tiruan ber-TTL. Menjaga tiga
 * jalur kehilangan data Task 11c: kunci IN_PROGRESS yatim saat proses mati di
 * tengah handler, dan `persistCompleted` gagal setelah handler sukses.
 */

// Literal terpisah dari konstanta produksi, supaya perubahan nilai terdeteksi.
const TTL_SEDANG_DIPROSES_DETIK = 120;
const TTL_SELESAI_DETIK = 24 * 60 * 60;
const KUNCI = "idempotency:uji:catat:user-1:req-1";

type Respons = { id: string };

const opsi = (handler: () => Promise<Respons>) => ({
  scope: "uji:catat",
  userId: "user-1",
  requestId: "req-1",
  payload: { jenis: "TELEPON" },
  handler,
});

/** Handler yang tak pernah selesai: meniru pod yang mati di tengah proses. */
const handlerMenggantung = () => vi.fn(() => new Promise<Respons>(() => {}));

const bacaStatus = (redisTiruan: RedisIdempotensiDiMemori): unknown => {
  const mentah = redisTiruan.bacaNilai(KUNCI);
  return mentah ? JSON.parse(mentah).status : null;
};

describe("GenericIdempotencyService — TTL kunci IN_PROGRESS", () => {
  let redisTiruan: RedisIdempotensiDiMemori;
  let service: GenericIdempotencyService;

  beforeEach(() => {
    vi.clearAllMocks();
    redisTiruan = pasangRedisIdempotensiDiMemori();
    service = new GenericIdempotencyService();
  });

  it("kunci IN_PROGRESS memakai TTL pendek; TTL 24 jam hanya setelah selesai", async () => {
    let selesaikan: (nilai: Respons) => void = () => {};
    const handler = vi.fn(
      () => new Promise<Respons>((resolve) => (selesaikan = resolve)),
    );

    const berjalan = service.execute(opsi(handler));
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    expect(redisTiruan.bacaSisaTtl(KUNCI)).toBe(TTL_SEDANG_DIPROSES_DETIK);

    selesaikan({ id: "kegiatan-1" });
    await berjalan;
    expect(bacaStatus(redisTiruan)).toBe("COMPLETED");
    expect(redisTiruan.bacaSisaTtl(KUNCI)).toBe(TTL_SELESAI_DETIK);
  });

  it("kunci yatim kedaluwarsa sendiri, lalu replay diproses sebagai permintaan baru", async () => {
    void service.execute(opsi(handlerMenggantung()));
    await vi.waitFor(() => expect(bacaStatus(redisTiruan)).toBe("IN_PROGRESS"));

    redisTiruan.majukanWaktu(TTL_SEDANG_DIPROSES_DETIK - 1);
    const handlerSebelumKedaluwarsa = vi.fn(async () => ({
      id: "tak-dipakai",
    }));
    const sebelum = await service.execute(opsi(handlerSebelumKedaluwarsa));
    expect(sebelum).toEqual({ kind: "in-progress" });
    expect(handlerSebelumKedaluwarsa).not.toHaveBeenCalled();

    redisTiruan.majukanWaktu(1);
    const handlerReplay = vi.fn(async () => ({ id: "kegiatan-replay" }));
    const sesudah = await service.execute(opsi(handlerReplay));

    expect(sesudah).toEqual({
      kind: "fresh",
      response: { id: "kegiatan-replay" },
    });
    expect(handlerReplay).toHaveBeenCalledTimes(1);
  });

  it("handler melempar: kunci tetap dilepas agar retry langsung diproses", async () => {
    const galat = new Error("validasi gagal");
    await expect(
      service.execute(opsi(vi.fn(async () => Promise.reject(galat)))),
    ).rejects.toBe(galat);

    expect(redisTiruan.daftarKunci()).toEqual([]);
  });
});

describe("GenericIdempotencyService — persistCompleted gagal setelah handler sukses", () => {
  let redisTiruan: RedisIdempotensiDiMemori;
  let service: GenericIdempotencyService;

  beforeEach(() => {
    vi.clearAllMocks();
    redisTiruan = pasangRedisIdempotensiDiMemori();
    service = new GenericIdempotencyService();
    vi.mocked(redis.setex).mockRejectedValueOnce(new Error("ECONNRESET"));
  });

  it("mengembalikan fresh beserta respons handler, bukan melempar", async () => {
    const hasil = await service.execute(
      opsi(vi.fn(async () => ({ id: "kegiatan-1" }))),
    );

    expect(hasil).toEqual({ kind: "fresh", response: { id: "kegiatan-1" } });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "[idempotency] failed to persist completed state, key left to expire",
      expect.objectContaining({ key: KUNCI }),
    );
  });

  it("kunci tidak dilepas: replay dalam TTL pendek mendapat in-progress, bukan tulis ganda", async () => {
    await service.execute(opsi(vi.fn(async () => ({ id: "kegiatan-1" }))));
    expect(bacaStatus(redisTiruan)).toBe("IN_PROGRESS");

    const handlerReplay = vi.fn(async () => ({ id: "kegiatan-ganda" }));
    const replay = await service.execute(opsi(handlerReplay));

    expect(replay).toEqual({ kind: "in-progress" });
    expect(handlerReplay).not.toHaveBeenCalled();
    expect(redisTiruan.bacaSisaTtl(KUNCI)).toBe(TTL_SEDANG_DIPROSES_DETIK);
  });
});
