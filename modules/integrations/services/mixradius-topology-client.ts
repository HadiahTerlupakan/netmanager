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
        console.error(
          "[MixRadius] Failed to parse ODP mapping response:",
          error,
        );
        return [];
      }
    }

    if (!Array.isArray(data)) {
      return [];
    }

    const odps: MixRadiusODP[] = [];

    for (const item of data) {
      let lat: number;
      const latStr = String(item.odp_latitude || "");
      if (latStr.includes("°")) {
        lat = parseDMSToDecimal(latStr) || 0;
      } else {
        lat = parseFloat(latStr) || 0;
      }

      let lng: number;
      const lngStr = String(item.odp_longitude || "");
      if (lngStr.includes("°")) {
        lng = parseDMSToDecimal(lngStr) || 0;
      } else {
        lng = parseFloat(lngStr) || 0;
      }

      if (lat === 0 && lng === 0) {
        continue;
      }

      if (lat > 0 && lat < 15) {
        lat = -lat;
      }

      const isValidCoord = lat >= -12 && lat <= 8 && lng >= 94 && lng <= 142;
      if (!isValidCoord) {
        console.warn(
          `[MixRadius] ODP ${item.odp_name} has invalid coords: lat=${lat}, lng=${lng}`,
        );
        continue;
      }

      odps.push({
        id: String(item.id),
        name: item.odp_name || "",
        area: item.odp_area || "",
        latitude: lat,
        longitude: lng,
        ownerName: item.owner_name || "",
        customerCount: parseInt(item.customers_count || "0", 10),
      });
    }

    return odps;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";

    if (
      message.includes("konfigurasi") ||
      message.includes("valid") ||
      message.includes("Missing credentials")
    ) {
      console.warn(
        `[MixRadius] Integration not available (fetchODPList): ${message}`,
      );
      return [];
    }

    console.error("[MixRadius] Fetch ODP list error:", message);
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

    const odpNameMatch = html.match(/name="name"[^>]*value="([^"]+)"/i);
    const odpName = odpNameMatch?.[1] ?? `ODP-${odpId}`;

    const customers: MixRadiusODPCustomer[] = [];
    const tableMatch = html.match(
      /<table[^>]*id="dynamic-table"[^>]*>([\s\S]*?)<\/table>/i,
    );
    if (!tableMatch) {
      return customers;
    }

    const tableContent = tableMatch[1] ?? "";
    const rowRegex = /<tr>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
      const rowHtml = rowMatch[1] ?? "";
      if (rowHtml.includes("<th>")) continue;

      const cells: string[] = [];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let cellMatch: RegExpExecArray | null;

      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        cells.push(cellMatch[1] ?? "");
      }

      if (cells.length < 7) continue;

      const cell0 = cells[0] ?? "";
      const idMatch = cell0.match(/value="(\d+)"/);
      const customerId = idMatch ? idMatch[1] : "";

      const cell6 = cells[6] ?? "";
      const mapsLinkMatch = cell6.match(
        /href="([^"]*google\.com\/maps[^"]*)"/i,
      );
      const coords = mapsLinkMatch
        ? parseGoogleMapsCoords(mapsLinkMatch[1] ?? "")
        : null;

      if (!customerId || !coords) continue;

      const isValidCoord =
        coords.lat >= -12 &&
        coords.lat <= 8 &&
        coords.lng >= 94 &&
        coords.lng <= 142;
      if (!isValidCoord) {
        console.warn(
          `[MixRadius] Invalid coords for customer ${customerId}: lat=${coords.lat}, lng=${coords.lng}`,
        );
        continue;
      }

      customers.push({
        id: customerId,
        memberId: (cells[1] ?? "").replace(/<[^>]*>/g, "").trim(),
        fullname: (cells[2] ?? "").replace(/<[^>]*>/g, "").trim(),
        address: (cells[3] ?? "").replace(/<[^>]*>/g, "").trim(),
        planName: (cells[4] ?? "").replace(/<[^>]*>/g, "").trim(),
        ownerName: (cells[5] ?? "").replace(/<[^>]*>/g, "").trim(),
        odpId: String(odpId),
        odpName,
        latitude: coords.lat,
        longitude: coords.lng,
      });
    }

    return customers;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";

    if (
      message.includes("konfigurasi") ||
      message.includes("valid") ||
      message.includes("Missing credentials")
    ) {
      console.warn(
        `[MixRadius] Integration not available (fetchODPCustomers): ${message}`,
      );
      return [];
    }

    console.error(
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
            console.error(
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
      console.warn(
        `[MixRadius] Integration not available (fetchTopologyData): ${message}`,
      );
      return {
        result: { odps: [], customers: [] },
        cache,
      };
    }

    console.error("[MixRadius] Fetch topology data error:", message);
    throw new Error(`Failed to fetch topology data: ${message}`);
  }
}
