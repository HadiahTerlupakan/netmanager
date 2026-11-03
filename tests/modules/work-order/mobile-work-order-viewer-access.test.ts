import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  unclaimedGuard: vi.fn(),
  loadScopeContext: vi.fn(),
}));

vi.mock(
  "@/modules/work-order/services/mobile-unclaimed-work-order-guard",
  () => ({
    mobileUnclaimedWorkOrderGuard: mocks.unclaimedGuard,
  }),
);

import { EmployeeWorkOrderQueryService } from "@/modules/work-order/services/EmployeeWorkOrderQueryService";
import { MOBILE_WORK_ORDER_VIEWER_ACCESS } from "@/modules/work-order";
import { validateMobileAssignedWorkOrderAccess } from "@/modules/work-order/services/work-order-access";
import { createMobileObserverWorkOrderGuard } from "@/modules/work-order/services/mobile-work-order-observer-guard";
import {
  ensureMobileWorkOrderAccess,
  getAllowedActionStatuses,
} from "@/modules/work-order/services/work-order-mobile-action.support";

/**
 * Role "admin" (workorders:read, tanpa site_only) menerima push "Work Order
 * Baru" untuk semua site, tetapi detail WO site lain dulu dijawab "Anda tidak
 * punya akses". Pembaca seperti itu kini mendapat `viewerAccess: OBSERVER`
 * di jalur baca saja; seluruh jalur aksi tetap menolaknya.
 */

const TENANT = "tenant-1";
const SITE_JAKSEL = "site-jaksel";
const SITE_CARIU = "site-cariu";
const ADMIN_PERMISSIONS = ["workorders:read", "workorders:verify"];

function workOrderAt(overrides: Record<string, unknown> = {}) {
  return {
    id: "wo-1",
    tenantId: TENANT,
    status: "PENDING",
    assignedToId: null as string | null,
    assignedMitraId: null as string | null,
    siteId: SITE_CARIU,
    departmentId: "dept-noc" as string | null,
    assignments: [] as Array<{ userId: string; status: string }>,
    ...overrides,
  };
}

function viewer(overrides: Record<string, unknown> = {}) {
  return {
    id: "admin-1",
    name: "Admin Jaksel",
    role: "admin",
    siteId: SITE_JAKSEL,
    tenantId: TENANT,
    isSuperAdmin: false,
    permissions: ADMIN_PERMISSIONS,
    ...overrides,
  };
}

function scopeProfile(permissions: string[], overrides = {}) {
  return {
    id: "admin-1",
    role: "admin",
    permissions,
    siteId: SITE_JAKSEL,
    siteIds: [SITE_JAKSEL],
    departmentId: "dept-ops",
    ...overrides,
  };
}

function serviceFor(workOrder: Record<string, unknown>) {
  const repository = { findById: async () => workOrder as never };
  return new EmployeeWorkOrderQueryService(
    repository as never,
    mocks.loadScopeContext,
  );
}

beforeEach(() => {
  mocks.unclaimedGuard.mockReset().mockResolvedValue(false);
  mocks.loadScopeContext
    .mockReset()
    .mockImplementation(async (_user, permissions: string[]) =>
      scopeProfile(permissions),
    );
});

describe("detail mobile: viewerAccess OBSERVER", () => {
  it("admin workorders:read melihat WO PENDING site lain sebagai OBSERVER", async () => {
    const detail = await serviceFor(workOrderAt()).getMobileWorkOrderDetail(
      "wo-1",
      viewer(),
    );

    expect(detail.viewerAccess).toBe(MOBILE_WORK_ORDER_VIEWER_ACCESS.OBSERVER);
    expect(detail.id).toBe("wo-1");
    expect(mocks.loadScopeContext).toHaveBeenCalledWith(
      { id: "admin-1", role: "admin", name: "Admin Jaksel" },
      ADMIN_PERMISSIONS,
    );
  });

  it("admin workorders:read melihat WO IN_PROGRESS site lain sebagai OBSERVER", async () => {
    const detail = await serviceFor(
      workOrderAt({ status: "IN_PROGRESS", assignedToId: "teknisi-x" }),
    ).getMobileWorkOrderDetail("wo-1", viewer());

    expect(detail.viewerAccess).toBe(MOBILE_WORK_ORDER_VIEWER_ACCESS.OBSERVER);
  });

  it("alias lama list:read setara workorders:read", async () => {
    const detail = await serviceFor(
      workOrderAt({ status: "COMPLETED" }),
    ).getMobileWorkOrderDetail("wo-1", viewer({ permissions: ["list:read"] }));

    expect(detail.viewerAccess).toBe(MOBILE_WORK_ORDER_VIEWER_ACCESS.OBSERVER);
  });

  it('role "*" menjadi OBSERVER', async () => {
    const detail = await serviceFor(
      workOrderAt({ status: "IN_PROGRESS" }),
    ).getMobileWorkOrderDetail("wo-1", viewer({ permissions: ["*"] }));

    expect(detail.viewerAccess).toBe(MOBILE_WORK_ORDER_VIEWER_ACCESS.OBSERVER);
  });

  it("workorders:site_only melihat WO di salah satu site userSites-nya", async () => {
    const permissions = [...ADMIN_PERMISSIONS, "workorders:site_only"];
    mocks.loadScopeContext.mockResolvedValue(
      scopeProfile(permissions, { siteIds: [SITE_JAKSEL, SITE_CARIU] }),
    );

    const detail = await serviceFor(
      workOrderAt({ status: "IN_PROGRESS" }),
    ).getMobileWorkOrderDetail("wo-1", viewer({ permissions }));

    expect(detail.viewerAccess).toBe(MOBILE_WORK_ORDER_VIEWER_ACCESS.OBSERVER);
  });
});

