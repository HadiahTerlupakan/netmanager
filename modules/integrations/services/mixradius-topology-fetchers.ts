import { logger } from "@/lib/logger";
import type { AxiosInstance } from "axios";

import type {
  MixRadiusODP,
  MixRadiusODPCustomer,
  MixRadiusTopologyData,
} from "./mixradius-types";
import {
  mapMixRadiusOdpItem,
  parseMixRadiusOdpCustomersHtml,
} from "./mixradius-topology-parsers";

const TOPOLOGY_BATCH_SIZE = 3;

export type MixRadiusTopologyCacheState = {
  data: MixRadiusTopologyData | null;
  expiresAt: number;
  ownerFilter: string | null;
};

/** Fetch ODP list from MixRadius topology endpoint. */
export async function fetchMixRadiusODPList(params: {
  client: AxiosInstance;
  baseUrl: string;
  login: () => Promise<void>;
  onSessionExpired: () => void;
  onRetry: () => Promise<MixRadiusODP[]>;
  randomDelay: (min?: number, max?: number) => Promise<void>;
}): Promise<MixRadiusODP[]> {
  const { client, baseUrl, login, onSessionExpired, onRetry, randomDelay } =
    params;
  await login();
  await randomDelay(300, 800);

  const response = await client.get(
    `${baseUrl}/rad-autoload/mapping-odps/ALL`,
    {
      headers: {
        "Content-Type": "application/json",
        Accept: "*/*",
        Referer: `${baseUrl}/rad-odp/mapping`,
      },
    },
  );

  if (
    typeof response.data === "string" &&
    response.data.includes("<!DOCTYPE")
  ) {
    onSessionExpired();
    return onRetry();
  }

  const parsedData = parseJsonResponse(response.data);
  if (!Array.isArray(parsedData)) {
    return [];
  }

  return parsedData
    .map((item) => mapMixRadiusOdpItem(item))
    .filter((odp): odp is MixRadiusODP => Boolean(odp));
}

/** Fetch customers that belong to a specific ODP. */
export async function fetchMixRadiusODPCustomers(params: {
  client: AxiosInstance;
  baseUrl: string;
  odpId: string;
  login: () => Promise<void>;
  onSessionExpired: () => void;
  onRetry: () => Promise<MixRadiusODPCustomer[]>;
  randomDelay: (min?: number, max?: number) => Promise<void>;
}): Promise<MixRadiusODPCustomer[]> {
  const {
    client,
    baseUrl,
    odpId,
    login,
    onSessionExpired,
    onRetry,
    randomDelay,
  } = params;
  await login();
  await randomDelay(200, 500);

  const response = await client.get(`${baseUrl}/rad-odp/edit/${odpId}`, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: `${baseUrl}/rad-odp/list`,
    },
  });
  const html = response.data as string;

  if (html.includes("LOGIN</title>") || html.includes("rad-admin/post")) {
    onSessionExpired();
    return onRetry();
  }

  return parseMixRadiusOdpCustomersHtml(html, odpId);
}

/** Fetch topology data and update topology cache state. */
export async function fetchMixRadiusTopologyData(params: {
  ownerName?: string;
  forceRefresh?: boolean;
  cache: MixRadiusTopologyCacheState;
  topologyCacheTtl: number;
  fetchODPList: () => Promise<MixRadiusODP[]>;
  fetchODPCustomers: (odpId: string) => Promise<MixRadiusODPCustomer[]>;
  randomDelay: (min?: number, max?: number) => Promise<void>;
}): Promise<{
  result: MixRadiusTopologyData;
  cache: MixRadiusTopologyCacheState;
}> {
  const {
    ownerName,
    forceRefresh,
    cache,
    topologyCacheTtl,
    fetchODPList,
    fetchODPCustomers,
    randomDelay,
  } = params;
  const ownerFilter = ownerName || null;
  if (
    !forceRefresh &&
    cache.data &&
    cache.expiresAt > Date.now() &&
    cache.ownerFilter === ownerFilter
  ) {
    return { result: cache.data, cache };
  }

  let odps = await fetchODPList();
  if (ownerName) {
    odps = odps.filter((odp) => odp.ownerName === ownerName);
  }

  const customers = await fetchTopologyCustomers(
    odps,
    fetchODPCustomers,
    randomDelay,
  );
  const result: MixRadiusTopologyData = { odps, customers };
  return {
    result,
    cache: {
      data: result,
      expiresAt: Date.now() + topologyCacheTtl,
      ownerFilter,
    },
  };
}

async function fetchTopologyCustomers(
  odps: MixRadiusODP[],
  fetchODPCustomers: (odpId: string) => Promise<MixRadiusODPCustomer[]>,
  randomDelay: (min?: number, max?: number) => Promise<void>,
) {
  const odpsWithCustomers = odps.filter((odp) => (odp.customerCount || 0) > 0);
  const allCustomers: MixRadiusODPCustomer[] = [];

  for (
    let index = 0;
    index < odpsWithCustomers.length;
    index += TOPOLOGY_BATCH_SIZE
  ) {
    const currentBatch = odpsWithCustomers.slice(
      index,
      index + TOPOLOGY_BATCH_SIZE,
    );
    const batchResults = await Promise.all(
      currentBatch.map((odp) =>
        fetchCustomersSafely(odp.id, fetchODPCustomers),
      ),
    );
    batchResults.forEach((customers) => allCustomers.push(...customers));
    if (index + TOPOLOGY_BATCH_SIZE < odpsWithCustomers.length) {
      await randomDelay(500, 1500);
    }
  }

  return allCustomers;
}

async function fetchCustomersSafely(
  odpId: string,
  fetchODPCustomers: (odpId: string) => Promise<MixRadiusODPCustomer[]>,
) {
  try {
    return await fetchODPCustomers(odpId);
  } catch {
    logger.error(`[MixRadius] Failed to fetch customers for ODP ${odpId}`);
    return [];
  }
}

function parseJsonResponse(data: unknown) {
  if (typeof data !== "string") {
    return data;
  }

  try {
    return JSON.parse(data);
  } catch (error) {
    logger.error("[MixRadius] Failed to parse ODP mapping response:", error);
    return [];
  }
}
