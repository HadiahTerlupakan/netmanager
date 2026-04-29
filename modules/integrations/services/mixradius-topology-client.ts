import { logger } from "@/lib/logger";
import type { AxiosInstance } from "axios";

import {
  parseDMSToDecimal,
  parseGoogleMapsCoords,
} from "./mixradius-topology-utils";
import {
  MixRadiusConfigError,
  type MixRadiusODP,
  type MixRadiusODPCustomer,
  type MixRadiusTopologyData,
} from "./MixRadiusService";

export type MixRadiusTopologyCacheState = {
  data: MixRadiusTopologyData | null;
  expiresAt: number;
  ownerFilter: string | null;
};

type MixRadiusOdpRawItem = Record<string, unknown>;

function parseCoordinate(value: unknown) {
  const coordinate = String(value || "");
  if (coordinate.includes("°")) {
    return parseDMSToDecimal(coordinate) || 0;
  }

  return parseFloat(coordinate) || 0;
}

function normalizeLatitude(latitude: number) {
  if (latitude > 0 && latitude < 15) {
    return -latitude;
  }

  return latitude;
}

function isIndonesianCoordinate(latitude: number, longitude: number) {
  return (
    latitude >= -12 && latitude <= 8 && longitude >= 94 && longitude <= 142
  );
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "").trim();
}

export function mapMixRadiusOdpItem(
  item: MixRadiusOdpRawItem,
): MixRadiusODP | null {
  const latitude = normalizeLatitude(parseCoordinate(item.odp_latitude));
  const longitude = parseCoordinate(item.odp_longitude);

  if (latitude === 0 && longitude === 0) {
    return null;
  }

  if (!isIndonesianCoordinate(latitude, longitude)) {
    logger.warn(
      `[MixRadius] ODP ${item.odp_name} has invalid coords: lat=${latitude}, lng=${longitude}`,
    );
    return null;
  }

  return {
    id: String(item.id),
    name: String(item.odp_name || ""),
    area: String(item.odp_area || ""),
    latitude,
    longitude,
    ownerName: String(item.owner_name || ""),
    customerCount: parseInt(String(item.customers_count || "0"), 10),
  };
}

export function parseMixRadiusOdpCustomersHtml(
  html: string,
  odpId: string,
): MixRadiusODPCustomer[] {
  const odpNameMatch = html.match(/name="name"[^>]*value="([^"]+)"/i);
  const odpName = odpNameMatch?.[1] ?? `ODP-${odpId}`;
  const tableMatch = html.match(
    /<table[^>]*id="dynamic-table"[^>]*>([\s\S]*?)<\/table>/i,
  );

  if (!tableMatch) {
    return [];
  }

  return parseCustomerRows(tableMatch[1] ?? "", odpId, odpName);
}

function parseCustomerRows(
  tableContent: string,
  odpId: string,
  odpName: string,
) {
  const customers: MixRadiusODPCustomer[] = [];
  const rowRegex = /<tr>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
    const customer = parseCustomerRow(rowMatch[1] ?? "", odpId, odpName);
    if (customer) {
      customers.push(customer);
    }
  }

  return customers;
}

function parseCustomerRow(rowHtml: string, odpId: string, odpName: string) {
  if (rowHtml.includes("<th>")) {
    return null;
  }

  const cells = extractTableCells(rowHtml);
  if (cells.length < 7) {
    return null;
  }

  const customerId = extractCustomerId(cells[0] ?? "");
  const coords = extractCustomerCoords(cells[6] ?? "");
  if (!customerId || !coords) {
    return null;
  }

  if (!isIndonesianCoordinate(coords.lat, coords.lng)) {
    logger.warn(
      `[MixRadius] Invalid coords for customer ${customerId}: lat=${coords.lat}, lng=${coords.lng}`,
    );
    return null;
  }

  return {
    id: customerId,
    memberId: stripHtml(cells[1] ?? ""),
    fullname: stripHtml(cells[2] ?? ""),
    address: stripHtml(cells[3] ?? ""),
    planName: stripHtml(cells[4] ?? ""),
    ownerName: stripHtml(cells[5] ?? ""),
    odpId: String(odpId),
    odpName,
    latitude: coords.lat,
    longitude: coords.lng,
  };
}

function extractTableCells(rowHtml: string) {
  const cells: string[] = [];
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let cellMatch: RegExpExecArray | null;

  while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
    cells.push(cellMatch[1] ?? "");
  }

  return cells;
}

function extractCustomerId(cellHtml: string) {
  const idMatch = cellHtml.match(/value="(\d+)"/);
  return idMatch ? idMatch[1] : "";
}

function extractCustomerCoords(cellHtml: string) {
  const mapsLinkMatch = cellHtml.match(/href="([^"]*google\.com\/maps[^"]*)"/i);
  return mapsLinkMatch ? parseGoogleMapsCoords(mapsLinkMatch[1] ?? "") : null;
}

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

  try {
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

    let data = response.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch (error) {
        logger.error(
          "[MixRadius] Failed to parse ODP mapping response:",
          error,
        );
        return [];
      }
    }

    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((item) => mapMixRadiusOdpItem(item))
      .filter((odp): odp is MixRadiusODP => Boolean(odp));
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";

    if (
      message.includes("konfigurasi") ||
      message.includes("valid") ||
      message.includes("Missing credentials")
    ) {
      logger.warn(
        `[MixRadius] Integration not available (fetchODPList): ${message}`,
      );
      return [];
    }

    logger.error("[MixRadius] Fetch ODP list error:", message);
    throw new Error(`Failed to fetch ODP list: ${message}`);
  }
}

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

  try {
    await login();
    await randomDelay(200, 500);

    const response = await client.get(`${baseUrl}/rad-odp/edit/${odpId}`, {
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Referer: `${baseUrl}/rad-odp/list`,
      },
    });

    const html = response.data as string;

    if (html.includes("LOGIN</title>") || html.includes("rad-admin/post")) {
      onSessionExpired();
      return onRetry();
    }

    return parseMixRadiusOdpCustomersHtml(html, odpId);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";

    if (
      message.includes("konfigurasi") ||
      message.includes("valid") ||
      message.includes("Missing credentials")
    ) {
      logger.warn(
        `[MixRadius] Integration not available (fetchODPCustomers): ${message}`,
      );
      return [];
    }

    logger.error(
      `[MixRadius] Fetch ODP customers error for ${odpId}:`,
      message,
    );
    return [];
  }
}

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

  try {
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

    const odpsWithCustomers = odps.filter(
      (odp) => (odp.customerCount || 0) > 0,
    );
    const batchSize = 3;
    const allCustomers: MixRadiusODPCustomer[] = [];

    for (let i = 0; i < odpsWithCustomers.length; i += batchSize) {
      const batch = odpsWithCustomers.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (odp) => {
          try {
            return await fetchODPCustomers(odp.id);
          } catch {
            logger.error(
              `[MixRadius] Failed to fetch customers for ODP ${odp.id}`,
            );
            return [];
          }
        }),
      );

      batchResults.forEach((customers) => allCustomers.push(...customers));

      if (i + batchSize < odpsWithCustomers.length) {
        await randomDelay(500, 1500);
      }
    }

    const result: MixRadiusTopologyData = {
      odps,
      customers: allCustomers,
    };

    return {
      result,
      cache: {
        data: result,
        expiresAt: Date.now() + topologyCacheTtl,
        ownerFilter,
      },
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";

    if (
      error instanceof MixRadiusConfigError ||
      message.includes("konfigurasi") ||
      message.includes("valid") ||
      message.includes("Missing credentials")
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
}
