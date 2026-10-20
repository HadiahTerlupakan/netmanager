/** Antrean router core yang gagal dihapus dan harus dicoba lagi. */
export interface IVpnCoreRouterTombstoneRepository {
  /** Mencatat id router core; mencatat id yang sama dua kali tidak berefek. */
  add(coreRouterId: string): Promise<void>;

  /** Id router core yang paling lama menunggu, paling lama lebih dulu. */
  listOldest(limit: number): Promise<string[]>;

  /** Menghapus catatan; tidak gagal bila catatan sudah tidak ada. */
  remove(coreRouterId: string): Promise<void>;

  /** True bila id router core sedang menunggu dihapus (draft tidak boleh dipakai lagi). */
  has(coreRouterId: string): Promise<boolean>;

  /** True bila router netmanager mana pun (lintas tenant) memakai id router core ini. */
  isUsedByRouter(coreRouterId: string): Promise<boolean>;
}
