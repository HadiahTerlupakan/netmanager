import { RabRevisionStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  revisionFindUnique: vi.fn(),
  approvalCreate: vi.fn(),
  approvalCount: vi.fn(),
  revisionUpdate: vi.fn(),
  projectUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/modules/database", () => ({
  prisma: {
    user: { findUnique: mockFns.userFindUnique },
    rabRevision: {
      findUnique: mockFns.revisionFindUnique,
      update: mockFns.revisionUpdate,
    },
    rabRevisionApproval: {
      create: mockFns.approvalCreate,
      count: mockFns.approvalCount,
    },
    rabProject: { update: mockFns.projectUpdate },
    $transaction: mockFns.transaction,
  },
}));

import {
  approveRabRevision,
  RabRevisionApprovalError,
} from "@/modules/finance/services/RabRevisionApprovalService";

describe("approveRabRevision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.transaction.mockImplementation(async (callback) =>
      callback({
        rabRevision: { update: mockFns.revisionUpdate },
        rabProject: { update: mockFns.projectUpdate },
      }),
    );
    mockFns.userFindUnique.mockResolvedValue({
      id: "approver-1",
      role: { canApproveRab: true, name: "Finance", isSuperAdmin: false },
    });
    mockFns.revisionFindUnique.mockResolvedValue({
      id: "rev-1",
      rabProjectId: "rab-1",
      status: RabRevisionStatus.PENDING_APPROVAL,
      approvals: [],
      project: { id: "rab-1" },
    });
    mockFns.approvalCount.mockResolvedValue(1);
    mockFns.revisionUpdate.mockResolvedValue({
      id: "rev-1",
      status: "APPROVED",
    });
  });

  it("creates approval and promotes revision when threshold is reached", async () => {
    const result = await approveRabRevision({
      rabProjectId: "rab-1",
      revisionId: "rev-1",
      userId: "approver-1",
    });

    expect(mockFns.approvalCreate).toHaveBeenCalledWith({
      data: {
        rabRevisionId: "rev-1",
        userId: "approver-1",
        status: "APPROVED",
      },
    });
    expect(mockFns.projectUpdate).toHaveBeenCalledWith({
      where: { id: "rab-1" },
      data: { finalApprovedRevisionId: "rev-1" },
    });
    expect(result.message).toBe("Revisi RAB berhasil disetujui seutuhnya.");
  });

  it("blocks users without RAB approval permission", async () => {
    mockFns.userFindUnique.mockResolvedValue({
      id: "user-1",
      role: {
        canApproveRab: false,
        canReceiveWhatsappApproval: false,
        name: "Staff",
        isSuperAdmin: false,
      },
    });

    await expect(
      approveRabRevision({
        rabProjectId: "rab-1",
        revisionId: "rev-1",
        userId: "user-1",
      }),
    ).rejects.toEqual(
      new RabRevisionApprovalError(
        "Dilarang: Akun Anda tidak memiliki hak akses (role: canApproveRab) untuk menyetujui dokumen ini.",
        403,
      ),
    );
  });
});
