import { describe, expect, it } from "vitest";
import { generateSampleSet } from "@/modules/sample-invoice/domain/generate-sample-set";
import { createRandom } from "@/modules/sample-invoice/domain/random";
import type { SampleGenerateInput } from "@/modules/sample-invoice/domain/types";

const STREETS = [
  {
    name: "Jalan Raya Cariu",
    village: "Cariu",
    district: "Cariu",
    city: "Bogor",
  },
  {
    name: "Jl. Pasar Lama",
    village: "Cariu",
    district: "Cariu",
    city: "Bogor",
  },
  { name: "Gang Melati", village: "Babakanraden", district: "Cariu" },
  { name: "Kampung Sawah", city: "Bogor" },
  { name: "Mekarwangi" },
];

function input(
  overrides: Partial<SampleGenerateInput> = {},
): SampleGenerateInput {
  return {
    mitraId: "mitra-1",
    mitraName: "Mitra Selawangi",
    issuer: { name: "PT Contoh", address: "Bogor", phone: "021" },
    packages: [
      { name: "Home 10", speed: "10 Mbps", price: 150000 },
      { name: "Home 20", speed: "20 Mbps", price: 250000 },
    ],
    customerCount: 10,
    fromMonth: "2026-08",
    toMonth: "2026-10",
    center: { lat: -6.5091, lng: 107.1352 },
    radiusM: 2000,
    dueDay: 10,
    payDate: { mode: "random" },
    ppn: "inclusive",
    streets: STREETS,
    ...overrides,
  };
}

const TODAY = "2026-10-28";
const run = (i = input(), seed = 42) =>
  generateSampleSet(i, { today: TODAY, random: createRandom(seed) });

describe("generateSampleSet", () => {
  it("one invoice per customer per month, customer data fixed across months", () => {
    const set = run();
    expect(set.customers).toHaveLength(10);
    expect(set.invoices).toHaveLength(30);
    set.customers.forEach((customer, index) => {
      const own = set.invoices.filter((inv) => inv.customerIndex === index);
      expect(own.map((inv) => inv.month)).toEqual([
        "2026-08",
        "2026-09",
        "2026-10",
      ]);
      const price = input().packages[customer.packageIndex].price;
      for (const inv of own) expect(inv.total).toBe(price);
    });
  });

  it("adds each package's add-ons to its customers' totals", () => {
    const set = run(
      input({
        ppn: "exclusive",
        packages: [
          {
            name: "Home 10",
            speed: "10 Mbps",
            price: 150000,
            addons: [
              { name: "Sewa modem", price: 25000 },
              { name: "IP publik", price: 50000 },
            ],
          },
        ],
      }),
    );
    for (const inv of set.invoices) {
      expect(inv.dpp).toBe(225000);
      expect(inv.ppn).toBe(24750);
      expect(inv.total).toBe(249750);
    }
  });

  it("numbers and codes use the CTH prefix and customer position", () => {
    const set = run();
    expect(set.customers[6].code).toBe("CTH-0007");
    const sept = set.invoices.find(
      (inv) => inv.customerIndex === 6 && inv.month === "2026-09",
    );
    expect(sept?.number).toBe("CTH/2026/09/0007");
  });

  it("masks every phone number", () => {
    for (const customer of run().customers) {
      expect(customer.phoneMasked).toMatch(
        /^(0812|0813|0821|0852|0857|0878|0896)-\*\*\*\*-\d{4}$/,
      );
    }
  });

  it("addresses use only the given streets", () => {
    for (const customer of run().customers) {
      const street = STREETS.find((s) => customer.address.includes(s.name));
      expect(street).toBeDefined();
      const houseNo = Number(customer.address.match(/No\. (\d+)/)?.[1]);
      expect(houseNo).toBeGreaterThanOrEqual(1);
      expect(houseNo).toBeLessThanOrEqual(200);
      for (const part of [street!.village, street!.district, street!.city]) {
        if (part) expect(customer.address).toContain(`, ${part}`);
      }
    }
  });

  it("adds Jl. only to names that are not already a road type", () => {
    const addresses = run().customers.map((c) => c.address);
    expect(addresses.some((a) => a.startsWith("Jl. Jalan"))).toBe(false);
    expect(addresses.some((a) => a.startsWith("Jl. Gang"))).toBe(false);
    const kampung = addresses.find((a) => a.includes("Kampung Sawah"));
    if (kampung) expect(kampung.startsWith("Jl. Kampung Sawah")).toBe(true);
  });

  it("random pay dates stay inside the month and not after today", () => {
    for (const inv of run().invoices) {
      expect(inv.paidDate.startsWith(inv.month)).toBe(true);
      if (inv.month === "2026-10") expect(inv.paidDate <= TODAY).toBe(true);
    }
  });

  it("fixed pay day is used for every invoice", () => {
    const set = run(input({ payDate: { mode: "fixed", day: 5 } }));
    for (const inv of set.invoices)
      expect(inv.paidDate.endsWith("-05")).toBe(true);
  });

  it("due date is the due day of the billing month", () => {
    const sept = run().invoices.find((inv) => inv.month === "2026-09");
    expect(sept?.dueDate).toBe("2026-09-10");
  });

  it("same seed gives the same set", () => {
    expect(run()).toEqual(run());
    expect(run(input(), 43)).not.toEqual(run());
  });
});
