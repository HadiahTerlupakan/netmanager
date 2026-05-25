/**
 * Seed data sample untuk modul Procurement.
 *
 * Idempotent: aman di-run berulang. Cek existence berdasarkan kode/nomor
 * unik sebelum insert. Tidak mengubah data yang sudah ada.
 *
 * Yang di-seed:
 * - 5 supplier ISP-relevan (FO cable, ONT, splitter, network gear, jasa)
 * - 1 GRN dari PO yang sudah RECEIVED (memanfaatkan PO existing)
 * - 1 RTV dari GRN tersebut (alasan: barang rusak)
 *
 * Run: npx tsx prisma/seed-procurement.ts
 */
import { prisma } from "@/lib/prisma";

interface SupplierSeed {
  code: string;
  name: string;
  address: string;
  contact: string;
  email: string;
  phone: string;
  npwp: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
}

const SUPPLIERS: SupplierSeed[] = [
  {
    code: "SUP-001",
    name: "PT Fiber Nusantara Sejahtera",
    address: "Jl. Industri Raya Blok C No. 12, Cikarang Barat, Bekasi 17530",
    contact: "Bpk. Hendra Wijaya",
    email: "sales@fibernusantara.co.id",
    phone: "021-89901234",
    npwp: "01.234.567.8-123.000",
    bankName: "BCA",
    bankAccountNumber: "1234567890",
    bankAccountHolder: "PT Fiber Nusantara Sejahtera",
  },
  {
    code: "SUP-002",
    name: "CV Mitra Telekomunikasi Indonesia",
    address: "Jl. Cipinang Indah Raya No. 45, Jakarta Timur 13420",
    contact: "Ibu Sari Pratama",
    email: "order@mitratelkom.id",
    phone: "021-47863921",
    npwp: "02.345.678.9-234.000",
    bankName: "Mandiri",
    bankAccountNumber: "1340009876543",
    bankAccountHolder: "CV Mitra Telekomunikasi Indonesia",
  },
  {
    code: "SUP-003",
    name: "PT Sinar Kabel Optik",
    address: "Kawasan Industri Pulogadung Blok A No. 8, Jakarta Timur",
    contact: "Bpk. Bambang Setiawan",
    email: "purchasing@sinarkabel.com",
    phone: "021-46802355",
    npwp: "03.456.789.0-345.000",
    bankName: "BNI",
    bankAccountNumber: "0234567891",
    bankAccountHolder: "PT Sinar Kabel Optik",
  },
  {
    code: "SUP-004",
    name: "PT Network Gear Solution",
    address: "Jl. Boulevard Raya QF1 No. 5, Kelapa Gading, Jakarta Utara",
    contact: "Bpk. Andre Tanuwijaya",
    email: "sales@networkgear.id",
    phone: "021-45867123",
    npwp: "04.567.890.1-456.000",
    bankName: "BRI",
    bankAccountNumber: "0345678912345",
    bankAccountHolder: "PT Network Gear Solution",
  },
  {
    code: "SUP-005",
    name: "CV Bangun Jaya Konstruksi",
    address: "Jl. Margonda Raya No. 88, Depok 16424",
    contact: "Bpk. Ridwan Kamil",
    email: "info@bangunjaya.co.id",
    phone: "021-77819922",
    npwp: "05.678.901.2-567.000",
    bankName: "BCA",
    bankAccountNumber: "9876543210",
    bankAccountHolder: "CV Bangun Jaya Konstruksi",
  },
];

async function seedSuppliers(tenantId: string): Promise<string[]> {
  const ids: string[] = [];
  for (const s of SUPPLIERS) {
    const existing = await prisma.supplier.findFirst({
      where: { code: s.code, tenantId },
    });
    if (existing) {
      console.log(`[seed-procurement] supplier ${s.code} already exists, skip`);
      ids.push(existing.id);
      continue;
    }
    const created = await prisma.supplier.create({
      data: { ...s, tenantId, status: "ACTIVE" },
    });
    console.log(`[seed-procurement] supplier ${s.code} created: ${created.id}`);
    ids.push(created.id);
  }
  return ids;
}

async function linkPoToSupplier(
  poId: string,
  supplierId: string,
): Promise<void> {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po) {
    console.log(`[seed-procurement] PO ${poId} not found, skip link`);
    return;
  }
  if (po.supplierId) {
    console.log(`[seed-procurement] PO ${po.poNumber} already linked, skip`);
    return;
  }
  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { supplierId },
  });
  console.log(`[seed-procurement] PO ${po.poNumber} linked to supplier`);
}

