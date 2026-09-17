import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetServerSession,
  mockCanUserApproveRab,
  mockApproveRabWithRetry,
  mockIsApprovalRouteError,
} = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockCanUserApproveRab: vi.fn(),
  mockApproveRabWithRetry: vi.fn(),
  mockIsApprovalRouteError: vi.fn(),
}));

vi.mock("next-auth/next", () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/modules/finance", () => ({
  rabApprovalService: {
    canUserApproveRab: mockCanUserApproveRab,
    approveRabWithRetry: mockApproveRabWithRetry,
    isApprovalRouteError: mockIsApprovalRouteError,
  },
}));

import { POST as APPROVE } from "@/app/api/finance/rab-projects/[id]/approve/route";

describe("rab approve route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: "approver-1" } });
    mockCanUserApproveRab.mockResolvedValue({ isAllowed: true });
    mockIsApprovalRouteError.mockImplementation(
      (error: unknown) =>
        typeof error === "object" && error !== null && "status" in error,
    );
  });

  it("records first approval from draft and moves status to pending approval", async () => {
    mockApproveRabWithRetry.mockResolvedValue({
      approvedCount: 1,
      updatedRab: {
        id: "rab-1",
        status: "PENDING_APPROVAL",
      },
    });

    const response = await APPROVE(
      new NextRequest("http://localhost/api/rab/approve", { method: "POST" }),
      {
        params: Promise.resolve({ id: "rab-1" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockCanUserApproveRab).toHaveBeenCalledWith("approver-1");
    expect(mockApproveRabWithRetry).toHaveBeenCalledWith("rab-1", "approver-1");
    expect(body.message).toContain("Menunggu 1 Persetujuan lagi");
    expect(body.data.status).toBe("PENDING_APPROVAL");
  });

  it("uses the final approval message when the approval threshold is reached", async () => {
    mockApproveRabWithRetry.mockResolvedValue({
      approvedCount: 2,
      updatedRab: {
        id: "rab-2",
        status: "APPROVED",
      },
    });

    const response = await APPROVE(
      new NextRequest("http://localhost/api/rab/approve", { method: "POST" }),
      {
        params: Promise.resolve({ id: "rab-2" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe("RAB Berhasil disetujui seutuhnya.");
    expect(body.data.status).toBe("APPROVED");
  });

  it("returns 403 when the current user cannot approve the RAB", async () => {
    mockCanUserApproveRab.mockResolvedValue({ isAllowed: false });

    const response = await APPROVE(
      new NextRequest("http://localhost/api/rab/approve", { method: "POST" }),
      {
        params: Promise.resolve({ id: "rab-3" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(mockApproveRabWithRetry).not.toHaveBeenCalled();
    expect(body.error).toContain("canApproveRab");
  });

  it("maps approval service business errors to the provided HTTP status", async () => {
    mockApproveRabWithRetry.mockRejectedValue({
      status: 400,
      message: "Anda sudah menyetujui RAB ini sebelumnya.",
    });

    const response = await APPROVE(
      new NextRequest("http://localhost/api/rab/approve", { method: "POST" }),
      {
        params: Promise.resolve({ id: "rab-4" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Anda sudah menyetujui RAB ini sebelumnya.");
  });

  it("returns 500 for unexpected approval failures", async () => {
    mockApproveRabWithRetry.mockRejectedValue(new Error("boom"));
    mockIsApprovalRouteError.mockReturnValue(false);

    const response = await APPROVE(
      new NextRequest("http://localhost/api/rab/approve", { method: "POST" }),
      {
        params: Promise.resolve({ id: "rab-5" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe(
      "Terjadi kesalahan internal saat memproses persetujuan.",
    );
  });

  it("returns 401 when the request has no authenticated user", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await APPROVE(
      new NextRequest("http://localhost/api/rab/approve", { method: "POST" }),
      {
        params: Promise.resolve({ id: "rab-6" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(mockCanUserApproveRab).not.toHaveBeenCalled();
    expect(body.error).toBe("Unauthorized");
  });
});
