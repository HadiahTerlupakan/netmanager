import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findWorkOrder: vi.fn(),
  findTargetUser: vi.fn(),
  findPartnerAdminProfile: vi.fn(),
  findAssignmentForRemoval: vi.fn(),
  createPartnerAssignment: vi.fn(),
  assignmentFindFirst: vi.fn(),
  assignmentDelete: vi.fn(),
}));

vi.mock("@/modules/database", () => ({
  prisma: {
    workOrderAssignments: {
      findFirst: mocks.assignmentFindFirst,
      delete: mocks.assignmentDelete,
    },
  },
}));
vi.mock(
  "@/modules/work-order/services/mobile-work-order-partner.lookup",
  () => ({
    findWorkOrder: mocks.findWorkOrder,
    findTargetUser: mocks.findTargetUser,
    findPartnerAdminProfile: mocks.findPartnerAdminProfile,
    findAssignmentForRemoval: mocks.findAssignmentForRemoval,
    createPartnerAssignment: mocks.createPartnerAssignment,
    findPartnerAssignment: vi.fn(),
    updatePartnerInvitationResponse: vi.fn(),
  }),
);
vi.mock("@/modules/work-order/services/partner-invite-availability", () => ({
  canInvitePartnerToday: vi.fn().mockResolvedValue(true),
  PARTNER_ON_LEAVE_ERROR_MESSAGE: "cuti",
}));
vi.mock("@/modules/work-order/services/work-order-activity-log", () => ({
  recordWorkOrderActivity: vi.fn(),
  WORK_ORDER_ACTIVITY_ACTIONS: {},
}));

import { MobileWorkOrderPartnerService } from "@/modules/work-order/services/MobileWorkOrderPartnerService";

const TENANT = "tenant-1";
const WO_SITE_B = {
  id: "wo-1",
  tenantId: TENANT,
  createdById: "pembuat",
  assignedToId: "lead",
  siteId: "site-b",
  departmentId: null as string | null,
};

function adminProfile(overrides: Record<string, unknown> = {}) {
  return {
    isAdmin: true,
    isSuperAdmin: false,
    siteId: "site-a",
    departmentId: undefined as string | undefined,
    permissions: [] as string[],
    ...overrides,
  };
}

function addPartner() {
  return new MobileWorkOrderPartnerService().addPartner({
    workOrderId: "wo-1",
    actorId: "admin-a",
    tenantId: TENANT,
    partnerUserId: "partner-1",
  });
}

describe("admin panel mengelola partner WO sesuai lingkup workorders:*_only", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findWorkOrder.mockResolvedValue(WO_SITE_B);
    mocks.findTargetUser.mockResolvedValue({ id: "partner-1", name: "P" });
    mocks.assignmentFindFirst.mockResolvedValue(null);
    mocks.createPartnerAssignment.mockResolvedValue({ id: "asg-1" });
  });

  it("menolak admin ber-site_only atas WO site lain", async () => {
    mocks.findPartnerAdminProfile.mockResolvedValue(
      adminProfile({ permissions: ["workorders:site_only"] }),
    );

    await expect(addPartner()).rejects.toThrow("FORBIDDEN");
    expect(mocks.createPartnerAssignment).not.toHaveBeenCalled();
  });

  it("mengizinkan admin tanpa toggle pembatas di tenant yang sama", async () => {
    mocks.findPartnerAdminProfile.mockResolvedValue(adminProfile());

    await expect(addPartner()).resolves.toEqual({ id: "asg-1" });
  });

  it("mengizinkan admin ber-site_only atas WO site sendiri", async () => {
    mocks.findPartnerAdminProfile.mockResolvedValue(
      adminProfile({ permissions: ["workorders:site_only"], siteId: "site-b" }),
    );

    await expect(addPartner()).resolves.toEqual({ id: "asg-1" });
  });

  it("menolak non-admin yang bukan peserta WO", async () => {
    mocks.findPartnerAdminProfile.mockResolvedValue(
      adminProfile({ isAdmin: false }),
    );

    await expect(addPartner()).rejects.toThrow("FORBIDDEN");
  });

  it("lead WO tetap bisa mengelola partner tanpa memeriksa profil admin", async () => {
    await expect(
      new MobileWorkOrderPartnerService().addPartner({
        workOrderId: "wo-1",
        actorId: "lead",
        tenantId: TENANT,
        partnerUserId: "partner-1",
      }),
    ).resolves.toEqual({ id: "asg-1" });
    expect(mocks.findPartnerAdminProfile).not.toHaveBeenCalled();
  });

  it("hapus partner juga menegakkan lingkup admin", async () => {
    mocks.findAssignmentForRemoval.mockResolvedValue({
      id: "asg-1",
      workOrderId: "wo-1",
      assignedById: "orang-lain",
      userId: "partner-1",
      workOrders: WO_SITE_B,
    });
    mocks.findPartnerAdminProfile.mockResolvedValue(
      adminProfile({ permissions: ["workorders:site_only"] }),
    );

    await expect(
      new MobileWorkOrderPartnerService().removePartner({
        assignmentId: "asg-1",
        workOrderId: "wo-1",
        actorId: "admin-a",
        tenantId: TENANT,
      }),
    ).rejects.toThrow("FORBIDDEN");
    expect(mocks.assignmentDelete).not.toHaveBeenCalled();
  });
});
