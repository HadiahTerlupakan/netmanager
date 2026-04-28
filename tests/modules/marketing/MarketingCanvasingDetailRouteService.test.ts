import { describe, expect, it, vi } from "vitest";

import { MarketingCanvasingDetailRouteService } from "@/modules/marketing";

const request = {
  id: "canvasing-1",
  nama: "Customer",
  salesId: "sales-1",
  status: "PENDING",
};

const requestWithSales: Record<string, unknown> = {
  id: "canvasing-1",
  salesId: "sales-1",
  status: "PENDING",
  user: { siteId: "site-1" },
  mitra: null,
};

function createService() {
  const canvasing = {
    getRequestById: vi.fn().mockResolvedValue(request),
    getRequestByIdWithSales: vi.fn().mockResolvedValue(requestWithSales),
    updateRequest: vi.fn().mockResolvedValue({ ...request, nama: "Updated" }),
    cancelApproval: vi
      .fn()
      .mockResolvedValue({ ...request, status: "PENDING" }),
    deleteRequest: vi.fn().mockResolvedValue(undefined),
  };

  return {
    canvasing,
    service: new MarketingCanvasingDetailRouteService(canvasing as never),
  };
}

describe("MarketingCanvasingDetailRouteService", () => {
  it("mengizinkan owner membaca detail canvasing", async () => {
    const { service } = createService();

    const result = await service.getDetail({
      id: "canvasing-1",
      session: { id: "sales-1", role: "SALES", siteId: "site-1" },
      permissions: [],
      isSuperAdmin: false,
    });

    expect(result).toEqual({ success: true, data: request });
  });

  it("menolak update status generic", async () => {
    const { canvasing, service } = createService();

    const result = await service.updateDetail({
      id: "canvasing-1",
      session: { id: "sales-1", role: "SALES", siteId: "site-1" },
      permissions: ["canvasing:update"],
      isSuperAdmin: false,
      body: { status: "APPROVED" },
    });

    expect(result).toEqual({
      success: false,
      status: 400,
      error: "Perubahan status harus melalui endpoint aksi khusus",
    });
    expect(canvasing.updateRequest).not.toHaveBeenCalled();
  });

  it("menolak cancel approval untuk request yang belum APPROVED", async () => {
    const { canvasing, service } = createService();

    const result = await service.patchDetail({
      id: "canvasing-1",
      session: { id: "admin-1", role: "ADMIN", siteId: "site-1" },
      permissions: ["canvasing:update"],
      isSuperAdmin: false,
      body: { action: "cancel_approval" },
    });

    expect(result).toEqual({
      success: false,
      status: 400,
      error: "Hanya canvasing dengan status APPROVED yang bisa dibatalkan",
      code: "VALIDATION_ERROR",
    });
    expect(canvasing.cancelApproval).not.toHaveBeenCalled();
  });

  it("menghapus canvasing ketika user punya permission dan site sesuai", async () => {
    const { canvasing, service } = createService();

    const result = await service.deleteDetail({
      id: "canvasing-1",
      session: { id: "admin-1", role: "ADMIN", siteId: "site-1" },
      permissions: ["canvasing:delete", "canvasing:site_only"],
      isSuperAdmin: false,
    });

    expect(canvasing.deleteRequest).toHaveBeenCalledWith("canvasing-1");
    expect(result).toEqual({
      success: true,
      data: null,
      message: "Data canvasing berhasil dihapus",
    });
  });
});
