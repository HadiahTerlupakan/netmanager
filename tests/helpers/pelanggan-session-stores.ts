import { prismaMock, redisMock } from "../setup";

/** Pelanggan contoh untuk tes sesi login. */
export const PELANGGAN_SESI = {
  id: "pel-1",
  idPelanggan: "PLG-001",
  nama: "Budi",
  username: "budi",
  status: "AKTIF",
};

/** Keadaan baris pelanggan dan daftar sesi dicabut di tiruan basis data. */
export interface PelangganSessionStores {
  tokenVersion: number;
  status: string;
  revokedKeys: Set<string>;
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
    revokedKeys: new Set(),
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
  redisMock.setex.mockImplementation(async (key: string) => {
    stores.revokedKeys.add(key);
    return "OK";
  });
  redisMock.exists.mockReset();
  redisMock.exists.mockImplementation(async (key: string) =>
    stores.revokedKeys.has(key) ? 1 : 0,
  );

  return stores;
}
