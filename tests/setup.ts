import { beforeEach, vi, type Mock } from "vitest";
import { mockReset } from "vitest-mock-extended";

// Force the timezone to Jakarta for all tests so that CI (UTC) behaves identically to local development
process.env.TZ = "Asia/Jakarta";
// Define a simplified mock type to avoid Prisma's circular type references (TS2615)
// This is a known issue with Prisma 7.x and vitest-mock-extended
// See: https://www.prisma.io/docs/orm/prisma-client/testing/unit-testing

type MockFn = Mock;

type MockModel = {
  findMany: MockFn;
  findUnique: MockFn;
  findFirst: MockFn;
  create: MockFn;
  createMany: MockFn;
  update: MockFn;
  updateMany: MockFn;
  delete: MockFn;
  deleteMany: MockFn;
  upsert: MockFn;
  count: MockFn;
  aggregate: MockFn;
  groupBy: MockFn;
};

export type MockPrismaClient = {
  announcement: MockModel;
  announcementRead: MockModel;
  appVersion: MockModel;
  attendance: MockModel;
  attendanceEvaluation: MockModel;
  attendanceEvaluationAudit: MockModel;
  barang: MockModel;
  barangGudang: MockModel;
  barangKeluar: MockModel;
  canvasing: MockModel;
  conversation: MockModel;
  employeeLoan: MockModel;
  emailDeliveryLog: MockModel;
  expense: MockModel;
  gudang: MockModel;
  hargaPaket: MockModel;
  holiday: MockModel;
  investor: MockModel;
  invoice: MockModel;
  leaveRequest: MockModel;
  mitra: MockModel;
  notifications: MockModel;
  notificationDeadLetter: MockModel;
  odp: MockModel;
  odpOutput: MockModel;
  overtime: MockModel;
  overtimeAutoCheckoutSchedule: MockModel;
  payment: MockModel;
  pelanggan: MockModel;
  pemasukan: MockModel;
  pengeluaran: MockModel;
  permission: MockModel;
  profilePPP: MockModel;
  proratePaymentLog: MockModel;
  purchaseRequest: MockModel;
  purchaseRequestItem: MockModel;
  purchaseOrder: MockModel;
  purchaseOrderItem: MockModel;
  rabActualAchievement: MockModel;
  rabInvestor: MockModel;
  rabItem: MockModel;
  rabProject: MockModel;
  rabRevision: MockModel;
  radcheck: MockModel;
  radgroupcheck: MockModel;
  radgroupreply: MockModel;
  radippool: MockModel;
  radusergroup: MockModel;
  restockAlerts: MockModel;
  restockSettings: MockModel;
  role: MockModel;
  salary: MockModel;
  settings: MockModel;
  sites: MockModel;
  stockOpname: MockModel;
  supportTickets: MockModel;
  systemLog: MockModel;
  ticketReplies: MockModel;
  unmatchedMutation: MockModel;
  user: MockModel;
  userSite: MockModel;
  userSalaryComponent: MockModel;
  workOrderAssignments: MockModel;
  workOrderAttachments: MockModel;
  workOrderTasks: MockModel;
  workOrderUpdates: MockModel;
  workOrders: MockModel;
  $connect: MockFn;
  $disconnect: MockFn;
  $transaction: MockFn;
  $queryRaw: MockFn;
  $queryRawUnsafe: MockFn;
  $executeRaw: MockFn;
  $executeRawUnsafe: MockFn;
  $on: MockFn;
  $extends: MockFn;
  _cache?: Map<string, MockModel>;
};

// Create deep mock without instantiating real PrismaClient
// This avoids needing DATABASE_URL for tests
const createMock = (): MockPrismaClient => {
  const createMockModel = (): MockModel => ({
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  });

  // Base methods that are always present
  const baseMock: Record<string, MockFn> = {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $transaction: vi.fn().mockImplementation((callback) => {
      if (typeof callback === "function") {
        return callback(prismaMock);
      }
      return Promise.resolve(callback);
    }),
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    $executeRaw: vi.fn(),
    $executeRawUnsafe: vi.fn(),
    $on: vi.fn(),
    $extends: vi.fn(),
  };

  // Use Proxy to create models on demand
  const cache = new Map<string, MockModel>();

  const proxy = new Proxy(baseMock, {
    get(target, prop) {
      if (prop === "_cache") return cache;
      if (typeof prop === "string" && prop in target) {
        return target[prop];
      }

      if (typeof prop === "string" && !prop.startsWith("$")) {
        if (!cache.has(prop)) {
          cache.set(prop, createMockModel());
        }
        return cache.get(prop);
      }

      return undefined;
    },
  }) as unknown as MockPrismaClient;

  return proxy;
};

// Export with simplified type - the actual mock still has all Prisma methods
export const prismaMock = createMock();

// Mock the prisma modules
vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  prismaAuth: prismaMock,
}));

vi.mock("@/lib/prisma-mitra", () => ({
  prismaMitra: prismaMock,
  prismaMitraAuth: prismaMock,
}));

vi.mock("@/lib/prisma-billing", () => ({
  prismaBilling: prismaMock,
  prismaBillingAuth: prismaMock,
}));

vi.mock("@/lib/prisma-radius", () => ({
  prismaRadius: prismaMock,
  prismaRadiusAuth: prismaMock,
}));

vi.mock("@/lib/tenant-context", () => ({
  getTenantIdFromContext: vi.fn().mockResolvedValue({ isSuperAdmin: true }),
  runWithRequestTenantContext: vi.fn(
    async (_tenantContext, callback: () => Promise<unknown>) => callback(),
  ),
}));

