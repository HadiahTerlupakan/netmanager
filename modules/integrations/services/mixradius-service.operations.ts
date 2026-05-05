import {
  fetchMixRadiusActiveSessionsPPP,
  fetchMixRadiusCustomerDetail,
  fetchMixRadiusCustomersPPP,
  fetchMixRadiusInvoiceCounts,
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
  fetchMixRadiusODPCustomers,
  fetchMixRadiusODPList,
  fetchMixRadiusTopologyData,
} from "./mixradius-topology-client";
import {
  MIXRADIUS_TOPOLOGY_CACHE_TTL,
  type MixRadiusTopologyCacheState,
} from "./mixradius-service.config";
import type { MixRadiusBaseClientParams } from "./mixradius-service.client";
import type { MixRadiusCustomerCacheState } from "./mixradius-customer-client.types";
import type {
  FetchCustomersParams,
  MixRadiusCustomerDetail,
  MixRadiusCustomerResponse,
  MixRadiusIncomePeriodResponse,
  MixRadiusIncomeSummary,
  MixRadiusODP,
  MixRadiusODPCustomer,
  MixRadiusOwner,
} from "./mixradius-types";

/** Fetch PPP customers from MixRadius with cache management. */
export async function fetchCustomersPPPOperation(
  params: MixRadiusBaseClientParams & {
    cache: MixRadiusCustomerCacheState;
    customersCacheTtl: number;
    onResetClient: () => void;
  },
): Promise<{
  result: MixRadiusCustomerResponse;
  cache: MixRadiusCustomerCacheState;
}> {
  const { result, cache } = await fetchMixRadiusCustomersPPP({
    ...params,
    filters: params.filters,
    cache: params.cache,
    customersCacheTtl: params.customersCacheTtl,
    onResetClient: params.onResetClient,
  });

  return { result, cache };
}

/** Fetch income rows by period from MixRadius. */
export async function fetchIncomeByPeriodOperation(
  params: MixRadiusBaseClientParams,
): Promise<MixRadiusIncomePeriodResponse> {
  return fetchMixRadiusIncomeByPeriod(params);
}

/** Fetch summarized income metrics from MixRadius. */
export async function fetchIncomeSummaryOperation(
  params: MixRadiusBaseClientParams,
): Promise<MixRadiusIncomeSummary> {
  return fetchMixRadiusIncomeSummary(params);
}

/** Fetch MixRadius owners with numeric identifiers. */
export async function getOwnersWithIdsOperation(
  params: MixRadiusBaseClientParams,
): Promise<MixRadiusOwner[]> {
  return fetchMixRadiusOwnersWithIds(params);
}

/** Fetch unique owner names from PPP customers. */
export async function getUniqueOwnersOperation(params: {
  fetchCustomersPPP: (
    filters: FetchCustomersParams,
  ) => Promise<MixRadiusCustomerResponse>;
}): Promise<string[]> {
  return fetchMixRadiusUniqueOwners(params);
}

/** Delete an income record in MixRadius. */
export async function deleteIncomeRecordOperation(
  params: MixRadiusBaseClientParams & { id: string },
): Promise<boolean> {
  return deleteMixRadiusIncomeRecord(params);
}

/** Get printable invoice HTML from MixRadius. */
export async function getPrintInvoiceHtmlOperation(
  params: MixRadiusBaseClientParams & {
    id: string;
    type?: "standard" | "thermal";
  },
): Promise<string> {
  return getMixRadiusPrintInvoiceHtml(params);
}

/** Fetch active PPP sessions keyed by username. */
export async function fetchActiveSessionsPPPOperation(
  params: MixRadiusBaseClientParams & { search?: string },
): Promise<Map<string, { ip: string; uptime: string }>> {
  return fetchMixRadiusActiveSessionsPPP({
    ...params,
    search: params.search || "",
  });
}

/** Fetch cached invoice counts for customer IDs. */
export async function fetchInvoiceCountsOperation(params: {
  customerIds: string[];
  bypassCache: boolean;
  validationData: Record<string, string>;
  invoiceCountCache: ReturnType<
    typeof import("./mixradius-service.config").createInvoiceCountCache
  >;
  randomDelay: (min?: number, max?: number) => Promise<void>;
  login: () => Promise<void>;
  fetchCustomerDetail: (customerId: string) => Promise<MixRadiusCustomerDetail>;
}) {
  return fetchMixRadiusInvoiceCounts({
    customerIds: params.customerIds,
    bypassCache: params.bypassCache,
    validationData: params.validationData,
    invoiceCountCache: params.invoiceCountCache,
    randomDelay: params.randomDelay,
    login: params.login,
    fetchCustomerDetail: params.fetchCustomerDetail,
  });
}

/** Fetch a detailed customer page from MixRadius. */
export async function fetchCustomerDetailOperation(
  params: MixRadiusBaseClientParams & {
    customerId: string;
    fetchCustomersPPP: (
      params: FetchCustomersParams,
    ) => Promise<MixRadiusCustomerResponse>;
  },
): Promise<MixRadiusCustomerDetail> {
  return fetchMixRadiusCustomerDetail(params);
}

/** Fetch MixRadius ODP list. */
export async function fetchODPListOperation(params: {
  client: MixRadiusBaseClientParams["client"];
  baseUrl: string;
  login: () => Promise<void>;
  onSessionExpired: () => void;
  randomDelay: (min?: number, max?: number) => Promise<void>;
  onRetry: () => Promise<MixRadiusODP[]>;
}): Promise<MixRadiusODP[]> {
  return fetchMixRadiusODPList(params);
}

/** Fetch customers attached to an ODP. */
export async function fetchODPCustomersOperation(params: {
  client: MixRadiusBaseClientParams["client"];
  baseUrl: string;
  odpId: string;
  login: () => Promise<void>;
  onSessionExpired: () => void;
  randomDelay: (min?: number, max?: number) => Promise<void>;
  onRetry: () => Promise<MixRadiusODPCustomer[]>;
}): Promise<MixRadiusODPCustomer[]> {
  return fetchMixRadiusODPCustomers(params);
}

/** Fetch topology data for MixRadius ODP mapping. */
export async function fetchTopologyDataOperation(params: {
  ownerName?: string;
  forceRefresh?: boolean;
  cache: MixRadiusTopologyCacheState;
  fetchODPList: () => Promise<MixRadiusODP[]>;
  fetchODPCustomers: (odpId: string) => Promise<MixRadiusODPCustomer[]>;
  randomDelay: (min?: number, max?: number) => Promise<void>;
}) {
  return fetchMixRadiusTopologyData({
    ownerName: params.ownerName,
    forceRefresh: params.forceRefresh,
    cache: params.cache,
    topologyCacheTtl: MIXRADIUS_TOPOLOGY_CACHE_TTL,
    fetchODPList: params.fetchODPList,
    fetchODPCustomers: params.fetchODPCustomers,
    randomDelay: params.randomDelay,
  });
}

/** Fetch yearly profit arrays from MixRadius. */
export async function fetchProfitReportOperation(
  params: MixRadiusBaseClientParams,
) {
  return fetchMixRadiusProfitReport(params);
}
