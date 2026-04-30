import axios, { type AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

import { LRUCache } from "@/lib/utils/lru-cache";
import type {
  MixRadiusCustomer,
  MixRadiusTopologyData,
} from "./mixradius-types";

const DEFAULT_TIMEOUT_IN_MS = 60_000;
const SESSION_RESET_TIMEOUT_IN_MS = 30_000;
const CUSTOMERS_CACHE_TTL_IN_MS = 15 * 60 * 1000;
const DISABLED_CACHE_TTL_IN_MS = 0;
const INVOICE_CACHE_LIMIT = 5000;
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export type MixRadiusTopologyCacheState = {
  data: MixRadiusTopologyData | null;
  expiresAt: number;
  ownerFilter: string | null;
};

export function createMixRadiusHttpClient(jar: CookieJar): AxiosInstance {
  return wrapper(
    axios.create({
      jar,
      withCredentials: true,
      timeout: DEFAULT_TIMEOUT_IN_MS,
      headers: buildDefaultHttpHeaders(),
    }),
  );
}

export function createMixRadiusResetClient(jar: CookieJar): AxiosInstance {
  return wrapper(
    axios.create({
      jar,
      withCredentials: true,
      timeout: SESSION_RESET_TIMEOUT_IN_MS,
      headers: buildResetHttpHeaders(),
    }),
  );
}

function buildDefaultHttpHeaders() {
  return {
    "User-Agent": BROWSER_USER_AGENT,
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
  };
}

function buildResetHttpHeaders() {
  return {
    "User-Agent": BROWSER_USER_AGENT,
  };
}

export function createInvoiceCountCache() {
  return new LRUCache<
    string,
    { paidCount: number; totalCount: number; lastRenewedOn: string }
  >(INVOICE_CACHE_LIMIT, DISABLED_CACHE_TTL_IN_MS);
}

export function createCustomersCacheState(): {
  data: MixRadiusCustomer[];
  expiresAt: number;
} {
  return {
    data: [],
    expiresAt: 0,
  };
}

export function createTopologyCacheState(): MixRadiusTopologyCacheState {
  return {
    data: null,
    expiresAt: 0,
    ownerFilter: null,
  };
}

export const MIXRADIUS_CUSTOMERS_CACHE_TTL = CUSTOMERS_CACHE_TTL_IN_MS;
export const MIXRADIUS_TOPOLOGY_CACHE_TTL = DISABLED_CACHE_TTL_IN_MS;
