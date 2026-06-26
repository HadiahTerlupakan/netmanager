import type {
  CanvasingCompletionSummaryEntity,
  CanvasingEntity,
  CanvasingListSummaryEntity,
  CanvasingStatus,
} from "../entities/CanvasingEntity";

export interface CanvasingListFilters {
  status?: CanvasingStatus;
  salesId?: string;
  mitraId?: string;
  siteId?: string;
  siteIds?: string[];
  search?: string;
}

export interface CreateCanvasingInput {
  nama: string;
  noKtp: string;
  noTelpon: string;
  email?: string | null;
  alamat: string;
  kabel: number;
  odp?: string | null;
  paket: string;
  sn?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  shareloc?: string | null;
  foto?: string | null;
  fotoKtp?: string | null;
  mitraId?: string | null;
  salesId?: string | null;
}

export interface UpdateCanvasingInput {
  nama?: string;
  noKtp?: string;
  noTelpon?: string;
  email?: string | null;
  alamat?: string;
  kabel?: number;
  odp?: string | null;
  paket?: string;
  sn?: string | null;
  status?: CanvasingStatus;
  foto?: string | null;
  fotoKtp?: string | null;
  workOrderId?: string | null;
  approvedBy?: string | null;
  approvedAt?: Date | null;
}

export interface FindAllCanvasingResult {
  data: CanvasingEntity[];
  total: number;
  summary: CanvasingListSummaryEntity;
  /** Set when cursor pagination dipakai (lihat findAll opts). */
  nextCursor?: string | null;
}

/**
 * Opsi tambahan untuk findAll. `cursor` aktifkan cursor-based pagination
 * (mengabaikan `page`); cursor berisi `id` item terakhir dari halaman sebelumnya.
 */
export interface FindAllCanvasingOptions {
  cursor?: string | null;
}

export interface ICanvasingRepository {
  /** Create a new canvasing request and return its domain entity. */
  create(data: CreateCanvasingInput): Promise<CanvasingEntity>;

  /** Find a canvasing request by id. */
  findById(id: string): Promise<CanvasingEntity | null>;

  /** Find a canvasing request with sales and site context. */
  findByIdWithSales(id: string): Promise<CanvasingEntity | null>;

  /** Find canvasing requests using optional filters and pagination. */
  findAll(
    filters?: CanvasingListFilters,
    page?: number,
    limit?: number,
    options?: FindAllCanvasingOptions,
  ): Promise<FindAllCanvasingResult>;

  /** Get completion summary counts for optional sales scope. */
  getCompletionSummary(input: {
    salesId?: string;
    today: Date;
    tomorrow: Date;
    weekStart: Date;
    monthStart: Date;
  }): Promise<CanvasingCompletionSummaryEntity>;

  /** Update a canvasing request and return the updated entity. */
  update(id: string, data: UpdateCanvasingInput): Promise<CanvasingEntity>;

  /** Delete a canvasing request by id. */
  delete(id: string): Promise<void>;
}
