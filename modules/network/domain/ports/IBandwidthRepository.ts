export type BandwidthCreateInput = Record<string, unknown>;
export type BandwidthUpdateInput = Record<string, unknown>;

export interface BandwidthListFilters {
  status?: string;
  siteIds?: string[];
  requestedSiteId?: string | null;
  includeGlobal: boolean;
}

export interface IBandwidthRepository {
  /** Ambil daftar bandwidth untuk route admin. */
  findMany(filters: BandwidthListFilters): Promise<unknown[]>;

  /** Buat bandwidth baru. */
  create(input: BandwidthCreateInput): Promise<{ id: string; name: string }>;

  /** Ambil detail bandwidth berdasarkan identifier. */
  findById(id: string): Promise<unknown | null>;

  /** Perbarui bandwidth berdasarkan identifier. */
  update(id: string, input: BandwidthUpdateInput): Promise<unknown>;

  /** Ambil bandwidth beserta paket yang memakai bandwidth tersebut. */
  findForDelete(
    id: string,
  ): Promise<{ name: string; hargaPaket: Array<{ name: string }> } | null>;

  /** Hapus bandwidth berdasarkan identifier. */
  delete(id: string): Promise<void>;
}
