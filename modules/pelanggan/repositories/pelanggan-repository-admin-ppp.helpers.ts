import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PelangganMapper } from "../mappers/PelangganMapper";
import {
  adminDeleteSelect,
  adminMutationContextSelect,
  adminMutationSelect,
} from "./pelanggan-repository.constants";

/** Get customer data needed for admin PPP mutation flow. */
export function findForAdminMutation(id: string, tenantId?: string | null) {
  return prisma.pelanggan.findFirst({
    where: tenantId ? { id, tenantId } : { id },
    select: adminMutationSelect,
  });
}

/** Update customer PPP fields from admin mutation flow. */
export async function updateAdminPppById(
  id: string,
  data: Prisma.PelangganUncheckedUpdateInput,
) {
  const pelanggan = await prisma.pelanggan.update({ where: { id }, data });
  return PelangganMapper.toDomain(pelanggan);
}

/** Get customer data needed for admin delete flow. */
export function findForAdminDelete(id: string, tenantId?: string | null) {
  return prisma.pelanggan.findFirst({
    where: tenantId ? { id, tenantId } : { id },
    select: adminDeleteSelect,
  });
}

/** Get customer detail with package and ODP for admin query flow. */
export async function findAdminPppDetail(id: string, tenantId?: string | null) {
  const pelanggan = await prisma.pelanggan.findFirst({
    where: tenantId ? { id, tenantId } : { id },
    include: buildAdminPppDetailInclude(),
  });

  return pelanggan ? PelangganMapper.toDomainWithPackage(pelanggan) : null;
}

/** Get minimal customer context for admin PPP mutation. */
export function findAdminMutationContext(id: string, tenantId?: string | null) {
  return prisma.pelanggan.findFirst({
    where: tenantId ? { id, tenantId } : { id },
    select: adminMutationContextSelect,
  });
}

function buildAdminPppDetailInclude() {
  return {
    hargaPaket: { include: buildHargaPaketInclude() },
    odp: { select: { name: true, location: true } },
  };
}

function buildHargaPaketInclude() {
  return {
    profilePPP: { include: { mikroTikRouter: true } },
    bandwidth: true,
  };
}
