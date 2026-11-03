import { randomUUID } from "crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * INVOICE_PAID di-commit di database billing sebelum event-nya ditulis ke
 * outbox di database utama; proses yang mati di antaranya meninggalkan
 * invoice lunas tanpa perpanjangan, aktivasi, jurnal, atau notifikasi.
 * Rekonsiliasi mencari invoice lunas tanpa baris outbox INVOICE_PAID dan
 * mengirim ulang event-nya. Diuji terhadap Postgres sungguhan karena
 * pencocokannya memakai `payload->>'invoiceId' = ANY(...)` di OutboxEvent.
 */

vi.mock("@/modules/events", () => ({
  BillingEventDispatcher: { onInvoicePaid: vi.fn(async () => undefined) },
}));

import { prismaAuth } from "@/lib/prisma";
import { prismaBillingAuth } from "@/lib/prisma-billing";
import { EVENT_NAMES, saveToOutbox } from "@/lib/event-bus";
import { runAsSystemContext } from "@/lib/tenant-context";
import { BillingEventDispatcher } from "@/modules/events";
import { replayMissingInvoicePaidEvents } from "@/modules/finance/services/invoice-paid-reconciliation";

const hasTestDb = Boolean(
  process.env.TEST_DATABASE_URL && process.env.TEST_DATABASE_URL_BILLING,
);
const describeDb = hasTestDb ? describe : describe.skip;

const TENANT = "tenant-rekon-lunas";
const PELANGGAN = "pel-rekon-lunas";
const MENIT = 60 * 1000;
const NOW = new Date();

const dispatcher = vi.mocked(BillingEventDispatcher);
const created: string[] = [];

async function invoice(
  label: string,
  options: { status: "PAID" | "SENT"; paidAt: Date | null },
) {
  const id = randomUUID();
  created.push(id);
  await prismaBillingAuth.invoice.create({
    data: {
      id,
      invoiceNumber: `REKON-${label}-${id.slice(0, 8)}`,
      pelangganId: PELANGGAN,
      dueDate: NOW,
      status: options.status,
      subtotal: 100000n,
      totalAmount: 100000n,
      paidAmount: options.status === "PAID" ? 100000n : 0n,
      paidAt: options.paidAt,
      tenantId: TENANT,
      updatedAt: NOW,
    },
  });
  return id;
}

async function paidBy(invoiceId: string, amount: bigint) {
  await prismaBillingAuth.payment.create({
    data: {
      id: randomUUID(),
      invoiceId,
      pelangganId: PELANGGAN,
      amount,
      paymentDate: NOW,
      paymentMethod: "BANK_TRANSFER",
      gatewayStatus: "PAID",
      tenantId: TENANT,
      updatedAt: NOW,
    },
  });
}

async function cleanup() {
  if (created.length === 0) return;
  await prismaBillingAuth.payment.deleteMany({
    where: { invoiceId: { in: created } },
  });
  await prismaBillingAuth.invoice.deleteMany({
    where: { id: { in: created } },
  });
  await prismaAuth.$executeRaw`
    DELETE FROM "OutboxEvent" WHERE payload->>'invoiceId' = ANY(${created})`;
  created.length = 0;
}

const replayedIds = () =>
  dispatcher.onInvoicePaid.mock.calls.map(([invoiceId]) => invoiceId);

describeDb("rekonsiliasi INVOICE_PAID", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await cleanup();
  });

  afterAll(cleanup);

  it("mengirim ulang hanya untuk invoice lunas yang event-nya tidak pernah tercatat", async () => {
    const hilang = await invoice("HILANG", {
      status: "PAID",
      paidAt: new Date(NOW.getTime() - 60 * MENIT),
    });
    await paidBy(hilang, 100000n);
    const tercatat = await invoice("TERCATAT", {
      status: "PAID",
      paidAt: new Date(NOW.getTime() - 60 * MENIT),
    });
    await saveToOutbox({
      eventName: EVENT_NAMES.INVOICE_PAID,
      payload: { invoiceId: tercatat, pelangganId: PELANGGAN, amount: 100000 },
      priority: 1,
      category: "billing",
    });
    // Jalur normal mungkin masih menulis outbox-nya.
    const baruLunas = await invoice("BARU", {
      status: "PAID",
      paidAt: new Date(NOW.getTime() - 5 * MENIT),
    });
    // Di luar jendela: barisnya bisa sudah dibersihkan.
    const lama = await invoice("LAMA", {
      status: "PAID",
      paidAt: new Date(NOW.getTime() - 5 * 24 * 60 * MENIT),
    });
    const belumLunas = await invoice("SENT", { status: "SENT", paidAt: null });

    await runAsSystemContext("tes rekonsiliasi", () =>
      replayMissingInvoicePaidEvents(NOW),
    );

    const replayed = replayedIds();
    expect(replayed).toContain(hilang);
    for (const id of [tercatat, baruLunas, lama, belumLunas]) {
      expect(replayed).not.toContain(id);
    }
    expect(dispatcher.onInvoicePaid).toHaveBeenCalledWith(
      hilang,
      PELANGGAN,
      100000,
      { amountPaid: 100000, couponDiscount: 0, saldoUsed: 0 },
      TENANT,
    );
  });
});
