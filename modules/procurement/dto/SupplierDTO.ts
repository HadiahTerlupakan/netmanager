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
  status: string;
  blacklistReason: string | null;
  siupNumber: string | null;
  siupDocumentUrl: string | null;
  npwpDocumentUrl: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  contractDocumentUrl: string | null;
  contractExpiresAt: string | null;
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
    status: supplier.status,
    blacklistReason: supplier.blacklistReason,
    siupNumber: supplier.siupNumber,
    siupDocumentUrl: supplier.siupDocumentUrl,
    npwpDocumentUrl: supplier.npwpDocumentUrl,
    bankName: supplier.bankName,
    bankAccountNumber: supplier.bankAccountNumber,
    bankAccountHolder: supplier.bankAccountHolder,
    contractDocumentUrl: supplier.contractDocumentUrl,
    contractExpiresAt: supplier.contractExpiresAt
      ? supplier.contractExpiresAt.toISOString()
      : null,
    tenantId: supplier.tenantId,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
  };
}
