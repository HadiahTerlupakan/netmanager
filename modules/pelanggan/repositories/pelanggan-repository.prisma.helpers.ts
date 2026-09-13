import { prisma } from "@/lib/prisma";
import type { CreatePelangganDTO, FilterOptions } from "./PelangganRepository";
import { PelangganMapper } from "../mappers/PelangganMapper";
import { pelangganWithPackageInclude } from "./pelanggan-repository.constants";
import {
  buildCreatePelangganArgs,
  buildPelangganWhereClause,
} from "./pelanggan-repository.helpers";

export async function findCustomerBillingAccess(input: {
  pelangganId: string;
  tenantId?: string | null;
}) {
  return prisma.pelanggan.findFirst({
    where: {
      id: input.pelangganId,
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
    },
    select: { id: true, siteId: true },
  });
}

export async function findAllPelanggan(filter?: FilterOptions) {
  const where = buildPelangganWhereClause(filter);
  const pelanggan = await prisma.pelanggan.findMany({
    where,
    include: pelangganWithPackageInclude,
    orderBy: { createdAt: "desc" },
  });

  return pelanggan.map((item) => PelangganMapper.toDomainWithPackage(item));
}

export async function findAllPaginatedPelanggan(
  filter?: FilterOptions,
  page: number = 1,
  limit: number = 10,
) {
  const where = buildPelangganWhereClause(filter);
  const [data, total] = await Promise.all([
    prisma.pelanggan.findMany({
      where,
      include: pelangganWithPackageInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.pelanggan.count({ where }),
  ]);

  return {
    data: data.map((item) => PelangganMapper.toDomainWithPackage(item)),
    total,
  };
}

export async function findPelangganById(id: string) {
  const pelanggan = await prisma.pelanggan.findUnique({ where: { id } });
  return pelanggan ? PelangganMapper.toDomain(pelanggan) : null;
}

export async function findPelangganByIdPelanggan(idPelanggan: string) {
  const pelanggan = await prisma.pelanggan.findFirst({
    where: { idPelanggan },
  });
  return pelanggan ? PelangganMapper.toDomain(pelanggan) : null;
}

export async function findPelangganByUsername(username: string) {
  const pelanggan = await prisma.pelanggan.findFirst({ where: { username } });
  return pelanggan ? PelangganMapper.toDomain(pelanggan) : null;
}

export async function createPelanggan(data: CreatePelangganDTO) {
  const pelanggan = await prisma.pelanggan.create(
    buildCreatePelangganArgs(data),
  );
  return PelangganMapper.toDomainWithPackage(pelanggan);
}

export async function updatePelanggan(
  id: string,
  data: Partial<CreatePelangganDTO>,
) {
  const pelanggan = await prisma.pelanggan.update({
    where: { id },
    data,
  });

  return PelangganMapper.toDomain(pelanggan);
}

export async function deletePelanggan(id: string) {
  const pelanggan = await prisma.pelanggan.delete({ where: { id } });
  return PelangganMapper.toDomain(pelanggan);
}

export async function checkHargaPaketExists(id: string): Promise<boolean> {
  const hargaPaket = await prisma.hargaPaket.findUnique({ where: { id } });
  return hargaPaket !== null;
}

export async function findPelangganByIdWithPackage(id: string) {
  const pelanggan = await prisma.pelanggan.findUnique({
    where: { id },
    include: {
      site: true,
      pendingPackage: true,
      hargaPaket: {
        include: {
          bandwidth: true,
        },
      },
    },
  });

  return pelanggan ? PelangganMapper.toDomainWithPackage(pelanggan) : null;
}

export async function findPelangganByIdWithHargaPaket(id: string) {
  const pelanggan = await prisma.pelanggan.findUnique({
    where: { id },
    include: { hargaPaket: true },
  });

  return pelanggan ? PelangganMapper.toDomainWithPackage(pelanggan) : null;
}