describe("detail mobile: PARTICIPANT & CLAIMABLE tidak berubah", () => {
  it("teknisi pemegang mendapat PARTICIPANT tanpa memuat profil lingkup", async () => {
    const detail = await serviceFor(
      workOrderAt({ status: "IN_PROGRESS", assignedToId: "teknisi-a" }),
    ).getMobileWorkOrderDetail(
      "wo-1",
      viewer({ id: "teknisi-a", permissions: ["m_work_order:read"] }),
    );

    expect(detail.viewerAccess).toBe(
      MOBILE_WORK_ORDER_VIEWER_ACCESS.PARTICIPANT,
    );
    expect(mocks.loadScopeContext).not.toHaveBeenCalled();
  });

  it("partner dengan undangan PENDING mendapat PARTICIPANT", async () => {
    const detail = await serviceFor(
      workOrderAt({
        status: "IN_PROGRESS",
        assignedToId: "teknisi-x",
        assignments: [{ userId: "teknisi-a", status: "PENDING" }],
      }),
    ).getMobileWorkOrderDetail("wo-1", viewer({ id: "teknisi-a" }));

    expect(detail.viewerAccess).toBe(
      MOBILE_WORK_ORDER_VIEWER_ACCESS.PARTICIPANT,
    );
  });

  it("WO PENDING yang lolos aturan daftar WO tersedia mendapat CLAIMABLE", async () => {
    mocks.unclaimedGuard.mockResolvedValue(true);

    const detail = await serviceFor(workOrderAt()).getMobileWorkOrderDetail(
      "wo-1",
      viewer(),
    );

    expect(detail.viewerAccess).toBe(MOBILE_WORK_ORDER_VIEWER_ACCESS.CLAIMABLE);
    expect(mocks.loadScopeContext).not.toHaveBeenCalled();
  });

  it("super admin: PENDING → CLAIMABLE, IN_PROGRESS → OBSERVER", async () => {
    const superAdmin = viewer({
      isSuperAdmin: true,
      tenantId: "tenant-lain",
      permissions: ["*"],
    });

    const pending = await serviceFor(workOrderAt()).getMobileWorkOrderDetail(
      "wo-1",
      superAdmin,
    );
    const inProgress = await serviceFor(
      workOrderAt({ status: "IN_PROGRESS" }),
    ).getMobileWorkOrderDetail("wo-1", superAdmin);

    expect(pending.viewerAccess).toBe(
      MOBILE_WORK_ORDER_VIEWER_ACCESS.CLAIMABLE,
    );
    expect(inProgress.viewerAccess).toBe(
      MOBILE_WORK_ORDER_VIEWER_ACCESS.OBSERVER,
    );
    expect(mocks.loadScopeContext).not.toHaveBeenCalled();
  });
});