// Set default secret for JWT testing
process.env.NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET || "test-secret-123-at-least-32-chars-long";
process.env.DATABASE_URL_BILLING =
  process.env.DATABASE_URL_BILLING ||
  "postgresql://billing-test:billing-test@localhost:5432/billing_test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test";
process.env.NEXT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Reset all mocks before each test
beforeEach(() => {
  const pMock = prismaMock as MockPrismaClient;
  mockReset(pMock as unknown as { [key: string]: unknown });

  // Reset all cached model mocks
  if (pMock._cache) {
    pMock._cache.forEach((model: MockModel) => {
      Object.values(model).forEach((mock) => {
        if (typeof mock === "function") {
          (mock as MockFn).mockReset();
        }
      });
    });
  }
});

// Mock console methods to reduce noise in tests
vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});

// Mock ioredis globally so modules using BullMQ/ioredis never attempt real network connections in tests
vi.mock("ioredis", () => {
  class RedisMock {
    options: Record<string, unknown>;
    status = "ready";
    private maxListeners = 10;
    private listeners = new Map<
      string | symbol,
      Set<(...args: unknown[]) => void>
    >();

    constructor(_url?: string, options: Record<string, unknown> = {}) {
      this.options = options;
    }

    private addListener(
      event: string | symbol,
      listener: (...args: unknown[]) => void,
      once = false,
    ) {
      const wrapped = once
        ? (...args: unknown[]) => {
            this.removeListener(event, wrapped);
            listener(...args);
          }
        : listener;

      const currentListeners = this.listeners.get(event) ?? new Set();
      currentListeners.add(wrapped);
      this.listeners.set(event, currentListeners);
      return this;
    }

    on = vi.fn(
      (event: string | symbol, listener: (...args: unknown[]) => void) =>
        this.addListener(event, listener),
    );
    once = vi.fn(
      (event: string | symbol, listener: (...args: unknown[]) => void) =>
        this.addListener(event, listener, true),
    );
    off = vi.fn(
      (event: string | symbol, listener: (...args: unknown[]) => void) =>
        this.removeListener(event, listener),
    );
    removeListener = vi.fn(
      (event: string | symbol, listener: (...args: unknown[]) => void) => {
        this.listeners.get(event)?.delete(listener);
        return this;
      },
    );
    emit = vi.fn((event: string | symbol, ...args: unknown[]) => {
      for (const listener of this.listeners.get(event) ?? []) {
        listener(...args);
      }
      return true;
    });
    getMaxListeners = vi.fn(() => this.maxListeners);
    setMaxListeners = vi.fn((count: number) => {
      this.maxListeners = count;
      return this;
    });
    defineCommand = vi.fn((name: string) => {
      const command = vi.fn().mockResolvedValue(1);
      Object.assign(this, { [name]: command });
      return this;
    });
    info = vi
      .fn()
      .mockResolvedValue("redis_version:7.2.0\nmaxmemory_policy:noeviction");
    connect = vi.fn().mockResolvedValue(undefined);
    disconnect = vi.fn(() => {
      this.status = "end";
      this.emit("end");
    });
    quit = vi.fn().mockImplementation(async () => {
      this.status = "end";
      this.emit("end");
      return "OK";
    });
    duplicate = vi.fn(() => new RedisMock(undefined, this.options));
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue("OK");
    setex = vi.fn().mockResolvedValue("OK");
    del = vi.fn().mockResolvedValue(1);
    exists = vi.fn().mockResolvedValue(0);
    keys = vi.fn().mockResolvedValue([]);
    expire = vi.fn().mockResolvedValue(1);
    incr = vi.fn().mockResolvedValue(1);
    ttl = vi.fn().mockResolvedValue(-1);
    hget = vi.fn().mockResolvedValue(null);
    hset = vi.fn().mockResolvedValue(1);
    hdel = vi.fn().mockResolvedValue(1);
    hgetall = vi.fn().mockResolvedValue({});
    publish = vi.fn().mockResolvedValue(0);
    subscribe = vi.fn().mockResolvedValue(0);
  }

  return {
    default: RedisMock,
  };
});

// Mock Redis client globally
// This prevents errors in CI environments where Redis is not available
export const redisMock = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  keys: vi.fn(),
  expire: vi.fn(),
  incr: vi.fn(),
  ttl: vi.fn(),
  hget: vi.fn(),
  hset: vi.fn(),
  hdel: vi.fn(),
  hgetall: vi.fn(),
  publish: vi.fn(),
  subscribe: vi.fn(),
  on: vi.fn(),
};

vi.mock("@/lib/redis", () => ({
  redis: redisMock,
}));

// Mock the WebSocket emitter globally using vi.mock
// This replaces the module completely preventing any network calls
vi.mock("@/lib/websocket/emitter", () => ({
  socketEmitter: {
    notifyUser: vi.fn(),
    notifyDepartment: vi.fn(),
    notifyAdmins: vi.fn(),
    updateNotificationCount: vi.fn(),
    newTicket: vi.fn(),
    updateTicket: vi.fn(),
    ticketReply: vi.fn(),
    ticketMessage: vi.fn(),
    updateTicketCount: vi.fn(),
    newWorkOrder: vi.fn(),
    updateWorkOrder: vi.fn(),
    workOrderAssigned: vi.fn(),
    workOrderActivity: vi.fn(),
    inventoryUpdate: vi.fn(),
    broadcast: vi.fn(),
    forceLogout: vi.fn(),
  },
}));
