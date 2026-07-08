import type {
  ResellerPackagePriceDTO,
  ResolvedPackagePriceDTO,
} from "../dto/reseller.dto";
import { ResellerMapper } from "../mappers/ResellerMapper";
import type { IResellerRepository } from "../domain/ports/IResellerRepository";
import { ResellerRepository } from "../repositories/ResellerRepository";

export class ResellerPricingService {
  constructor(
    private readonly repository: IResellerRepository = new ResellerRepository(),
  ) {}

  /** List package price overrides for a reseller. */
  async listPackagePrices(
    tenantId: string | null,
    resellerId: string,
  ): Promise<readonly ResellerPackagePriceDTO[]> {
    const prices = await this.repository.findPackagePricesByResellerId(
      tenantId,
      resellerId,
    );
    return prices.map(ResellerMapper.toPackagePriceDTO);
  }

  /** Create package price override for a reseller. */
  async upsertPackagePrice(input: {
    readonly tenantId: string | null;
    readonly resellerId: string;
    readonly hargaPaketId: string;
    readonly price: number;
    readonly startsAt?: Date;
    readonly endsAt?: Date | null;
  }): Promise<ResellerPackagePriceDTO> {
    const reseller = await this.repository.findById(
      input.tenantId,
      input.resellerId,
    );
    if (!reseller) {
      throw new Error("Reseller tidak ditemukan");
    }
    const price = await this.repository.upsertPackagePrice(input);
    return ResellerMapper.toPackagePriceDTO(price);
  }

  /** Resolve effective package price for reseller customer. */
  async resolvePackagePrice(input: {
    readonly tenantId: string | null;
    readonly resellerId?: string | null;
    readonly hargaPaketId: string;
    readonly at?: Date;
  }): Promise<ResolvedPackagePriceDTO> {
    const at = input.at ?? new Date();
    if (input.resellerId) {
      const override = await this.repository.findActivePackagePrice({
        tenantId: input.tenantId,
        resellerId: input.resellerId,
        hargaPaketId: input.hargaPaketId,
        at,
      });
      if (override) {
        return {
          price: override.price,
          source: "RESELLER_OVERRIDE",
          priceId: override.id,
        };
      }
    }

    const basePrice = await this.repository.findBasePackagePrice(
      input.tenantId,
      input.hargaPaketId,
    );
    if (basePrice === null) {
      throw new Error("Harga Paket tidak ditemukan");
    }
    return { price: basePrice, source: "BASE_PACKAGE", priceId: null };
  }
}

let resellerPricingService: ResellerPricingService | null = null;

/** Get singleton reseller pricing service. */
export function getResellerPricingService(): ResellerPricingService {
  if (!resellerPricingService) {
    resellerPricingService = new ResellerPricingService();
  }
  return resellerPricingService;
}
