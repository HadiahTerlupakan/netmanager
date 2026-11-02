import { describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/tests/setup";
import { LeaveRequestRepository } from "@/modules/attendance/repositories/LeaveRequestRepository";
import { buildOvertimeWhere } from "@/modules/overtime/repositories/OvertimeRepository.helpers";

/**
 * Lingkup admin multi-site diteruskan sebagai daftar site. Kolom site pemilik
 * data harus disaring `{ in }` — dulu hanya satu site utama yang diteruskan.
 */
describe("filter site lingkup admin di repository", () => {
  it("izin: siteIds menjadi user.siteId { in }", async () => {
    vi.mocked(prismaMock.leaveRequest.count).mockResolvedValue(0);

    await new LeaveRequestRepository().count({
      tenantId: "t1",
      siteIds: ["site-a", "site-b"],
    });

    expect(prismaMock.leaveRequest.count).toHaveBeenCalledWith({
      where: {
        tenantId: "t1",
        user: { siteId: { in: ["site-a", "site-b"] } },
      },
    });
  });

  it("izin: siteIds kosong tetap menyaring (hasil kosong), bukan tanpa filter", async () => {
    vi.mocked(prismaMock.leaveRequest.count).mockResolvedValue(0);

    await new LeaveRequestRepository().count({ tenantId: "t1", siteIds: [] });

    expect(prismaMock.leaveRequest.count).toHaveBeenCalledWith({
      where: { tenantId: "t1", user: { siteId: { in: [] } } },
    });
  });

  it("lembur: siteId { in } diteruskan ke filter user", () => {
    expect(
      buildOvertimeWhere({
        tenantId: "t1",
        siteId: { in: ["site-a", "site-b"] },
      }).user,
    ).toEqual({ siteId: { in: ["site-a", "site-b"] } });
  });
});
