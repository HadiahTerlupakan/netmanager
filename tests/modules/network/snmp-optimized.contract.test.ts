import {
  beforeAll,
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mockCleanup = vi.hoisted(() => vi.fn());
const mockCacheClear = vi.hoisted(() => vi.fn());
const mockCacheGet = vi.hoisted(() => vi.fn().mockReturnValue(null));
const mockCacheSet = vi.hoisted(() => vi.fn());
const mockSnmpGetBulkSimple = vi.hoisted(() => vi.fn());

vi.mock("@/modules/network/services/snmpService", () => ({
  snmpGetBulkSimple: mockSnmpGetBulkSimple,
}));

vi.mock("@/lib/utils/lru-cache", () => {
  class MockLRUCache {
    get = mockCacheGet;
    set = mockCacheSet;
    clear = mockCacheClear;
    cleanup = mockCleanup;

    constructor() {}
  }

  return { LRUCache: MockLRUCache };
});

vi.mock("@/modules/network/services/snmp-optimized.helpers", () => ({
  buildOnuItem: vi.fn().mockImplementation(({ index, oltId }) => ({
    oltId,
    name: `ONU-${index}`,
    description: null,
    pppoe: null,
    gponOnu: `idx-${index}`,
    status: "Unknown",
    rxOlt: "N/A",
    rxOnu: "N/A",
    serialNumber: null,
    actualType: null,
  })),
  resolveOnuDataTimeout: vi.fn().mockReturnValue(60_000),
}));

vi.mock("net-snmp", () => ({
  default: {
    createSession: vi.fn(),
    isVarbindError: vi.fn().mockReturnValue(false),
    ObjectType: { EndOfMibView: "EndOfMibView" },
  },
}));

vi.useFakeTimers();
const processOnSpy = vi.spyOn(process, "on").mockImplementation(() => process);

let snmpModule: typeof import("@/modules/network/services/snmp-optimized");

beforeAll(async () => {
  snmpModule = await import("@/modules/network/services/snmp-optimized");
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
});

afterAll(() => {
  processOnSpy.mockRestore();
  vi.useRealTimers();
});

describe("snmp-optimized contract", () => {
  it("keeps the public exports", () => {
    expect(typeof snmpModule.snmpWalkOptimized).toBe("function");
    expect(typeof snmpModule.fetchOnuDataPaginated).toBe("function");
    expect(typeof snmpModule.clearSNMPCache).toBe("function");
    expect(typeof snmpModule.cleanupSNMPConnections).toBe("function");
  });

  it("returns paginated shape without external network dependency", async () => {
    mockSnmpGetBulkSimple.mockResolvedValueOnce({});
    mockSnmpGetBulkSimple.mockResolvedValueOnce({});

    const result = await snmpModule.fetchOnuDataPaginated(
      "127.0.0.1",
      161,
      "public",
      "2c",
      "olt-1",
      1,
      50,
    );

    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("pagination");
    expect(result.pagination).toHaveProperty("page");
    expect(result.pagination).toHaveProperty("pageSize");
    expect(result.pagination).toHaveProperty("total");
    expect(result.pagination).toHaveProperty("totalPages");
  });

  it("allows cache cleanup facade call", () => {
    snmpModule.clearSNMPCache();
    snmpModule.cleanupSNMPConnections();

    expect(mockCacheClear).toHaveBeenCalled();
    expect(() => snmpModule.cleanupSNMPConnections()).not.toThrow();
  });
});
