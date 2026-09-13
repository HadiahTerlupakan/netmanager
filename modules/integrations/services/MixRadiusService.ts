import { MixRadiusOwnerGroupFacadeService } from "./MixRadiusOwnerGroupFacadeService";
import {
  createCustomersCacheState,
  createInvoiceCountCache,
  createTopologyCacheState,
  MIXRADIUS_CUSTOMERS_CACHE_TTL,
} from "./mixradius-service.config";
import {
  buildMixRadiusBaseClientParams,
  type MixRadiusBaseClientParams,
} from "./mixradius-service.client";
import {
  applySessionState,
  buildSessionState,
  createMixRadiusSessionSnapshot,
  expireSession,
  resetCookieSession,
  resetHttpSession,
  type MixRadiusSessionSnapshot,
} from "./mixradius-service.session";
import {
  deleteIncomeRecordOperation,
  fetchActiveSessionsPPPOperation,
  fetchCustomersPPPOperation,
  fetchCustomerDetailOperation,
  fetchIncomeByPeriodOperation,
  fetchIncomeSummaryOperation,
  fetchInvoiceCountsOperation,
  fetchODPCustomersOperation,
  fetchODPListOperation,
  fetchProfitReportOperation,
  fetchTopologyDataOperation,
  getOwnersWithIdsOperation,
  getPrintInvoiceHtmlOperation,
  getUniqueOwnersOperation,
} from "./mixradius-service.operations";
import {
  loadMixRadiusCredentials,
  loginMixRadius,
} from "./mixradius-auth-client";
import type {
  FetchCustomersParams,
  MixRadiusCredentials,
  MixRadiusCustomerDetail,
  MixRadiusCustomerResponse,
  MixRadiusIncomePeriodResponse,
  MixRadiusIncomeSummary,
  MixRadiusODP,
  MixRadiusODPCustomer,
  MixRadiusOwner,
  MixRadiusTopologyData,
} from "./mixradius-types";

const DEFAULT_MIN_DELAY_IN_MS = 300;
const DEFAULT_MAX_DELAY_IN_MS = 800;

export type {
  FetchCustomersParams,
  MixRadiusCredentials,
  MixRadiusCustomer,
  MixRadiusCustomerDetail,
  MixRadiusCustomerResponse,
  MixRadiusIncomePeriodRecord,
  MixRadiusIncomePeriodResponse,
  MixRadiusIncomeSummary,
  MixRadiusInvoice,
  MixRadiusODP,
  MixRadiusODPCustomer,
  MixRadiusOwner,
  MixRadiusTopologyData,
} from "./mixradius-types";

export class MixRadiusService {
  private credentials: MixRadiusCredentials = {
    username: process.env.MIXRADIUS_USERNAME || "",
    password: process.env.MIXRADIUS_PASSWORD || "",
    baseUrl: process.env.MIXRADIUS_URL || "",
  };
  private session: MixRadiusSessionSnapshot = createMixRadiusSessionSnapshot();
  private readonly invoiceCountCache = createInvoiceCountCache();
  private customersCache = createCustomersCacheState();
  private topologyCache = createTopologyCacheState();
  private customersInflight = new Map<
    string,
    Promise<MixRadiusCustomerResponse>
  >();

