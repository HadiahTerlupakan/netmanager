import { LRUCache } from "@/lib/utils/lru-cache";
import type { AxiosInstance } from "axios";

import {
  buildInvoiceCountCacheKey,
  parseMixRadiusInvoicesFromHtml,
} from "./mixradius-invoice-utils";
import {
  applyCustomerFilters,
  buildCustomerFetchFormData,
  buildCustomerResponse,
  deduplicateCustomers,
  mergeCustomerSessions,
  parseCustomerDetailHtml,
} from "./mixradius-customer-helpers";
import {
  MixRadiusConfigError,
  type FetchCustomersParams,
  type MixRadiusCustomer,
  type MixRadiusCustomerDetail,
  type MixRadiusCustomerResponse,
} from "./mixradius-types";

export type MixRadiusCustomerCacheState = {
  data: MixRadiusCustomer[];
  expiresAt: number;
};

type MixRadiusCustomerClientParams = {
  client: AxiosInstance;
  baseUrl: string;
  login: () => Promise<void>;
  onSessionExpired: () => void;
  randomDelay: (min?: number, max?: number) => Promise<void>;
};

const MAX_SESSION_RETRY = 1;
const ACTIVE_SESSION_PAGE_SIZE = "5000";
const FETCH_CUSTOMERS_DELAY_MIN_IN_MS = 500;
const FETCH_CUSTOMERS_DELAY_MAX_IN_MS = 1500;
const ACTIVE_SESSION_DELAY_MIN_IN_MS = 200;
const ACTIVE_SESSION_DELAY_MAX_IN_MS = 500;
const CUSTOMER_DETAIL_DELAY_MIN_IN_MS = 200;
const CUSTOMER_DETAIL_DELAY_MAX_IN_MS = 600;
const SESSION_LOOKUP_DELAY_MIN_IN_MS = 100;
const SESSION_LOOKUP_DELAY_MAX_IN_MS = 300;
const INVOICE_FETCH_DELAY_MIN_IN_MS = 300;
const INVOICE_FETCH_DELAY_MAX_IN_MS = 1000;
const INVOICE_BATCH_DELAY_MIN_IN_MS = 200;
const INVOICE_BATCH_DELAY_MAX_IN_MS = 500;
const INVOICE_CHUNK_SIZE = 1;
const CUSTOMER_DETAIL_NOT_FOUND_MARKERS = [
  "404 - Data Not Found",
  "Data tidak ditemukan",
] as const;

function isMixRadiusConfigError(message: string) {
  return (
    message.includes("konfigurasi") ||
    message.includes("valid") ||
    message.includes("Missing credentials")
  );
}

function getCustomerConfigError(message: string, context: string) {
  console.warn(
    `[MixRadius] Integration not available (${context}): ${message}`,
  );
  return new MixRadiusConfigError(message);
}

/** Fetch active PPP sessions keyed by username. */
export async function fetchMixRadiusActiveSessionsPPP(
  params: MixRadiusCustomerClientParams & { search?: string },
): Promise<Map<string, { ip: string; uptime: string }>> {
  const { client, baseUrl, login, randomDelay, search = "" } = params;

  try {
    await login();
    await randomDelay(
      ACTIVE_SESSION_DELAY_MIN_IN_MS,
      ACTIVE_SESSION_DELAY_MAX_IN_MS,
    );
    const response = await client.post(
      `${baseUrl}/rad-get-data/active-ppp&sid=SSP-38`,
      buildActiveSessionFormData(search).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
          Referer: `${baseUrl}/rad-users-session/active-ppp`,
        },
      },
    );

    return buildActiveSessionMap(response.data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    if (
      error instanceof MixRadiusConfigError ||
      isMixRadiusConfigError(message)
    ) {
      throw error instanceof MixRadiusConfigError
        ? error
        : getCustomerConfigError(message, "fetchActiveSessionsPPP");
    }

    console.error("[MixRadius] Failed to fetch active sessions:", message);
    return new Map();
  }
}

