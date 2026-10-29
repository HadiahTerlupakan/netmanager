import type { PpnMode, SamplePackage } from "./types";

const PPN_RATE = 0.11;

export function splitPpn(price: number, mode: PpnMode) {
  if (mode === "none") return { dpp: price, ppn: 0, total: price };
  if (mode === "inclusive") {
    const dpp = Math.round(price / (1 + PPN_RATE));
    return { dpp, ppn: price - dpp, total: price };
  }
  const ppn = Math.round(price * PPN_RATE);
  return { dpp: price, ppn, total: price + ppn };
}

/** Harga paket ditambah add-on, sebelum diskon dan PPN. */
export function packageGross(pkg: SamplePackage) {
  return (pkg.addons ?? []).reduce(
    (sum, addon) => sum + addon.price,
    pkg.price,
  );
}

export function discountAmount(pkg: SamplePackage) {
  const { discount } = pkg;
  if (!discount) return 0;
  return discount.kind === "amount"
    ? discount.value
    : Math.round((packageGross(pkg) * discount.value) / 100);
}

/**
 * Baris rincian invoice: paket, add-on, lalu diskon sebagai baris minus.
 * PPN dihitung per baris agar jumlah baris di PDF selalu sama dengan total
 * invoice; baris diskon ikut mengurangi dasar PPN.
 */
export function invoiceLines(pkg: SamplePackage, mode: PpnMode) {
  const items = [{ name: pkg.name, price: pkg.price }, ...(pkg.addons ?? [])];
  if (pkg.discount) {
    const { name, kind, value } = pkg.discount;
    items.push({
      name: `Diskon ${name}${kind === "percent" ? ` (${value}%)` : ""}`,
      price: -discountAmount(pkg),
    });
  }
  return items.map((item) => ({
    name: item.name,
    ...splitPpn(item.price, mode),
  }));
}

/** Bulan "YYYY-MM" dari awal sampai akhir, termasuk keduanya. */
export function monthsInRange(fromMonth: string, toMonth: string): string[] {
  const [fromYear, fromMon] = fromMonth.split("-").map(Number);
  const [toYear, toMon] = toMonth.split("-").map(Number);
  const months: string[] = [];
  for (
    let index = fromYear * 12 + fromMon - 1;
    index <= toYear * 12 + toMon - 1;
    index++
  ) {
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    months.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return months;
}

export function daysInMonth(month: string) {
  const [year, mon] = month.split("-").map(Number);
  return new Date(Date.UTC(year, mon, 0)).getUTCDate();
}
