import { logger } from "@/lib/logger";
import {
  applyCustomerFilters,
  buildCustomerFetchFormData,
  buildCustomerResponse,
  deduplicateCustomers,
  mergeCustomerSessions,
} from "./mixradius-customer-helpers";
import {
  MixRadiusConfigError,
  type FetchCustomersParams,
  type MixRadiusCustomer,
  type MixRadiusCustomerResponse,
} from "./mixradius-types";
import { fetchMixRadiusActiveSessionsPPP } from "./mixradius-active-sessions-client";
import { isMixRadiusConfigError } from "./mixradius-customer-errors";
import type {
  MixRadiusCustomerCacheState,
  MixRadiusCustomerClientParams,
} from "./mixradius-customer-client.types";

export type { MixRadiusCustomerCacheState } from "./mixradius-customer-client.types";
export { fetchMixRadiusActiveSessionsPPP } from "./mixradius-active-sessions-client";
export { fetchMixRadiusCustomerDetail } from "./mixradius-customer-detail-client";
export { fetchMixRadiusInvoiceCounts } from "./mixradius-invoice-count-client";

const MAX_SESSION_RETRY = 1;
const FETCH_CUSTOMERS_DELAY_MIN_IN_MS = 500;
const FETCH_CUSTOMERS_DELAY_MAX_IN_MS = 1500;
const SESSION_LOOKUP_DELAY_MIN_IN_MS = 100;
const SESSION_LOOKUP_DELAY_MAX_IN_MS = 300;

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
    logger.error("[MixRadius] Fetch error:", message);

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
  client: MixRadiusCustomerClientParams["client"];
  baseUrl: string;
  login: () => Promise<void>;
  onSessionExpired: () => void;
  randomDelay: (min?: number, max?: number) => Promise<void>;
}) {
  try {
    await params.randomDelay(
      SESSION_LOOKUP_DELAY_MIN_IN_MS,
      SESSION_LOOKUP_DELAY_MAX_IN_MS,
    );
    const activeSessions = await fetchActiveSessions(params);
    return mergeCustomerSessions(params.customers, activeSessions);
  } catch {
    return mergeCustomerSessions(params.customers, new Map());
  }
}

async function fetchActiveSessions(params: {
  client: MixRadiusCustomerClientParams["client"];
  baseUrl: string;
  login: () => Promise<void>;
  onSessionExpired: () => void;
  randomDelay: (min?: number, max?: number) => Promise<void>;
  search: string;
}) {
  return fetchMixRadiusActiveSessionsPPP({
    client: params.client,
    baseUrl: params.baseUrl,
    login: params.login,
    onSessionExpired: params.onSessionExpired,
    randomDelay: params.randomDelay,
    search: params.search,
  });
}
