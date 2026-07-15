import { describe, expect, it } from "vitest";

import {
  detectNodeTypeFromName,
  normalizeCoordinates,
  parseCsv,
} from "@/modules/map/services/MapCsvImportService";

describe("MapCsvImportService helpers", () => {
  describe("detectNodeTypeFromName", () => {
    it("detects ODP prefix", () => {
      expect(detectNodeTypeFromName("ODP-BLJ-01")).toBe("odp");
      expect(detectNodeTypeFromName("odp-001-rck")).toBe("odp");
    });

    it("detects ODC prefix", () => {
      expect(detectNodeTypeFromName("ODC-02-KRW2")).toBe("odc");
    });

    it("detects OLT and ONT prefix", () => {
      expect(detectNodeTypeFromName("OLT-MAIN")).toBe("olt");
      expect(detectNodeTypeFromName("ONT-CUS-01")).toBe("ont");
    });

    it("defaults to odp when prefix unknown", () => {
      expect(detectNodeTypeFromName("NODE-XYZ")).toBe("odp");
      expect(detectNodeTypeFromName("")).toBe("odp");
    });
  });

  describe("normalizeCoordinates", () => {
    it("keeps valid lat/lon as-is", () => {
      const result = normalizeCoordinates(-6.31, 107.27);
      expect(result).toEqual({
        latitude: -6.31,
        longitude: 107.27,
        swapped: false,
      });
    });

    it("swaps when lat/lon are inverted", () => {
      // lat=107.287 is out of range, lon=6.313 is valid lat
      const result = normalizeCoordinates(107.287071, 6.313818);
      expect(result.swapped).toBe(true);
      expect(result.latitude).toBeCloseTo(6.313818);
      expect(result.longitude).toBeCloseTo(107.287071);
    });
  });

  describe("parseCsv", () => {
    it("parses quoted fields and headers", () => {
      const csv = `name,area,owner,latitude,longitude,notes
"ODP-BLJ-01","Pangkal Pinang","PANGKALPINANG",-2.116806,106.100417,"lat forced negative"
"ODC-02-KRW2","KARAWANG","KARAWANG",-6.311952,107.281377,"ok"`;

      const { headers, rows } = parseCsv(csv);
      expect(headers).toEqual([
        "name",
        "area",
        "owner",
        "latitude",
        "longitude",
        "notes",
      ]);
      expect(rows).toHaveLength(2);
      expect(rows[0].name).toBe("ODP-BLJ-01");
      expect(rows[0].latitude).toBe("-2.116806");
      expect(rows[1].name).toBe("ODC-02-KRW2");
    });

    it("handles empty content", () => {
      const { headers, rows } = parseCsv("");
      expect(headers).toEqual([]);
      expect(rows).toEqual([]);
    });
  });
});
