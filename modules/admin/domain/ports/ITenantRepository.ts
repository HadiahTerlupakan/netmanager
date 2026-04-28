import type { TenantEntity } from "../entities/TenantEntity";

export interface TenantListFilters {
  activeOnly: boolean;
}

export interface TenantWriteInput {
  name: string;
  domain: string | null;
  isActive: boolean;
}

export interface ITenantRepository {
  /** Ambil tenant berdasarkan filter daftar. */
  findMany(filters: TenantListFilters): Promise<TenantEntity[]>;

  /** Buat tenant baru. */
  create(input: TenantWriteInput): Promise<TenantEntity>;

  /** Perbarui tenant berdasarkan identifier. */
  update(id: string, input: TenantWriteInput): Promise<TenantEntity>;

  /** Hapus tenant berdasarkan identifier. */
  delete(id: string): Promise<void>;

  /** Cari tenant lain yang memakai domain sama. */
  findDuplicateDomain(id: string, domain: string): Promise<TenantEntity | null>;

  /** Cari tenant aktif berdasarkan domain. */
  findActiveByDomain(domain: string): Promise<{ id: string } | null>;
}
