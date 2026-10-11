import { describe, expect, it, vi } from "vitest";
import { validateMobileWorkOrderMaterialAccess } from "@/modules/work-order/services/work-order-access";

const ID_MITRA = "cmov3i5qz0000r0n93w8hjo42";
const ID_TEKNISI = "e452c1be-cd38-4513-850e-34dd10ea428b";
const ID_WO = "wo-1";

function buatRepository(workOrder: Record<string, unknown>) {
  return { findById: vi.fn().mockResolvedValue(workOrder) };
}

function workOrderDasar(tambahan: Record<string, unknown>) {
  return {
    id: ID_WO,
    tenantId: "tenant-1",
    status: "IN_PROGRESS",
    siteId: "site-1",
    departmentId: null as string | null,
    assignedToId: null as string | null,
    assignedMitraId: null as string | null,
    assignments: [] as Array<Record<string, unknown>>,
    ...tambahan,
  };
}

function konteks(id: string) {
  return {
    id,
    tenantId: "tenant-1",
    role: "MITRA",
    permissions: [] as string[],
  };
}

describe("akses work order untuk mitra", () => {
  it("mengizinkan mitra yang memegang work order (assignedMitraId)", async () => {
    const repository = buatRepository(
      workOrderDasar({ assignedMitraId: ID_MITRA }),
    );

    const workOrder = await validateMobileWorkOrderMaterialAccess({
      repository: repository as never,
      workOrderId: ID_WO,
      userContext: konteks(ID_MITRA) as never,
    });

    expect(workOrder.id).toBe(ID_WO);
  });

  it("mengizinkan mitra partner yang undangannya disetujui", async () => {
    const repository = buatRepository(
      workOrderDasar({
        assignedToId: ID_TEKNISI,
        assignments: [{ userId: null, mitraId: ID_MITRA, status: "APPROVED" }],
      }),
    );

    const workOrder = await validateMobileWorkOrderMaterialAccess({
      repository: repository as never,
      workOrderId: ID_WO,
      userContext: konteks(ID_MITRA) as never,
    });

    expect(workOrder.id).toBe(ID_WO);
  });

  it("menolak mitra yang tidak memegang work order", async () => {
    const repository = buatRepository(
      workOrderDasar({ assignedMitraId: "mitra-lain" }),
    );

    await expect(
      validateMobileWorkOrderMaterialAccess({
        repository: repository as never,
        workOrderId: ID_WO,
        userContext: konteks(ID_MITRA) as never,
      }),
    ).rejects.toThrow(/tidak memiliki akses/i);
  });

  it("menolak mitra yang undangannya ditolak", async () => {
    const repository = buatRepository(
      workOrderDasar({
        assignedToId: ID_TEKNISI,
        assignments: [{ userId: null, mitraId: ID_MITRA, status: "REJECTED" }],
      }),
    );

    await expect(
      validateMobileWorkOrderMaterialAccess({
        repository: repository as never,
        workOrderId: ID_WO,
        userContext: konteks(ID_MITRA) as never,
      }),
    ).rejects.toThrow(/tidak memiliki akses/i);
  });
});
