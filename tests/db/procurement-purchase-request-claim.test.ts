import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Repository procurement memakai klien ber-isolasi tenant; di tes ini cukup
// klien dasar yang sama-sama menembak Postgres uji, supaya yang diuji murni
// SQL-nya.
vi.mock("@/lib/prisma", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/prisma")>();
  return { ...actual, prisma: actual.prismaAuth };
});

import { prismaAuth } from "@/lib/prisma";
import type { CreatePurchaseOrderInput } from "@/modules/procurement/domain/ports/IProcurementRepository";
import { PurchaseRequestAlreadyOrderedError } from "@/modules/procurement/domain/purchase-request-errors";
import { ProcurementRepository } from "@/modules/procurement/repositories/ProcurementRepository";

/**
 * Klaim pengajuan saat PO dibuat (PO otomatis saat persetujuan, Generate PO di
 * halaman procurement): UPDATE bersyarat APPROVED tanpa PO → ORDERED di
 * transaksi yang sama dengan pembuatan PO. Hanya Postgres yang bisa
 * membuktikan dua pembuatan bersamaan menyisakan tepat satu PO.
 *
 * Dilewati tanpa `TEST_DATABASE_URL`; lihat ./scripts/setup-test-db.sh.
 */

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

const TENANT = "tenant-uji-klaim-pr";
const USER = "user-uji-klaim-pr";
const GUDANG = "gudang-uji-klaim-pr";
const BARANG = "barang-uji-klaim-pr";
const REQUEST = "pr-uji-klaim-pr";

const repository = new ProcurementRepository();

async function bersihkan(): Promise<void> {
  await prismaAuth.purchaseRequestItem.deleteMany({
    where: { tenantId: TENANT },
  });
  await prismaAuth.purchaseRequest.deleteMany({ where: { tenantId: TENANT } });
  await prismaAuth.purchaseOrderItem.deleteMany({
    where: { tenantId: TENANT },
  });
  await prismaAuth.purchaseOrder.deleteMany({ where: { tenantId: TENANT } });
  await prismaAuth.barang.deleteMany({ where: { id: BARANG } });
  await prismaAuth.gudang.deleteMany({ where: { id: GUDANG } });
  await prismaAuth.user.deleteMany({ where: { id: USER } });
  await prismaAuth.tenant.deleteMany({ where: { id: TENANT } });
}

async function seed(requestStatus: "APPROVED" | "DRAFT"): Promise<void> {
  const now = new Date();
  await prismaAuth.tenant.create({
    data: { id: TENANT, name: "Tenant Uji Klaim PR" },
  });
  await prismaAuth.user.create({
    data: {
      id: USER,
      email: "uji-klaim-pr@example.test",
      name: "Admin Uji",
      updatedAt: now,
      tenantId: TENANT,
    },
  });
  await prismaAuth.gudang.create({
    data: {
      id: GUDANG,
      kode: "GDG-UJI-KLAIM-PR",
      nama: "Gudang Uji",
      updatedAt: now,
      tenantId: TENANT,
    },
  });
  await prismaAuth.barang.create({
    data: {
      id: BARANG,
      kode: "BRG-UJI-KLAIM-PR",
      nama: "Kabel Uji",
      satuan: "roll",
      updatedAt: now,
      tenantId: TENANT,
    },
  });
  await prismaAuth.purchaseRequest.create({
    data: {
      id: REQUEST,
      nomorRequest: REQUEST,
      status: requestStatus,
      requesterId: USER,
      gudangId: GUDANG,
      tenantId: TENANT,
      updatedAt: now,
      items: {
        create: {
          id: `${REQUEST}-item`,
          barangId: BARANG,
          jumlah: 10,
          tenantId: TENANT,
          statusApproval: requestStatus === "APPROVED" ? "APPROVED" : "PENDING",
        },
      },
    },
  });
}

function orderInput(suffix: string): CreatePurchaseOrderInput {
  return {
    id: `po-uji-klaim-pr-${suffix}`,
    poNumber: `PO-UJI-KLAIM-PR-${suffix}`,
    supplierId: null,
    createdBy: USER,
    tenantId: TENANT,
    totalAmount: 0,
    items: [
      {
        id: `poi-uji-klaim-pr-${suffix}`,
        barangId: BARANG,
        quantity: 10,
        unitPrice: 0,
        totalPrice: 0,
        tenantId: TENANT,
      },
    ],
    jasaItems: [],
    prIds: [REQUEST],
  };
}

async function readRequest(): Promise<{
  status: string;
  purchaseOrderId: string | null;
}> {
  return prismaAuth.purchaseRequest.findUniqueOrThrow({
    where: { id: REQUEST },
    select: { status: true, purchaseOrderId: true },
  });
}

describeDb("Klaim pengajuan saat PO dibuat — Postgres", () => {
  beforeEach(async () => {
    await bersihkan();
  });

  afterAll(async () => {
    await bersihkan();
  });

  it("dua pembuatan PO bersamaan untuk pengajuan yang sama: tepat satu PO tersimpan", async () => {
    await seed("APPROVED");

    const results = await Promise.allSettled([
      repository.createPOWithItems(orderInput("a")),
      repository.createPOWithItems(orderInput("b")),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(
      PurchaseRequestAlreadyOrderedError,
    );
    const orders = await prismaAuth.purchaseOrder.findMany({
      where: { tenantId: TENANT },
      select: { id: true },
    });
    expect(orders).toHaveLength(1);
    expect(await readRequest()).toEqual({
      status: "ORDERED",
      purchaseOrderId: orders[0].id,
    });
  });

  it("pengajuan yang belum disetujui tidak bisa dibuatkan PO", async () => {
    await seed("DRAFT");

    await expect(
      repository.createPOWithItems(orderInput("c")),
    ).rejects.toBeInstanceOf(PurchaseRequestAlreadyOrderedError);

    expect(
      await prismaAuth.purchaseOrder.count({ where: { tenantId: TENANT } }),
    ).toBe(0);
    expect(await readRequest()).toEqual({
      status: "DRAFT",
      purchaseOrderId: null,
    });
  });
});
