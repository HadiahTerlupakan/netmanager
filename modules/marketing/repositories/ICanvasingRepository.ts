import type { Canvasing, CanvasingStatus } from "@prisma/client";

export interface CanvasingListFilters {
  status?: CanvasingStatus;
  salesId?: string;
  mitraId?: string;
  siteId?: string;
  search?: string;
}

export interface CanvasingListSummary {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  pendingClaims: number;
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

export interface CanvasingWithSalesSite extends Canvasing {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    siteId: string | null;
    sites: {
      id: string;
      name: string;
    } | null;
  } | null;
  mitra: {
    id: string;
    name: string | null;
    email: string | null;
    mitraType: string | null;
    siteId: string | null;
    sites: {
      id: string;
      name: string;
    } | null;
  } | null;
}

export interface CanvasingWithSalesInfo extends Canvasing {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    siteId: string | null;
  } | null;
  mitra: {
    id: string;
    name: string | null;
    email: string | null;
    mitraType: string | null;
    siteId: string | null;
  } | null;
}

export interface ICanvasingRepository {
  create(data: CreateCanvasingInput): Promise<CanvasingWithSalesInfo>;
  findById(id: string): Promise<Canvasing | null>;
  findByIdWithSales(id: string): Promise<CanvasingWithSalesSite | null>;
  findAll(
    filters?: CanvasingListFilters,
    page?: number,
    limit?: number,
  ): Promise<{
    data: Canvasing[];
    total: number;
    summary: CanvasingListSummary;
  }>;
  update(id: string, data: UpdateCanvasingInput): Promise<Canvasing>;
  delete(id: string): Promise<void>;
}
