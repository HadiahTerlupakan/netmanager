import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  approveLeave: vi.fn(),
  findPendingTukarLiburInRange: vi.fn(),
}));

vi.mock("@/modules/attendance/services/LeaveService", () => ({
  getLeaveService: () => ({ approveLeave: mockFns.approveLeave }),
}));

vi.mock("@/modules/attendance/repositories/LeaveRequestRepository", () => ({
  LeaveRequestRepository: class {
    findPendingTukarLiburInRange = mockFns.findPendingTukarLiburInRange;
  },
}));

import { autoApproveTukarLibur } from "@/modules/attendance";

describe("autoApproveTukarLibur", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("approves pending TUKAR_LIBUR requests for tomorrow", async () => {
    mockFns.findPendingTukarLiburInRange.mockResolvedValue([
      {
        id: "leave-1",
        tenantId: "tenant-1",
      },
    ]);
    mockFns.approveLeave.mockResolvedValue({ success: true });

    const result = await autoApproveTukarLibur(
      new Date("2026-03-09T10:00:00+07:00"),
    );

    expect(mockFns.findPendingTukarLiburInRange).toHaveBeenCalledWith(
      new Date(2026, 2, 10),
      new Date(2026, 2, 10, 23, 59, 59, 999),
    );
    expect(mockFns.approveLeave).toHaveBeenCalledWith(
      "leave-1",
      "SYSTEM_AUTO",
      "tenant-1",
    );
    expect(result).toEqual({
      approvedCount: 1,
      approvedIds: ["leave-1"],
      checkedDate: new Date("2026-03-09T10:00:00+07:00")
        .toISOString()
        .split("T")[0],
    });
  });
});
