import { logger } from "@/lib/logger";

import type { MixRadiusODP, MixRadiusODPCustomer } from "./mixradius-types";
import {
  parseDMSToDecimal,
  parseGoogleMapsCoords,
} from "./mixradius-topology-utils";

type MixRadiusOdpRawItem = Record<string, unknown>;

function parseCoordinate(value: unknown) {
  const coordinate = String(value || "");
  return coordinate.includes("°")
    ? parseDMSToDecimal(coordinate) || 0
    : parseFloat(coordinate) || 0;
}

function normalizeLatitude(latitude: number) {
  return latitude > 0 && latitude < 15 ? -latitude : latitude;
}

export function isIndonesianCoordinate(latitude: number, longitude: number) {
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
  const odpName =
    html.match(/name="name"[^>]*value="([^"]+)"/i)?.[1] ?? `ODP-${odpId}`;
  const tableContent = html.match(
    /<table[^>]*id="dynamic-table"[^>]*>([\s\S]*?)<\/table>/i,
  )?.[1];
  if (!tableContent) {
    return [];
  }

  return parseCustomerRows(tableContent, odpId, odpName);
}

function parseCustomerRows(
  tableContent: string,
  odpId: string,
  odpName: string,
) {
  const customers: MixRadiusODPCustomer[] = [];
  const rowRegex = /<tr>([\s\S]*?)<\/tr>/gi;
  let currentRowMatch: RegExpMatchArray | null;

  while ((currentRowMatch = rowRegex.exec(tableContent)) !== null) {
    const customer = parseCustomerRow(currentRowMatch[1] ?? "", odpId, odpName);
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

  const customerId = cells[0]?.match(/value="(\d+)"/)?.[1] || "";
  const coordinates = extractCustomerCoordinates(cells[6] ?? "");
  if (!customerId || !coordinates) {
    return null;
  }

  if (!isIndonesianCoordinate(coordinates.lat, coordinates.lng)) {
    logger.warn(
      `[MixRadius] Invalid coords for customer ${customerId}: lat=${coordinates.lat}, lng=${coordinates.lng}`,
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
    odpId,
    odpName,
    latitude: coordinates.lat,
    longitude: coordinates.lng,
  };
}

function extractTableCells(rowHtml: string) {
  const cells: string[] = [];
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let currentCellMatch: RegExpMatchArray | null;

  while ((currentCellMatch = cellRegex.exec(rowHtml)) !== null) {
    cells.push(currentCellMatch[1] ?? "");
  }

  return cells;
}

function extractCustomerCoordinates(cellHtml: string) {
  const mapsLink = cellHtml.match(/href="([^"]*google\.com\/maps[^"]*)"/i)?.[1];
  return mapsLink ? parseGoogleMapsCoords(mapsLink) : null;
}
