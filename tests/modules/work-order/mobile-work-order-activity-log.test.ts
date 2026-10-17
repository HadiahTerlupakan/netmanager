import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  logActivitySafe: vi.fn(),
  userFindFirst: vi.fn(),
  taskFindFirst: vi.fn(),
  assignmentDelete: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logActivitySafe: mocks.logActivitySafe,
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/modules/database", () => ({
  prisma: {
    user: { findFirst: mocks.userFindFirst },
    workOrderTasks: { findFirst: mocks.taskFindFirst },
    workOrderAssignments: { delete: mocks.assignmentDelete },
  },
}));
vi.mock("@/lib/websocket/emitter", () => ({
  socketEmitter: { updateWorkOrder: vi.fn(), emit: vi.fn() },
}));
vi.mock(
  "@/modules/work-order/services/mobile-work-order-notification.helpers",
  () => ({
    notifyMobileTaskUpdate: vi.fn(),
    notifyMobileWorkOrderAction: vi.fn(),
  }),
);
vi.mock(
  "@/modules/work-order/services/work-order-mobile-action.support",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    ensureMobileWorkOrderAccess: vi.fn(),
    getWorkOrderOrThrow: vi.fn().mockResolvedValue({
      id: "wo-1",
      workOrderNumber: "WO-20261017-0005",
      title: "Internet Mati / FOCUT",
      tenantId: "tenant-1",
      status: "ASSIGNED",
    }),
  }),
);
vi.mock(
  "@/modules/work-order/services/mobile-work-order-partner.lookup",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    findWorkOrder: vi.fn().mockResolvedValue({
      id: "wo-1",
      workOrderNumber: "WO-20261017-0005",
      title: "Internet Mati / FOCUT",
      tenantId: "tenant-1",
      status: "IN_PROGRESS",
      createdById: "user-1",
      assignedToId: "user-1",
    }),
    findTargetUser: vi.fn().mockResolvedValue({ id: "user-2", name: "Kacun" }),
    findAssignmentForRemoval: vi.fn().mockResolvedValue({
      id: "asg-1",
      workOrderId: "wo-1",
      userId: "user-2",
      assignedById: "user-1",
      workOrders: {
        id: "wo-1",
        workOrderNumber: "WO-20261017-0005",
        title: "Internet Mati / FOCUT",
        tenantId: "tenant-1",
        createdById: "user-1",
        assignedToId: "user-1",
      },
    }),
    createPartnerAssignment: vi.fn().mockResolvedValue({ id: "asg-1" }),
  }),
);

import { MobileAvailableWorkOrderService } from "@/modules/work-order/services/MobileAvailableWorkOrderService";
import { MobileWorkOrderActionService } from "@/modules/work-order/services/MobileWorkOrderActionService";
import { MobileWorkOrderPartnerService } from "@/modules/work-order/services/MobileWorkOrderPartnerService";

type Internals = Record<string, unknown>;
const SUBJECT = "Work Order WO-20261017-0005";

function lastActivity() {
  expect(mocks.logActivitySafe).toHaveBeenCalledTimes(1);
  return mocks.logActivitySafe.mock.calls[0][0];
}

describe("Log Aktivitas aksi WO dari mobile", () => {
  beforeEach(() => {
    mocks.logActivitySafe.mockReset();
    mocks.userFindFirst.mockResolvedValue({ name: "Kacun" });
  });

  it.each(["START", "CLAIM", "COMPLETE", "PAUSE", "COMMENT", "NOTE"])(
    "mencatat aksi %s dengan nama aksinya sendiri",
    async (action) => {
      const service = new MobileWorkOrderActionService({} as never);
      (service as unknown as Internals).runAction = vi.fn();

      await service.handleAction({
        workOrderId: "wo-1",
        tenantId: "tenant-1",
        actor: { id: "user-1", name: "Kacun" },
        payload: { action, notes: "ODP sudah disambung" } as never,
      });

      expect(lastActivity()).toMatchObject({
        action,
        subject: SUBJECT,
        userId: "user-1",
        tenantId: "tenant-1",
        details: {
          workOrderId: "wo-1",
          statusSebelum: "ASSIGNED",
          notes: "ODP sudah disambung",
        },
      });
    },
  );

  it("mencatat centang tugas WO", async () => {
    mocks.taskFindFirst.mockResolvedValue({ title: "Splicing ODP" });
    const service = new MobileWorkOrderActionService({
      updateTask: vi.fn(),
    } as never);

    await service.updateTaskStatus({
      workOrderId: "wo-1",
      taskId: "task-1",
      isCompleted: true,
      tenantId: "tenant-1",
      actor: { id: "user-1" },
    });

    expect(lastActivity()).toMatchObject({
      action: "UPDATE_TASK",
      subject: SUBJECT,
      details: { taskId: "task-1", tugas: "Splicing ODP", status: "COMPLETED" },
    });
  });

  it("mencatat klaim WO tersedia oleh mitra sebagai pelaku mitra", async () => {
    const claimed = {
      id: "wo-1",
      workOrderNumber: "WO-20261017-0005",
      title: "Internet Mati / FOCUT",
      tenantId: "tenant-1",
      status: "PENDING",
      assignedToId: null as string | null,
      assignedMitraId: null as string | null,
    };
    const service = new MobileAvailableWorkOrderService({
      findUserProfile: vi.fn().mockResolvedValue(null),
      findWorkOrderById: vi.fn().mockResolvedValue(claimed),
      claimWorkOrder: vi.fn().mockResolvedValue(true),
    } as never);
    const internals = service as unknown as Internals;
    internals.validateClaimAccess = vi.fn();
    internals.resolveTriggeredByName = vi.fn().mockResolvedValue("CV Jaya");
    internals.afterClaim = vi.fn();

    await service
      .claimAvailableWorkOrder("wo-1", {
        id: "mitra-1",
        role: "MITRA",
        tenantId: "tenant-1",
      } as never)
      .catch((): undefined => undefined);

    expect(lastActivity()).toMatchObject({
      action: "CLAIM",
      subject: SUBJECT,
      actor: { type: "mitra", id: "mitra-1" },
      tenantId: "tenant-1",
    });
  });

  it("mencatat penambahan partner", async () => {
    const service = new MobileWorkOrderPartnerService();
    const internals = service as unknown as Internals;
    internals.ensurePartnerAccess = vi.fn();
    internals.ensurePartnerAssignmentAvailable = vi.fn();
    internals.ensurePartnerAvailableToday = vi.fn();

    await service.addPartner({
      workOrderId: "wo-1",
      actorId: "user-1",
      tenantId: "tenant-1",
      partnerUserId: "user-2",
    });

    expect(lastActivity()).toMatchObject({
      action: "ADD_PARTNER",
      subject: SUBJECT,
      userId: "user-1",
      details: { partnerId: "user-2", partnerName: "Kacun" },
    });
  });

  it("mencatat penghapusan partner", async () => {
    const service = new MobileWorkOrderPartnerService();
    (service as unknown as Internals).ensurePartnerAccess = vi.fn();

    await service.removePartner({
      assignmentId: "asg-1",
      workOrderId: "wo-1",
      actorId: "user-1",
      tenantId: "tenant-1",
    });

    expect(lastActivity()).toMatchObject({
      action: "REMOVE_PARTNER",
      subject: SUBJECT,
      details: { assignmentId: "asg-1", partnerId: "user-2" },
    });
  });
});
