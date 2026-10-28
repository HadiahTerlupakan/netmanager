import type { SampleStreet } from "@/modules/sample-invoice";

/**
 * Nama jalan asli di dalam radius, diambil dari browser admin: pod produksi
 * tidak bisa menjangkau Overpass (timeout, dicek 2026-10-28).
 *
 * Wilayah tiap jalan diambil dari Nominatim per sel ±1 km, bukan dari
 * `is_in` Overpass: query wilayah Overpass butuh ±45 detik bahkan untuk
 * radius 2 km. Server Overpass publik sering penuh, jadi dicoba berurutan.
 */
export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const OVERPASS_TIMEOUT_MS = 30_000;
const NOMINATIM_TIMEOUT_MS = 10_000;
/** Kebijakan Nominatim: paling banyak satu permintaan per detik. */
const NOMINATIM_GAP_MS = 1100;
const MAX_AREA_LOOKUPS = 12;
/** 0,01 derajat ≈ 1,1 km. */
const CELL_PER_DEGREE = 100;

type Point = { lat: number; lng: number };
type Way = { name: string; center: Point };
type Area = Pick<SampleStreet, "village" | "district" | "city">;
type Deps = {
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
  sleep?: (ms: number) => Promise<void>;
};

export function buildOverpassQuery(center: Point, radiusM: number) {
  return `[out:json][timeout:25];way(around:${radiusM},${center.lat},${center.lng})["highway"]["name"];out tags center;`;
}

const cellKey = (point: Point) =>
  `${Math.round(point.lat * CELL_PER_DEGREE)}:${Math.round(point.lng * CELL_PER_DEGREE)}`;

export function parseOverpassWays(json: unknown): Way[] {
  const elements = (json as { elements?: unknown[] } | null)?.elements;
  if (!Array.isArray(elements)) return [];
  const seen = new Set<string>();
  const ways: Way[] = [];
  for (const element of elements as Array<{
    tags?: { name?: string };
    center?: { lat: number; lon: number };
  }>) {
    const name = element.tags?.name?.trim();
    if (!name || !element.center) continue;
    const center = { lat: element.center.lat, lng: element.center.lon };
    const key = `${name}|${cellKey(center)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    ways.push({ name, center });
  }
  return ways;
}

export function areaFromNominatim(json: unknown): Area {
  const address = (json as { address?: Record<string, string> } | null)
    ?.address;
  if (!address) return {};
  const area: Area = {
    village:
      address.village ??
      address.suburb ??
      address.neighbourhood ??
      address.hamlet,
    district: address.city_district ?? address.town ?? address.municipality,
    city: address.city ?? address.county,
  };
  return Object.fromEntries(
    Object.entries(area).filter(([, value]) => value),
  ) as Area;
}

async function fetchWays(
  center: Point,
  radiusM: number,
  fetchImpl: NonNullable<Deps["fetchImpl"]>,
) {
  const body = new URLSearchParams({
    data: buildOverpassQuery(center, radiusM),
  });
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        body,
        signal: AbortSignal.timeout(OVERPASS_TIMEOUT_MS),
      });
      if (response.ok) return parseOverpassWays(await response.json());
    } catch {
      // Server penuh atau timeout: coba server berikutnya.
    }
  }
  return null;
}

async function lookupArea(
  point: Point,
  fetchImpl: NonNullable<Deps["fetchImpl"]>,
) {
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(point.lat),
    lon: String(point.lng),
    zoom: "14",
    addressdetails: "1",
    "accept-language": "id",
  });
  try {
    const response = await fetchImpl(`${NOMINATIM_URL}?${params}`, {
      signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS),
    });
    return response.ok ? areaFromNominatim(await response.json()) : {};
  } catch {
    return {};
  }
}

const distance = (a: Point, b: Point) =>
  (a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2;

/** Wilayah per sel; sel di luar yang diperiksa memakai sel terdekat. */
async function areasByCell(ways: Way[], deps: Required<Deps>) {
  const cells = new Map<string, { point: Point; count: number }>();
  for (const way of ways) {
    const key = cellKey(way.center);
    const cell = cells.get(key) ?? { point: way.center, count: 0 };
    cells.set(key, { ...cell, count: cell.count + 1 });
  }
  const sampled = [...cells.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_AREA_LOOKUPS);

  const areas: Array<{ point: Point; area: Area }> = [];
  for (const [index, cell] of sampled.entries()) {
    if (index > 0) await deps.sleep(NOMINATIM_GAP_MS);
    areas.push({
      point: cell.point,
      area: await lookupArea(cell.point, deps.fetchImpl),
    });
  }
  return (point: Point) =>
    areas.reduce((best, candidate) =>
      distance(candidate.point, point) < distance(best.point, point)
        ? candidate
        : best,
    ).area;
}

export async function fetchStreets(
  center: Point,
  radiusM: number,
  deps: Deps = {},
): Promise<
  { ok: true; streets: SampleStreet[] } | { ok: false; message: string }
> {
  const resolved: Required<Deps> = {
    fetchImpl: deps.fetchImpl ?? ((url, init) => fetch(url, init)),
    sleep:
      deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
  };
  const ways = await fetchWays(center, radiusM, resolved.fetchImpl);
  if (!ways) {
    return {
      ok: false,
      message:
        "OpenStreetMap sedang sibuk atau tidak merespons. Coba lagi beberapa saat lagi.",
    };
  }
  if (ways.length === 0) {
    return {
      ok: false,
      message: "Tidak ada jalan bernama di area ini; perbesar radius.",
    };
  }

  const areaOf = await areasByCell(ways, resolved);
  const seen = new Set<string>();
  const streets: SampleStreet[] = [];
  for (const way of ways) {
    const street = { name: way.name, ...areaOf(way.center) };
    const key = `${street.name}|${street.village ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    streets.push(street);
  }
  return { ok: true, streets };
}
