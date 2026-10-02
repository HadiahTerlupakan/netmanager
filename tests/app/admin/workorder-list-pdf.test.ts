import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkOrder } from "@/app/admin/workorders/list/types";

const apiFetcher = vi.fn();
vi.mock("@/lib/hooks/useApi", () => ({ apiFetcher: (url: string) => apiFetcher(url) }));

const { ambilSemuaWorkOrder, susunBarisWorkOrderPdf, BATAS_BARIS_PDF } = await import(
  "@/app/admin/workorders/list/pdf"
);

function workOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: "wo-1",
    workOrderNumber: "WO-001",
    title: "Pasang baru",
    type: "INSTALLATION",
    status: "COMPLETED",
    priority: "HIGH",
    scheduledDate: null,
    isInternal: false,
    requestedById: null,
    pelanggan: { nama: "Budi", idPelanggan: "PLG-9" },
    assignedTo: { name: "Andi", role: { isTechnical: true } },
    site: { name: "HQ" },
    createdBy: { name: "Admin" },
    createdAt: "2026-10-01T03:00:00.000Z",
    startedAt: "2026-10-01T04:00:00.000Z",
    completedAt: "2026-10-01T06:30:00.000Z",
    ...overrides,
  };
}

describe("susunBarisWorkOrderPdf", () => {
  it("menyusun kolom sesuai tabel di layar", () => {
    const baris = susunBarisWorkOrderPdf(workOrder());
    expect(baris[0]).toBe("WO-001");
    expect(baris[1]).toBe("Pasang baru\nINSTALLATION");
    expect(baris[2]).toContain("Budi");
    expect(baris[3]).toBe("HQ");
    expect(baris[4]).toBe("Completed");
    expect(baris[6]).toBe("Andi (Teknis)");
    expect(baris[8]).toBe("2 jam 30 menit");
    expect(baris[9]).toBe("Admin");
  });

  it("menandai mitra, belum ditugaskan, dan WO yang belum selesai", () => {
    expect(susunBarisWorkOrderPdf(workOrder({ assignedTo: null, assignedMitra: { name: "CV Jaya" } }))[6]).toBe(
      "CV Jaya (Mitra)",
    );
    const belum = susunBarisWorkOrderPdf(workOrder({ assignedTo: null, completedAt: null, site: null }));
    expect(belum[6]).toBe("Unassigned");
    expect(belum[8]).toBe("-");
    expect(belum[3]).toBe("-");
  });
});

describe("ambilSemuaWorkOrder", () => {
  beforeEach(() => apiFetcher.mockReset());

  it("mengambil semua halaman dengan filter yang sama", async () => {
    apiFetcher
      .mockResolvedValueOnce({ workOrders: [workOrder({ id: "a" })], total: 2, totalPages: 2 })
      .mockResolvedValueOnce({ workOrders: [workOrder({ id: "b" })], total: 2, totalPages: 2 });

    const hasil = await ambilSemuaWorkOrder(new URLSearchParams({ status: "COMPLETED" }));

    expect(hasil.workOrders.map((wo) => wo.id)).toEqual(["a", "b"]);
    expect(hasil.total).toBe(2);
    expect(apiFetcher).toHaveBeenCalledTimes(2);
    expect(apiFetcher.mock.calls[1][0]).toContain("status=COMPLETED");
    expect(apiFetcher.mock.calls[1][0]).toContain("page=2");
  });

  it("berhenti di batas baris PDF", async () => {
    const penuh = Array.from({ length: 100 }, (_, i) => workOrder({ id: String(i) }));
    apiFetcher.mockResolvedValue({ workOrders: penuh, total: 9999, totalPages: 100 });

    const hasil = await ambilSemuaWorkOrder(new URLSearchParams());

    expect(hasil.workOrders).toHaveLength(BATAS_BARIS_PDF);
    expect(hasil.total).toBe(9999);
  });
});
