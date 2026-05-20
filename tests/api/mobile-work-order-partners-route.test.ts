import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  addPartner: vi.fn(),
  removePartner: vi.fn(),
  getDuplicateAssignmentErrorMessage: vi.fn(),
  getPartnerOnLeaveErrorMessage: vi.fn(),
  isDuplicateAssignmentError: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  createHandler: (_options: unknown, handler: unknown) => handler,
  apiSuccess: (data: unknown, init?: { message?: string; status?: number }) =>
    NextResponse.json(
      { success: true, data, message: init?.message },
      { status: init?.status || 200 },
    ),
  apiError: (message: string, _code?: string, init?: { status?: number }) =>
    NextResponse.json({ error: message }, { status: init?.status || 500 }),
  ErrorCodes: {
    NOT_FOUND: "NOT_FOUND",
    FORBIDDEN: "FORBIDDEN",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    INTERNAL_ERROR: "INTERNAL_ERROR",
  },
}));

vi.mock("@/modules/work-order", () => ({
  MobileWorkOrderPartnerService: class MockService {
    addPartner = mockFns.addPartner;
    removePartner = mockFns.removePartner;
    getDuplicateAssignmentErrorMessage =
      mockFns.getDuplicateAssignmentErrorMessage;
    getPartnerOnLeaveErrorMessage = mockFns.getPartnerOnLeaveErrorMessage;
    isDuplicateAssignmentError = mockFns.isDuplicateAssignmentError;
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

import { DELETE, POST } from "@/app/api/mobile/work-orders/[id]/partners/route";

describe("mobile work order partners route", () => {
  const session = {
    user: {
      id: "assigner-1",
      tenantId: "tenant-1",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.isDuplicateAssignmentError.mockReturnValue(false);
    mockFns.getDuplicateAssignmentErrorMessage.mockReturnValue(
      "User sudah ditambahkan sebagai partner di work order ini",
    );
    mockFns.getPartnerOnLeaveErrorMessage.mockReturnValue(
      "Partner sedang libur dan belum check-in lembur hari ini",
    );
  });

  it("menolak invite partner yang sedang libur hari ini dan tidak sedang lembur aktif", async () => {
    mockFns.addPartner.mockRejectedValue(new Error("PARTNER_ON_LEAVE"));

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/work-orders/wo-1/partners", {
        method: "POST",
        body: JSON.stringify({ userId: "partner-1", role: "PARTNER" }),
        headers: { "content-type": "application/json" },
      }),
      { session, params: { id: "wo-1" } } as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Partner sedang libur dan belum check-in lembur hari ini",
    });
  });

  it("menolak invite partner untuk requester yang bukan creator, lead, assigner, atau admin", async () => {
    mockFns.addPartner.mockRejectedValue(new Error("FORBIDDEN"));

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/work-orders/wo-1/partners", {
        method: "POST",
        body: JSON.stringify({ userId: "partner-1", role: "PARTNER" }),
        headers: { "content-type": "application/json" },
      }),
      {
        session: { user: { id: "user-random", tenantId: "tenant-1" } },
        params: { id: "wo-1" },
      } as never,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error:
        "Anda tidak memiliki akses untuk menambahkan partner ke work order ini",
    });
  });

  it("menolak duplicate invite saat create terkena unique constraint database", async () => {
    mockFns.addPartner.mockRejectedValue({ code: "P2002" });
    mockFns.isDuplicateAssignmentError.mockReturnValue(true);

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/work-orders/wo-1/partners", {
        method: "POST",
        body: JSON.stringify({ userId: "partner-1", role: "PARTNER" }),
        headers: { "content-type": "application/json" },
      }),
      { session, params: { id: "wo-1" } } as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "User sudah ditambahkan sebagai partner di work order ini",
    });
  });

  it("menolak hapus partner untuk requester yang bukan assigner, creator, lead, atau admin", async () => {
    mockFns.removePartner.mockRejectedValue(new Error("FORBIDDEN"));

    const response = await DELETE(
      new NextRequest(
        "http://localhost/api/mobile/work-orders/wo-1/partners?assignmentId=assignment-1",
        { method: "DELETE" },
      ),
      {
        session: { user: { id: "user-random", tenantId: "tenant-1" } },
        params: { id: "wo-1" },
      } as never,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Anda tidak memiliki akses untuk menghapus partner ini",
    });
  });
});
