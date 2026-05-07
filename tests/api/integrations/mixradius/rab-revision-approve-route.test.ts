import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetServerSession,
  mockApproveRabRevision,
  mockRejectRevision,
  mockIsRouteServiceError,
  MockRabRevisionApprovalError,
} = vi.hoisted(() => {
  class MockRabRevisionApprovalError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.name = "RabRevisionApprovalError";
      this.status = status;
    }
  }

  return {
    mockGetServerSession: vi.fn(),
    mockApproveRabRevision: vi.fn(),
    mockRejectRevision: vi.fn(),
    mockIsRouteServiceError: vi.fn(),
    MockRabRevisionApprovalError,
  };
});

vi.mock("next-auth/next", () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/modules/finance", () => ({
  approveRabRevision: mockApproveRabRevision,
  RabRevisionApprovalError: MockRabRevisionApprovalError,
  RabRevisionRouteService: class MockRabRevisionRouteService {
    rejectRevision = mockRejectRevision;
  },
  isRouteServiceError: mockIsRouteServiceError,
}));

import { POST as APPROVE } from "@/app/api/integrations/mixradius/expenses/rab/[id]/revisions/[revisionId]/approve/route";
import { POST as REJECT } from "@/app/api/integrations/mixradius/expenses/rab/[id]/revisions/[revisionId]/reject/route";

describe("rab revision approval route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: "approver-1" } });
    mockIsRouteServiceError.mockImplementation(
      (error: unknown) =>
        typeof error === "object" && error !== null && "status" in error,
    );
  });

  it("marks the revision approved and returns the service payload", async () => {
    mockApproveRabRevision.mockResolvedValue({
      message: "Revisi RAB berhasil disetujui.",
      data: {
        id: "rev-2",
        rabProjectId: "rab-1",
        status: "APPROVED",
      },
    });

    const response = await APPROVE(
      new NextRequest("http://localhost/api/revision/approve", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ id: "rab-1", revisionId: "rev-2" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockApproveRabRevision).toHaveBeenCalledWith({
      rabProjectId: "rab-1",
      revisionId: "rev-2",
      userId: "approver-1",
    });
    expect(body).toEqual({
      success: true,
      message: "Revisi RAB berhasil disetujui.",
      data: {
        id: "rev-2",
        rabProjectId: "rab-1",
        status: "APPROVED",
      },
    });
  });

  it("records rejection without changing the route contract", async () => {
    mockRejectRevision.mockResolvedValue({
      id: "rev-2",
      rabProjectId: "rab-1",
      status: "REJECTED",
      rejectionNotes: "Harga tidak valid",
    });

    const response = await REJECT(
      new NextRequest("http://localhost/api/revision/reject", {
        method: "POST",
        body: JSON.stringify({ notes: "Harga tidak valid" }),
        headers: { "content-type": "application/json" },
      }),
      {
        params: Promise.resolve({ id: "rab-1", revisionId: "rev-2" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockRejectRevision).toHaveBeenCalledWith({
      projectId: "rab-1",
      revisionId: "rev-2",
      userId: "approver-1",
      notes: "Harga tidak valid",
    });
    expect(body).toEqual({
      success: true,
      message: "Revisi RAB ditolak.",
      data: {
        id: "rev-2",
        rabProjectId: "rab-1",
        status: "REJECTED",
        rejectionNotes: "Harga tidak valid",
      },
    });
  });

  it("blocks approval while the revision is still a draft", async () => {
    mockApproveRabRevision.mockRejectedValue(
      new MockRabRevisionApprovalError(
        "Revisi masih draft dan harus diajukan terlebih dahulu.",
        400,
      ),
    );

    const response = await APPROVE(
      new NextRequest("http://localhost/api/revision/approve", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ id: "rab-1", revisionId: "rev-3" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("diajukan terlebih dahulu");
  });

  it("maps reject service route errors to the provided HTTP status", async () => {
    mockRejectRevision.mockRejectedValue({
      status: 400,
      message: "Anda sudah menyetujui revisi ini sebelumnya.",
    });

    const response = await REJECT(
      new NextRequest("http://localhost/api/revision/reject", {
        method: "POST",
        body: JSON.stringify({ notes: "Tidak sesuai" }),
        headers: { "content-type": "application/json" },
      }),
      {
        params: Promise.resolve({ id: "rab-1", revisionId: "rev-4" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Anda sudah menyetujui revisi ini sebelumnya.");
  });
});
