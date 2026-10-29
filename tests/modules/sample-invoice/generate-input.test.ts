import { describe, expect, it } from "vitest";
import { parseGenerateInput } from "@/modules/sample-invoice/validators/generate-input";
import { DEFAULT_SAMPLE_INVOICE_LIMITS } from "@/modules/sample-invoice/services/sample-invoice-limits";

const TODAY = "2026-10-28";
const streets = Array.from({ length: 5 }, (_, i) => ({
  name: `Jalan ${i}`,
  city: "Bogor",
}));

function raw(overrides: Record<string, unknown> = {}) {
  return {
    mitraId: "m1",
    mitraName: "Mitra Selawangi",
    issuer: { name: "PT Contoh", address: "Bogor", phone: "021" },
    packages: [{ name: "Home 10", speed: "10 Mbps", price: 150000 }],
    customerCount: 50,
    fromMonth: "2026-05",
    toMonth: "2026-10",
    center: { lat: -6.5, lng: 107.1 },
    radiusM: 2000,
    dueDay: 10,
    payDate: { mode: "random" },
    ppn: "inclusive",
    streets,
    ...overrides,
  };
}

const parse = (value: unknown, limits = DEFAULT_SAMPLE_INVOICE_LIMITS) =>
  parseGenerateInput(value, limits, TODAY);

function message(value: unknown, limits = DEFAULT_SAMPLE_INVOICE_LIMITS) {
  const result = parse(value, limits);
  expect(result.ok).toBe(false);
  return "message" in result ? result.message : "";
}

describe("parseGenerateInput", () => {
  it("accepts a valid form", () => {
    const result = parse(raw());
    expect(result.ok).toBe(true);
  });

  it("rejects months after the current month and reversed ranges", () => {
    expect(message(raw({ toMonth: "2026-11" }))).toMatch(/bulan berjalan/);
    expect(message(raw({ fromMonth: "2026-09", toMonth: "2026-08" }))).toMatch(
      /bulan awal/i,
    );
  });

  it("names the limit and the requested number", () => {
    expect(message(raw({ customerCount: 501 }))).toMatch(/501.*500|500.*501/);
    expect(message(raw({ fromMonth: "2025-10" }))).toMatch(/13.*12|12.*13/);
    expect(
      message(raw({ customerCount: 400 }), {
        ...DEFAULT_SAMPLE_INVOICE_LIMITS,
        maxPdfs: 2000,
      }),
    ).toMatch(/2400.*2000|2\.400.*2\.000/);
  });

  it("rejects a fixed pay day still in the future for the current month", () => {
    const fixed28 = (toMonth = "2026-10") =>
      raw({ payDate: { mode: "fixed", day: 28 }, toMonth });
    const limits = DEFAULT_SAMPLE_INVOICE_LIMITS;

    expect(parseGenerateInput(fixed28(), limits, "2026-10-28").ok).toBe(true);
    const early = parseGenerateInput(fixed28(), limits, "2026-10-27");
    expect(early.ok).toBe(false);
    expect("message" in early ? early.message : "").toMatch(/28/);
    expect(
      parseGenerateInput(fixed28("2026-09"), limits, "2026-10-27").ok,
    ).toBe(true);
  });

  it("rejects out-of-range radius, due day, packages and prices", () => {
    expect(message(raw({ radiusM: 199 }))).not.toBe("");
    expect(message(raw({ radiusM: 10001 }))).not.toBe("");
    expect(message(raw({ dueDay: 29 }))).not.toBe("");
    expect(message(raw({ packages: [] }))).not.toBe("");
    expect(
      message(raw({ packages: [{ name: "A", speed: "1", price: 0 }] })),
    ).not.toBe("");
    expect(
      message(raw({ packages: [{ name: "A", speed: "1", price: 1.5 }] })),
    ).not.toBe("");
  });

  it("accepts add-ons on a package and keeps them", () => {
    const addons = [{ name: "Sewa modem", price: 25000 }];
    const result = parse(
      raw({
        packages: [
          { name: "Home 10", speed: "10 Mbps", price: 150000, addons },
        ],
      }),
    );
    expect(result.ok && result.input.packages[0].addons).toEqual(addons);
  });

  it("rejects an add-on without a name or a positive whole price", () => {
    const withAddon = (addon: unknown) =>
      raw({
        packages: [
          { name: "Home 10", speed: "10 Mbps", price: 150000, addons: [addon] },
        ],
      });
    expect(message(withAddon({ name: "", price: 25000 }))).not.toBe("");
    expect(message(withAddon({ name: "Modem", price: 0 }))).not.toBe("");
    expect(message(withAddon({ name: "Modem", price: 2.5 }))).not.toBe("");
  });

  it("accepts a package discount and keeps it", () => {
    const discount = { name: "Promo loyal", kind: "percent", value: 10 };
    const result = parse(
      raw({
        packages: [
          { name: "Home 10", speed: "10 Mbps", price: 150000, discount },
        ],
      }),
    );
    expect(result.ok && result.input.packages[0].discount).toEqual(discount);
  });

  it("rejects a discount that is unnamed, not whole, or leaves nothing to pay", () => {
    const withDiscount = (discount: unknown) =>
      raw({
        packages: [
          {
            name: "Home 10",
            speed: "10 Mbps",
            price: 150000,
            addons: [{ name: "Modem", price: 50000 }],
            discount,
          },
        ],
      });
    expect(
      message(withDiscount({ name: "", kind: "amount", value: 1000 })),
    ).not.toBe("");
    expect(
      message(withDiscount({ name: "P", kind: "percent", value: 100 })),
    ).not.toBe("");
    expect(
      message(withDiscount({ name: "P", kind: "percent", value: 0 })),
    ).not.toBe("");
    expect(
      message(withDiscount({ name: "P", kind: "amount", value: 200000 })),
    ).not.toBe("");
    expect(
      parse(withDiscount({ name: "P", kind: "amount", value: 199999 })).ok,
    ).toBe(true);
  });

  it("cleans the street list from the browser", () => {
    const result = parse(
      raw({
        streets: [
          ...streets,
          { name: "  Jalan 0  ", city: "Bogor" },
          { name: "<script>Jalan X</script>" },
          { name: "   " },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const names = result.input.streets.map((s) => s.name);
    expect(names.filter((n) => n === "Jalan 0")).toHaveLength(1);
    expect(names.some((n) => /[<>]/.test(n))).toBe(false);
    expect(names).not.toContain("");
  });

  it("caps the street list at 2000 entries", () => {
    const many = Array.from({ length: 5000 }, (_, i) => ({
      name: `Jalan ${i}`,
    }));
    const result = parse(raw({ streets: many }));
    expect(result.ok && result.input.streets.length).toBe(2000);
  });

  it("needs at least 5 named streets", () => {
    expect(message(raw({ streets: streets.slice(0, 4) }))).toMatch(/radius/);
  });
});
