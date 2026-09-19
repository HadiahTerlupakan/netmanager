import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  findFirst: vi.fn(),
  createRequest: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { pelanggan: { findFirst: mockFns.findFirst } },
}));

vi.mock("@/modules/work-order/repositories/WorkOrderRepository", () => ({
  WorkOrderRepository: class MockWorkOrderRepository {
    createRequest = mockFns.createRequest;
  },
}));

import { MobileWorkOrderRequestService } from "@/modules/work-order/services/MobileWorkOrderRequestService";

const sessionUser = {
  id: "user-1",
  name: "Teknisi",
  tenantId: "tenant-1",
  siteId: "site-a",
  siteIds: ["site-a"],
};

const body = {
  type: "TROUBLESHOOT" as const,
  title: "Gangguan",
  description: "Tidak bisa browsing",
  departmentId: "dept-1",
  pelangganId: "plg-1",
};

describe("MobileWorkOrderRequestService dengan pelangganId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.createRequest.mockResolvedValue({
      id: "wo-1",
      workOrderNumber: "WO-1",
    });
    mockFns.findFirst.mockResolvedValue({
      id: "plg-1",
      nama: "Budi",
      noTelp: "08123",
      alamat: "Jl. Mawar 1",
      latitude: -6.2,
      longitude: 106.8,
      siteId: "site-a",
      tenantId: "tenant-1",
    });
  });

  it("menyimpan pelangganId dan mengisi kontak dari data pelanggan", async () => {
    await new MobileWorkOrderRequestService().createRequest(body, sessionUser);

    expect(mockFns.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        pelangganId: "plg-1",
        contactName: "Budi",
        contactPhone: "08123",
        locationAddress: "Jl. Mawar 1",
      }),
    );
  });

  it("tidak menimpa kontak yang diisi manual oleh karyawan", async () => {
    await new MobileWorkOrderRequestService().createRequest(
      { ...body, contactName: "Ibu Budi", contactPhone: "08999" },
      sessionUser,
    );

    expect(mockFns.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        contactName: "Ibu Budi",
        contactPhone: "08999",
      }),
    );
  });

  it("menolak pelanggan dari site lain", async () => {
    mockFns.findFirst.mockResolvedValue(null);

    await expect(
      new MobileWorkOrderRequestService().createRequest(body, sessionUser),
    ).rejects.toThrow(/pelanggan/i);
    expect(mockFns.createRequest).not.toHaveBeenCalled();
  });

  it("membatasi pencarian pelanggan ke siteIds karyawan", async () => {
    await new MobileWorkOrderRequestService().createRequest(body, sessionUser);

    const [findFirstArgs] = mockFns.findFirst.mock.calls[0];
    expect(findFirstArgs.where).toEqual({
      id: "plg-1",
      siteId: { in: ["site-a"] },
    });
  });

  it("memakai siteId lama sebagai fallback saat siteIds kosong", async () => {
    await new MobileWorkOrderRequestService().createRequest(body, {
      id: "user-1",
      name: "Teknisi",
      tenantId: "tenant-1",
      siteId: "site-a",
    });

    const [findFirstArgs] = mockFns.findFirst.mock.calls[0];
    expect(findFirstArgs.where).toEqual({
      id: "plg-1",
      siteId: { in: ["site-a"] },
    });
  });

  it("membiarkan super admin mengakses pelanggan tanpa batasan site", async () => {
    await new MobileWorkOrderRequestService().createRequest(body, {
      ...sessionUser,
      siteIds: ["site-a"],
      isSuperAdmin: true,
    });

    const [findFirstArgs] = mockFns.findFirst.mock.calls[0];
    expect(findFirstArgs.where).toEqual({ id: "plg-1" });
  });

  it("memakai siteId pelanggan yang ditautkan, bukan siteId body atau sesi", async () => {
    mockFns.findFirst.mockResolvedValue({
      id: "plg-1",
      nama: "Budi",
      noTelp: "08123",
      alamat: "Jl. Mawar 1",
      latitude: -6.2,
      longitude: 106.8,
      siteId: "site-pelanggan",
      tenantId: "tenant-1",
    });

    await new MobileWorkOrderRequestService().createRequest(
      { ...body, siteId: "site-body" },
      { ...sessionUser, siteId: "site-sesi" },
    );

    expect(mockFns.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: "site-pelanggan" }),
    );
  });
});
