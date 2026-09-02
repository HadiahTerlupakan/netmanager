import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import {
  createBillingCatchUpRange,
  createExistingInvoiceKey,
  resolveInvoiceDueDate,
} from "@/modules/finance/services/automatic-billing.helpers";

describe("createBillingCatchUpRange", () => {
  const today = new Date(2026, 8, 10, 14, 30); // 10 Sep 2026
  const daysBeforeDue = 5;

  it("berakhir pada akhir hari target (hari ini + window)", () => {
    const range = createBillingCatchUpRange(today, daysBeforeDue);

    expect(range.end.getFullYear()).toBe(2026);
    expect(range.end.getMonth()).toBe(8);
    expect(range.end.getDate()).toBe(15);
    expect(range.end.getHours()).toBe(23);
    expect(range.end.getMilliseconds()).toBe(999);
  });

  // Regresi: query lama mencocokkan EXTRACT(DAY FROM jatuhTempo) = targetDay.
  // Bila cron gagal sehari, kohort tanggal itu terlewat permanen.
  it("masih mencakup jatuh tempo dari hari yang terlewat", () => {
    const range = createBillingCatchUpRange(today, daysBeforeDue);
    const missedYesterday = new Date(2026, 8, 14, 12, 0); // target kemarin

    expect(missedYesterday >= range.start && missedYesterday <= range.end).toBe(
      true,
    );
  });

  // Regresi: tanpa batas bulan/tahun, pelanggan dengan jatuh tempo jauh di
  // masa depan ikut cocok dan ditagih lebih awal.
  it("tidak mencakup jatuh tempo bulan berikutnya", () => {
    const range = createBillingCatchUpRange(today, daysBeforeDue);
    const nextMonth = new Date(2026, 9, 15, 12, 0);

    expect(nextMonth <= range.end).toBe(false);
  });

  it("tidak mencakup jatuh tempo tahun depan dengan tanggal sama", () => {
    const range = createBillingCatchUpRange(today, daysBeforeDue);
    const nextYear = new Date(2027, 8, 15, 12, 0);

    expect(nextYear <= range.end).toBe(false);
  });

  it("memberi batas bawah, bukan rentang tak terhingga", () => {
    const range = createBillingCatchUpRange(today, daysBeforeDue);

    expect(range.start.getTime()).toBeGreaterThan(
      new Date(2026, 0, 1).getTime(),
    );
    expect(range.start < range.end).toBe(true);
  });
});

describe("resolveInvoiceDueDate", () => {
  // Regresi: invoice harian dulu memakai targetDate (hari ini + window)
  // sebagai dueDate, bukan jatuh tempo pelanggan itu sendiri. Untuk pelanggan
  // yang jatuh temponya di bulan lain, invoice terbit dengan tanggal salah.
  it("mengikuti jatuh tempo pelanggan, bukan tanggal target", () => {
    const jatuhTempo = new Date(2026, 8, 12, 17, 45);

    const dueDate = resolveInvoiceDueDate(jatuhTempo);

    expect(dueDate.getFullYear()).toBe(2026);
    expect(dueDate.getMonth()).toBe(8);
    expect(dueDate.getDate()).toBe(12);
  });

  it("menormalkan ke awal hari supaya dedupe konsisten", () => {
    const dueDate = resolveInvoiceDueDate(new Date(2026, 8, 12, 23, 59, 59));

    expect(dueDate.getHours()).toBe(0);
    expect(dueDate.getMinutes()).toBe(0);
    expect(dueDate.getSeconds()).toBe(0);
    expect(dueDate.getMilliseconds()).toBe(0);
  });
});

describe("createExistingInvoiceKey", () => {
  // Dedupe harus per (pelanggan, jatuh tempo miliknya), bukan per tanggal
  // target global — kalau tidak, pelanggan menunggak dapat invoice tiap hari.
  it("menyamakan kunci untuk jam berbeda pada hari yang sama", () => {
    const pagi = createExistingInvoiceKey("cust-1", new Date(2026, 8, 12, 1));
    const malam = createExistingInvoiceKey("cust-1", new Date(2026, 8, 12, 23));

    expect(pagi).toBe(malam);
  });

  it("membedakan pelanggan", () => {
    const a = createExistingInvoiceKey("cust-1", new Date(2026, 8, 12));
    const b = createExistingInvoiceKey("cust-2", new Date(2026, 8, 12));

    expect(a).not.toBe(b);
  });

  it("membedakan siklus jatuh tempo pelanggan yang sama", () => {
    const september = createExistingInvoiceKey("cust-1", new Date(2026, 8, 12));
    const oktober = createExistingInvoiceKey("cust-1", new Date(2026, 9, 12));

    expect(september).not.toBe(oktober);
  });
});
