import type { SiteEntity } from "../entities/SiteEntity";

export interface SiteCreateRepositoryInput {
  code: string;
  name: string;
  description?: string | null;
  address?: string | null;
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
  latitude?: number | null;
  longitude?: number | null;
  attendanceRadius?: number;
  isActive?: boolean;
  gudangIds?: string[];
}

export interface SiteFilterOptions {
  search?: string;
  activeOnly?: boolean;
}

export interface ISiteRepository {
  /** Get all sites with optional filter. */
  findAll(filter?: SiteFilterOptions): Promise<SiteEntity[]>;
  /** Find site by ID with related details. */
  findById(id: string): Promise<SiteEntity | null>;
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