async function seedGoodsReceiptForReceivedPo(
  tenantId: string,
  receiverUserId: string,
): Promise<string | null> {
  const receivedPo = await prisma.purchaseOrder.findFirst({
    where: { tenantId, status: "RECEIVED" },
    include: { items: true },
  });
  if (!receivedPo) {
    console.log("[seed-procurement] no RECEIVED PO found, skip GRN seed");
    return null;
  }

  const existingGrn = await prisma.goodsReceipt.findFirst({
    where: { purchaseOrderId: receivedPo.id, tenantId },
  });
  if (existingGrn) {
    console.log(
      `[seed-procurement] GRN for PO ${receivedPo.poNumber} already exists, skip`,
    );
    return existingGrn.id;
  }

  const gudang = await prisma.gudang.findFirst({
    where: { tenantId },
  });
  if (!gudang) {
    console.log("[seed-procurement] no gudang found, cannot seed GRN");
    return null;
  }

  const grnNumber = `GRN/2026/01/0001`;
  const grn = await prisma.goodsReceipt.create({
    data: {
      grnNumber,
      purchaseOrderId: receivedPo.id,
      gudangId: gudang.id,
      receivedById: receiverUserId,
      tenantId,
      notes:
        "Seed data: penerimaan pertama untuk testing workflow procurement.",
      items: {
        create: receivedPo.items.map((item) => ({
          purchaseOrderItemId: item.id,
          barangId: item.barangId,
          quantity: item.quantity,
          tenantId,
        })),
      },
    },
    include: { items: true },
  });
  console.log(
    `[seed-procurement] GRN ${grn.grnNumber} created (${grn.items.length} item)`,
  );

  for (const item of grn.items) {
    await prisma.purchaseOrderItem.update({
      where: { id: item.purchaseOrderItemId },
      data: { receivedQuantity: { increment: item.quantity } },
    });
  }

  return grn.id;
}

async function seedGoodsReturnForGrn(
  tenantId: string,
  grnId: string,
  returnerUserId: string,
): Promise<void> {
  const existingRtv = await prisma.goodsReturn.findFirst({
    where: { goodsReceiptId: grnId, tenantId },
  });
  if (existingRtv) {
    console.log(
      `[seed-procurement] RTV for GRN already exists: ${existingRtv.rtvNumber}, skip`,
    );
    return;
  }

  const grn = await prisma.goodsReceipt.findUnique({
    where: { id: grnId },
    include: { items: true, purchaseOrder: true },
  });
  if (!grn || grn.items.length === 0) {
    console.log("[seed-procurement] GRN not found / no items, skip RTV");
    return;
  }

  const firstItem = grn.items[0];
  if (firstItem.quantity < 1) {
    console.log("[seed-procurement] GRN item qty < 1, skip RTV");
    return;
  }

  const rtv = await prisma.goodsReturn.create({
    data: {
      rtvNumber: `RTV/2026/01/0001`,
      goodsReceiptId: grn.id,
      supplierId: grn.purchaseOrder.supplierId,
      gudangId: grn.gudangId,
      reason: "DAMAGED",
      status: "SENT",
      returnedById: returnerUserId,
      tenantId,
      notes:
        "Seed data: 1 unit barang ditemukan rusak saat unboxing, dikembalikan ke vendor.",
      items: {
        create: [
          {
            goodsReceiptItemId: firstItem.id,
            barangId: firstItem.barangId,
            quantity: 1,
            tenantId,
            notes: "Casing pecah, packaging tidak rapi.",
          },
        ],
      },
    },
  });
  console.log(`[seed-procurement] RTV ${rtv.rtvNumber} created`);
}

async function main(): Promise<void> {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true },
  });
  if (tenants.length === 0) {
    console.log("[seed-procurement] no tenant found, abort");
    return;
  }

  for (const tenant of tenants) {
    console.log(`\n[seed-procurement] tenant=${tenant.name} (${tenant.id})`);

    const supplierIds = await seedSuppliers(tenant.id);
    if (supplierIds.length === 0) continue;

    const unlinkedPos = await prisma.purchaseOrder.findMany({
      where: { tenantId: tenant.id, supplierId: null },
      select: { id: true },
    });
    for (const po of unlinkedPos) {
      const randomSupplier =
        supplierIds[Math.floor(Math.random() * supplierIds.length)];
      await linkPoToSupplier(po.id, randomSupplier);
    }

    const adminUser = await prisma.user.findFirst({
      where: { tenantId: tenant.id },
      select: { id: true },
    });
    if (!adminUser) {
      console.log("[seed-procurement] no user found, skip GRN/RTV");
      continue;
    }

    const grnId = await seedGoodsReceiptForReceivedPo(tenant.id, adminUser.id);
    if (grnId) {
      await seedGoodsReturnForGrn(tenant.id, grnId, adminUser.id);
    }
  }

  console.log("\n[seed-procurement] done");
}

main()
  .catch((e) => {
    console.error("[seed-procurement] FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
