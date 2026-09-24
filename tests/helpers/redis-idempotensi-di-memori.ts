import { vi } from "vitest";

import { redis } from "@/lib/redis";

const MILIDETIK_PER_DETIK = 1000;

interface EntriRedis {
  nilai: string;
  kedaluwarsaPadaMs: number;
}

/** Kendali atas Redis tiruan: waktu maju manual dan intip TTL kunci. */
export interface RedisIdempotensiDiMemori {
  /** Majukan jam tiruan; kunci yang TTL-nya lewat dianggap hilang. */
  majukanWaktu: (detik: number) => void;
  /** Sisa TTL (detik) kunci, atau `null` bila kunci tidak ada. */
  bacaSisaTtl: (kunci: string) => number | null;
  /** Baca nilai mentah kunci yang masih hidup. */
  bacaNilai: (kunci: string) => string | null;
  /** Semua kunci yang masih hidup. */
  daftarKunci: () => string[];
}

/**
 * Pasang Redis tiruan di memori pada `redisMock` global (`tests/setup.ts`)
 * yang menghormati `SET ... EX n NX`, `SETEX`, `GET`, dan `DEL`, termasuk
 * kedaluwarsa TTL. `GenericIdempotencyService` asli dipakai apa adanya,
 * jadi test mengukur perilaku sebenarnya, bukan tiruan service.
 */
export function pasangRedisIdempotensiDiMemori(): RedisIdempotensiDiMemori {
  const penyimpanan = new Map<string, EntriRedis>();
  let sekarangMs = 0;

  const ambilHidup = (kunci: string): EntriRedis | null => {
    const entri = penyimpanan.get(kunci);
    if (!entri) return null;
    if (entri.kedaluwarsaPadaMs <= sekarangMs) {
      penyimpanan.delete(kunci);
      return null;
    }
    return entri;
  };

  const simpan = (kunci: string, nilai: string, ttlDetik: number): void => {
    penyimpanan.set(kunci, {
      nilai,
      kedaluwarsaPadaMs: sekarangMs + ttlDetik * MILIDETIK_PER_DETIK,
    });
  };

  vi.mocked(redis.set).mockImplementation((async (
    kunci: string,
    nilai: string,
    ...opsi: unknown[]
  ) => {
    if (opsi.includes("NX") && ambilHidup(kunci)) return null;
    const indeksEx = opsi.indexOf("EX");
    simpan(kunci, nilai, Number(opsi[indeksEx + 1]));
    return "OK";
  }) as never);
  vi.mocked(redis.get).mockImplementation(
    (async (kunci: string) => ambilHidup(kunci)?.nilai ?? null) as never,
  );
  vi.mocked(redis.setex).mockImplementation((async (
    kunci: string,
    ttlDetik: number,
    nilai: string,
  ) => {
    simpan(kunci, nilai, ttlDetik);
    return "OK";
  }) as never);
  vi.mocked(redis.del).mockImplementation((async (kunci: string) =>
    ambilHidup(kunci) && penyimpanan.delete(kunci) ? 1 : 0) as never);

  return {
    majukanWaktu: (detik) => {
      sekarangMs += detik * MILIDETIK_PER_DETIK;
    },
    bacaSisaTtl: (kunci) => {
      const entri = ambilHidup(kunci);
      if (!entri) return null;
      return (entri.kedaluwarsaPadaMs - sekarangMs) / MILIDETIK_PER_DETIK;
    },
    bacaNilai: (kunci) => ambilHidup(kunci)?.nilai ?? null,
    daftarKunci: () => [...penyimpanan.keys()].filter((k) => ambilHidup(k)),
  };
}
