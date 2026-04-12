import { CustomerPortalService } from "../CustomerPortalService";
import { CustomerUsageService } from "../CustomerUsageService";
import { CustomerInvoiceRepository } from "../../repositories/CustomerInvoiceRepository";
import { mapDashboardSection } from "./customer-dashboard.mapper";
import type {
  CustomerDashboardBillingData,
  CustomerDashboardProfileData,
  CustomerDashboardViewModel,
} from "./customer-dashboard.contracts";

type CustomerDashboardServiceDependencies = {
  portalService: Pick<CustomerPortalService, "getProfile">;
  usageService: Pick<CustomerUsageService, "getUsageData">;
  invoiceRepository: Pick<
    CustomerInvoiceRepository,
    "getDashboardBillingSummary"
  >;
};

const DEFAULT_PROFILE_ERROR = "Gagal memuat profil pelanggan";
const DEFAULT_CONNECTION_ERROR = "Gagal memuat koneksi pelanggan";
const DEFAULT_BILLING_ERROR = "Gagal memuat ringkasan tagihan pelanggan";

export class CustomerDashboardService {
  private readonly portalService: Pick<CustomerPortalService, "getProfile">;
  private readonly usageService: Pick<CustomerUsageService, "getUsageData">;
  private readonly invoiceRepository: Pick<
    CustomerInvoiceRepository,
    "getDashboardBillingSummary"
  >;

  constructor(
    dependencies: Partial<CustomerDashboardServiceDependencies> = {},
  ) {
    this.portalService =
      dependencies.portalService ?? new CustomerPortalService();
    this.usageService = dependencies.usageService ?? new CustomerUsageService();
    this.invoiceRepository =
      dependencies.invoiceRepository ?? new CustomerInvoiceRepository();
  }

  /**
   * Get dashboard data for customer portal.
   */
  async getDashboardData(input: {
    customerId: string;
  }): Promise<CustomerDashboardViewModel> {
    const [profileResult, usageResult, billingResult] =
      await Promise.allSettled([
        this.portalService.getProfile(input.customerId),
        this.usageService.getUsageData(input.customerId),
        this.invoiceRepository.getDashboardBillingSummary(input.customerId),
      ]);

    return {
      profile: mapDashboardSection<CustomerDashboardProfileData>(
        profileResult,
        DEFAULT_PROFILE_ERROR,
      ),
      connection: this.mapConnectionSection(usageResult),
      billing: mapDashboardSection<CustomerDashboardBillingData>(
        billingResult,
        DEFAULT_BILLING_ERROR,
      ),
    };
  }

  private mapConnectionSection(
    result: PromiseSettledResult<
      Awaited<ReturnType<CustomerUsageService["getUsageData"]>>
    >,
  ): CustomerDashboardViewModel["connection"] {
    if (result.status === "fulfilled") {
      return {
        state: "ready",
        data: result.value.connection,
      };
    }

    return {
      state: "error",
      data: null,
      message:
        result.reason instanceof Error
          ? result.reason.message
          : DEFAULT_CONNECTION_ERROR,
    };
  }
}