describe("detail mobile: tetap ditolak", () => {
  it("tanpa workorders:read → ditolak, profil lingkup tidak dimuat", async () => {
    const teknisi = viewer({ permissions: ["m_work_order:read"] });

    await expect(
      serviceFor(workOrderAt()).getMobileWorkOrderDetail("wo-1", teknisi),
    ).rejects.toThrow("Akses ditolak");
    await expect(
      serviceFor(
        workOrderAt({ status: "IN_PROGRESS" }),
      ).getMobileWorkOrderDetail("wo-1", teknisi),
    ).rejects.toThrow("tidak memiliki akses");
    expect(mocks.loadScopeContext).not.toHaveBeenCalled();
  });

  it("pemanggil tanpa permissions (perilaku lama) tetap ditolak", async () => {
    const { permissions: _omitted, ...withoutPermissions } = viewer();

    await expect(
      serviceFor(
        workOrderAt({ status: "IN_PROGRESS" }),
      ).getMobileWorkOrderDetail("wo-1", withoutPermissions),
    ).rejects.toThrow("tidak memiliki akses");
  });

  it("workorders:site_only untuk WO site lain → ditolak", async () => {
    const permissions = [...ADMIN_PERMISSIONS, "workorders:site_only"];

    await expect(
      serviceFor(
        workOrderAt({ status: "IN_PROGRESS" }),
      ).getMobileWorkOrderDetail("wo-1", viewer({ permissions })),
    ).rejects.toThrow("tidak memiliki akses");
    await expect(
      serviceFor(workOrderAt()).getMobileWorkOrderDetail(
        "wo-1",
        viewer({ permissions }),
      ),
    ).rejects.toThrow("Akses ditolak");
  });

  it("workorders:department_only untuk WO departemen lain → ditolak", async () => {
    const permissions = [...ADMIN_PERMISSIONS, "workorders:department_only"];

    await expect(
      serviceFor(
        workOrderAt({ status: "IN_PROGRESS" }),
      ).getMobileWorkOrderDetail("wo-1", viewer({ permissions })),
    ).rejects.toThrow("tidak memiliki akses");
  });

  it("profil pembaca tidak ditemukan → ditolak (fail closed)", async () => {
    mocks.loadScopeContext.mockResolvedValue(null);

    await expect(
      serviceFor(
        workOrderAt({ status: "IN_PROGRESS" }),
      ).getMobileWorkOrderDetail("wo-1", viewer()),
    ).rejects.toThrow("tidak memiliki akses");
  });

  it("tenant lain → ditolak sebelum guard pengamat", async () => {
    await expect(
      serviceFor(
        workOrderAt({ status: "IN_PROGRESS", tenantId: "tenant-lain" }),
      ).getMobileWorkOrderDetail("wo-1", viewer({ permissions: ["*"] })),
    ).rejects.toThrow("Tenant berbeda");
    expect(mocks.loadScopeContext).not.toHaveBeenCalled();
  });
});

describe("jalur aksi tetap menolak pengamat", () => {
  const observerActor = viewer();

  it("CLAIM atas WO PENDING site lain oleh pengamat ditolak", async () => {
    const { statuses, invalidStatusMessage } =
      getAllowedActionStatuses("CLAIM");

    await expect(
      ensureMobileWorkOrderAccess({
        repository: { findById: async () => workOrderAt() } as never,
        workOrderId: "wo-1",
        actor: observerActor,
        allowedStatuses: statuses,
        invalidStatusMessage,
      }),
    ).rejects.toThrow("Akses ditolak");
  });

  it("UPDATE atas WO IN_PROGRESS milik orang lain oleh pengamat ditolak", async () => {
    const { statuses, invalidStatusMessage } =
      getAllowedActionStatuses("START");

    await expect(
      ensureMobileWorkOrderAccess({
        repository: {
          findById: async () =>
            workOrderAt({ status: "IN_PROGRESS", assignedToId: "teknisi-x" }),
        } as never,
        workOrderId: "wo-1",
        actor: observerActor,
        allowedStatuses: statuses,
        invalidStatusMessage,
      }),
    ).rejects.toThrow("tidak memiliki akses");
  });

  it("validateMobileAssignedWorkOrderAccess mengabaikan guard pengamat yang diselipkan", async () => {
    const smuggled = {
      repository: {
        findById: async () => workOrderAt({ status: "IN_PROGRESS" }) as never,
      },
      workOrderId: "wo-1",
      userContext: {
        id: "admin-1",
        tenantId: TENANT,
        permissions: [] as string[],
      },
      allowedStatuses: ["IN_PROGRESS"],
      invalidStatusMessage: "status salah",
      observerAccessGuard: createMobileObserverWorkOrderGuard({
        permissions: ["*"],
        loadScopeContext: mocks.loadScopeContext,
      }),
    };

    await expect(
      validateMobileAssignedWorkOrderAccess(smuggled),
    ).rejects.toThrow("tidak memiliki akses");
  });
});
