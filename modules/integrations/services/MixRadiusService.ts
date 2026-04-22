import type { MixRadiusOwnerGroup } from "@prisma/client-billing";
import axios, { type AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import { LRUCache } from "@/lib/utils/lru-cache";
import {
  fetchMixRadiusActiveSessionsPPP,
  fetchMixRadiusCustomerDetail,
  fetchMixRadiusCustomersPPP,
  fetchMixRadiusInvoiceCounts,
  type MixRadiusCustomerCacheState,
} from "./mixradius-customer-client";
import {
  deleteMixRadiusIncomeRecord,
  fetchMixRadiusIncomeByPeriod,
  fetchMixRadiusIncomeSummary,
  fetchMixRadiusOwnersWithIds,
  fetchMixRadiusProfitReport,
  fetchMixRadiusUniqueOwners,
  getMixRadiusPrintInvoiceHtml,
} from "./mixradius-income-client";
import {
  loadMixRadiusCredentials,
  loginMixRadius,
} from "./mixradius-auth-client";
import {
  fetchMixRadiusODPCustomers,
  fetchMixRadiusODPList,
  fetchMixRadiusTopologyData,
} from "./mixradius-topology-client";
import {
  getMixRadiusOwnerGroupService,
  type MixRadiusOwnerGroupPayload,
  type MixRadiusOwnerGroupUpdatePayload,
} from "./mixradius-owner-group-service";

// Types
export interface MixRadiusCredentials {
  username: string;
  password: string;
  baseUrl: string;
}

export type { MixRadiusOwnerGroup };

export class MixRadiusConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MixRadiusConfigError";
  }
}

export interface MixRadiusCustomer {
  id: string;
  type: string;
  member_id: string;
  servicetype: string;
  nasporttype: string;
  server_name: string | null;
  method: string;
  username: string;
  password: string;
  fullname: string;
  email: string;
  phonenumber: string;
  address: string;
  created_at: string;
  plan_name: string;
  total: string | number;
  renewed_on: string;
  expired_on: string;
  remote_address: string;
  note: string | null;
  trx_invoice: string;
  trx_status: string;
  payment_type: string;
  auth_status: string;
  bind_mac: string;
  mac_address: string | null;
  owner_name: string;
  // New fields for online status
  online?: boolean;
  active_session_ip?: string;
}

export interface MixRadiusCustomerResponse {
  draw: number;
  recordsTotal: number;
  recordsFiltered: number;
  data: MixRadiusCustomer[];
}

export interface MixRadiusCustomerDetail {
  id: string;
  member_id: string;
  username: string;
  password: string;
  fullname: string;
  email: string;
  phonenumber: string;
  address: string;
  remote_address: string;
  plan_name: string;
  payment_type: string;
  subscription_type: string;
  trx_status: string;
  identity_number: string;
  created_at: string;
  renewed_on: string;
  expired_on: string;
  auth_status: string;
  note: string;
  bind_mac: string;
  mac_address: string;
  total: string;
  latitude: string;
  longitude: string;
  // Extended fields
  odp_name?: string;
  owner_name?: string;
  service_type?: string;
  ip_type?: string;
  portal_password?: string;
  expired_action?: string;
  uptime?: string;
  quota_usage?: string;
  online?: boolean;
  invoices?: MixRadiusInvoice[];
}

export interface MixRadiusInvoice {
  id: string;
  invoice_number: string;
  plan_name: string;
  amount: string;
  activation_date: string;
  deadline_date: string;
  owner: string;
  status: string;
}

export interface MixRadiusIncomePeriodRecord {
  id: string;
  invoice: string;
  customer_id: string;
  member_id: string;
  username: string;
  fullname: string;
  email: string;
  address: string;
  phonenumber: string;
  plan_name: string;
  price: string;
  seller_fee: string;
  tax: string;
  total: string;
  payment_method: string;
  payment_type: string;
  trx_status: string;
  invoice_date: string;
  renewed_on: string;
  expired_on: string;
  method: string;
  type: string;
  nasporttype: string;
  server_name: string | null;
  owner_name: string;
}

