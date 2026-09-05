import { describe, expect, it } from "vitest";
import {
  createPlanningItemSchema,
  updatePlanningItemSchema,
} from "@/modules/planning/validators/planningItemSchemas";
import { createPlanningSchema } from "@/modules/planning/validators/planningSchemas";
import { listPlanningTemplateSchema } from "@/modules/planning/validators/planningTemplateSchemas";

const baseItem = {
  name: "Kabel Fiber 24 Core",
  unit: "meter",
};

describe("planningItemSchemas", () => {
  // Kolomnya `Float` di Prisma dan satuannya bebas teks, jadi 12,5 meter kabel
  // adalah masukan yang wajar. `.int()` sebelumnya menolaknya di API meski
  // database, entity, dan mapper semuanya menerimanya.
  it("menerima kuantitas pecahan", () => {
    const result = createPlanningItemSchema.safeParse({
      ...baseItem,
      quantity: 12.5,
    });

    expect(result.success).toBe(true);
  });

  it("menolak kuantitas nol atau negatif", () => {
    expect(
      createPlanningItemSchema.safeParse({ ...baseItem, quantity: 0 }).success,
    ).toBe(false);
    expect(
      createPlanningItemSchema.safeParse({ ...baseItem, quantity: -1 }).success,
    ).toBe(false);
  });

  // Material dari stok, hibah, atau yang ditanggung pihak ketiga berharga nol.
  // `.positive()` menolaknya dan memaksa operator mengarang angka.
  it("menerima harga estimasi nol", () => {
    const result = createPlanningItemSchema.safeParse({
      ...baseItem,
      quantity: 1,
      estimatedPrice: 0,
    });

    expect(result.success).toBe(true);
  });

  it("menerima harga realisasi nol tapi menolak harga negatif", () => {
    expect(updatePlanningItemSchema.safeParse({ actualPrice: 0 }).success).toBe(
      true,
    );
    expect(
      updatePlanningItemSchema.safeParse({ actualPrice: -1 }).success,
    ).toBe(false);
  });
});

describe("createPlanningSchema", () => {
  const basePlanning = {
    type: "OSP" as const,
    title: "Ekspansi FO Cipinang",
    area: "Cipinang",
    estimatedUnits: 100,
  };

  // Rencana yang seluruh materialnya ditanggung pihak ketiga beranggaran nol,
  // dan itu sah — sejalan dengan `actualBudget`.
  it("menerima anggaran estimasi nol", () => {
    expect(
      createPlanningSchema.safeParse({ ...basePlanning, estimatedBudget: 0 })
        .success,
    ).toBe(true);
  });

  it("menolak anggaran estimasi negatif", () => {
    expect(
      createPlanningSchema.safeParse({ ...basePlanning, estimatedBudget: -1 })
        .success,
    ).toBe(false);
  });
});

describe("listPlanningTemplateSchema", () => {
  // Bukan `z.coerce.boolean()`: nilainya datang sebagai string query param dan
  // `Boolean("false") === true`, sehingga `?isActive=false` justru mengembalikan
  // template yang aktif — filter dengan satu keluaran, dan template nonaktif
  // tidak pernah bisa dilihat.
  it("menerjemahkan isActive=false menjadi false", () => {
    const result = listPlanningTemplateSchema.parse({ isActive: "false" });

    expect(result.isActive).toBe(false);
  });

  it("menerjemahkan isActive=true menjadi true", () => {
    expect(
      listPlanningTemplateSchema.parse({ isActive: "true" }).isActive,
    ).toBe(true);
  });

  it("membiarkan isActive tidak terisi saat tidak dikirim", () => {
    expect(listPlanningTemplateSchema.parse({}).isActive).toBeUndefined();
  });

  it("menolak nilai isActive di luar 'true'/'false'", () => {
    expect(
      listPlanningTemplateSchema.safeParse({ isActive: "1" }).success,
    ).toBe(false);
  });
});
