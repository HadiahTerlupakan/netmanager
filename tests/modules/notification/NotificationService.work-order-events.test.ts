import { beforeEach, describe, expect, it, vi } from "vitest";

const findEligibleRecipients = vi.fn();
const findWorkOrderStakeholders = vi.fn();
const createNotification = vi.fn();

vi.mock(
  "@/modules/notification/services/NotificationService.recipients",
  () => ({
    findEligibleRecipients: (...args: unknown[]) =>
      findEligibleRecipients(...args),
    findWorkOrderStakeholders: (...args: unknown[]) =>
      findWorkOrderStakeholders(...args),
    findCanvasingVerifiers: vi.fn(),
  }),
);

vi.mock(
  "@/modules/notification/services/NotificationService.workorders",
  () => ({
    notifyNewWorkOrderRecipients: vi.fn(
      async (input: { recipients: unknown[] }) => ({
        count: input.recipients.length,
      }),
    ),
    notifyAssignedWorkOrderRecipients: vi.fn(async () => undefined),
    notifyStatusChangedWorkOrderRecipients: vi.fn(async () => undefined),
    notifyUpdatedWorkOrderRecipients: vi.fn(async () => undefined),
    notifyMobileActionRecipients: vi.fn(
      async (input: { recipients: unknown[] }) => ({
        count: input.recipients.length,
      }),
    ),
  }),
);

import {
  notifyNewWorkOrderEvent,
  notifyWorkOrderStatusChangeEvent,
  notifyAdminsAboutMobileActionEvent,
} from "@/modules/notification/services/NotificationService.work-order-events";

const userLookupService = {} as import("@/modules/users").UserLookupService;

describe("work-order notification audiences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findEligibleRecipients.mockResolvedValue([{ id: "pool-1" }]);
    findWorkOrderStakeholders.mockResolvedValue([{ id: "stake-1" }]);
    createNotification.mockResolvedValue({});
  });

  it("new WO uses POOL (findEligibleRecipients)", async () => {
    await notifyNewWorkOrderEvent({
      userLookupService,
      createNotification,
      data: {
        workOrderId: "wo-1",
        workOrderNumber: "WO-1",
        title: "T",
        type: "INSTALLATION",
        priority: "NORMAL",
        departmentId: "d1",
        siteId: "s1",
        triggeredByUserId: "u0",
      },
    });
    expect(findEligibleRecipients).toHaveBeenCalled();
    expect(findWorkOrderStakeholders).not.toHaveBeenCalled();
  });

  it("status change uses STAKEHOLDERS", async () => {
    await notifyWorkOrderStatusChangeEvent({
      userLookupService,
      createNotification,
      data: {
        workOrderId: "wo-1",
        workOrderNumber: "WO-1",
        title: "T",
        type: "INSTALLATION",
        priority: "NORMAL",
        oldStatus: "COMPLETED",
        newStatus: "VERIFIED",
        departmentId: "d1",
        siteId: "s1",
        assignedToId: "tech-1",
        createdById: "admin-1",
        triggeredByUserId: "u0",
      },
    });
    expect(findWorkOrderStakeholders).toHaveBeenCalledWith(
      expect.objectContaining({
        workOrderId: "wo-1",
        assignedToId: "tech-1",
        createdById: "admin-1",
        excludeUserId: "u0",
      }),
    );
    expect(findEligibleRecipients).not.toHaveBeenCalled();
  });

  it("mobile action uses STAKEHOLDERS", async () => {
    await notifyAdminsAboutMobileActionEvent({
      userLookupService,
      createNotification,
      data: {
        workOrderId: "wo-1",
        workOrderNumber: "WO-1",
        title: "T",
        actionType: "CLAIM",
        actionMessage: "claim",
        triggeredByUserId: "tech-1",
        departmentId: "d1",
        siteId: "s1",
        assignedToId: "tech-1",
      },
    });
    expect(findWorkOrderStakeholders).toHaveBeenCalled();
    expect(findEligibleRecipients).not.toHaveBeenCalled();
  });
});
