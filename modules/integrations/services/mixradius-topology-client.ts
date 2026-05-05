import { logger } from "@/lib/logger";
import type { AxiosInstance } from "axios";

import {
  fetchMixRadiusODPCustomers as fetchOdpCustomers,
  fetchMixRadiusODPList as fetchOdpList,
  fetchMixRadiusTopologyData as fetchTopologyData,
  type MixRadiusTopologyCacheState,
} from "./mixradius-topology-fetchers";
import {
  mapMixRadiusOdpItem,
  parseMixRadiusOdpCustomersHtml,
} from "./mixradius-topology-parsers";
import { MixRadiusConfigError } from "./mixradius-types";
import type {
  MixRadiusODP,
  MixRadiusODPCustomer,
  MixRadiusTopologyData,
} from "./mixradius-types";

/** Fetch MixRadius ODP list. */
export async function fetchMixRadiusODPList(params: {
  client: AxiosInstance;
  baseUrl: string;
  login: () => Promise<void>;
  onSessionExpired: () => void;
  onRetry: () => Promise<MixRadiusODP[]>;
  randomDelay: (min?: number, max?: number) => Promise<void>;
}): Promise<MixRadiusODP[]> {
  try {
    return await fetchOdpList(params);
  } catch (error: unknown) {
    return handleODPListError(error);
  }
}

function handleODPListError(error: unknown): MixRadiusODP[] {
  const message = error instanceof Error ? error.message : "Terjadi kesalahan";
  if (isMixRadiusConfigError(message)) {
    logger.warn(
      `[MixRadius] Integration not available (fetchODPList): ${message}`,
    );
    return [];
  }

  logger.error("[MixRadius] Fetch ODP list error:", message);
  throw new Error(`Failed to fetch ODP list: ${message}`);
}

/** Fetch MixRadius ODP customers. */
export async function fetchMixRadiusODPCustomers(params: {
  client: AxiosInstance;
  baseUrl: string;
  odpId: string;
  login: () => Promise<void>;
  onSessionExpired: () => void;
  onRetry: () => Promise<MixRadiusODPCustomer[]>;
  randomDelay: (min?: number, max?: number) => Promise<void>;
}): Promise<MixRadiusODPCustomer[]> {
  try {
    return await fetchOdpCustomers(params);
  } catch (error: unknown) {
    return handleODPCustomersError(error, params.odpId);
  }
}

function handleODPCustomersError(
  error: unknown,
  odpId: string,
): MixRadiusODPCustomer[] {
  const message = error instanceof Error ? error.message : "Terjadi kesalahan";
  if (isMixRadiusConfigError(message)) {
    logger.warn(
      `[MixRadius] Integration not available (fetchODPCustomers): ${message}`,
    );
    return [];
  }

  logger.error(`[MixRadius] Fetch ODP customers error for ${odpId}:`, message);
  return [];
}

/** Fetch MixRadius topology data with local cache state. */
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
  try {
    return await fetchTopologyData(params);
  } catch (error: unknown) {
    return handleTopologyDataError(error, params.cache);
  }
}

function handleTopologyDataError(
  error: unknown,
  cache: MixRadiusTopologyCacheState,
): {
  result: MixRadiusTopologyData;
  cache: MixRadiusTopologyCacheState;
} {
  const message = error instanceof Error ? error.message : "Terjadi kesalahan";
  if (
    error instanceof MixRadiusConfigError ||
    isMixRadiusConfigError(message)
  ) {
    logger.warn(
      `[MixRadius] Integration not available (fetchTopologyData): ${message}`,
    );
    return {
      result: { odps: [], customers: [] },
      cache,
    };
  }

  logger.error("[MixRadius] Fetch topology data error:", message);
  throw new Error(`Failed to fetch topology data: ${message}`);
}

export { mapMixRadiusOdpItem, parseMixRadiusOdpCustomersHtml };

function isMixRadiusConfigError(message: string) {
  return (
    message.includes("konfigurasi") ||
    message.includes("valid") ||
    message.includes("Missing credentials")
  );
}