export interface MixRadiusIncomeSummary {
  profit: string;
  feeSeller: string;
  totalPlusPpn: string;
  totalTransactions: string;
}

export interface MixRadiusIncomePeriodResponse {
  draw: number;
  recordsTotal: number;
  recordsFiltered: number;
  data: MixRadiusIncomePeriodRecord[];
  summary?: MixRadiusIncomeSummary;
  availableOwners?: string[];
}

export interface FetchCustomersParams {
  start?: number;
  length?: number;
  search?: string;
  searchType?: string; // all, member_id, username, fullname, phonenumber, address
  authStatus?: string;
  ownerName?: string;
  groupId?: string;
  onlineStatus?: "online" | "offline";
  siteId?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  forceRefresh?: boolean;
  // Income Period Filters
  startDate?: string;
  endDate?: string;
  serviceType?: string;
  paymentMethod?: string;
  ownerId?: string;
}

// ODP Types for Topology Map
export interface MixRadiusODP {
  id: string;
  name: string;
  area: string;
  latitude: number;
  longitude: number;
  ownerName: string;
  customerCount?: number;
}

export interface MixRadiusODPCustomer {
  id: string;
  memberId: string;
  fullname: string;
  address: string;
  planName: string;
  ownerName: string;
  odpId: string;
  odpName: string;
  latitude: number;
  longitude: number;
}

export interface MixRadiusTopologyData {
  odps: MixRadiusODP[];
  customers: MixRadiusODPCustomer[];
}

export interface MixRadiusOwner {
  id: string;
  name: string;
}

export class MixRadiusService {
  private credentials: MixRadiusCredentials;
  private client: AxiosInstance;
  private jar: CookieJar;
  private isLoggedIn: boolean = false;
  private loginExpiresAt: number = 0;
  private loggedInCredentials: { username: string; baseUrl: string } | null =
    null; // Track active session credentials
  private invoiceCountCache: LRUCache<
    string,
    { paidCount: number; totalCount: number; lastRenewedOn: string }
  >;

  // Cache for Customers List - ENABLED
  // Set to 15 minutes to reduce load on upstream server
  private customersCache: MixRadiusCustomerCacheState = {
    data: [],
    expiresAt: 0,
  };
  private static CUSTOMERS_CACHE_TTL = 15 * 60 * 1000; // 15 Minutes

  // Topology cache - DISABLED
  private topologyCache: {
    data: MixRadiusTopologyData | null;
    expiresAt: number;
    ownerFilter: string | null;
  } = { data: null, expiresAt: 0, ownerFilter: null };
  private static TOPOLOGY_CACHE_TTL = 0; // Disabled (was 5m)

