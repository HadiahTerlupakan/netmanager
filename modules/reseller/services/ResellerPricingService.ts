import type {
  ResellerPackagePriceDTO,
  ResolvedPackagePriceDTO,
} from "../dto/reseller.dto";
import { ResellerMapper } from "../mappers/ResellerMapper";
import type { IResellerRepository } from "../domain/ports/IResellerRepository";
import {
  ResellerNotFoundError,
  ResellerValidationError,
} from "../errors/reseller-errors";
import { ResellerRepository } from "../repositories/ResellerRepository";

const PACKAGE_NOT_FOUND_MESSAGE = "Harga Paket tidak ditemukan";

/**
 * Pesan 410 untuk tulis harga khusus reseller. Model agen (PM 5/2021 Ps
 * 223(2)b.3): tagihan pelanggan reseller selalu memakai harga paket ISP dan
 * seluruh pendapatan dibukukan ISP; reseller dibayar lewat komisi.
 */
export const RESELLER_PACKAGE_PRICE_DEPRECATED_MESSAGE =
  "Harga khusus reseller sudah tidak dipakai. Pelanggan reseller selalu ditagih " +
  "dengan harga paket ISP dan seluruh pendapatan dibukukan ISP; imbalan reseller " +
  "diatur lewat komisi.";

/**
 * @deprecated Harga khusus reseller tidak sesuai model agen; data lama hanya
 * bisa dibaca (`listPackagePrices`). Tabel `ResellerPackagePrice` tidak
 * di-drop. Jangan sambungkan ke penagihan.
 */
export class ResellerPricingService {
  constructor(
    private readonly repository: IResellerRepository = new ResellerRepository(),
  ) {}

  /** List package price overrides for a reseller. */
  async listPackagePrices(
    tenantId: string,
    resellerId: string,
  ): Promise<readonly ResellerPackagePriceDTO[]> {
    const prices = await this.repository.findPackagePricesByResellerId(
      tenantId,
      resellerId,
    );
    return prices.map(ResellerMapper.toPackagePriceDTO);
  }

  /**
   * Create package price override for a reseller. Paket wajib milik tenant
   * yang sama: FK `hargaPaketId` global, jadi tanpa pemeriksaan ini id paket
   * tenant lain diterima dan id yang tidak ada berakhir 500 (P2003).
   */
  async upsertPackagePrice(input: {
    readonly tenantId: string;
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
      throw new ResellerNotFoundError();
    }
    const basePrice = await this.repository.findBasePackagePrice(
      input.tenantId,
      input.hargaPaketId,
    );
    if (basePrice === null) {
      throw new ResellerValidationError(PACKAGE_NOT_FOUND_MESSAGE);
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
      throw new ResellerNotFoundError(PACKAGE_NOT_FOUND_MESSAGE);
    }
    return { price: basePrice, source: "BASE_PACKAGE", priceId: null };
  }
}

let resellerPricingService: ResellerPricingService | null = null;

/**
 * Get singleton reseller pricing service.
 * @deprecated Hanya untuk membaca data harga khusus lama.
 */
export function getResellerPricingService(): ResellerPricingService {
  if (!resellerPricingService) {
    resellerPricingService = new ResellerPricingService();
  }
  return resellerPricingService;
}
