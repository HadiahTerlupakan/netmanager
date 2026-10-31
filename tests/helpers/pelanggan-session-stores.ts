import { prismaMock, redisMock } from "../setup";

/** Pelanggan contoh untuk tes sesi login. */
export const PELANGGAN_SESI = {
  id: "pel-1",
  idPelanggan: "PLG-001",
  nama: "Budi",
  username: "budi",
  status: "AKTIF",
};

/** Keadaan baris pelanggan di tiruan basis data dan isi Redis tiruan. */
export interface PelangganSessionStores {
  tokenVersion: number;
  status: string;
  redisValues: Map<string, string>;
}

/**
 * Basis data dan Redis tiruan yang menyimpan keadaan, supaya urutan login,
 * refresh, dan logout di beberapa perangkat benar-benar saling memengaruhi
 * seperti di produksi. Mock yang hanya mengembalikan nilai tetap tidak bisa
 * menunjukkan login kedua mencabut sesi pertama.
 */
export function useStatefulPelangganStores(
  initialTokenVersion = 3,
): PelangganSessionStores {
  const stores: PelangganSessionStores = {
    tokenVersion: initialTokenVersion,
    status: "AKTIF",
    redisValues: new Map(),
  };

  prismaMock.pelanggan.update.mockImplementation(
    async ({ data }: { data: { tokenVersion?: { increment: number } } }) => {
      stores.tokenVersion += data.tokenVersion?.increment ?? 0;
      return {};
    },
  );
  prismaMock.pelanggan.findUnique.mockImplementation(async () => ({
    ...PELANGGAN_SESI,
    tokenVersion: stores.tokenVersion,
    status: stores.status,
    lastVersionCode: null,
    lastVersionName: null,
  }));
  redisMock.setex.mockReset();
  redisMock.setex.mockImplementation(
    async (key: string, _ttl: number, value: string) => {
      stores.redisValues.set(key, value);
      return "OK";
    },
  );
  redisMock.exists.mockReset();
  redisMock.exists.mockImplementation(async (key: string) =>
    stores.redisValues.has(key) ? 1 : 0,
  );
  redisMock.get.mockReset();
  redisMock.get.mockImplementation(
    async (key: string) => stores.redisValues.get(key) ?? null,
  );

  return stores;
}
