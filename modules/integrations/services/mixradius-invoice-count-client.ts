import { LRUCache } from "@/lib/utils/lru-cache";

import { buildInvoiceCountCacheKey } from "./mixradius-invoice-utils";
import {
  MixRadiusConfigError,
  type MixRadiusCustomerDetail,
} from "./mixradius-types";
import type {
  MixRadiusInvoiceCount,
  MixRadiusInvoiceCountCacheValue,
} from "./mixradius-customer-client.types";
import {
  getCustomerConfigError,
  isMixRadiusConfigError,
} from "./mixradius-customer-errors";

const INVOICE_BATCH_DELAY_MIN_IN_MS = 200;
const INVOICE_BATCH_DELAY_MAX_IN_MS = 500;
const INVOICE_CHUNK_SIZE = 1;

export async function fetchMixRadiusInvoiceCounts(params: {
  customerIds: string[];
  bypassCache?: boolean;
  validationData?: Record<string, string>;
  invoiceCountCache: LRUCache<string, MixRadiusInvoiceCountCacheValue>;
  randomDelay: (min?: number, max?: number) => Promise<void>;
  login: () => Promise<void>;
  fetchCustomerDetail: (customerId: string) => Promise<MixRadiusCustomerDetail>;
}): Promise<Map<string, MixRadiusInvoiceCount>> {
  await ensureInvoiceCountLogin(params.login);
  const invoiceCounts = new Map<string, MixRadiusInvoiceCount>();

  await processInvoiceCountBatches({
    ...params,
    bypassCache: params.bypassCache ?? false,
    validationData: params.validationData ?? {},
    invoiceCounts,
  });

  return invoiceCounts;
}

async function processInvoiceCountBatches(params: {
  customerIds: string[];
  bypassCache: boolean;
  validationData: Record<string, string>;
  invoiceCountCache: LRUCache<string, MixRadiusInvoiceCountCacheValue>;
  randomDelay: (min?: number, max?: number) => Promise<void>;
  fetchCustomerDetail: (customerId: string) => Promise<MixRadiusCustomerDetail>;
  invoiceCounts: Map<string, MixRadiusInvoiceCount>;
}) {
  const { customerIds, randomDelay, ...rest } = params;

  for (let index = 0; index < customerIds.length; index += INVOICE_CHUNK_SIZE) {
    const chunk = customerIds.slice(index, index + INVOICE_CHUNK_SIZE);
    await Promise.all(
      chunk.map((customerId) => populateInvoiceCount({ customerId, ...rest })),
    );

    if (shouldDelayNextBatch(index, customerIds.length)) {
      await randomDelay(
        INVOICE_BATCH_DELAY_MIN_IN_MS,
        INVOICE_BATCH_DELAY_MAX_IN_MS,
      );
    }
  }
}

function shouldDelayNextBatch(currentIndex: number, totalLength: number) {
  return currentIndex + INVOICE_CHUNK_SIZE < totalLength;
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
  invoiceCountCache: LRUCache<string, MixRadiusInvoiceCountCacheValue>;
  fetchCustomerDetail: (customerId: string) => Promise<MixRadiusCustomerDetail>;
  invoiceCounts: Map<string, MixRadiusInvoiceCount>;
}) {
  try {
    const cachedCounts = tryGetCachedCount({
      customerId: params.customerId,
      lastRenewedOn: params.validationData[params.customerId] || "",
      bypassCache: params.bypassCache,
      validationData: params.validationData,
      invoiceCountCache: params.invoiceCountCache,
    });

    if (cachedCounts) {
      params.invoiceCounts.set(params.customerId, cachedCounts);
      return;
    }

    await fetchAndCacheInvoiceCount({
      customerId: params.customerId,
      lastRenewedOn: params.validationData[params.customerId] || "",
      fetchCustomerDetail: params.fetchCustomerDetail,
      invoiceCountCache: params.invoiceCountCache,
      invoiceCounts: params.invoiceCounts,
    });
  } catch (error) {
    handleInvoiceCountError(params.customerId, error, params.invoiceCounts);
  }
}

function tryGetCachedCount(params: {
  customerId: string;
  lastRenewedOn: string;
  bypassCache: boolean;
  validationData: Record<string, string>;
  invoiceCountCache: LRUCache<string, MixRadiusInvoiceCountCacheValue>;
}): MixRadiusInvoiceCount | null {
  if (params.bypassCache) {
    return null;
  }
  return getCachedInvoiceCount(params);
}

async function fetchAndCacheInvoiceCount(params: {
  customerId: string;
  lastRenewedOn: string;
  fetchCustomerDetail: (customerId: string) => Promise<MixRadiusCustomerDetail>;
  invoiceCountCache: LRUCache<string, MixRadiusInvoiceCountCacheValue>;
  invoiceCounts: Map<string, MixRadiusInvoiceCount>;
}) {
  const counts = await fetchAndBuildInvoiceCount(
    params.customerId,
    params.fetchCustomerDetail,
  );
  params.invoiceCounts.set(params.customerId, counts);
  cacheInvoiceCount({
    customerId: params.customerId,
    lastRenewedOn: params.lastRenewedOn,
    counts,
    invoiceCountCache: params.invoiceCountCache,
  });
}

function handleInvoiceCountError(
  customerId: string,
  error: unknown,
  invoiceCounts: Map<string, MixRadiusInvoiceCount>,
) {
  console.error(
    `[MixRadius] Failed to fetch invoice count for ${customerId}:`,
    error,
  );
  invoiceCounts.set(customerId, { paidCount: 0, totalCount: 0 });
}

async function fetchAndBuildInvoiceCount(
  customerId: string,
  fetchCustomerDetail: (customerId: string) => Promise<MixRadiusCustomerDetail>,
) {
  const customerDetail = await fetchCustomerDetail(customerId);
  return buildInvoiceCount(customerDetail.invoices || []);
}

function getCachedInvoiceCount(params: {
  customerId: string;
  lastRenewedOn: string;
  bypassCache: boolean;
  validationData: Record<string, string>;
  invoiceCountCache: LRUCache<string, MixRadiusInvoiceCountCacheValue>;
}) {
  if (params.bypassCache) {
    return null;
  }

  const cacheKey = buildInvoiceCountCacheKey(
    params.customerId,
    params.lastRenewedOn,
  );
  const cachedValue = params.invoiceCountCache.get(cacheKey);

  if (!isCacheValid(cachedValue, params.customerId, params.validationData)) {
    return null;
  }

  return {
    paidCount: cachedValue.paidCount,
    totalCount: cachedValue.totalCount,
  };
}

function isCacheValid(
  cachedValue: MixRadiusInvoiceCountCacheValue | undefined,
  customerId: string,
  validationData: Record<string, string>,
) {
  if (!cachedValue) return false;
  const liveRenewedOn = validationData[customerId];
  return !liveRenewedOn || cachedValue.lastRenewedOn === liveRenewedOn;
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
  counts: MixRadiusInvoiceCount;
  invoiceCountCache: LRUCache<string, MixRadiusInvoiceCountCacheValue>;
}) {
  const { customerId, lastRenewedOn, counts, invoiceCountCache } = params;
  const cacheKey = buildInvoiceCountCacheKey(customerId, lastRenewedOn);
  invoiceCountCache.set(cacheKey, { ...counts, lastRenewedOn });
}
