import { describe, expect, it } from "vitest";
import {
  invoiceLines,
  monthsInRange,
  splitPpn,
} from "@/modules/sample-invoice/domain/money";

describe("PPN dan rentang bulan invoice contoh", () => {
  it("memisahkan PPN yang sudah termasuk harga", () => {
    expect(splitPpn(250000, "inclusive")).toEqual({
      dpp: 225225,
      ppn: 24775,
      total: 250000,
    });
  });

  it("menambahkan PPN ke harga", () => {
    expect(splitPpn(250000, "exclusive")).toEqual({
      dpp: 250000,
      ppn: 27500,
      total: 277500,
    });
  });

  it("tanpa PPN tidak menambah apa pun", () => {
    expect(splitPpn(150000, "none")).toEqual({
      dpp: 150000,
      ppn: 0,
      total: 150000,
    });
  });

  it("satu baris untuk paket tanpa add-on, juga untuk paket lama tanpa field addons", () => {
    expect(
      invoiceLines({ name: "Home", speed: "20 Mbps", price: 250000 }, "none"),
    ).toEqual([{ name: "Home", dpp: 250000, ppn: 0, total: 250000 }]);
  });

  it("add-on menjadi baris sendiri dengan PPN-nya sendiri", () => {
    const lines = invoiceLines(
      {
        name: "Home",
        speed: "20 Mbps",
        price: 250000,
        addons: [{ name: "Sewa modem", price: 25000 }],
      },
      "inclusive",
    );
    expect(lines).toEqual([
      { name: "Home", dpp: 225225, ppn: 24775, total: 250000 },
      { name: "Sewa modem", dpp: 22523, ppn: 2477, total: 25000 },
    ]);
  });

  it("diskon persen dihitung dari paket + add-on dan menjadi baris minus", () => {
    const lines = invoiceLines(
      {
        name: "Home",
        speed: "20 Mbps",
        price: 250000,
        addons: [{ name: "Sewa modem", price: 50000 }],
        discount: { name: "Promo loyal", kind: "percent", value: 10 },
      },
      "none",
    );
    expect(lines.at(-1)).toEqual({
      name: "Diskon Promo loyal (10%)",
      dpp: -30000,
      ppn: 0,
      total: -30000,
    });
    expect(lines.reduce((sum, line) => sum + line.total, 0)).toBe(270000);
  });

  it("diskon nominal mengurangi dasar PPN", () => {
    const lines = invoiceLines(
      {
        name: "Home",
        speed: "20 Mbps",
        price: 250000,
        discount: { name: "Promo", kind: "amount", value: 50000 },
      },
      "exclusive",
    );
    const sum = (key: "dpp" | "ppn" | "total") =>
      lines.reduce((total, line) => total + line[key], 0);
    expect(lines.at(-1)?.name).toBe("Diskon Promo");
    expect(sum("dpp")).toBe(200000);
    expect(sum("ppn")).toBe(22000);
    expect(sum("total")).toBe(222000);
  });

  it("rentang bulan melewati pergantian tahun", () => {
    expect(monthsInRange("2026-11", "2027-02")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
  });
});
