import { logger } from "@/lib/logger";
export function parseDMSToDecimal(dms: string): number | null {
  if (!dms) return null;

  const cleaned = dms
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/'/g, "'")
    .replace(/'/g, "'")
    .replace(/′/g, "'")
    .replace(/″/g, '"');

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
  if (!isNaN(decimal)) return decimal;

  logger.warn(`[MixRadius] Could not parse DMS: "${dms}" -> "${cleaned}"`);
  return null;
}

export function parseGoogleMapsCoords(
  url: string,
): { lat: number; lng: number } | null {
  if (!url) return null;

  const cleaned = url
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'");

  const placeRegex = /maps\/place\/([^,]+),([^<>\s"]+)/;
  const match = cleaned.match(placeRegex);

  if (match) {
    const latStr = match[1] ?? "";
    const lngStr = match[2] ?? "";

    const lat = parseDMSToDecimal(latStr);
    const lng = parseDMSToDecimal(lngStr);

    if (lat !== null && lng !== null) {
      return {
        lat: lat > 0 && lat < 15 ? -lat : lat,
        lng,
      };
    }

    logger.warn(
      `[MixRadius] Failed to parse coords: lat="${latStr}" -> ${lat}, lng="${lngStr}" -> ${lng}`,
    );
  } else {
    logger.warn(
      `[MixRadius] No coordinate match in URL: ${url.substring(0, 100)}`,
    );
  }

  return null;
}
