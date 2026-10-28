import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  OVERPASS_ENDPOINTS,
  areaFromNominatim,
  buildOverpassQuery,
  fetchStreets,
  parseOverpassWays,
} from "@/app/admin/finance/invoice-contoh/overpass";

const fixture = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf8"));
const ways = fixture("overpass-cibinong.json");
const reverse = fixture("nominatim-cibinong.json");
const CENTER = { lat: -6.4826, lng: 106.8435 };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("OpenStreetMap street lookup", () => {
  it("asks Overpass for named roads with their centre in the radius", () => {
    expect(buildOverpassQuery(CENTER, 3000)).toBe(
      '[out:json][timeout:25];way(around:3000,-6.4826,106.8435)["highway"]["name"];out tags center;',
    );
  });

  it("keeps named ways with a centre, one per name and area cell", () => {
    const parsed = parseOverpassWays(ways);
    expect(parsed.length).toBeGreaterThanOrEqual(5);
    expect(parsed.every((way) => way.name && way.center)).toBe(true);
    expect(parseOverpassWays({})).toEqual([]);
    expect(parseOverpassWays(null)).toEqual([]);
  });

  it("reads village, district and regency from Nominatim", () => {
    expect(areaFromNominatim(reverse)).toEqual({
      village: "Pakansari",
      district: "Cibinong",
      city: "Bogor",
    });
    expect(areaFromNominatim({})).toEqual({});
  });

  it("falls back to the next Overpass server and names each street's area", async () => {
    const sleep = vi.fn(async () => {});
    const fetchImpl = vi.fn(async (url: string) => {
      if (url === OVERPASS_ENDPOINTS[0]) return json({}, 502);
      if (OVERPASS_ENDPOINTS.includes(url)) return json(ways);
      return json(reverse);
    });

    const result = await fetchStreets(CENTER, 3000, { fetchImpl, sleep });

    expect(result.ok).toBe(true);
    if (!("streets" in result)) return;
    expect(result.streets.length).toBeGreaterThanOrEqual(5);
    expect(result.streets[0]).toMatchObject({
      village: "Pakansari",
      district: "Cibinong",
      city: "Bogor",
    });
    const reverseCalls = fetchImpl.mock.calls.filter(([url]) =>
      url.includes("nominatim"),
    );
    expect(reverseCalls.length).toBeGreaterThan(0);
    expect(reverseCalls.length).toBeLessThanOrEqual(12);
    // Kebijakan Nominatim: paling banyak satu permintaan per detik.
    expect(sleep).toHaveBeenCalledTimes(reverseCalls.length - 1);
    expect(sleep).toHaveBeenCalledWith(1100);
  });

  it("explains when every Overpass server is busy", async () => {
    const fetchImpl = vi.fn(async () => json({}, 429));

    const result = await fetchStreets(CENTER, 3000, {
      fetchImpl,
      sleep: async () => {},
    });

    expect(result).toEqual({
      ok: false,
      message: expect.stringMatching(/OpenStreetMap sedang sibuk/),
    });
  });

  it("explains a timeout", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new DOMException("timeout", "TimeoutError");
    });

    const result = await fetchStreets(CENTER, 3000, {
      fetchImpl,
      sleep: async () => {},
    });

    expect("message" in result && result.message).toMatch(/sibuk|coba lagi/i);
  });

  it("explains an area without named streets", async () => {
    const fetchImpl = vi.fn(async () => json({ elements: [] }));

    const result = await fetchStreets(CENTER, 3000, {
      fetchImpl,
      sleep: async () => {},
    });

    expect("message" in result && result.message).toMatch(/perbesar radius/);
  });

  it("keeps the streets when Nominatim fails, without area names", async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes("nominatim") ? json({}, 503) : json(ways),
    );

    const result = await fetchStreets(CENTER, 3000, {
      fetchImpl,
      sleep: async () => {},
    });

    expect(result.ok).toBe(true);
    if ("streets" in result) expect(result.streets[0].village).toBeUndefined();
  });
});
