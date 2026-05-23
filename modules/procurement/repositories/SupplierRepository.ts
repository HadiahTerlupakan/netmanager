import { prisma } from "@/lib/prisma";
import type {
  Supplier,
  SupplierPphCategory,
} from "../domain/entities/Supplier";
import type {
  ISupplierRepository,
  SupplierCreateInput,
  SupplierListFilter,
  SupplierListResult,
  SupplierUpdateInput,
} from "../domain/ports/ISupplierRepository";

interface SupplierRow {
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
  createdAt: Date;
  updatedAt: Date;
}

function toDomain(row: SupplierRow): Supplier {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    address: row.address,
    contact: row.contact,
    email: row.email,
    phone: row.phone,
    npwp: row.npwp,
    defaultPphCategory:
      (row.defaultPphCategory as SupplierPphCategory | null) ?? null,
    tenantId: row.tenantId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class SupplierRepository implements ISupplierRepository {
  async create(input: SupplierCreateInput): Promise<Supplier> {
    const row = await prisma.supplier.create({
      data: {
        code: input.code,
        name: input.name,
        address: input.address ?? null,
        contact: input.contact ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        npwp: input.npwp ?? null,
        defaultPphCategory: input.defaultPphCategory ?? null,
        tenantId: input.tenantId,
      },
    });
    return toDomain(row);
  }

  async update(id: string, input: SupplierUpdateInput): Promise<Supplier> {
    const row = await prisma.supplier.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.address !== undefined && { address: input.address }),
        ...(input.contact !== undefined && { contact: input.contact }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.npwp !== undefined && { npwp: input.npwp }),
        ...(input.defaultPphCategory !== undefined && {
          defaultPphCategory: input.defaultPphCategory,
        }),
      },
    });
    return toDomain(row);
  }

  async findById(id: string): Promise<Supplier | null> {
    const row = await prisma.supplier.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByCode(code: string): Promise<Supplier | null> {
    const row = await prisma.supplier.findUnique({ where: { code } });
    return row ? toDomain(row) : null;
  }

  async findByNpwp(
    tenantId: string | null,
    npwp: string,
  ): Promise<Supplier | null> {
    const row = await prisma.supplier.findFirst({
      where: { tenantId, npwp },
    });
    return row ? toDomain(row) : null;
  }

  async list(filter: SupplierListFilter): Promise<SupplierListResult> {
    const where: Record<string, unknown> = { tenantId: filter.tenantId };
    if (filter.search) {
      where.OR = [
        { code: { contains: filter.search, mode: "insensitive" } },
        { name: { contains: filter.search, mode: "insensitive" } },
        { npwp: { contains: filter.search } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      prisma.supplier.count({ where }),
    ]);

    return {
      items: rows.map(toDomain),
      total,
      page: filter.page,
      limit: filter.limit,
    };
  }

  async delete(id: string): Promise<void> {
    await prisma.supplier.delete({ where: { id } });
  }
}