  constructor() {
    // Initial credentials from environment variables (fallback)
    this.credentials = {
      username: process.env.MIXRADIUS_USERNAME || "",
      password: process.env.MIXRADIUS_PASSWORD || "",
      baseUrl: process.env.MIXRADIUS_URL || "",
    };

    // Note: MixRadius server now has valid SSL certificate from Sectigo (*.topsetting.com)
    // No need to disable TLS verification anymore

    // Create cookie jar
    this.jar = new CookieJar();

    // Initialize cache - DISABLED (was 24 hours TTL)
    this.invoiceCountCache = new LRUCache(5000, 0);

    // Create axios instance with cookie jar support
    this.client = wrapper(
      axios.create({
        jar: this.jar,
        withCredentials: true,
        timeout: 60000, // Increased to 60s
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
          "Cache-Control": "max-age=0",
          Connection: "keep-alive",
          "Sec-Ch-Ua":
            '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
          "Sec-Ch-Ua-Mobile": "?0",
          "Sec-Ch-Ua-Platform": '"Windows"',
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "same-origin",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1",
        },
      }),
    );
  }

  /**
   * Human-like random delay
   * Helps avoid bot detection and reduces server hammering
   */
  private async randomDelay(
    min: number = 300,
    max: number = 800,
  ): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Load credentials from DB or fallback to Env
   */
  private async loadCredentials() {
    this.credentials = await loadMixRadiusCredentials();

    if (
      !this.credentials.username ||
      !this.credentials.password ||
      !this.credentials.baseUrl
    ) {
      console.warn(
        "[MixRadius] Credentials missing in Env vars. MixRadius integration will fail until configured.",
      );
    }
  }

  /**
   * Login ke MixRadius
   */
  async login(): Promise<void> {
    await this.loadCredentials();

    const nextSession = await loginMixRadius({
      client: this.client,
      credentials: this.credentials,
      session: {
        isLoggedIn: this.isLoggedIn,
        loginExpiresAt: this.loginExpiresAt,
        loggedInCredentials: this.loggedInCredentials,
      },
      randomDelay: this.randomDelay.bind(this),
    });

    this.isLoggedIn = nextSession.isLoggedIn;
    this.loginExpiresAt = nextSession.loginExpiresAt;
    this.loggedInCredentials = nextSession.loggedInCredentials;
  }

  /**
   * Fetch data customers PPP dari MixRadius
   */
  async fetchCustomersPPP(
    params: FetchCustomersParams = {},
  ): Promise<MixRadiusCustomerResponse> {
    await this.loadCredentials();

    const { result, cache } = await fetchMixRadiusCustomersPPP({
      client: this.client,
      baseUrl: this.credentials.baseUrl,
      login: this.login.bind(this),
      onSessionExpired: () => {
        this.isLoggedIn = false;
      },
      randomDelay: this.randomDelay.bind(this),
      filters: params,
      cache: this.customersCache,
      customersCacheTtl: MixRadiusService.CUSTOMERS_CACHE_TTL,
      onResetClient: () => {
        this.jar = new CookieJar();
        this.client = wrapper(
          axios.create({
            jar: this.jar,
            withCredentials: true,
            timeout: 30000,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            },
          }),
        );
      },
    });

    this.customersCache = cache;
    return result;
  }

  /**
   * Fetch Income by Period from MixRadius
   * Endpoint: POST /rad-get-data/reports-period
   */
  async fetchIncomeByPeriod(
    params: FetchCustomersParams = {},
  ): Promise<MixRadiusIncomePeriodResponse> {
    return fetchMixRadiusIncomeByPeriod({
      client: this.client,
      baseUrl: this.credentials.baseUrl,
      login: this.login.bind(this),
      onSessionExpired: () => {
        this.isLoggedIn = false;
      },
      randomDelay: this.randomDelay.bind(this),
      filters: params,
    });
  }

  /**
   * Fetch Income Summary (Cards)
   * Refactored to ALWAYS calculate from the actual data to ensure consistency with the table.
   * Previously it tried to scrape HTML cards from MixRadius, which often returned 0 or unmatched data.
   */
  async fetchIncomeSummary(
    params: FetchCustomersParams = {},
  ): Promise<MixRadiusIncomeSummary> {
    return fetchMixRadiusIncomeSummary({
      client: this.client,
      baseUrl: this.credentials.baseUrl,
      login: this.login.bind(this),
      onSessionExpired: () => {
        this.isLoggedIn = false;
      },
      randomDelay: this.randomDelay.bind(this),
      filters: params,
    });
  }

  /**
   * Fetch owner list with IDs from Income Report page HTML
   * This allows us to get the real numeric IDs (e.g. "26") required for API filtering
   */
  async getOwnersWithIds(): Promise<MixRadiusOwner[]> {
    await this.loadCredentials();

    return fetchMixRadiusOwnersWithIds({
      client: this.client,
      baseUrl: this.credentials.baseUrl,
      login: this.login.bind(this),
      onSessionExpired: () => {
        this.isLoggedIn = false;
      },
      randomDelay: this.randomDelay.bind(this),
    });
  }

  /**
   * Get unique list of owners
   * This fetches from the Customers list, so it only returns owners who actually have customers/transactions.
   */
  async getUniqueOwners(): Promise<string[]> {
    return fetchMixRadiusUniqueOwners({
      fetchCustomersPPP: async (filters) => this.fetchCustomersPPP(filters),
    });
  }

  /**
   * Delete Income Record
   * Endpoint: POST /rad-reports/delete/{id}
   */
  async deleteIncomeRecord(id: string): Promise<boolean> {
    return deleteMixRadiusIncomeRecord({
      client: this.client,
      baseUrl: this.credentials.baseUrl,
      login: this.login.bind(this),
      onSessionExpired: () => {
        this.isLoggedIn = false;
      },
      randomDelay: this.randomDelay.bind(this),
      id,
    });
  }

  /**
   * Get Print Invoice HTML
   * Endpoint: GET /rad-reports/print-invoice/{id}/{type}
   * type: 'standard' | 'thermal'
   */
  async getPrintInvoiceHtml(
    id: string,
    type: "standard" | "thermal" = "standard",
  ): Promise<string> {
    return getMixRadiusPrintInvoiceHtml({
      client: this.client,
      baseUrl: this.credentials.baseUrl,
      login: this.login.bind(this),
      onSessionExpired: () => {
        this.isLoggedIn = false;
      },
      randomDelay: this.randomDelay.bind(this),
      id,
      type,
    });
  }

  // --- Owner Group Methods ---

  async getOwnerGroups() {
    return getMixRadiusOwnerGroupService().getOwnerGroups();
  }

  async getOwnerGroup(id: string) {
    return getMixRadiusOwnerGroupService().getOwnerGroup(id);
  }

  async createOwnerGroup(data: MixRadiusOwnerGroupPayload) {
    return getMixRadiusOwnerGroupService().createOwnerGroup(data);
  }

  async updateOwnerGroup(id: string, data: MixRadiusOwnerGroupUpdatePayload) {
    return getMixRadiusOwnerGroupService().updateOwnerGroup(id, data);
  }

  async deleteOwnerGroup(id: string) {
    return getMixRadiusOwnerGroupService().deleteOwnerGroup(id);
  }

  /**
   * Fetch Active Sessions from MixRadius
   * Endpoint: /rad-get-active-sessions (or similar, verifying via implementation)
   * Returns: Map of username -> session info
   */
  async fetchActiveSessionsPPP(
    search: string = "",
  ): Promise<Map<string, { ip: string; uptime: string }>> {
    return fetchMixRadiusActiveSessionsPPP({
      client: this.client,
      baseUrl: this.credentials.baseUrl,
      login: this.login.bind(this),
      onSessionExpired: () => {
        this.isLoggedIn = false;
      },
      randomDelay: this.randomDelay.bind(this),
      search,
    });
  }

  /**
   * Fetch Invoice Counts for a list of Customer IDs
   * Uses parallel fetching of details (limit batch size in caller)
   * bypassCache: force re-fetch
   * validationData: map of customerId -> currentRenewedOn to auto-invalidate stale cache
   */
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

  /**
   * Fetch detail customer dari MixRadius
   * Endpoint: GET /rad-customers/edit/{id}
   */
  async fetchCustomerDetail(
    customerId: string,
  ): Promise<MixRadiusCustomerDetail> {
    return fetchMixRadiusCustomerDetail({
      client: this.client,
      baseUrl: this.credentials.baseUrl,
      login: this.login.bind(this),
      onSessionExpired: () => {
        this.isLoggedIn = false;
      },
      randomDelay: this.randomDelay.bind(this),
      customerId,
      fetchCustomersPPP: this.fetchCustomersPPP.bind(this),
    });
  }

  /**
   * Clear session (force re-login on next request)
   */
  async clearSession(): Promise<void> {
    this.isLoggedIn = false;
    this.loginExpiresAt = 0;
    this.customersCache = { data: [], expiresAt: 0 }; // Clear local cache too
    this.jar = new CookieJar();
    // console.log('[MixRadius] Session and caches cleared')
  }

  /**
   * Check if session is valid
   */
  isSessionValid(): boolean {
    return this.isLoggedIn && this.loginExpiresAt > Date.now();
  }

  // ==================== ODP Methods for Topology Map ====================

  /**
   * Fetch list of ODPs from MixRadius
   * Endpoint: GET /rad-autoload/mapping-odps/ALL (JSON API - much faster!)
   */
  async fetchODPList(): Promise<MixRadiusODP[]> {
    return fetchMixRadiusODPList({
      client: this.client,
      baseUrl: this.credentials.baseUrl,
      login: this.login.bind(this),
      onSessionExpired: () => {
        this.isLoggedIn = false;
      },
      onRetry: () => this.fetchODPList(),
      randomDelay: this.randomDelay.bind(this),
    });
  }

  /**
   * Fetch customers for a specific ODP
   * Endpoint: GET /rad-odp/edit/{id} (parse HTML tab Pelanggan)
   */
  async fetchODPCustomers(odpId: string): Promise<MixRadiusODPCustomer[]> {
    return fetchMixRadiusODPCustomers({
      client: this.client,
      baseUrl: this.credentials.baseUrl,
      odpId,
      login: this.login.bind(this),
      onSessionExpired: () => {
        this.isLoggedIn = false;
      },
      onRetry: () => this.fetchODPCustomers(odpId),
      randomDelay: this.randomDelay.bind(this),
    });
  }

  /**
   * Clear topology cache (call this when ODP/customer data changes)
   */
  clearTopologyCache(): void {
    this.topologyCache = { data: null, expiresAt: 0, ownerFilter: null };
    // console.log('[MixRadius] Topology cache cleared')
  }

  /**
   * Fetch all topology data (ODPs + Customers) for the map
   * Uses parallel batching for faster customer fetching
   * Results are cached for 5 minutes
   */
  async fetchTopologyData(options?: {
    ownerName?: string;
    forceRefresh?: boolean;
  }): Promise<MixRadiusTopologyData> {
    const { result, cache } = await fetchMixRadiusTopologyData({
      ownerName: options?.ownerName,
      forceRefresh: options?.forceRefresh,
      cache: this.topologyCache,
      topologyCacheTtl: MixRadiusService.TOPOLOGY_CACHE_TTL,
      fetchODPList: this.fetchODPList.bind(this),
      fetchODPCustomers: this.fetchODPCustomers.bind(this),
      randomDelay: this.randomDelay.bind(this),
    });

    this.topologyCache = cache;
    return result;
  }

  /**
   * Fetch profit report directly from MixRadius HTML (Scraping)
   * Mengambil data pendapatan, transaksi, fee, dan pajak
   */
  async fetchProfitReport(_groupId?: string): Promise<{
    income: number[];
    transactions: number[];
    sellerFees: number[];
    taxes: number[];
  }> {
    return fetchMixRadiusProfitReport({
      client: this.client,
      baseUrl: this.credentials.baseUrl,
      login: this.login.bind(this),
      onSessionExpired: () => {
        this.isLoggedIn = false;
      },
      randomDelay: this.randomDelay.bind(this),
    });
  }
}

// Singleton instance
let mixRadiusServiceInstance: MixRadiusService | null = null;

export function getMixRadiusService(): MixRadiusService {
  if (!mixRadiusServiceInstance) {
    mixRadiusServiceInstance = new MixRadiusService();
  }
  return mixRadiusServiceInstance;
}
