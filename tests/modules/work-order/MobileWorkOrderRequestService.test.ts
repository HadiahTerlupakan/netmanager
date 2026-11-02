import { beforeEach, describe, expect, it, vi } from "vitest";

async function flushPromises(iterations = 12) {
  for (let index = 0; index < iterations; index += 1) {
    await Promise.resolve();
  }
}

const mockFns = vi.hoisted(() => ({
  createRequest: vi.fn(),
  userFindFirst: vi.fn(),
  departmentsFindFirst: vi.fn(),
  userFindMany: vi.fn(),
  createNotification: vi.fn(),
  socketNewWorkOrder: vi.fn(),
}));

vi.mock("@/modules/database", () => ({
  prisma: {
    user: {
      findFirst: (...args: unknown[]) => mockFns.userFindFirst(...args),
      findMany: (...args: unknown[]) => mockFns.userFindMany(...args),
    },
    departments: {
      findFirst: (...args: unknown[]) => mockFns.departmentsFindFirst(...args),
    },
  },
}));

vi.mock("@/modules/work-order/repositories/WorkOrderRepository", () => ({
  WorkOrderRepository: class MockWorkOrderRepository {
    createRequest = mockFns.createRequest;
  },
}));

vi.mock("@/modules/notification", () => ({
  createNotification: (...args: unknown[]) =>
    mockFns.createNotification(...args),
}));

vi.mock("@/lib/websocket/emitter", () => ({
  socketEmitter: {
    newWorkOrder: (...args: unknown[]) => mockFns.socketNewWorkOrder(...args),
  },
}));

import { MobileWorkOrderRequestService } from "@/modules/work-order/services/MobileWorkOrderRequestService";

describe("MobileWorkOrderRequestService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.userFindFirst.mockResolvedValue(null);
    mockFns.departmentsFindFirst.mockResolvedValue(null);
    mockFns.userFindMany.mockResolvedValue([]);
    mockFns.createNotification.mockResolvedValue(undefined);
    mockFns.socketNewWorkOrder.mockResolvedValue(undefined);
    mockFns.createRequest.mockResolvedValue({
      id: "wo-1",
      workOrderNumber: "WO-001",
      title: "Request Dismantle",
      type: "DISCONNECTION",
      status: "REQUESTED",
      priority: "HIGH",
      assignedToId: null,
      departmentId: null,
      siteId: "site-1",
      createdAt: new Date("2026-04-14T00:00:00.000Z"),
    });
  });

  it("memakai siteId dari session saat payload mobile tidak mengirim siteId", async () => {
    const prismaClient = {
      user: {
        findFirst: mockFns.userFindFirst,
        findMany: mockFns.userFindMany,
      },
      departments: {
        findFirst: mockFns.departmentsFindFirst,
      },
    } as never;

    const service = new MobileWorkOrderRequestService(prismaClient);

    await service.createRequest(
      {
        type: "DISCONNECTION",
        title: "Request Dismantle: Pelanggan A",
        description: "Permintaan pembongkaran perangkat",
        priority: "HIGH",
        contactName: "Pelanggan A",
      },
      {
        id: "user-1",
        tenantId: "tenant-1",
        siteId: "site-1",
        name: "Teknisi Mobile",
      },
    );

    expect(mockFns.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        requestedById: "user-1",
        tenantId: "tenant-1",
        siteId: "site-1",
      }),
    );
  });

  // Dulu: createNotification (FCM) + push Expo massal terpisah. Expo dihapus;
  // setiap admin cukup satu createNotification yang sudah membawa push FCM.
  it("mengirim satu notifikasi ber-push FCM ke tiap admin, tanpa push massal terpisah", async () => {
    mockFns.userFindMany.mockResolvedValue([
      { id: "admin-1" },
      { id: "admin-2" },
    ]);

    const prismaClient = {
      user: {
        findFirst: mockFns.userFindFirst,
        findMany: mockFns.userFindMany,
      },
      departments: {
        findFirst: mockFns.departmentsFindFirst,
      },
    } as never;

    const service = new MobileWorkOrderRequestService(prismaClient);

    await service.createRequest(
      {
        type: "DISCONNECTION",
        title: "Request Dismantle: Pelanggan A",
        description: "Permintaan pembongkaran perangkat",
        priority: "HIGH",
      },
      {
        id: "user-1",
        tenantId: "tenant-1",
        siteId: "site-1",
        name: "Teknisi Mobile",
      },
    );

    await flushPromises();

    expect(mockFns.createNotification).toHaveBeenCalledTimes(2);
    expect(mockFns.createNotification).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        userId: "admin-1",
        title: "📝 WO Request Baru",
      }),
    );
    expect(mockFns.createNotification).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ userId: "admin-2" }),
    );
    for (const [panggilan] of mockFns.createNotification.mock.calls) {
      expect(panggilan).not.toHaveProperty("skipPush");
    }
  });

  it("mengembalikan work order sebelum fan-out notifikasi admin selesai", async () => {
    mockFns.userFindMany.mockResolvedValue([
      { id: "admin-1" },
      { id: "admin-2" },
    ]);

    let resolvePush: ((value: { id: string }) => void) | undefined;
    mockFns.createNotification.mockImplementation(
      () =>
        new Promise<{ id: string }>((resolve) => {
          resolvePush = resolve;
        }),
    );

    const prismaClient = {
      user: {
        findFirst: mockFns.userFindFirst,
        findMany: mockFns.userFindMany,
      },
      departments: {
        findFirst: mockFns.departmentsFindFirst,
      },
    } as never;

    const service = new MobileWorkOrderRequestService(prismaClient);

    const pendingRequest = service.createRequest(
      {
        type: "DISCONNECTION",
        title: "Request Dismantle: Pelanggan A",
        description: "Permintaan pembongkaran perangkat",
        priority: "HIGH",
      },
      {
        id: "user-1",
        tenantId: "tenant-1",
        siteId: "site-1",
        name: "Teknisi Mobile",
      },
    );

    await flushPromises(20);

    const resolutionProbe = vi.fn();
    pendingRequest.then(resolutionProbe);
    await flushPromises(20);

    expect(resolutionProbe).toHaveBeenCalledWith(
      expect.objectContaining({ id: "wo-1" }),
    );
    expect(resolvePush).toBeTypeOf("function");

    resolvePush?.({ id: "notif-1" });
    await expect(pendingRequest).resolves.toEqual(
      expect.objectContaining({ id: "wo-1" }),
    );
  });
});
