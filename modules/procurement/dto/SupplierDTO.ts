import type { Supplier } from "../domain/entities/Supplier";

export interface SupplierDTO {
  id: string;
  code: string;
  name: string;
  address: string | null;
  contact: string | null;
  email: string | null;
  phone: string | null;
  npwp: string | null;
  defaultPphCategory: string | null;
  tenantId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierListResponseDTO {
  items: SupplierDTO[];
  total: number;
  page: number;
  limit: number;
}

export function toSupplierDTO(supplier: Supplier): SupplierDTO {
  return {
    id: supplier.id,
    code: supplier.code,
    name: supplier.name,
    address: supplier.address,
    contact: supplier.contact,
    email: supplier.email,
    phone: supplier.phone,
    npwp: supplier.npwp,
    defaultPphCategory: supplier.defaultPphCategory,
    tenantId: supplier.tenantId,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
  };
}
