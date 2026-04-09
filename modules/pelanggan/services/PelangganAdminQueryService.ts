import { prisma } from "@/modules/database";
import { CustomerUsageService } from "./CustomerUsageService";

export type PppTechnicalInfo = Awaited<
  ReturnType<CustomerUsageService["getTechnicalInfo"]>
>;

const customerUsageService = new CustomerUsageService();

const sanitizePelangganResponse = <
  T extends { password?: string | null; passwordHash?: string | null },
>(
  pelanggan: T,
): Omit<T, "password" | "passwordHash"> => {
  const {
    password: _password,
    passwordHash: _passwordHash,
    ...safePelanggan
  } = pelanggan;
  return safePelanggan;
};

export class PelangganAdminQueryService {
  async getPppDetail(id: string, tenantId?: string | null) {
    const pelanggan = await prisma.pelanggan.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      include: {
        hargaPaket: {
          include: {
            profilePPP: {
              include: {
                mikroTikRouter: true,
              },
            },
            bandwidth: true,
          },
        },
        odp: {
          select: {
            name: true,
            location: true,
          },
        },
      },
    });

    if (!pelanggan) return null;

    const technicalInfo = await customerUsageService.getTechnicalInfo({
      username: pelanggan.username,
      tenantId: pelanggan.tenantId,
      packageRouterName: pelanggan.hargaPaket?.profilePPP?.mikroTikRouter?.name,
      odpName: pelanggan.odp?.name,
      odpLocation: pelanggan.odp?.location,
    });

    return { pelanggan: sanitizePelangganResponse(pelanggan), technicalInfo };
  }

  async getPppMutationContext(id: string, tenantId?: string | null) {
    return prisma.pelanggan.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      select: {
        id: true,
        username: true,
        status: true,
        siteId: true,
        nama: true,
      },
    });
  }
}
