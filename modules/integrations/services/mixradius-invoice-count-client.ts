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

const INVOICE_FETCH_DELAY_MIN_IN_MS = 300;
const INVOICE_FETCH_DELAY_MAX_IN_MS = 1000;
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
  const invoiceCounts = new Map<string, MixRadiusInvoiceCount>();

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
  randomDelay: (min?: number, max?: number) => Promise<void>;
  fetchCustomerDetail: (customerId: string) => Promise<MixRadiusCustomerDetail>;
  invoiceCounts: Map<string, MixRadiusInvoiceCount>;
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
  invoiceCountCache: LRUCache<string, MixRadiusInvoiceCountCacheValue>;
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
  counts: MixRadiusInvoiceCount;
  invoiceCountCache: LRUCache<string, MixRadiusInvoiceCountCacheValue>;
}) {
  const { customerId, lastRenewedOn, counts, invoiceCountCache } = params;
  const cacheKey = buildInvoiceCountCacheKey(customerId, lastRenewedOn);
  invoiceCountCache.set(cacheKey, { ...counts, lastRenewedOn });
}
