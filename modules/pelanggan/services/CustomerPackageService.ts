import { DiscountType } from "@prisma/client";
import { PelangganRepository } from "../repositories/PelangganRepository";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const DEFAULT_UPGRADE_LIMIT = 5;

interface PackageBillingSummary {
  basePrice: number;
  discountAmount: number;
  afterDiscount: number;
  ppnAmount: number;
  totalPrice: number;
}

interface CustomerPackageViewModel {
  package: {
    id: string;
    nama: string;
    harga: number;
    durasi: number;
    durasiUnit: string;
    usePPN: boolean;
    ppnPercentage: number | null;
    useDiscount: boolean;
    discountType: DiscountType | null;
    discountValue: number | null;
    bandwidth: {
      nama: string;
      download: string | null;
      upload: string | null;
      downloadSpeed: number | null;
      uploadSpeed: number | null;
    } | null;
    isFeatured: boolean;
  };
  subscription: {
    tanggalAktif: Date;
    jatuhTempo: Date;
    status: string;
    daysUntilDue: number;
  };
  billing: PackageBillingSummary;
  upgradeOptions: Array<{
    id: string;
    nama: string;
    harga: number;
    priceDifference: number;
    bandwidth: {
      nama: string;
      download: string | null;
      upload: string | null;
    } | null;
  }>;
}

function calculateBillingSummary(params: {
  basePrice: number;
  useDiscount: boolean;
  discountType: DiscountType | null;
  discountValue: number | null;
  usePPN: boolean;
  ppnPercentage: number | null;
}): PackageBillingSummary {
  const discountAmount = getDiscountAmount(params);
  const afterDiscount = params.basePrice - discountAmount;
  const ppnAmount = getPpnAmount(afterDiscount, params);

  return {
    basePrice: params.basePrice,
    discountAmount,
    afterDiscount,
    ppnAmount,
    totalPrice: afterDiscount + ppnAmount,
  };
}

function getDiscountAmount(params: {
  basePrice: number;
  useDiscount: boolean;
  discountType: DiscountType | null;
  discountValue: number | null;
}): number {
  if (!params.useDiscount || !params.discountValue) {
    return 0;
  }

  if (params.discountType === DiscountType.PERCENT) {
    return Math.round(params.basePrice * (params.discountValue / 100));
  }

  return params.discountValue;
}

function getPpnAmount(
  amountAfterDiscount: number,
  params: { usePPN: boolean; ppnPercentage: number | null },
): number {
  if (!params.usePPN || !params.ppnPercentage) {
    return 0;
  }

  return Math.round(amountAfterDiscount * (params.ppnPercentage / 100));
}

function calculateDaysUntilDue(dueDate: Date): number {
  return Math.ceil(
    (new Date(dueDate).getTime() - Date.now()) / DAY_IN_MILLISECONDS,
  );
}

export class CustomerPackageService {
  private pelangganRepository = new PelangganRepository();

  /**
   * Get customer package detail, billing summary, and upgrade options.
   */
  async getCustomerPackage(
    customerId: string,
  ): Promise<CustomerPackageViewModel> {
    const customer =
      await this.pelangganRepository.findByIdWithPackage(customerId);
    if (!customer) {
      throw new Error("CUSTOMER_NOT_FOUND");
    }

    if (!customer.hargaPaket) {
      throw new Error("PACKAGE_NOT_FOUND");
    }

    const paket = customer.hargaPaket;
    const billing = calculateBillingSummary({
      basePrice: paket.harga,
      useDiscount: paket.useDiscount,
      discountType: paket.discountType,
      discountValue: paket.discountValue,
      usePPN: paket.usePPN,
      ppnPercentage: paket.ppnPercentage,
    });
    const upgradeOptions =
      await this.pelangganRepository.findUpgradePackageOptions(
        paket.harga,
        DEFAULT_UPGRADE_LIMIT,
      );

    return {
      package: {
        id: paket.id,
        nama: paket.name,
        harga: paket.harga,
        durasi: paket.durasi,
        durasiUnit: paket.durasiUnit,
        usePPN: paket.usePPN,
        ppnPercentage: paket.ppnPercentage,
        useDiscount: paket.useDiscount,
        discountType: paket.discountType,
        discountValue: paket.discountValue,
        bandwidth: paket.bandwidth
          ? {
              nama: paket.bandwidth.name,
              download: paket.bandwidth.maxLimitDownload,
              upload: paket.bandwidth.maxLimitUpload,
              downloadSpeed: paket.bandwidth.downloadSpeed,
              uploadSpeed: paket.bandwidth.uploadSpeed,
            }
          : null,
        isFeatured: paket.featured,
      },
      subscription: {
        tanggalAktif: customer.tanggalAktif,
        jatuhTempo: customer.jatuhTempo,
        status: customer.status,
        daysUntilDue: calculateDaysUntilDue(customer.jatuhTempo),
      },
      billing,
      upgradeOptions: upgradeOptions.map((upgradePackage) => ({
        id: upgradePackage.id,
        nama: upgradePackage.name,
        harga: upgradePackage.harga,
        priceDifference: upgradePackage.harga - paket.harga,
        bandwidth: upgradePackage.bandwidth
          ? {
              nama: upgradePackage.bandwidth.name,
              download: upgradePackage.bandwidth.maxLimitDownload,
              upload: upgradePackage.bandwidth.maxLimitUpload,
            }
          : null,
      })),
    };
  }
}

let customerPackageServiceInstance: CustomerPackageService | null = null;

/**
 * Get singleton customer package service instance.
 */
export function getCustomerPackageService(): CustomerPackageService {
  if (!customerPackageServiceInstance) {
    customerPackageServiceInstance = new CustomerPackageService();
  }

  return customerPackageServiceInstance;
}
