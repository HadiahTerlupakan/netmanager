import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserPermissions: vi.fn(),
  getUnreadCount: vi.fn(),
}));

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getUserPermissions: mocks.getUserPermissions,
}));

import { AdminSupportTicketService } from "@/modules/pelanggan/services/AdminSupportTicketService";
import * as supportServiceModule from "@/modules/pelanggan/services/AdminSupportTicketService";
import { AdminSupportTicketRouteService } from "@/modules/pelanggan/services/AdminSupportTicketRouteService";

describe("AdminSupportTicketService.replyToTicket — lingkup site", () => {
  it("admin terbatas tanpa site ditolak, bukan dibebaskan", async () => {
    const ticketRepo = {
      findByIdAdmin: vi.fn().mockResolvedValue({
        id: "t-1",
        status: "OPEN",
        pelangganId: "p-1",
      }),
      createReply: vi.fn(),
    };
    const service = new AdminSupportTicketService(ticketRepo as never);

    const result = await service.replyToTicket({
      ticketId: "t-1",
      senderId: "admin-1",
      message: "halo",
      allowedSiteIds: [],
    } as never);

    expect(result).toMatchObject({ success: false, code: "FORBIDDEN" });
    expect(ticketRepo.createReply).not.toHaveBeenCalled();
  });
});

describe("AdminSupportTicketRouteService.getUnreadCount — lingkup site", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(
      supportServiceModule,
      "getAdminSupportTicketService",
    ).mockReturnValue({
      getUnreadCount: mocks.getUnreadCount,
    } as never);
    mocks.getUnreadCount.mockResolvedValue({
      success: true,
      data: { count: 0 },
    });
  });

  it("menghitung seluruh site admin, bukan hanya site pertama", async () => {
    mocks.getUserPermissions.mockResolvedValue([
      "support:read",
      "support:site_only",
    ]);

    await new AdminSupportTicketRouteService().getUnreadCount({
      user: { id: "admin-1", role: "ADMIN", siteIds: ["s1", "s2"] },
    } as never);

    expect(mocks.getUnreadCount).toHaveBeenCalledWith(["s1", "s2"]);
  });

  it("admin terbatas tanpa site dihitung pada daftar kosong", async () => {
    mocks.getUserPermissions.mockResolvedValue([
      "support:read",
      "support:site_only",
    ]);

    await new AdminSupportTicketRouteService().getUnreadCount({
      user: { id: "admin-1", role: "ADMIN" },
    } as never);

    expect(mocks.getUnreadCount).toHaveBeenCalledWith([]);
  });

  it("admin tanpa pembatasan menghitung seluruh tenant", async () => {
    mocks.getUserPermissions.mockResolvedValue(["support:read"]);

    await new AdminSupportTicketRouteService().getUnreadCount({
      user: { id: "admin-1", role: "ADMIN", siteIds: ["s1"] },
    } as never);

    expect(mocks.getUnreadCount).toHaveBeenCalledWith(undefined);
  });
});
