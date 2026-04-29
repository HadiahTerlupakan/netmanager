export interface MixRadiusInvestorSiteEntity {
  id: string;
  name: string;
  owners: string[];
  isActive: boolean;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MixRadiusInvestorSiteInput {
  name: string;
  owners: string[];
  isActive: boolean;
  tenantId?: string;
}

export interface DeleteResult {
  count: number;
}

export interface IMixRadiusInvestorSiteRepository {
  /** Ambil daftar site investor berdasarkan tenant opsional. */
  findMany(tenantId?: string): Promise<MixRadiusInvestorSiteEntity[]>;

  /** Ambil satu site investor berdasarkan id dan tenant opsional. */
  findById(
    id: string,
    tenantId?: string,
  ): Promise<MixRadiusInvestorSiteEntity | null>;

  /** Buat site investor baru. */
  create(
    input: MixRadiusInvestorSiteInput,
  ): Promise<MixRadiusInvestorSiteEntity>;

  /** Perbarui site investor berdasarkan identifier terbatasi tenant. */
  update(id: string, input: MixRadiusInvestorSiteInput): Promise<DeleteResult>;

  /** Hapus site investor berdasarkan identifier terbatasi tenant. */
  delete(id: string, tenantId?: string): Promise<DeleteResult>;
}
