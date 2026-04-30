import type { AxiosInstance } from "axios";
import { CookieJar } from "tough-cookie";

import {
  fetchMixRadiusActiveSessionsPPP,
  fetchMixRadiusCustomerDetail,
  fetchMixRadiusCustomersPPP,
  fetchMixRadiusInvoiceCounts,
  type MixRadiusCustomerCacheState,
} from "./mixradius-customer-client";
import {
  loadMixRadiusCredentials,
  loginMixRadius,
  type MixRadiusSessionState,
} from "./mixradius-auth-client";
import {
  deleteMixRadiusIncomeRecord,
  fetchMixRadiusIncomeByPeriod,
  fetchMixRadiusIncomeSummary,
  fetchMixRadiusOwnersWithIds,
  fetchMixRadiusProfitReport,
  fetchMixRadiusUniqueOwners,
  getMixRadiusPrintInvoiceHtml,
} from "./mixradius-income-client";
import { MixRadiusOwnerGroupFacadeService } from "./MixRadiusOwnerGroupFacadeService";
import {
  createCustomersCacheState,
  createInvoiceCountCache,
  createMixRadiusHttpClient,
  createMixRadiusResetClient,
  createTopologyCacheState,
  MIXRADIUS_CUSTOMERS_CACHE_TTL,
  MIXRADIUS_TOPOLOGY_CACHE_TTL,
  type MixRadiusTopologyCacheState,
} from "./mixradius-service.config";
import {
  fetchMixRadiusODPCustomers,
  fetchMixRadiusODPList,
  fetchMixRadiusTopologyData,
} from "./mixradius-topology-client";
import type {
  MixRadiusOwnerGroupPayload,
  MixRadiusOwnerGroupUpdatePayload,
} from "./mixradius-owner-group-service";
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
  private client: AxiosInstance;
  private jar: CookieJar;
  private isLoggedIn = false;
  private loginExpiresAt = 0;
  private loggedInCredentials: { username: string; baseUrl: string } | null =
    null;
  private readonly invoiceCountCache = createInvoiceCountCache();
  private readonly ownerGroupService = new MixRadiusOwnerGroupFacadeService();
  private customersCache: MixRadiusCustomerCacheState =
    createCustomersCacheState();
  private topologyCache: MixRadiusTopologyCacheState =
    createTopologyCacheState();

  constructor() {
    this.jar = new CookieJar();
    this.client = createMixRadiusHttpClient(this.jar);
  }

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
    const session = await loginMixRadius({
      client: this.client,
      credentials: this.credentials,
      session: this.getSessionState(),
      randomDelay: this.randomDelay.bind(this),
    });
    this.applySessionState(session);
  }

  /** Fetch PPP customers from MixRadius. */
  async fetchCustomersPPP(
    params: FetchCustomersParams = {},
  ): Promise<MixRadiusCustomerResponse> {
    await this.loadCredentials();

    const { result, cache } = await fetchMixRadiusCustomersPPP({
      client: this.client,
      baseUrl: this.credentials.baseUrl,
      login: this.login.bind(this),
      onSessionExpired: this.handleSessionExpired.bind(this),
      randomDelay: this.randomDelay.bind(this),
      filters: params,
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
    return fetchMixRadiusIncomeByPeriod(this.buildBaseClientParams(params));
  }

  /** Fetch summarized income metrics from MixRadius. */
  async fetchIncomeSummary(
    params: FetchCustomersParams = {},
  ): Promise<MixRadiusIncomeSummary> {
    await this.loadCredentials();
    return fetchMixRadiusIncomeSummary(this.buildBaseClientParams(params));
  }

  /** Fetch MixRadius owners with numeric identifiers. */
  async getOwnersWithIds(): Promise<MixRadiusOwner[]> {
    await this.loadCredentials();
    return fetchMixRadiusOwnersWithIds(this.buildBaseClientParams());
  }

  /** Fetch unique owner names from PPP customers. */
  async getUniqueOwners(): Promise<string[]> {
    return fetchMixRadiusUniqueOwners({
      fetchCustomersPPP: async (filters) => this.fetchCustomersPPP(filters),
    });
  }

  /** Delete an income record in MixRadius. */
  async deleteIncomeRecord(id: string): Promise<boolean> {
    await this.loadCredentials();
    return deleteMixRadiusIncomeRecord({
      ...this.buildBaseClientParams(),
      id,
    });
  }

  /** Retrieve invoice print HTML from MixRadius. */
  async getPrintInvoiceHtml(
    id: string,
    type: "standard" | "thermal" = "standard",
  ): Promise<string> {
    await this.loadCredentials();
    return getMixRadiusPrintInvoiceHtml({
      ...this.buildBaseClientParams(),
      id,
      type,
    });
  }

  /** List owner groups for MixRadius mapping. */
  async getOwnerGroups(tenantId?: string) {
    return this.ownerGroupService.getOwnerGroups(tenantId);
  }

  /** Get one owner group for MixRadius mapping. */
  async getOwnerGroup(id: string, tenantId?: string) {
    return this.ownerGroupService.getOwnerGroup(id, tenantId);
  }

  /** Create an owner group for MixRadius mapping. */
  async createOwnerGroup(data: MixRadiusOwnerGroupPayload) {
    return this.ownerGroupService.createOwnerGroup(data);
  }

  /** Update an owner group for MixRadius mapping. */
  async updateOwnerGroup(id: string, data: MixRadiusOwnerGroupUpdatePayload) {
    return this.ownerGroupService.updateOwnerGroup(id, data);
  }

  /** Delete an owner group for MixRadius mapping. */
  async deleteOwnerGroup(id: string, tenantId?: string) {
    return this.ownerGroupService.deleteOwnerGroup(id, tenantId);
  }

  /** Fetch active PPP sessions keyed by username. */
  async fetchActiveSessionsPPP(
    search: string = "",
  ): Promise<Map<string, { ip: string; uptime: string }>> {
    await this.loadCredentials();
    return fetchMixRadiusActiveSessionsPPP({
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
    return fetchMixRadiusInvoiceCounts({
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
    return fetchMixRadiusCustomerDetail({
      ...this.buildBaseClientParams(),
      customerId,
      fetchCustomersPPP: this.fetchCustomersPPP.bind(this),
    });
  }

  /** Clear MixRadius login session and in-memory caches. */
  async clearSession(): Promise<void> {
    this.handleSessionExpired();
    this.customersCache = createCustomersCacheState();
    this.resetCookieJar();
  }

  /** Check whether the current MixRadius session is still valid. */
  isSessionValid(): boolean {
    return this.isLoggedIn && this.loginExpiresAt > Date.now();
  }

  /** Fetch MixRadius ODP list. */
  async fetchODPList(): Promise<MixRadiusODP[]> {
    await this.loadCredentials();
    return fetchMixRadiusODPList({
      ...this.buildBaseClientParams(),
      onRetry: () => this.fetchODPList(),
    });
  }

  /** Fetch customers attached to an ODP. */
  async fetchODPCustomers(odpId: string): Promise<MixRadiusODPCustomer[]> {
    await this.loadCredentials();
    return fetchMixRadiusODPCustomers({
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
    const { result, cache } = await fetchMixRadiusTopologyData({
      ownerName: options?.ownerName,
      forceRefresh: options?.forceRefresh,
      cache: this.topologyCache,
      topologyCacheTtl: MIXRADIUS_TOPOLOGY_CACHE_TTL,
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
    return fetchMixRadiusProfitReport(this.buildBaseClientParams());
  }

  private buildBaseClientParams(filters?: FetchCustomersParams) {
    return {
      client: this.client,
      baseUrl: this.credentials.baseUrl,
      login: this.login.bind(this),
      onSessionExpired: this.handleSessionExpired.bind(this),
      randomDelay: this.randomDelay.bind(this),
      filters,
    };
  }

  private getSessionState(): MixRadiusSessionState {
    return {
      isLoggedIn: this.isLoggedIn,
      loginExpiresAt: this.loginExpiresAt,
      loggedInCredentials: this.loggedInCredentials,
    };
  }

  private applySessionState(session: MixRadiusSessionState) {
    this.isLoggedIn = session.isLoggedIn;
    this.loginExpiresAt = session.loginExpiresAt;
    this.loggedInCredentials = session.loggedInCredentials;
  }

  private handleSessionExpired() {
    this.isLoggedIn = false;
    this.loginExpiresAt = 0;
    this.loggedInCredentials = null;
  }

  private resetCookieJar() {
    this.jar = new CookieJar();
    this.client = createMixRadiusHttpClient(this.jar);
  }

  private resetHttpClient() {
    this.jar = new CookieJar();
    this.client = createMixRadiusResetClient(this.jar);
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

export { MixRadiusConfigError } from "./mixradius-types";
