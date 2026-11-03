import { vi } from "vitest";

import type {
  ResellerEntity,
  ResellerOutletEntity,
} from "@/modules/reseller/domain/entities/ResellerEntity";
import type { IResellerRepository } from "@/modules/reseller/domain/ports/IResellerRepository";

const FIXED_DATE = new Date("2026-07-08T00:00:00.000Z");

/** Port repository reseller dengan setiap method sebagai `vi.fn()`. */
export function createResellerRepositoryMock(): IResellerRepository {
  return {
    findByCode: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    findOutletById: vi.fn(),
    findOutletByCode: vi.fn(),
    findOutletsByResellerId: vi.fn(),
    createOutlet: vi.fn(),
    updateOutlet: vi.fn(),
    softDeleteOutlet: vi.fn(),
    findActivePackagePrice: vi.fn(),
    findBasePackagePrice: vi.fn(),
    findPackagePricesByResellerId: vi.fn(),
    upsertPackagePrice: vi.fn(),
  };
}

/** Reseller aktif tenant-1; field bisa ditimpa. */
export function buildReseller(
  overrides: Partial<ResellerEntity> = {},
): ResellerEntity {
  return {
    id: "reseller-1",
    tenantId: "tenant-1",
    code: "RSL-001",
    name: "Reseller Satu",
    email: null,
    phone: null,
    address: null,
    status: "ACTIVE",
    notes: null,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    deletedAt: null,
    ...overrides,
  };
}

/** Outlet aktif milik reseller-1; field bisa ditimpa. */
export function buildOutlet(
  overrides: Partial<ResellerOutletEntity> = {},
): ResellerOutletEntity {
  return {
    id: "outlet-1",
    tenantId: "tenant-1",
    resellerId: "reseller-1",
    code: "OUT-001",
    name: "Outlet Pusat",
    phone: null,
    address: null,
    status: "ACTIVE",
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    deletedAt: null,
    ...overrides,
  };
}