/** Fetch PPP customers from MixRadius and apply local filtering. */
export async function fetchMixRadiusCustomersPPP(
  params: MixRadiusCustomerClientParams & {
    filters?: FetchCustomersParams;
    cache: MixRadiusCustomerCacheState;
    customersCacheTtl: number;
    onResetClient: () => void;
    retryCount?: number;
  },
): Promise<{
  result: MixRadiusCustomerResponse;
  cache: MixRadiusCustomerCacheState;
}> {
  const filters = params.filters || {};
  const { start = 0, length = 10, search = "", forceRefresh = false } = filters;

  try {
    await ensureCustomerLogin(params.login);
    const customerDataset = await resolveCustomerDataset({
      ...params,
      forceRefresh,
    });
    const customersWithSessions = await attachActiveSessions({
      customers: customerDataset.data,
      search,
      client: params.client,
      baseUrl: params.baseUrl,
      login: params.login,
      onSessionExpired: params.onSessionExpired,
      randomDelay: params.randomDelay,
    });
    const filteredCustomers = await applyCustomerFilters(
      customersWithSessions,
      filters,
    );

    return {
      result: buildCustomerResponse({
        customers: filteredCustomers,
        start,
        length,
        recordsTotal: customerDataset.recordsTotal,
      }),
      cache: customerDataset.cache,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    console.error("[MixRadius] Fetch error:", message);

    if (
      error instanceof MixRadiusConfigError ||
      isMixRadiusConfigError(message)
    ) {
      throw error instanceof MixRadiusConfigError
        ? error
        : new MixRadiusConfigError(message);
    }

    throw new Error(`Failed to fetch MixRadius customers: ${message}`);
  }
}

/** Fetch detailed customer page and scrape DTO fields. */
export async function fetchMixRadiusCustomerDetail(
  params: MixRadiusCustomerClientParams & {
    customerId: string;
    fetchCustomersPPP: (
      params: FetchCustomersParams,
    ) => Promise<MixRadiusCustomerResponse>;
  },
): Promise<MixRadiusCustomerDetail> {
  const { client, baseUrl, login, onSessionExpired, randomDelay, customerId } =
    params;

  try {
    await login();
    await randomDelay(
      CUSTOMER_DETAIL_DELAY_MIN_IN_MS,
      CUSTOMER_DETAIL_DELAY_MAX_IN_MS,
    );
    const response = await client.get(
      `${baseUrl}/rad-customers/edit/${customerId}`,
      {
        headers: {
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Referer: `${baseUrl}/rad-customers/ppp`,
        },
      },
    );

    const html = response.data as string;
    assertCustomerSessionIsValid(html, onSessionExpired);
    const resolvedCustomerId = await resolveAlternateCustomerIdIfNeeded(
      html,
      customerId,
      params.fetchCustomersPPP,
    );
    if (resolvedCustomerId) {
      return fetchMixRadiusCustomerDetail({
        ...params,
        customerId: resolvedCustomerId,
      });
    }

    warnIfUnexpectedCustomerStructure(html, customerId);
    const customerDetail = {
      ...parseCustomerDetailHtml(html, customerId),
      invoices: parseMixRadiusInvoicesFromHtml(html),
    };
    assertCustomerDetailLooksValid(customerDetail, html, customerId);
    return customerDetail;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    if (
      error instanceof MixRadiusConfigError ||
      isMixRadiusConfigError(message)
    ) {
      throw error instanceof MixRadiusConfigError
        ? error
        : getCustomerConfigError(message, "fetchCustomerDetail");
    }

    console.error("[MixRadius] Fetch customer detail error:", message);
    throw new Error(`Failed to fetch customer detail: ${message}`);
  }
}

/** Fetch invoice counts for many customer IDs with cache validation. */
export async function fetchMixRadiusInvoiceCounts(params: {
  customerIds: string[];
  bypassCache?: boolean;
  validationData?: Record<string, string>;
  invoiceCountCache: LRUCache<
    string,
    { paidCount: number; totalCount: number; lastRenewedOn: string }
  >;
  randomDelay: (min?: number, max?: number) => Promise<void>;
  login: () => Promise<void>;
  fetchCustomerDetail: (customerId: string) => Promise<MixRadiusCustomerDetail>;
}): Promise<Map<string, { paidCount: number; totalCount: number }>> {
  const {
    customerIds,
    bypassCache = false,
    validationData = {},
    invoiceCountCache,
    randomDelay,
    login,
    fetchCustomerDetail,
  } = params;

  await ensureInvoiceCountLogin(login);
  const invoiceCounts = new Map<
    string,
    { paidCount: number; totalCount: number }
  >();

  for (let index = 0; index < customerIds.length; index += INVOICE_CHUNK_SIZE) {
    const chunk = customerIds.slice(index, index + INVOICE_CHUNK_SIZE);
    await Promise.all(
      chunk.map((customerId) =>
        populateInvoiceCount({
          customerId,
          bypassCache,
          validationData,
          invoiceCountCache,
          randomDelay,
          fetchCustomerDetail,
          invoiceCounts,
        }),
      ),
    );

    if (index + INVOICE_CHUNK_SIZE < customerIds.length) {
      await randomDelay(
        INVOICE_BATCH_DELAY_MIN_IN_MS,
        INVOICE_BATCH_DELAY_MAX_IN_MS,
      );
    }
  }

  return invoiceCounts;
}

async function ensureCustomerLogin(login: () => Promise<void>) {
  try {
    await login();
  } catch (loginError) {
    const errorMessage =
      loginError instanceof Error ? loginError.message : String(loginError);
    if (
      loginError instanceof MixRadiusConfigError ||
      isMixRadiusConfigError(errorMessage)
    ) {
      throw loginError instanceof MixRadiusConfigError
        ? loginError
        : new MixRadiusConfigError(errorMessage);
    }
    throw loginError;
  }
}

async function resolveCustomerDataset(
  params: MixRadiusCustomerClientParams & {
    cache: MixRadiusCustomerCacheState;
    customersCacheTtl: number;
    onResetClient: () => void;
    forceRefresh: boolean;
    retryCount?: number;
  },
) {
  const { cache, forceRefresh } = params;
  if (!forceRefresh && cache.data.length > 0 && cache.expiresAt > Date.now()) {
    return {
      data: [...cache.data],
      recordsTotal: cache.data.length,
      cache,
    };
  }

  return fetchCustomerDatasetFromUpstream(params);
}

async function fetchCustomerDatasetFromUpstream(
  params: MixRadiusCustomerClientParams & {
    cache: MixRadiusCustomerCacheState;
    customersCacheTtl: number;
    onResetClient: () => void;
    retryCount?: number;
  },
) {
  const {
    client,
    baseUrl,
    randomDelay,
    onSessionExpired,
    onResetClient,
    customersCacheTtl,
    retryCount = 0,
  } = params;

  await randomDelay(
    FETCH_CUSTOMERS_DELAY_MIN_IN_MS,
    FETCH_CUSTOMERS_DELAY_MAX_IN_MS,
  );
  const response = await client.post(
    `${baseUrl}/rad-get-data/customers-ppp`,
    buildCustomerFetchFormData().toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json, text/javascript, */*; q=0.01",
        Origin: baseUrl,
        Referer: `${baseUrl}/rad-customers/ppp`,
      },
    },
  );

  if (
    typeof response.data === "string" &&
    response.data.includes("<!DOCTYPE")
  ) {
    if (retryCount >= MAX_SESSION_RETRY) {
      throw new Error(
        "MixRadius session expired repeatedly while fetching customers.",
      );
    }

    onSessionExpired();
    onResetClient();
    return fetchCustomerDatasetFromUpstream({
      ...params,
      retryCount: retryCount + 1,
    });
  }

  const responseData = response.data as MixRadiusCustomerResponse;
  const customers = deduplicateCustomers(responseData.data || []);
  return {
    data: customers,
    recordsTotal: customers.length,
    cache: {
      data: customers,
      expiresAt: Date.now() + customersCacheTtl,
    },
  };
}

async function attachActiveSessions(params: {
  customers: MixRadiusCustomer[];
  search: string;
  client: AxiosInstance;
  baseUrl: string;
  login: () => Promise<void>;
  onSessionExpired: () => void;
  randomDelay: (min?: number, max?: number) => Promise<void>;
}) {
  const {
    customers,
    search,
    client,
    baseUrl,
    login,
    onSessionExpired,
    randomDelay,
  } = params;
  try {
    await randomDelay(
      SESSION_LOOKUP_DELAY_MIN_IN_MS,
      SESSION_LOOKUP_DELAY_MAX_IN_MS,
    );
    const activeSessions = await fetchMixRadiusActiveSessionsPPP({
      client,
      baseUrl,
      login,
      onSessionExpired,
      randomDelay,
      search,
    });
    return mergeCustomerSessions(customers, activeSessions);
  } catch {
    return mergeCustomerSessions(customers, new Map());
  }
}

function buildActiveSessionFormData(search: string) {
  const formData = new URLSearchParams();
  formData.append("draw", "1");
  formData.append("start", "0");
  formData.append("length", ACTIVE_SESSION_PAGE_SIZE);
  formData.append("search[value]", search);
  formData.append("search[regex]", "false");
  return formData;
}

function buildActiveSessionMap(responseData: unknown) {
  const activeMap = new Map<string, { ip: string; uptime: string }>();
  const sessions =
    responseData &&
    typeof responseData === "object" &&
    Array.isArray((responseData as { data?: unknown[] }).data)
      ? (responseData as { data: Record<string, unknown>[] }).data
      : [];

  sessions.forEach((session) => {
    const username = String(session.username || session.member_id || "");
    if (!username) {
      return;
    }

    activeMap.set(username, {
      ip: String(session.framedipaddress || ""),
      uptime: String(session.acctsessiontime || ""),
    });
  });

  return activeMap;
}

function assertCustomerSessionIsValid(
  html: string,
  onSessionExpired: () => void,
) {
  if (html.includes("LOGIN</title>") || html.includes("rad-admin/post")) {
    onSessionExpired();
    throw new Error("Session expired, please refresh");
  }
}

async function resolveAlternateCustomerIdIfNeeded(
  html: string,
  customerId: string,
  fetchCustomersPPP: (
    params: FetchCustomersParams,
  ) => Promise<MixRadiusCustomerResponse>,
) {
  if (!isMissingCustomerPage(html)) {
    return null;
  }

  console.error(
    `[MixRadius] 404 Not Found for ID ${customerId}. URL: unresolved/rad-customers/edit/${customerId}`,
  );
  if (customerId.length <= 6 || !/^\d+$/.test(customerId)) {
    throw new Error(
      "Data pelanggan tidak ditemukan (404). ID mungkin salah atau data telah dihapus.",
    );
  }

  const resolvedCustomerId = await resolveCustomerId(
    customerId,
    fetchCustomersPPP,
  );
  if (!resolvedCustomerId || resolvedCustomerId === customerId) {
    throw new Error(
      "Data pelanggan tidak ditemukan (404). ID mungkin salah atau data telah dihapus.",
    );
  }

  return resolvedCustomerId;
}

function isMissingCustomerPage(html: string) {
  return CUSTOMER_DETAIL_NOT_FOUND_MARKERS.some((marker) =>
    html.includes(marker),
  );
}

async function resolveCustomerId(
  customerId: string,
  fetchCustomersPPP: (
    params: FetchCustomersParams,
  ) => Promise<MixRadiusCustomerResponse>,
) {
  try {
    const searchResult = await fetchCustomersPPP({
      start: 0,
      length: 1,
      search: customerId,
      searchType: "username",
    });
    return searchResult.data[0]?.id;
  } catch (resolveError) {
    console.error("[MixRadius] ID resolution failed:", resolveError);
    return undefined;
  }
}

function warnIfUnexpectedCustomerStructure(html: string, customerId: string) {
  const hasCorrectHeader =
    /<h4>\s*<i[^>]*class="[^"]*fa-edit[^"]*"[^>]*><\/i>[\s\S]*?(Edit|Detail)[\s\S]*?<\/h4>/i.test(
      html,
    ) ||
    (html.includes("id_plan") && html.includes("username"));

  if (!hasCorrectHeader) {
    console.warn(
      `[MixRadius] Page structure check failed for customer ${customerId}. Marker elements not found.`,
    );
  }
}

function assertCustomerDetailLooksValid(
  customerDetail: MixRadiusCustomerDetail,
  html: string,
  customerId: string,
) {
  if (customerDetail.username || customerDetail.member_id) {
    return;
  }

  console.error(
    `[MixRadius] Scraping Validation Failed for ID ${customerId}. HTML snippet: ${html.substring(0, 500)}...`,
  );
  throw new Error(
    "Integration Error: MixRadius Admin Panel layout may have changed. Failed to extract core customer data.",
  );
}

async function ensureInvoiceCountLogin(login: () => Promise<void>) {
  try {
    await login();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      error instanceof MixRadiusConfigError ||
      isMixRadiusConfigError(message)
    ) {
      throw error instanceof MixRadiusConfigError
        ? error
        : getCustomerConfigError(message, "fetchInvoiceCounts");
    }
    throw error;
  }
}

async function populateInvoiceCount(params: {
  customerId: string;
  bypassCache: boolean;
  validationData: Record<string, string>;
  invoiceCountCache: LRUCache<
    string,
    { paidCount: number; totalCount: number; lastRenewedOn: string }
  >;
  randomDelay: (min?: number, max?: number) => Promise<void>;
  fetchCustomerDetail: (customerId: string) => Promise<MixRadiusCustomerDetail>;
  invoiceCounts: Map<string, { paidCount: number; totalCount: number }>;
}) {
  const {
    customerId,
    bypassCache,
    validationData,
    invoiceCountCache,
    randomDelay,
    fetchCustomerDetail,
    invoiceCounts,
  } = params;

  try {
    const lastRenewedOn = validationData[customerId] || "";
    const cachedCounts = getCachedInvoiceCount({
      customerId,
      lastRenewedOn,
      bypassCache,
      validationData,
      invoiceCountCache,
    });
    if (cachedCounts) {
      invoiceCounts.set(customerId, cachedCounts);
      return;
    }

    await randomDelay(
      INVOICE_FETCH_DELAY_MIN_IN_MS,
      INVOICE_FETCH_DELAY_MAX_IN_MS,
    );
    const customerDetail = await fetchCustomerDetail(customerId);
    const counts = buildInvoiceCount(customerDetail.invoices || []);
    invoiceCounts.set(customerId, counts);
    cacheInvoiceCount({ customerId, lastRenewedOn, counts, invoiceCountCache });
  } catch (error) {
    console.error(
      `[MixRadius] Failed to fetch invoice count for ${customerId}:`,
      error,
    );
    invoiceCounts.set(customerId, { paidCount: 0, totalCount: 0 });
  }
}

function getCachedInvoiceCount(params: {
  customerId: string;
  lastRenewedOn: string;
  bypassCache: boolean;
  validationData: Record<string, string>;
  invoiceCountCache: LRUCache<
    string,
    { paidCount: number; totalCount: number; lastRenewedOn: string }
  >;
}) {
  const {
    customerId,
    lastRenewedOn,
    bypassCache,
    validationData,
    invoiceCountCache,
  } = params;
  if (bypassCache) {
    return null;
  }

  const cacheKey = buildInvoiceCountCacheKey(customerId, lastRenewedOn);
  const cachedValue = invoiceCountCache.get(cacheKey);
  const liveRenewedOn = validationData[customerId];
  if (
    !cachedValue ||
    (liveRenewedOn && cachedValue.lastRenewedOn !== liveRenewedOn)
  ) {
    return null;
  }

  return {
    paidCount: cachedValue.paidCount,
    totalCount: cachedValue.totalCount,
  };
}

function buildInvoiceCount(invoices: Array<{ status: string }>) {
  const paidCount = invoices.filter(
    (invoice) => invoice.status === "Paid",
  ).length;
  return {
    paidCount,
    totalCount: invoices.length,
  };
}

function cacheInvoiceCount(params: {
  customerId: string;
  lastRenewedOn: string;
  counts: { paidCount: number; totalCount: number };
  invoiceCountCache: LRUCache<
    string,
    { paidCount: number; totalCount: number; lastRenewedOn: string }
  >;
}) {
  const { customerId, lastRenewedOn, counts, invoiceCountCache } = params;
  const cacheKey = buildInvoiceCountCacheKey(customerId, lastRenewedOn);
  invoiceCountCache.set(cacheKey, { ...counts, lastRenewedOn });
}
