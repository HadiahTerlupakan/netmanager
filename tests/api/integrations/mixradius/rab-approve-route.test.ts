import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/tests/setup";

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
}));

vi.mock("next-auth/next", () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  prismaAuth: prismaMock,
}));

import { POST as APPROVE } from "@/app/api/integrations/mixradius/expenses/rab/[id]/approve/route";

describe("rab approve route", () => {
  beforeEach(() => {
    mockGetServerSession.mockResolvedValue({ user: { id: "approver-1" } });
    prismaMock.$transaction.mockImplementation(
      async <T>(callback: (tx: typeof prismaMock) => Promise<T>) =>
        callback(prismaMock),
    );

    prismaMock.user.findUnique.mockResolvedValue({
      id: "approver-1",
      role: { canApproveRab: true, name: "Finance", isSuperAdmin: false },
    });
  });

  it("records first approval from draft and moves status to pending approval", async () => {
    prismaMock.rabProject.findUnique.mockResolvedValue({
      id: "rab-1",
      status: "DRAFT",
      approvals: [],
    });
    prismaMock.rabApproval.count.mockResolvedValue(1);
    prismaMock.rabProject.update.mockResolvedValue({
      id: "rab-1",
      status: "PENDING_APPROVAL",
      approvals: [{ userId: "approver-1", status: "APPROVED" }],
    });

    const response = await APPROVE(
      new NextRequest("http://localhost/api/rab/approve", { method: "POST" }),
      {
        params: Promise.resolve({ id: "rab-1" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.rabApproval.create).toHaveBeenCalledWith({
      data: {
        rabProjectId: "rab-1",
        userId: "approver-1",
        status: "APPROVED",
      },
    });
    expect(prismaMock.rabApproval.count).toHaveBeenCalledWith({
      where: { rabProjectId: "rab-1", status: "APPROVED" },
    });
    expect(prismaMock.rabProject.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rab-1" },
        data: { status: "PENDING_APPROVAL" },
      }),
    );
    expect(body.message).toContain("Menunggu 1 Persetujuan lagi");
    expect(body.data.status).toBe("PENDING_APPROVAL");
  });

  it("uses fresh db approval count and marks final approval as approved", async () => {
    prismaMock.rabProject.findUnique.mockResolvedValue({
      id: "rab-2",
      status: "PENDING_APPROVAL",
      approvals: [{ userId: "approver-2", status: "APPROVED" }],
    });
    prismaMock.rabApproval.count.mockResolvedValue(2);
    prismaMock.rabProject.update.mockResolvedValue({
      id: "rab-2",
      status: "APPROVED",
      approvals: [
        { userId: "approver-2", status: "APPROVED" },
        { userId: "approver-1", status: "APPROVED" },
      ],
    });

    const response = await APPROVE(
      new NextRequest("http://localhost/api/rab/approve", { method: "POST" }),
      {
        params: Promise.resolve({ id: "rab-2" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.rabApproval.count).toHaveBeenCalledWith({
      where: { rabProjectId: "rab-2", status: "APPROVED" },
    });
    expect(prismaMock.rabProject.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rab-2" },
        data: { status: "APPROVED" },
      }),
    );
    expect(body.message).toBe("RAB Berhasil disetujui seutuhnya.");
    expect(body.data.status).toBe("APPROVED");
  });

  it("does not rewrite project status outside transaction when threshold is not reached", async () => {
    prismaMock.rabProject.findUnique.mockResolvedValue({
      id: "rab-5",
      status: "DRAFT",
      approvals: [],
    });
    prismaMock.rabApproval.count.mockResolvedValueOnce(1);
    prismaMock.rabProject.update.mockResolvedValue({
      id: "rab-5",
      status: "PENDING_APPROVAL",
      approvals: [{ userId: "approver-1", status: "APPROVED" }],
    });

    const response = await APPROVE(
      new NextRequest("http://localhost/api/rab/approve", { method: "POST" }),
      {
        params: Promise.resolve({ id: "rab-5" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.rabProject.update).toHaveBeenCalledTimes(1);
    expect(body.message).toContain("Menunggu 1 Persetujuan lagi");
    expect(body.data.status).toBe("PENDING_APPROVAL");
  });

  it("retries serialization conflict and marks final approval as approved", async () => {
    prismaMock.$transaction
      .mockRejectedValueOnce({ code: "P2034" })
      .mockImplementationOnce(
        async <T>(callback: (tx: typeof prismaMock) => Promise<T>) =>
          callback(prismaMock),
      );
    prismaMock.rabProject.findUnique.mockResolvedValue({
      id: "rab-6",
      status: "PENDING_APPROVAL",
      approvals: [{ userId: "approver-2", status: "APPROVED" }],
    });
    prismaMock.rabApproval.count.mockResolvedValue(2);
    prismaMock.rabProject.update.mockResolvedValue({
      id: "rab-6",
      status: "APPROVED",
      approvals: [
        { userId: "approver-2", status: "APPROVED" },
        { userId: "approver-1", status: "APPROVED" },
      ],
    });

    const response = await APPROVE(
      new NextRequest("http://localhost/api/rab/approve", { method: "POST" }),
      {
        params: Promise.resolve({ id: "rab-6" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
    expect(prismaMock.rabProject.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.rabProject.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rab-6" },
        data: { status: "APPROVED" },
      }),
    );
    expect(body.message).toBe("RAB Berhasil disetujui seutuhnya.");
    expect(body.data.status).toBe("APPROVED");
  });

  it("rejects duplicate approval from the same approver", async () => {
    prismaMock.rabProject.findUnique.mockResolvedValue({
      id: "rab-3",
      status: "PENDING_APPROVAL",
      approvals: [{ userId: "approver-1", status: "APPROVED" }],
    });

    const response = await APPROVE(
      new NextRequest("http://localhost/api/rab/approve", { method: "POST" }),
      {
        params: Promise.resolve({ id: "rab-3" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Anda sudah menyetujui RAB ini sebelumnya.");
    expect(prismaMock.rabApproval.create).not.toHaveBeenCalled();
    expect(prismaMock.rabApproval.count).not.toHaveBeenCalled();
    expect(prismaMock.rabProject.update).not.toHaveBeenCalled();
  });

  it("maps duplicate approval race from unique constraint to business error", async () => {
    prismaMock.rabProject.findUnique.mockResolvedValue({
      id: "rab-4",
      status: "PENDING_APPROVAL",
      approvals: [{ userId: "approver-2", status: "APPROVED" }],
    });
    prismaMock.rabApproval.create.mockRejectedValue({
      code: "P2002",
      meta: { target: ["rabProjectId", "userId"] },
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
    expect(prismaMock.rabApproval.count).not.toHaveBeenCalled();
    expect(prismaMock.rabProject.update).not.toHaveBeenCalled();
  });
});
