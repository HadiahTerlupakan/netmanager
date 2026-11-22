import { describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/tests/setup";
import { LeaveRequestRepository } from "@/modules/attendance/repositories/LeaveRequestRepository";

type LeaveRow = Awaited<ReturnType<typeof prismaMock.leaveRequest.findMany>>;

function leaveRow(id: string, approvedBy: string | null) {
  return { id, approvedBy, user: { name: "Pegawai" } };
}

/**
 * Layar izin dulu menulis "Admin" untuk setiap penyetuju. Daftar izin kini
 * membawa nama user yang benar-benar menyetujui.
 */
describe("LeaveRequestRepository.findAll — nama penyetuju", () => {
  it("menambahkan nama penyetuju dari approvedBy, dibatasi tenant", async () => {
    vi.mocked(prismaMock.leaveRequest.findMany).mockResolvedValue([
      leaveRow("l1", "spv-1"),
      leaveRow("l2", "spv-1"),
      leaveRow("l3", "SYSTEM_AUTO"),
      leaveRow("l4", null),
    ] as unknown as LeaveRow);
    vi.mocked(prismaMock.user.findMany).mockResolvedValue([
      { id: "spv-1", name: "Budi Supervisor" },
    ] as never);

    const leaves = await new LeaveRequestRepository().findAll({
      tenantId: "t1",
    });

    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["spv-1"] }, tenantId: "t1" },
      select: { id: true, name: true },
    });
    expect(leaves.map((leave) => leave.approverName)).toEqual([
      "Budi Supervisor",
      "Budi Supervisor",
      null,
      null,
    ]);
  });

  it("tidak membaca user bila belum ada izin yang disetujui orang", async () => {
    vi.mocked(prismaMock.leaveRequest.findMany).mockResolvedValue([
      leaveRow("l1", null),
    ] as unknown as LeaveRow);

    const leaves = await new LeaveRequestRepository().findAll({
      tenantId: "t1",
    });

    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
    expect(leaves[0].approverName).toBeNull();
  });
});
