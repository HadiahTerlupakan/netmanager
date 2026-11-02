import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getWorkOrderById: vi.fn(),
  addMaterial: vi.fn(),
  deleteWorkOrder: vi.fn(),
  sendWorkOrderReminder: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logActivitySafe: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/modules/work-order/services/WorkOrderNotifications", () => ({
  sendWorkOrderReminder: mocks.sendWorkOrderReminder,
}));
vi.mock("@/modules/work-order/services/WorkOrderService", () => ({
  getWorkOrderService: () => ({
    getWorkOrderById: mocks.getWorkOrderById,
    addMaterial: mocks.addMaterial,
    deleteWorkOrder: mocks.deleteWorkOrder,
  }),
}));
vi.mock("@/modules/work-order/services/WorkOrderCacheService", () => ({
  workOrderCacheService: { invalidateAllCaches: vi.fn() },
}));

import { AdminWorkOrderActionRouteService } from "@/modules/work-order/services/AdminWorkOrderActionRouteService";

const ACTOR = { id: "admin-a" };
const PERMISSIONS = ["workorders:site_only"];
const SITE_WO = "site-b";

const FORBIDDEN_RESULT = {
  success: false,
  code: "FORBIDDEN",
  error: "Akses ditolak: Site berbeda",
};

function createService() {
  const repository = {
    findMaterialDetail: vi.fn().mockResolvedValue({ code: "OK", data: {} }),
    findReminderWorkOrderById: vi.fn().mockResolvedValue({
      id: "wo-1",
      status: "IN_PROGRESS",
      departmentId: null,
      siteId: SITE_WO,
    }),
    resetCanvasingByWorkOrderId: vi.fn(),
    isGudangAvailableForSite: vi.fn(),
    findFirstGudangBySite: vi.fn(),
  };
  const getUserContext = vi.fn().mockResolvedValue({
    id: ACTOR.id,
    permissions: PERMISSIONS,
    siteId: "site-a",
  });
  const service = new AdminWorkOrderActionRouteService(
    repository as never,
    getUserContext,
  );
  return { service, repository };
}

function allowWorkOrder(siteId: string | null = SITE_WO) {
  mocks.getWorkOrderById.mockResolvedValue({
    success: true,
    data: { id: "wo-1", siteId },
  });
}

describe("aksi admin work order menegakkan lingkup site sebelum efek samping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.addMaterial.mockResolvedValue({ success: true, data: {} });
  });

  it("detail material ditolak untuk WO site lain dan tidak membaca timeline", async () => {
    mocks.getWorkOrderById.mockResolvedValue(FORBIDDEN_RESULT);
    const { service, repository } = createService();

    const result = await service.getMaterialDetail({
      workOrderId: "wo-1",
      updateId: "upd-1",
      actor: ACTOR,
      permissions: PERMISSIONS,
    });

    expect(result).toMatchObject({ success: false, code: "FORBIDDEN" });
    expect(repository.findMaterialDetail).not.toHaveBeenCalled();
  });

  it("detail material dibaca bila WO dalam lingkup", async () => {
    allowWorkOrder();
    const { service, repository } = createService();

    const result = await service.getMaterialDetail({
      workOrderId: "wo-1",
      updateId: "upd-1",
      actor: ACTOR,
      permissions: PERMISSIONS,
    });

    expect(result).toEqual({ success: true, data: {} });
    expect(repository.findMaterialDetail).toHaveBeenCalledWith("wo-1", "upd-1");
  });

  it("reminder ditolak untuk WO site lain tanpa mengirim notifikasi", async () => {
    mocks.getWorkOrderById.mockResolvedValue(FORBIDDEN_RESULT);
    const { service } = createService();

    const result = await service.sendReminder({
      workOrderId: "wo-1",
      actor: ACTOR,
      permissions: PERMISSIONS,
    });

    expect(result).toMatchObject({ success: false, code: "FORBIDDEN" });
    expect(mocks.sendWorkOrderReminder).not.toHaveBeenCalled();
  });

  it("hapus permanen memvalidasi akses sebelum mereset canvasing", async () => {
    mocks.getWorkOrderById.mockResolvedValue(FORBIDDEN_RESULT);
    const { service, repository } = createService();

    const result = await service.deleteWorkOrder({
      workOrderId: "wo-1",
      permanent: true,
      actor: ACTOR,
      permissions: PERMISSIONS,
    });

    expect(result).toMatchObject({ success: false, code: "FORBIDDEN" });
    expect(repository.resetCanvasingByWorkOrderId).not.toHaveBeenCalled();
    expect(mocks.deleteWorkOrder).not.toHaveBeenCalled();
  });
});

describe("gudang asal material admin mengikuti site work order", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.addMaterial.mockResolvedValue({ success: true, data: {} });
  });

  function addMaterial(
    service: AdminWorkOrderActionRouteService,
    gudangId?: string,
  ) {
    return service.addMaterial({
      workOrderId: "wo-1",
      barangId: "barang-1",
      quantity: 1,
      gudangId,
      actor: ACTOR,
      permissions: PERMISSIONS,
    });
  }

  it("menolak gudang pilihan klien yang tidak tertaut ke site WO", async () => {
    allowWorkOrder();
    const { service, repository } = createService();
    repository.isGudangAvailableForSite.mockResolvedValue(false);

    const result = await addMaterial(service, "gudang-site-lain");

    expect(repository.isGudangAvailableForSite).toHaveBeenCalledWith(
      "gudang-site-lain",
      SITE_WO,
    );
    expect(result).toMatchObject({
      success: false,
      code: "ADD_MATERIAL_ERROR",
    });
    expect(mocks.addMaterial).not.toHaveBeenCalled();
  });

  it("memakai gudang site WO bila klien tidak memilih gudang", async () => {
    allowWorkOrder();
    const { service, repository } = createService();
    repository.findFirstGudangBySite.mockResolvedValue("gudang-site-b");

    await addMaterial(service);

    expect(repository.findFirstGudangBySite).toHaveBeenCalledWith(SITE_WO);
    expect(mocks.addMaterial).toHaveBeenCalledWith(
      "wo-1",
      "barang-1",
      1,
      expect.objectContaining({ id: ACTOR.id }),
      undefined,
      "gudang-site-b",
    );
  });

  it("menolak dengan pesan jelas bila site WO belum punya gudang", async () => {
    allowWorkOrder();
    const { service, repository } = createService();
    repository.findFirstGudangBySite.mockResolvedValue(null);

    const result = await addMaterial(service);

    expect(result).toMatchObject({
      success: false,
      error: expect.stringContaining("belum punya gudang"),
    });
    expect(mocks.addMaterial).not.toHaveBeenCalled();
  });

  it("menolak WO tanpa site bila gudang tidak dipilih, bukan memilih stok terbanyak", async () => {
    allowWorkOrder(null);
    const { service } = createService();

    const result = await addMaterial(service);

    expect(result).toMatchObject({
      success: false,
      error: expect.stringContaining("belum punya site"),
    });
    expect(mocks.addMaterial).not.toHaveBeenCalled();
  });

  it("tidak menyentuh gudang sama sekali bila WO di luar lingkup", async () => {
    mocks.getWorkOrderById.mockResolvedValue(FORBIDDEN_RESULT);
    const { service, repository } = createService();

    const result = await addMaterial(service, "gudang-1");

    expect(result).toMatchObject({ success: false, code: "FORBIDDEN" });
    expect(repository.isGudangAvailableForSite).not.toHaveBeenCalled();
  });
});
