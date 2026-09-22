import type {
  ProspekEntity,
  ProspekStatus,
  ProspekSumber,
} from "../entities/Prospek";

/**
 * Kontrak akses data prospek presurvei.
 *
 * Service hanya bergantung pada antarmuka ini supaya aturan bisnisnya bisa
 * diuji tanpa database.
 */

export interface ProspekListFilters {
  status?: ProspekStatus;
  sumber?: ProspekSumber;
  pemilikId?: string;
  search?: string;
  page: number;
  limit: number;
}

export interface CreateProspekInput {
  nama: string;
  noTelp: string;
  email?: string | null;
  alamat: string;
  latitude?: number | null;
  longitude?: number | null;
  shareloc?: string | null;
  sumber: ProspekSumber;
  iklanId?: string | null;
  registrationId?: string | null;
  referralNama?: string | null;
  pemilikId?: string | null;
  paketDiminati?: string | null;
  catatan?: string | null;
  siteId?: string | null;
}

export interface UpdateProspekInput {
  nama?: string;
  noTelp?: string;
  email?: string | null;
  alamat?: string;
  latitude?: number | null;
  longitude?: number | null;
  shareloc?: string | null;
  status?: ProspekStatus;
  pemilikId?: string | null;
  paketDiminati?: string | null;
  catatan?: string | null;
}

export interface IProspekRepository {
  findMany(
    filters: ProspekListFilters,
  ): Promise<{ items: ProspekEntity[]; total: number }>;
  findById(id: string): Promise<ProspekEntity | null>;
  create(input: CreateProspekInput): Promise<ProspekEntity>;
  update(id: string, input: UpdateProspekInput): Promise<ProspekEntity>;
}
