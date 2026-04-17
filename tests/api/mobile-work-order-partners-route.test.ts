import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "../setup";

const mockFns = vi.hoisted(() => ({
  getMobileAuthPayload: vi.fn(),
}));

vi.mock("@/lib/mobile-api-auth", () => ({
  getMobileAuthPayload: mockFns.getMobileAuthPayload,
}));

vi.mock("@/modules/database", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/api-response", () => ({
  apiError: (message: string, _code?: string, options?: { status?: number }) =>
    NextResponse.json({ error: message }, { status: options?.status ?? 500 }),
  ErrorCodes: {
    NOT_FOUND: "NOT_FOUND",
    FORBIDDEN: "FORBIDDEN",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    INTERNAL_ERROR: "INTERNAL_ERROR",
  },
}));

import { DELETE, POST } from "@/app/api/mobile/work-orders/[id]/partners/route";

describe("mobile work order partners route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.getMobileAuthPayload.mockResolvedValue({
      id: "assigner-1",
      tenantId: "tenant-1",
    });
    prismaMock.workOrders.findFirst.mockResolvedValue({
      id: "wo-1",
      workOrderNumber: "WO-001",
      status: "ASSIGNED",
      createdById: "assigner-1",
      assignedToId: null,
    } as never);
    prismaMock.user.findFirst
      .mockResolvedValueOnce({
        id: "partner-1",
        name: "Partner Satu",
        email: "partner@example.com",
      } as never)
      .mockResolvedValueOnce({
        id: "assigner-1",
        role: {
          accessAdminPanel: false,
          isSuperAdmin: false,
        },
      } as never);
    prismaMock.workOrderAssignments.findFirst.mockResolvedValue(null);
    prismaMock.leaveRequest.findFirst.mockResolvedValue({
      type: "CUTI",
      reason: "Cuti tahunan",
    } as never);
    prismaMock.overtime.findFirst.mockResolvedValue(null);
    prismaMock.workOrderAssignments.create.mockResolvedValue({
      id: "assignment-1",
      workOrderId: "wo-1",
      userId: "partner-1",
      role: "PARTNER",
      status: "PENDING",
      assignedAt: new Date("2026-04-18T08:00:00.000Z"),
      assignedById: "assigner-1",
      user: {
        id: "partner-1",
        name: "Partner Satu",
        email: "partner@example.com",
        image: null,
      },
    } as never);
  });

  it("menolak invite partner yang sedang libur hari ini dan tidak sedang lembur aktif", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/mobile/work-orders/wo-1/partners", {
        method: "POST",
        body: JSON.stringify({ userId: "partner-1", role: "PARTNER" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "wo-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Partner sedang libur dan belum check-in lembur hari ini",
    });
    expect(prismaMock.workOrderAssignments.create).not.toHaveBeenCalled();
  });

  it("menolak invite partner untuk requester yang bukan creator, lead, assigner, atau admin", async () => {
    mockFns.getMobileAuthPayload.mockResolvedValue({
      id: "user-random",
      tenantId: "tenant-1",
    });
    prismaMock.workOrders.findFirst.mockResolvedValue({
      id: "wo-1",
      workOrderNumber: "WO-001",
      status: "ASSIGNED",
      createdById: "creator-1",
      assignedToId: "lead-1",
    } as never);
    prismaMock.user.findFirst
      .mockResolvedValueOnce({
        id: "partner-1",
        name: "Partner Satu",
        email: "partner@example.com",
      } as never)
      .mockResolvedValueOnce({
        id: "user-random",
        role: {
          accessAdminPanel: false,
          isSuperAdmin: false,
        },
      } as never);
    prismaMock.leaveRequest.findFirst.mockResolvedValue(null);
    prismaMock.overtime.findFirst.mockResolvedValue(null);

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/work-orders/wo-1/partners", {
        method: "POST",
        body: JSON.stringify({ userId: "partner-1", role: "PARTNER" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "wo-1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error:
        "Anda tidak memiliki akses untuk menambahkan partner ke work order ini",
    });
    expect(prismaMock.workOrderAssignments.create).not.toHaveBeenCalled();
  });

  it("menolak duplicate invite saat create terkena unique constraint database", async () => {
    prismaMock.workOrderAssignments.findFirst.mockResolvedValue(null);
    prismaMock.leaveRequest.findFirst.mockResolvedValue(null);
    prismaMock.overtime.findFirst.mockResolvedValue(null);
    prismaMock.workOrderAssignments.create.mockRejectedValue({
      code: "P2002",
    });

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/work-orders/wo-1/partners", {
        method: "POST",
        body: JSON.stringify({ userId: "partner-1", role: "PARTNER" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "wo-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "User sudah ditambahkan sebagai partner di work order ini",
    });
  });

  it("menolak hapus partner untuk requester yang bukan assigner, creator, lead, atau admin", async () => {
    mockFns.getMobileAuthPayload.mockResolvedValue({
      id: "user-random",
      tenantId: "tenant-1",
    });
    prismaMock.workOrderAssignments.findFirst.mockResolvedValue({
      id: "assignment-1",
      workOrderId: "wo-1",
      assignedById: "assigner-1",
      workOrders: {
        id: "wo-1",
        createdById: "creator-1",
        assignedToId: "lead-1",
      },
    } as never);
    prismaMock.user.findFirst.mockResolvedValue({
      id: "user-random",
      role: {
        accessAdminPanel: false,
        isSuperAdmin: false,
      },
    } as never);

    const response = await DELETE(
      new NextRequest(
        "http://localhost/api/mobile/work-orders/wo-1/partners?assignmentId=assignment-1",
        { method: "DELETE" },
      ),
      { params: Promise.resolve({ id: "wo-1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Anda tidak memiliki akses untuk menghapus partner ini",
    });
    expect(prismaMock.workOrderAssignments.delete).not.toHaveBeenCalled();
  });
});
