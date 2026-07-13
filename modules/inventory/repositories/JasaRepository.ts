import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const JASA_INCLUDE = {
  supplier: { select: { id: true, name: true, code: true } },
} as const satisfies Prisma.JasaInclude;

export type JasaWithSupplier = Prisma.JasaGetPayload<{
  include: typeof JASA_INCLUDE;
}>;

export interface FindManyJasaParams {
  tenantId?: string | null;
  search?: string;
  status?: string;
  supplierId?: string;
  page?: number;
  limit?: number;
}

export interface CreateJasaInput {
  id?: string;
  kode: string;
  nama: string;
  satuan?: string;
  supplierId?: string | null;
  hargaEstimasi?: number;
  kategoriPph?: string | null;
  deskripsi?: string | null;
  status?: string;
  tenantId?: string | null;
}

export interface UpdateJasaInput {
  kode?: string;
  nama?: string;
  satuan?: string;
  supplierId?: string | null;
  hargaEstimasi?: number;
  kategoriPph?: string | null;
  deskripsi?: string | null;
  status?: string;
}

/** Repository master Jasa: CRUD + query dengan filter tenantId. */
export class JasaRepository {
  private readonly db: typeof prisma = prisma;

  async findMany(params: FindManyJasaParams) {
    const {
      tenantId,
      search,
      status,
      supplierId,
      page = 1,
      limit = 10,
    } = params;
    const where: Prisma.JasaWhereInput = { tenantId: tenantId ?? undefined };
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;
    if (search?.trim()) {
      where.OR = [
        { nama: { contains: search.trim(), mode: "insensitive" } },
        { kode: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    const take = limit <= 0 ? 10 : limit;
    const skip = Math.max(0, (page - 1) * take);
    const [items, total] = await Promise.all([
      this.db.jasa.findMany({
        where,
        include: JASA_INCLUDE,
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      this.db.jasa.count({ where }),
    ]);

    return { items, total, page, limit: take };
  }

  async findById(id: string, tenantId?: string | null) {
    return this.db.jasa.findFirst({
      where: { id, tenantId: tenantId ?? undefined },
      include: JASA_INCLUDE,
    });
  }

  async findByKode(kode: string, tenantId?: string | null) {
    return this.db.jasa.findFirst({
      where: { kode, tenantId: tenantId ?? undefined },
    });
  }

  async create(input: CreateJasaInput) {
    return this.db.jasa.create({
      data: {
        id: input.id ?? crypto.randomUUID(),
        kode: input.kode,
        nama: input.nama,
        satuan: input.satuan ?? "job",
        supplierId: input.supplierId ?? null,
        hargaEstimasi: input.hargaEstimasi ?? 0,
        kategoriPph: input.kategoriPph ?? null,
        deskripsi: input.deskripsi ?? null,
        status: input.status ?? "ACTIVE",
        tenantId: input.tenantId ?? null,
      },
      include: JASA_INCLUDE,
    });
  }

  async update(id: string, input: UpdateJasaInput, tenantId?: string | null) {
    const existing = await this.findById(id, tenantId);
    if (!existing) return null;

    return this.db.jasa.update({
      where: { id },
      data: {
        ...(input.kode !== undefined && { kode: input.kode }),
        ...(input.nama !== undefined && { nama: input.nama }),
        ...(input.satuan !== undefined && { satuan: input.satuan }),
        ...(input.supplierId !== undefined && { supplierId: input.supplierId }),
        ...(input.hargaEstimasi !== undefined && {
          hargaEstimasi: input.hargaEstimasi,
        }),
        ...(input.kategoriPph !== undefined && {
          kategoriPph: input.kategoriPph,
        }),
        ...(input.deskripsi !== undefined && { deskripsi: input.deskripsi }),
        ...(input.status !== undefined && { status: input.status }),
      },
      include: JASA_INCLUDE,
    });
  }

  async softDelete(id: string, tenantId?: string | null) {
    const existing = await this.findById(id, tenantId);
    if (!existing) return null;
    return this.db.jasa.update({
      where: { id },
      data: { status: "INACTIVE" },
      include: JASA_INCLUDE,
    });
  }
}

let jasaRepositoryInstance: JasaRepository | null = null;

export function getJasaRepository(): JasaRepository {
  if (!jasaRepositoryInstance) jasaRepositoryInstance = new JasaRepository();
  return jasaRepositoryInstance;
}
