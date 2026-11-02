import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  getGudangs: vi.fn(),
}));

vi.mock(
  "@/modules/work-order/services/mobile-unclaimed-work-order-guard",
  () => ({
    mobileUnclaimedWorkOrderGuard: mocks.guard,
  }),
);

import { EmployeeWorkOrderQueryService } from "@/modules/work-order/services/EmployeeWorkOrderQueryService";
import { enforceSiteRestriction } from "@/modules/work-order/services/work-order-create-scope";
import { ensureMobileMaterialGudangsAccessible } from "@/modules/work-order/services/work-order-material-gudang-scope";
import { ensureMobileWorkOrderAccess } from "@/modules/work-order/services/work-order-mobile-action.support";

const TENANT = "tenant-1";
const PENDING_WO_SITE_LAIN = {
  id: "wo-1",
  tenantId: TENANT,
  status: "PENDING",
  assignedToId: null as string | null,
  assignedMitraId: null as string | null,
  siteId: "site-b",
  departmentId: null as string | null,
  assignments: [] as never[],
};
const repository = { findById: async () => PENDING_WO_SITE_LAIN as never };
const actor = {
  id: "teknisi-a",
  name: "Teknisi",
  role: "Teknisi",
  siteId: "site-a",
  tenantId: TENANT,
  isSuperAdmin: false,
};

describe("jalur mobile memakai guard WO yang belum diambil", () => {
  beforeEach(() => mocks.guard.mockReset());

  it("detail WO PENDING site lain ditolak", async () => {
    mocks.guard.mockResolvedValue(false);
    const service = new EmployeeWorkOrderQueryService(repository as never);

    await expect(
      service.getMobileWorkOrderDetail("wo-1", actor),
    ).rejects.toThrow("Akses ditolak");
    expect(mocks.guard).toHaveBeenCalled();
  });

  it("aksi CLAIM atas WO PENDING site lain ditolak", async () => {
    mocks.guard.mockResolvedValue(false);

    await expect(
      ensureMobileWorkOrderAccess({
        repository: repository as never,
        workOrderId: "wo-1",
        actor,
        allowedStatuses: ["PENDING"],
        invalidStatusMessage: "Hanya WO berstatus PENDING yang dapat diklaim",
      }),
    ).rejects.toThrow("Akses ditolak");
  });

  it("aksi CLAIM diizinkan bila lolos aturan daftar WO tersedia", async () => {
    mocks.guard.mockResolvedValue(true);

    await expect(
      ensureMobileWorkOrderAccess({
        repository: repository as never,
        workOrderId: "wo-1",
        actor,
        allowedStatuses: ["PENDING"],
        invalidStatusMessage: "Hanya WO berstatus PENDING yang dapat diklaim",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("gudang material WO mobile mengikuti lingkup m_barang:site_only", () => {
  beforeEach(() => mocks.getGudangs.mockReset());

  it("menolak gudang di luar daftar gudang yang boleh dipakai aktor", async () => {
    mocks.getGudangs.mockResolvedValue([{ id: "gudang-a" }]);

    await expect(
      ensureMobileMaterialGudangsAccessible(
        { actorId: "t", tenantId: TENANT, gudangIds: ["gudang-b"] },
        mocks.getGudangs,
      ),
    ).rejects.toThrow("Akses ditolak");
  });

  it("menerima gudang dalam lingkup", async () => {
    mocks.getGudangs.mockResolvedValue([{ id: "gudang-a" }]);

    await expect(
      ensureMobileMaterialGudangsAccessible(
        { actorId: "t", tenantId: TENANT, gudangIds: ["gudang-a", "gudang-a"] },
        mocks.getGudangs,
      ),
    ).resolves.toBeUndefined();
  });

  it("meneruskan penolakan modul inventory (aktor terbatas tanpa site) sebagai Akses ditolak", async () => {
    const rejectingLister = async () => {
      throw new Error("Akun Anda belum diberi site");
    };

    const error = await ensureMobileMaterialGudangsAccessible(
      { actorId: "t", tenantId: TENANT, gudangIds: ["gudang-a"] },
      rejectingLister,
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      "Akses ditolak: Akun Anda belum diberi site",
    );
  });
});

describe("pembuatan WO oleh role site_only", () => {
  it("menolak pembuat terbatas yang belum punya site", () => {
    expect(() =>
      enforceSiteRestriction({
        normalizedInput: { title: "x" } as never,
        userContext: { id: "u", permissions: ["workorders:site_only"] },
        isSuperAdmin: false,
      }),
    ).toThrow("Akses ditolak");
  });

  it("mengunci site ke site pembuat", () => {
    const normalizedInput = { title: "x" } as { siteId?: string };
    enforceSiteRestriction({
      normalizedInput: normalizedInput as never,
      userContext: {
        id: "u",
        permissions: ["workorders:site_only"],
        siteId: "site-a",
      },
      isSuperAdmin: false,
    });

    expect(normalizedInput.siteId).toBe("site-a");
  });
});
