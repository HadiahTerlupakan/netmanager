import { CustomerUsageService } from "./CustomerUsageService";
import { PelangganRepository } from "../repositories/PelangganRepository";

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
  private readonly pelangganRepository = new PelangganRepository();

  /** Get detailed PPP customer data for admin view. */
  async getPppDetail(id: string, tenantId?: string | null) {
    const pelanggan = await this.pelangganRepository.findAdminPppDetail(
      id,
      tenantId,
    );

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

  /** Get minimal PPP customer context for admin mutation flow. */
  async getPppMutationContext(id: string, tenantId?: string | null) {
    return this.pelangganRepository.findAdminMutationContext(id, tenantId);
  }
}
