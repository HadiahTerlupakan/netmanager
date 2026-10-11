import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prismaAuth } from "@/lib/prisma";
import { runWithRequestTenantContext } from "@/lib/tenant-context";
import { MappingRepository } from "@/modules/map/repositories/MappingRepository";
import { PlanningItemRepository } from "@/modules/planning/repositories/PlanningItemRepository";

/**
 * Tes integrasi terhadap Postgres sungguhan.
 *
 * 38 berkas tes me-mock `@/lib/prisma` dan karena itu hanya bisa membuktikan
 * BENTUK sebuah query, bukan artinya. Empat hal di bawah justru soal arti, dan
 * tiruan hanya mengulang asumsi penulisnya:
 *
 *   1. `notIn: []` — apakah "tak satu pun dikecualikan" atau "tak satu pun
 *      cocok"? Dua penyapu bergantung padanya: sinkronisasi peta dengan payload
 *      kosong dan pembersihan item BoQ otomatis. Kalau artinya terbalik, yang
 *      satu tidak menghapus apa pun dan yang lain menghapus segalanya.
 *   2. Apakah `@@unique([planningId, sourceKey])` benar-benar menolak duplikat,
 *      sementara item manual ber-`sourceKey` NULL tetap boleh berjumlah berapa
 *      pun (Postgres memperlakukan NULL sebagai distinct).
 *   3. Apakah dua chokepoint peta benar-benar menyaring titik dan jalur
 *      rencana, lewat SQL yang sebenarnya dan ekstensi tenant yang hidup.
 *   4. Apakah `PlanningDocument.nodeId` ber-`SET NULL` memang MELEPAS foto
 *      alih-alih menghapusnya, dan apakah sinkronisasi peta masih merampas
 *      `planningId` dari titik yang sudah terbit.
 *
 * Dilewati tanpa `TEST_DATABASE_URL` — CI tidak menyediakan Postgres, dan
 * `npm test` harus tetap hijau tanpa database. Siapkan dengan
 * `./scripts/setup-test-db.sh`, jalankan dengan `npm run test:db`.
 */

const adaDbUji = Boolean(process.env.TEST_DATABASE_URL);
const describeDb = adaDbUji ? describe : describe.skip;

const TENANT = "tenant-uji-peta";
const TENANT_LAIN = "tenant-uji-lain";
const ctx = { tenantId: TENANT, isSuperAdmin: false };

const mappingRepo = new MappingRepository();
const itemRepo = new PlanningItemRepository();

/** Jalankan seperti request tenant, supaya ekstensi tenant ikut hidup. */
function sebagaiTenant<T>(callback: () => Promise<T>): Promise<T> {
  return runWithRequestTenantContext(
    { tenantId: TENANT, isSuperAdmin: false },
    callback,
  );
}

/** Pembuatan fixture memakai klien tanpa ekstensi: ia menulis lintas tenant. */
async function bersihkan(): Promise<void> {
  await prismaAuth.planningDocument.deleteMany({
    where: { tenantId: { in: [TENANT, TENANT_LAIN] } },
  });
  await prismaAuth.planningItem.deleteMany({
    where: { tenantId: { in: [TENANT, TENANT_LAIN] } },
  });
  await prismaAuth.mappingEdge.deleteMany({
    where: { tenantId: { in: [TENANT, TENANT_LAIN] } },
  });
  await prismaAuth.mappingNode.deleteMany({
    where: { tenantId: { in: [TENANT, TENANT_LAIN] } },
  });
  await prismaAuth.planning.deleteMany({
    where: { tenantId: { in: [TENANT, TENANT_LAIN] } },
  });
}

async function siapkanTenant(): Promise<void> {
  for (const id of [TENANT, TENANT_LAIN]) {
    await prismaAuth.tenant.upsert({
      where: { id },
      update: {},
      create: { id, name: id },
    });
  }
}

async function buatPlanning(id: string, tenantId = TENANT): Promise<string> {
  const planning = await prismaAuth.planning.create({
    data: {
      id,
      tenantId,
      title: `Rencana ${id}`,
      area: "Blok A",
      estimatedUnits: 10,
    },
  });
  return planning.id;
}

type OpsiNode = {
  nodeId: string;
  isPlanned?: boolean;
  planningId?: string | null;
  tenantId?: string;
};