  /** Delay requests slightly to reduce upstream throttling. */
  private async randomDelay(
    min: number = DEFAULT_MIN_DELAY_IN_MS,
    max: number = DEFAULT_MAX_DELAY_IN_MS,
  ) {
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /** Load the latest MixRadius credentials from configuration. */
  private async loadCredentials() {
    this.credentials = await loadMixRadiusCredentials();
  }

  /** Authenticate to MixRadius and refresh session state when needed. */
  async login(): Promise<void> {
    await this.loadCredentials();
    const nextSession = await loginMixRadius({
      client: this.session.client,
      credentials: this.credentials,
      session: buildSessionState(this.session),
      randomDelay: this.randomDelay.bind(this),
    });
    this.session = applySessionState(this.session, nextSession);
  }

  /** Fetch PPP customers from MixRadius. */
  async fetchCustomersPPP(
    params: FetchCustomersParams = {},
  ): Promise<MixRadiusCustomerResponse> {
    const inflightKey = this.buildCustomersInflightKey(params);
    if (inflightKey) {
      const existing = this.customersInflight.get(inflightKey);
      if (existing) return existing;
    }

    const promise = this.executeFetchCustomersPPP(params);
    if (inflightKey) {
      this.customersInflight.set(inflightKey, promise);
      // `.finally()` menghasilkan promise turunan; tanpa catch, rejection-nya
      // menjadi unhandledRejection walau caller sudah menangani `promise`.
      promise
        .finally(() => this.customersInflight.delete(inflightKey))
        .catch((): void => undefined);
    }

    return promise;
  }

  private buildCustomersInflightKey(
    params: FetchCustomersParams,
  ): string | null {
    if (params.forceRefresh) return null;
    const start = params.start ?? 0;
    const length = params.length ?? 10;
    const search = params.search ?? "";
    return `${start}:${length}:${search}`;
  }

  private async executeFetchCustomersPPP(
    params: FetchCustomersParams = {},
  ): Promise<MixRadiusCustomerResponse> {
    await this.loadCredentials();
    const { result, cache } = await fetchCustomersPPPOperation({
      ...this.buildBaseClientParams(params),
      cache: this.customersCache,
      customersCacheTtl: MIXRADIUS_CUSTOMERS_CACHE_TTL,
      onResetClient: this.resetHttpClient.bind(this),
    });
    this.customersCache = cache;
    return result;
  }

  /** Fetch income rows by period from MixRadius. */
  async fetchIncomeByPeriod(
    params: FetchCustomersParams = {},
  ): Promise<MixRadiusIncomePeriodResponse> {
    await this.loadCredentials();
    return fetchIncomeByPeriodOperation(this.buildBaseClientParams(params));
  }

  /** Fetch summarized income metrics from MixRadius. */
  async fetchIncomeSummary(
    params: FetchCustomersParams = {},
  ): Promise<MixRadiusIncomeSummary> {
    await this.loadCredentials();
    return fetchIncomeSummaryOperation(this.buildBaseClientParams(params));
  }

  /** Fetch MixRadius owners with numeric identifiers. */
  async getOwnersWithIds(): Promise<MixRadiusOwner[]> {
    await this.loadCredentials();
    return getOwnersWithIdsOperation(this.buildBaseClientParams());
  }

  /** Fetch unique owner names from PPP customers. */
  async getUniqueOwners(): Promise<string[]> {
    return getUniqueOwnersOperation({
      fetchCustomersPPP: async (filters) => this.fetchCustomersPPP(filters),
    });
  }

  /** Delete an income record in MixRadius. */
  async deleteIncomeRecord(id: string): Promise<boolean> {
    await this.loadCredentials();
    return deleteIncomeRecordOperation({ ...this.buildBaseClientParams(), id });
  }

  /** Retrieve invoice print HTML from MixRadius. */
  async getPrintInvoiceHtml(
    id: string,
    type: "standard" | "thermal" = "standard",
  ): Promise<string> {
    await this.loadCredentials();
    return getPrintInvoiceHtmlOperation({
      ...this.buildBaseClientParams(),
      id,
      type,
    });
  }

  /** Fetch active PPP sessions keyed by username. */
  async fetchActiveSessionsPPP(
    search: string = "",
  ): Promise<Map<string, { ip: string; uptime: string }>> {
    await this.loadCredentials();
    return fetchActiveSessionsPPPOperation({
      ...this.buildBaseClientParams(),
      search,
    });
  }

  /** Fetch cached invoice counts for customer IDs. */
  async fetchInvoiceCounts(
    customerIds: string[],
    bypassCache: boolean = false,
    validationData: Record<string, string> = {},
  ): Promise<Map<string, { paidCount: number; totalCount: number }>> {
    return fetchInvoiceCountsOperation({
      customerIds,
      bypassCache,
      validationData,
      invoiceCountCache: this.invoiceCountCache,
      randomDelay: this.randomDelay.bind(this),
      login: this.login.bind(this),
      fetchCustomerDetail: this.fetchCustomerDetail.bind(this),
    });
  }

  /** Fetch a detailed customer page from MixRadius. */
  async fetchCustomerDetail(
    customerId: string,
  ): Promise<MixRadiusCustomerDetail> {
    await this.loadCredentials();
    return fetchCustomerDetailOperation({
      ...this.buildBaseClientParams(),
      customerId,
      fetchCustomersPPP: this.fetchCustomersPPP.bind(this),
    });
  }

  /** Clear MixRadius login session and in-memory caches. */
  async clearSession(): Promise<void> {
    this.handleSessionExpired();
    this.customersCache = createCustomersCacheState();
    this.session = resetCookieSession(this.session);
  }

  /** Check whether the current MixRadius session is still valid. */
  isSessionValid(): boolean {
    return this.session.isLoggedIn && this.session.loginExpiresAt > Date.now();
  }

  /** Fetch MixRadius ODP list. */
  async fetchODPList(): Promise<MixRadiusODP[]> {
    await this.loadCredentials();
    return fetchODPListOperation({
      ...this.buildBaseClientParams(),
      onRetry: () => this.fetchODPList(),
    });
  }

  /** Fetch customers attached to an ODP. */
  async fetchODPCustomers(odpId: string): Promise<MixRadiusODPCustomer[]> {
    await this.loadCredentials();
    return fetchODPCustomersOperation({
      ...this.buildBaseClientParams(),
      odpId,
      onRetry: () => this.fetchODPCustomers(odpId),
    });
  }

  /** Clear cached topology data. */
  clearTopologyCache(): void {
    this.topologyCache = createTopologyCacheState();
  }

  /** Fetch topology data for MixRadius ODP mapping. */
  async fetchTopologyData(options?: {
    ownerName?: string;
    forceRefresh?: boolean;
  }): Promise<MixRadiusTopologyData> {
    const { result, cache } = await fetchTopologyDataOperation({
      ownerName: options?.ownerName,
      forceRefresh: options?.forceRefresh,
      cache: this.topologyCache,
      fetchODPList: this.fetchODPList.bind(this),
      fetchODPCustomers: this.fetchODPCustomers.bind(this),
      randomDelay: this.randomDelay.bind(this),
    });
    this.topologyCache = cache;
    return result;
  }

  /** Fetch yearly profit arrays from MixRadius. */
  async fetchProfitReport(_groupId?: string): Promise<{
    income: number[];
    transactions: number[];
    sellerFees: number[];
    taxes: number[];
  }> {
    await this.loadCredentials();
    return fetchProfitReportOperation(this.buildBaseClientParams());
  }

  private buildBaseClientParams(
    filters?: FetchCustomersParams,
  ): MixRadiusBaseClientParams {
    return buildMixRadiusBaseClientParams({
      client: this.session.client,
      baseUrl: this.credentials.baseUrl,
      login: this.login.bind(this),
      onSessionExpired: this.handleSessionExpired.bind(this),
      randomDelay: this.randomDelay.bind(this),
      filters,
    });
  }

  private handleSessionExpired() {
    this.session = expireSession(this.session);
  }

  private resetHttpClient() {
    this.session = resetHttpSession(this.session);
  }
}

let mixRadiusServiceInstance: MixRadiusService | null = null;

/** Get singleton MixRadius service. */
export function getMixRadiusService(): MixRadiusService {
  if (!mixRadiusServiceInstance) {
    mixRadiusServiceInstance = new MixRadiusService();
  }
  return mixRadiusServiceInstance;
}

export const getMixRadiusOwnerGroupFacadeService = () =>
  new MixRadiusOwnerGroupFacadeService();

export { MixRadiusConfigError } from "./mixradius-types";
