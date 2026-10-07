import type { SiteEntity } from "../entities/SiteEntity";

export interface SiteCreateRepositoryInput {
  code: string;
  name: string;
  description?: string | null;
  address?: string | null;
  kabupatenKota?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  attendanceRadius?: number;
  gudangIds?: string[];
}

export interface SiteUpdateRepositoryInput {
  code?: string;
  name?: string;
  description?: string | null;
  address?: string | null;
  kabupatenKota?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  attendanceRadius?: number;
  isActive?: boolean;
  gudangIds?: string[];
}

export interface SiteFilterOptions {
  search?: string;
  activeOnly?: boolean;
  allowedSiteIds?: string[];
}

export interface ISiteRepository {
  /** Get all sites with optional filter. */
  findAll(filter?: SiteFilterOptions): Promise<SiteEntity[]>;
  /** Find site by ID with related details. */
  findById(id: string): Promise<SiteEntity | null>;
  /** Find site name by ID for lightweight lookups. */
  findNameById(id: string): Promise<{ name: string } | null>;
  /**
   * Dari sekumpulan id gudang, kembalikan yang benar-benar ada DI TENANT AKTIF.
   *
   * Penugasan gudang ke site memakai `connect`/`set` berdasarkan id mentah
   * kiriman klien, dan ekstensi tenant Prisma tidak menyaring relasi bersarang.
   * Tanpa pemeriksaan ini, id gudang milik tenant lain bisa ditautkan ke site
   * sendiri.
   */
  findGudangIdsInTenant(gudangIds: string[]): Promise<string[]>;
  /** Find site by unique code. */
  findByCode(code: string): Promise<SiteEntity | null>;
  /** Create a site entity. */
  create(data: SiteCreateRepositoryInput): Promise<SiteEntity>;
  /** Update a site entity. */
  update(id: string, data: SiteUpdateRepositoryInput): Promise<SiteEntity>;
  /** Deactivate a site entity. */
  deactivate(id: string): Promise<SiteEntity>;
  /** Delete a site entity. */
  delete(id: string): Promise<void>;
  /** Find site entity for delete checks. */
  findWithCounts(id: string): Promise<SiteEntity | null>;
}
