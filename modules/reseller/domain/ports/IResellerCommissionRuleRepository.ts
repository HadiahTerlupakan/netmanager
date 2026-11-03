import type {
  ResellerCommissionRuleEntity,
  ResellerCommissionRuleListItem,
  ResellerCommissionTypeValue,
} from "../entities/ResellerCommissionEntity";

/** Status aturan komisi; kolomnya memakai enum ResellerStatus. */
export type CommissionRuleStatusValue = "ACTIVE" | "INACTIVE";

export interface CreateCommissionRuleData {
  readonly tenantId: string;
  readonly resellerId: string;
  readonly hargaPaketId: string | null;
  readonly type: ResellerCommissionTypeValue;
  readonly rate: number | null;
  readonly fixedAmount: number | null;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
}

export interface UpdateCommissionRuleData {
  readonly type?: ResellerCommissionTypeValue;
  readonly rate?: number | null;
  readonly fixedAmount?: number | null;
  readonly startsAt?: Date;
  readonly endsAt?: Date | null;
  readonly status?: CommissionRuleStatusValue;
}

/** Rentang berlaku aturan; `endsAt` null berarti tanpa batas akhir. */
export interface CommissionRuleWindow {
  readonly tenantId: string;
  readonly resellerId: string;
  readonly hargaPaketId: string | null;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  /** Aturan yang sedang diubah, dikecualikan dari pemeriksaan bentrok. */
  readonly excludeRuleId?: string;
}

/** Lingkup bentrok aturan: reseller + paket (null = semua paket). */
export interface CommissionRuleScope {
  readonly tenantId: string;
  readonly resellerId: string;
  readonly hargaPaketId: string | null;
}

/** Akses data aturan komisi reseller, selalu dibatasi tenant. */
export interface IResellerCommissionRuleRepository {
  /** Aturan reseller (aktif dan nonaktif) beserta nama paketnya. */
  listByReseller(
    tenantId: string,
    resellerId: string,
  ): Promise<readonly ResellerCommissionRuleListItem[]>;
  /** Aturan milik reseller di tenant; null bila tidak ada. */
  findById(
    tenantId: string,
    resellerId: string,
    ruleId: string,
  ): Promise<ResellerCommissionRuleEntity | null>;
  /** Aturan ACTIVE lain untuk reseller+paket yang rentangnya beririsan. */
  findOverlappingActiveRule(
    window: CommissionRuleWindow,
  ): Promise<ResellerCommissionRuleEntity | null>;
  create(data: CreateCommissionRuleData): Promise<ResellerCommissionRuleEntity>;
  update(
    ruleId: string,
    data: UpdateCommissionRuleData,
  ): Promise<ResellerCommissionRuleEntity>;
  /** Reseller ada (belum dihapus) di tenant. */
  resellerExists(tenantId: string, resellerId: string): Promise<boolean>;
  /** Paket ada di tenant. */
  packageExists(tenantId: string, hargaPaketId: string): Promise<boolean>;
  /**
   * Jalankan `work` dalam satu transaksi yang memegang kunci lingkup aturan,
   * dengan repository yang terikat transaksi itu. Cek bentrok lalu simpan di
   * dalamnya tidak bisa diselip permintaan lain untuk lingkup yang sama.
   */
  runExclusive<T>(
    scope: CommissionRuleScope,
    work: (repository: IResellerCommissionRuleRepository) => Promise<T>,
  ): Promise<T>;
}
