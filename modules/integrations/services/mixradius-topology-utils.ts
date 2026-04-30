import { logger } from "@/lib/logger";

const LATITUDE_NEGATION_LIMIT = 15;
const URL_LOG_PREVIEW_LENGTH = 100;

function decodeHtmlCoordinate(value: string) {
  return value
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/′/g, "'")
    .replace(/″/g, '"');
}

function normalizeLatitude(latitude: number) {
  return latitude > 0 && latitude < LATITUDE_NEGATION_LIMIT
    ? -latitude
    : latitude;
}

function logCoordinateParseFailure(params: {
  url: string;
  latStr?: string;
  lngStr?: string;
}) {
  if (params.latStr !== undefined && params.lngStr !== undefined) {
    logger.warn("[MixRadius] Failed to parse coordinates", {
      latStr: params.latStr,
      lngStr: params.lngStr,
    });
    return;
  }

  logger.warn("[MixRadius] No coordinate match in URL", {
    urlPreview: params.url.substring(0, URL_LOG_PREVIEW_LENGTH),
  });
}

/** Parse DMS or decimal coordinate text into decimal value. */
export function parseDMSToDecimal(dms: string): number | null {
  if (!dms) {
    return null;
  }

  const cleaned = decodeHtmlCoordinate(dms);
  const dmsRegex = /(-?)(\d+)[°](\d+)['](\d+\.?\d*)["']?/;
  const match = cleaned.match(dmsRegex);

  if (match) {
    const sign = match[1] === "-" ? -1 : 1;
    const degrees = parseFloat(match[2] ?? "0");
    const minutes = parseFloat(match[3] ?? "0");
    const seconds = parseFloat(match[4] ?? "0");
    return sign * (degrees + minutes / 60 + seconds / 3600);
  }

  const decimal = parseFloat(cleaned);
  return Number.isNaN(decimal) ? null : decimal;
}

/** Parse Google Maps place URL into latitude and longitude. */
export function parseGoogleMapsCoords(
  url: string,
): { lat: number; lng: number } | null {
  if (!url) {
    return null;
  }

  const cleaned = decodeHtmlCoordinate(url);
  const placeRegex = /maps\/place\/([^,]+),([^<>\s"]+)/;
  const match = cleaned.match(placeRegex);

  if (!match) {
    logCoordinateParseFailure({ url });
    return null;
  }

  const latStr = match[1] ?? "";
  const lngStr = match[2] ?? "";
  const lat = parseDMSToDecimal(latStr);
  const lng = parseDMSToDecimal(lngStr);

  if (lat === null || lng === null) {
    logCoordinateParseFailure({ url, latStr, lngStr });
    return null;
  }

  return { lat: normalizeLatitude(lat), lng };
}
