import type { Supplier, SupplierPphCategory } from "../entities/Supplier";

export interface SupplierCreateInput {
  code: string;
  name: string;
  address?: string | null;
  contact?: string | null;
  email?: string | null;
  phone?: string | null;
  npwp?: string | null;
  defaultPphCategory?: SupplierPphCategory | null;
  tenantId: string | null;
}

export interface SupplierUpdateInput {
  name?: string;
  address?: string | null;
  contact?: string | null;
  email?: string | null;
  phone?: string | null;
  npwp?: string | null;
  defaultPphCategory?: SupplierPphCategory | null;
}

export interface SupplierListFilter {
  tenantId: string | null;
  search?: string;
  page: number;
  limit: number;
}

export interface SupplierListResult {
  items: Supplier[];
  total: number;
  page: number;
  limit: number;
}

export interface ISupplierRepository {
  create(input: SupplierCreateInput): Promise<Supplier>;
  update(id: string, input: SupplierUpdateInput): Promise<Supplier>;
  findById(id: string): Promise<Supplier | null>;
  findByCode(code: string): Promise<Supplier | null>;
  findByNpwp(tenantId: string | null, npwp: string): Promise<Supplier | null>;
  list(filter: SupplierListFilter): Promise<SupplierListResult>;
  delete(id: string): Promise<void>;
}
