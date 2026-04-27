import { describe, expect, it } from "vitest";

import { escapeCsvCell } from "@/lib/csv";

describe("escapeCsvCell", () => {
  it("escapes quotes and wraps values", () => {
    expect(escapeCsvCell('Nama "Site"')).toBe('"Nama ""Site"""');
  });

  it("normalizes newlines and trims string values", () => {
    expect(escapeCsvCell("  Baris 1\nBaris 2  ")).toBe('"Baris 1 Baris 2"');
  });

  it("neutralizes spreadsheet formulas for string values", () => {
    expect(escapeCsvCell("=HYPERLINK(bad)")).toBe('"\'=HYPERLINK(bad)"');
    expect(escapeCsvCell("@danger")).toBe('"\'@danger"');
  });

  it("keeps numeric negative values unchanged", () => {
    expect(escapeCsvCell(-100_000)).toBe('"-100000"');
  });
});