async function buatNode(opsi: OpsiNode): Promise<void> {
  await prismaAuth.mappingNode.create({
    data: {
      nodeId: opsi.nodeId,
      type: "odp",
      name: opsi.nodeId,
      latitude: -6.2,
      longitude: 106.8,
      tenantId: opsi.tenantId ?? TENANT,
      isPlanned: opsi.isPlanned ?? false,
      planningId: opsi.planningId ?? null,
    },
  });
}

async function buatJalur(
  edgeId: string,
  source: string,
  target: string,
  isPlanned = false,
  planningId: string | null = null,
): Promise<void> {
  await prismaAuth.mappingEdge.create({
    data: {
      edgeId,
      source,
      target,
      tenantId: TENANT,
      isPlanned,
      planningId,
      distance: 100,
    },
  });
}

describeDb("integrasi DB nyata — chokepoint peta rencana", () => {
  beforeEach(async () => {
    await siapkanTenant();
    await bersihkan();
  });

  afterAll(async () => {
    if (adaDbUji) await bersihkan();
  });

  describe("arti `notIn: []`", () => {
    it("mengecualikan NOL baris, jadi penyapu menghapus semuanya", async () => {
      await buatNode({ nodeId: "nyata-1" });
      await buatNode({ nodeId: "nyata-2" });

      const hasil = await prismaAuth.mappingNode.deleteMany({
        where: { tenantId: TENANT, nodeId: { notIn: [] } },
      });

      // Inilah yang membuat sinkronisasi peta dengan payload kosong benar-benar
      // mengosongkan topologi nyata. Kalau `notIn: []` justru tidak mencocokkan
      // apa pun, penyapu itu diam-diam tidak pernah bekerja.
      expect(hasil.count).toBe(2);
    });

    it("tetap menghormati penyaring lain di sebelahnya", async () => {
      await buatNode({ nodeId: "nyata-1" });
      await buatNode({ nodeId: "rencana-1", isPlanned: true });

      await prismaAuth.mappingNode.deleteMany({
        where: { tenantId: TENANT, isPlanned: false, nodeId: { notIn: [] } },
      });

      const sisa = await prismaAuth.mappingNode.findMany({
        where: { tenantId: TENANT },
        select: { nodeId: true },
      });
      expect(sisa.map((n) => n.nodeId)).toEqual(["rencana-1"]);
    });
  });

  describe("penyapu item BoQ otomatis", () => {
    it("`OR sourceKey: null` memang diperlukan untuk menyapu item tanpa kunci", async () => {
      const planningId = await buatPlanning("plan-boq");
      await prismaAuth.planningItem.createMany({
        data: [
          {
            planningId,
            tenantId: TENANT,
            name: "Kabel dipakai",
            unit: "m",
            quantity: 1,
            isAutoGenerated: true,
            sourceKey: "kabel:dipakai",
          },
          {
            planningId,
            tenantId: TENANT,
            name: "Kabel usang",
            unit: "m",
            quantity: 1,
            isAutoGenerated: true,
            sourceKey: "kabel:usang",
          },
          {
            planningId,
            tenantId: TENANT,
            name: "Otomatis tanpa kunci",
            unit: "m",
            quantity: 1,
            isAutoGenerated: true,
            sourceKey: null,
          },
          {
            planningId,
            tenantId: TENANT,
            name: "Manual",
            unit: "pcs",
            quantity: 1,
            isAutoGenerated: false,
            sourceKey: null,
          },
        ],
      });

      const terhapus = await sebagaiTenant(() =>
        itemRepo.hapusOtomatisYangTidakDipakai({
          planningId,
          isAutoGenerated: true,
          sourceKeyDipakai: ["kabel:dipakai"],
        }),
      );

      expect(terhapus).toBe(2);
      const sisa = await prismaAuth.planningItem.findMany({
        where: { planningId },
        select: { name: true },
        orderBy: { name: "asc" },
      });
      // Item MANUAL tidak pernah tersapu — itu angka yang diketik perencana.
      expect(sisa.map((i) => i.name)).toEqual(["Kabel dipakai", "Manual"]);
    });

    it("daftar kunci kosong menyapu seluruh item otomatis", async () => {
      const planningId = await buatPlanning("plan-boq-kosong");
      await prismaAuth.planningItem.createMany({
        data: [
          {
            planningId,
            tenantId: TENANT,
            name: "Otomatis",
            unit: "m",
            quantity: 1,
            isAutoGenerated: true,
            sourceKey: "kabel:a",
          },
          {
            planningId,
            tenantId: TENANT,
            name: "Manual",
            unit: "pcs",
            quantity: 1,
            isAutoGenerated: false,
            sourceKey: null,
          },
        ],
      });

      const terhapus = await sebagaiTenant(() =>
        itemRepo.hapusOtomatisYangTidakDipakai({
          planningId,
          isAutoGenerated: true,
          sourceKeyDipakai: [],
        }),
      );

      expect(terhapus).toBe(1);
    });
  });

  describe("unique index PlanningItem(planningId, sourceKey)", () => {
    it("menolak kunci kembar dan membuat penerbitan ulang idempoten", async () => {
      const planningId = await buatPlanning("plan-unik");
      const masukan = {
        planningId,
        tenantId: TENANT,
        sourceKey: "kabel:feeder",
        name: "Kabel feeder",
        unit: "m",
        quantity: 100,
        notes: "terukur 100 m",
        isAutoGenerated: true as const,
      };

      await sebagaiTenant(() => itemRepo.upsertBySourceKey(masukan));
      await sebagaiTenant(() =>
        itemRepo.upsertBySourceKey({ ...masukan, quantity: 150 }),
      );

      const semua = await prismaAuth.planningItem.findMany({
        where: { planningId },
      });
      // Satu baris, bukan dua: inilah penjaga klik-ganda penerbitan material.
      expect(semua).toHaveLength(1);
      expect(semua[0].quantity).toBe(150);

      // Dan index-nya nyata, bukan sekadar niat di schema.
      await expect(
        prismaAuth.planningItem.create({
          data: {
            planningId,
            tenantId: TENANT,
            name: "Duplikat",
            unit: "m",
            quantity: 1,
            isAutoGenerated: true,
            sourceKey: "kabel:feeder",
          },
        }),
      ).rejects.toThrow();
    });

    it("item manual ber-sourceKey NULL boleh berjumlah berapa pun", async () => {
      const planningId = await buatPlanning("plan-manual");
      for (const nama of ["Manual A", "Manual B", "Manual C"]) {
        await prismaAuth.planningItem.create({
          data: {
            planningId,
            tenantId: TENANT,
            name: nama,
            unit: "pcs",
            quantity: 1,
            sourceKey: null,
          },
        });
      }

      // Postgres memperlakukan NULL sebagai distinct di unique index, jadi
      // penjaga konkurensi di atas tidak pernah memblokir entri manual.
      const semua = await prismaAuth.planningItem.findMany({
        where: { planningId },
      });
      expect(semua).toHaveLength(3);
    });
  });

  describe("dua chokepoint peta", () => {
    it("daftar titik tidak pernah membocorkan titik rencana", async () => {
      const planningId = await buatPlanning("plan-titik");
      await buatNode({ nodeId: "odp-nyata" });
      await buatNode({ nodeId: "odp-rencana", isPlanned: true, planningId });
      await buatNode({ nodeId: "odp-tenant-lain", tenantId: TENANT_LAIN });

      const titik = await sebagaiTenant(() => mappingRepo.findAllNodes(ctx));

      expect(titik.map((n) => n.nodeId)).toEqual(["odp-nyata"]);
    });

    it("daftar jalur tidak pernah membocorkan jalur rencana", async () => {
      const planningId = await buatPlanning("plan-jalur");
      await buatNode({ nodeId: "a" });
      await buatNode({ nodeId: "b" });
      await buatJalur("edge-nyata", "a", "b");
      await buatJalur("edge-rencana", "a", "b", true, planningId);

      const jalur = await sebagaiTenant(() => mappingRepo.findAllEdges(ctx));

      expect(jalur.map((e) => e.edgeId)).toEqual(["edge-nyata"]);
    });

    it("lingkup rencana menembus penyaring, hanya bila diminta", async () => {
      const planningId = await buatPlanning("plan-lingkup");
      await buatNode({ nodeId: "odp-nyata" });
      await buatNode({ nodeId: "odp-rencana", isPlanned: true, planningId });

      const rencana = await sebagaiTenant(() =>
        mappingRepo.findAllNodes(ctx, { lingkup: "rencana" }),
      );
      const semua = await sebagaiTenant(() =>
        mappingRepo.findAllNodes(ctx, { lingkup: "semua" }),
      );

      expect(rencana.map((n) => n.nodeId)).toEqual(["odp-rencana"]);
      expect(semua).toHaveLength(2);
    });
  });

  describe("provenance titik terbit", () => {
    async function titikTerbitDenganFoto(): Promise<{
      planningId: string;
      documentId: string;
    }> {
      const planningId = await buatPlanning("plan-terbit");
      await buatNode({ nodeId: "odp-terbit", isPlanned: false, planningId });
      const dokumen = await prismaAuth.planningDocument.create({
        data: {
          planningId,
          tenantId: TENANT,
          filename: "survei.webp",
          fileUrl: "/uploads/planning/survei.webp",
          category: "SURVEY_PHOTO",
          nodeId: "odp-terbit",
        },
      });
      return { planningId, documentId: dokumen.id };
    }

    it("sinkronisasi peta tidak merampas planningId maupun foto survei", async () => {
      const { planningId, documentId } = await titikTerbitDenganFoto();

      await sebagaiTenant(() =>
        mappingRepo.syncAllMappingData(ctx, {
          nodes: [
            {
              nodeId: "odp-terbit",
              type: "odp",
              name: "ODP Terbit (diubah)",
              latitude: -6.3,
              longitude: 106.9,
            },
          ],
          edges: [],
        }),
      );

      const node = await prismaAuth.mappingNode.findUnique({
        where: { nodeId: "odp-terbit" },
      });
      const dokumen = await prismaAuth.planningDocument.findUnique({
        where: { id: documentId },
      });

      // Dulu bentuk hapus-semua + tulis-ulang membuat keduanya null: titik
      // kehilangan asalnya dan foto survei terlepas dari titiknya.
      expect(node?.planningId).toBe(planningId);
      expect(dokumen?.nodeId).toBe("odp-terbit");
      // Dan payload tetap diterapkan.
      expect(node?.name).toBe("ODP Terbit (diubah)");
      expect(node?.latitude).toBe(-6.3);
    });

    it("FK source/target benar-benar RESTRICT, jadi reset peta harus menjaganya", async () => {
      const planningId = await buatPlanning("plan-restrict");
      await buatNode({ nodeId: "odc-nyata" });
      await buatNode({ nodeId: "odp-rencana", isPlanned: true, planningId });
      await buatJalur(
        "edge-rencana",
        "odp-rencana",
        "odc-nyata",
        true,
        planningId,
      );

      // Hitungan inilah yang dipakai penjaga reset.
      const menempel = await sebagaiTenant(() =>
        mappingRepo.countPlannedEdgesOnRealNodes(ctx),
      );
      expect(menempel).toBe(1);

      // Dan tanpa penjaga itu, penghapusan node nyata memang ditolak database —
      // bukan sebagai 400 yang terbaca, tapi sebagai galat Prisma yang jatuh
      // menjadi 500.
      await expect(
        prismaAuth.mappingNode.deleteMany({
          where: { tenantId: TENANT, isPlanned: false },
        }),
      ).rejects.toThrow();
    });

    it("titik yang hilang dari payload dihapus, fotonya dilepas bukan dimusnahkan", async () => {
      const { documentId } = await titikTerbitDenganFoto();

      await sebagaiTenant(() =>
        mappingRepo.syncAllMappingData(ctx, { nodes: [], edges: [] }),
      );

      const node = await prismaAuth.mappingNode.findUnique({
        where: { nodeId: "odp-terbit" },
      });
      const dokumen = await prismaAuth.planningDocument.findUnique({
        where: { id: documentId },
      });

      expect(node).toBeNull();
      // `SET NULL`, bukan `CASCADE`: bukti anggaran bertahan walau titiknya
      // pergi, dan cuma butuh dirapikan manual.
      expect(dokumen).not.toBeNull();
      expect(dokumen?.nodeId).toBeNull();
    });
  });
});
