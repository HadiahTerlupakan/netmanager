import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  approveLeave: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/modules/attendance/services/LeaveService", () => ({
  getLeaveService: () => ({ approveLeave: mockFns.approveLeave }),
}));

vi.mock("@/modules/database", () => ({
  prisma: {
    leaveRequest: {
      findMany: mockFns.findMany,
    },
  },
}));

import { autoApproveTukarLibur } from "@/modules/attendance/services/LeaveAutoApprovalService";

describe("autoApproveTukarLibur", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("approves pending TUKAR_LIBUR requests for tomorrow", async () => {
    mockFns.findMany.mockResolvedValue([
      {
        id: "leave-1",
        tenantId: "tenant-1",
        user: { id: "user-1", name: "Budi" },
      },
    ]);
    mockFns.approveLeave.mockResolvedValue({ success: true });

    const result = await autoApproveTukarLibur(
      new Date("2026-03-09T10:00:00+07:00"),
    );

    expect(mockFns.findMany).toHaveBeenCalledWith({
      where: {
        type: "TUKAR_LIBUR",
        status: "PENDING",
        startDate: {
          gte: new Date(2026, 2, 10),
          lte: new Date(2026, 2, 10, 23, 59, 59, 999),
        },
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    });
    expect(mockFns.approveLeave).toHaveBeenCalledWith(
      "leave-1",
      "SYSTEM_AUTO",
      "tenant-1",
    );
    expect(result).toEqual({
      approvedCount: 1,
      approvedIds: ["leave-1"],
      checkedDate: new Date(2026, 2, 10).toISOString().split("T")[0],
    });
  });
});
