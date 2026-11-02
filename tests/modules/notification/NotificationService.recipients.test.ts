import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EligibleUser } from "@/modules/notification/services/NotificationService.helpers";

const findManyWithDetailedRelations = vi.fn();
const findManyWithCustomWhere = vi.fn();
const assignmentFindMany = vi.fn();
const workOrderFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workOrderAssignments: {
      findMany: (...args: unknown[]) => assignmentFindMany(...args),
    },
    workOrders: {
      findUnique: (...args: unknown[]) => workOrderFindUnique(...args),
    },
  },
}));

const userLookupService = {
  findManyWithDetailedRelations,
  findManyWithCustomWhere,
} as unknown as import("@/modules/users").UserLookupService;

import {
  findEligibleRecipients,
  findWorkOrderStakeholders,
} from "@/modules/notification/services/NotificationService.recipients";

function user(partial: Partial<EligibleUser> & { id: string }): EligibleUser {
  return {
    id: partial.id,
    name: partial.name ?? partial.id,
    departmentId: partial.departmentId ?? null,
    siteId: partial.siteId ?? "site-cariu",
    userSites: partial.userSites ?? [{ siteId: "site-cariu" }],
    role: partial.role ?? {
      name: "Role",
      permission: [{ id: "p1", resource: "workorders", action: "read" }],
    },
  };
}

describe("findEligibleRecipients (POOL)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("excludes branch manager with m_work_order:department_only in other department", async () => {
    findManyWithDetailedRelations.mockResolvedValue([
      user({
        id: "dede",
        departmentId: "dept-ops",
        role: {
          name: "Branch Manager",
          permission: [
            { id: "1", resource: "workorders", action: "read" },
            { id: "2", resource: "m_work_order", action: "read" },
            { id: "3", resource: "m_work_order", action: "department_only" },
          ],
        },
      }),
      user({
        id: "luthpi",
        departmentId: "dept-tech",
        role: {
          name: "Teknisi",
          permission: [
            { id: "4", resource: "m_work_order", action: "read" },
            { id: "5", resource: "m_work_order", action: "department_only" },
          ],
        },
      }),
    ]);

    const recipients = await findEligibleRecipients({
      userLookupService,
      departmentId: "dept-tech",
      siteId: "site-cariu",
      excludeUserId: "creator-1",
    });

    expect(recipients.map((r) => r.id)).toEqual(["luthpi"]);
  });

  it("includes same-dept technician in POOL", async () => {
    findManyWithDetailedRelations.mockResolvedValue([
      user({
        id: "tech-1",
        departmentId: "dept-tech",
        role: {
          name: "Teknisi",
          permission: [
            { id: "1", resource: "m_work_order", action: "read" },
            { id: "2", resource: "m_work_order", action: "department_only" },
          ],
        },
      }),
    ]);

    const recipients = await findEligibleRecipients({
      userLookupService,
      departmentId: "dept-tech",
      siteId: "site-cariu",
      excludeUserId: "creator-1",
    });

    expect(recipients.map((r) => r.id)).toEqual(["tech-1"]);
  });

  it("includes verify user cross-dept", async () => {
    findManyWithDetailedRelations.mockResolvedValue([
      user({
        id: "verifier",
        departmentId: "dept-ops",
        role: {
          name: "Manager",
          permission: [
            { id: "1", resource: "workorders", action: "read" },
            { id: "2", resource: "workorders", action: "verify" },
            { id: "3", resource: "m_work_order", action: "department_only" },
          ],
        },
      }),
    ]);

    const recipients = await findEligibleRecipients({
      userLookupService,
      departmentId: "dept-tech",
      siteId: "site-cariu",
      excludeUserId: "creator-1",
    });

    expect(recipients.map((r) => r.id)).toEqual(["verifier"]);
  });
});

describe("findWorkOrderStakeholders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assignmentFindMany.mockResolvedValue([]);
    findManyWithCustomWhere.mockResolvedValue([]);
  });

  it("includes assignee and creator and excludes actor", async () => {
    const recipients = await findWorkOrderStakeholders({
      userLookupService,
      workOrderId: "wo-1",
      siteId: "site-cariu",
      assignedToId: "assignee-1",
      createdById: "creator-1",
      excludeUserId: "assignee-1",
    });
    expect(recipients.map((r) => r.id).sort()).toEqual(["creator-1"]);
  });

  it("includes users with workorders:verify in site", async () => {
    findManyWithCustomWhere.mockResolvedValue([{ id: "verifier-1" }]);
    const recipients = await findWorkOrderStakeholders({
      userLookupService,
      workOrderId: "wo-1",
      siteId: "site-cariu",
      excludeUserId: "actor-1",
    });
    expect(recipients.map((r) => r.id)).toContain("verifier-1");
  });

  it("does not include broad-read technician who is not stakeholder", async () => {
    findManyWithCustomWhere.mockResolvedValue([]);
    const recipients = await findWorkOrderStakeholders({
      userLookupService,
      workOrderId: "wo-1",
      siteId: "site-cariu",
      excludeUserId: "actor-1",
    });
    expect(recipients.map((r) => r.id)).not.toContain("random-tech");
    expect(recipients).toEqual([]);
  });
});

// Peran tanpa "Batasi ke Site Sendiri" melihat WO semua site, jadi
// verifikatornya juga dikabari WO dari semua site di tenant-nya. Dulu hanya
// WO site profilnya sendiri (kasus Rohadi: admin di JAKSEL).
describe("cakupan site penerima mengikuti toggle Batasi ke Site Sendiri", () => {
  const WO_SITE = "site-cariu";
  const HOME_SITE = "site-jaksel";

  function verifier(
    id: string,
    extra: Array<{ resource: string; action: string }> = [],
    partial: Partial<EligibleUser> = {},
  ): EligibleUser {
    return user({
      id,
      siteId: HOME_SITE,
      userSites: [],
      ...partial,
      role: {
        name: "admin",
        permission: [
          { id: `${id}-r`, resource: "workorders", action: "read" },
          { id: `${id}-v`, resource: "workorders", action: "verify" },
          ...extra.map((permission, index) => ({
            id: `${id}-${index}`,
            ...permission,
          })),
        ],
      },
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    workOrderFindUnique.mockResolvedValue({ tenantId: "tenant-1" });
    assignmentFindMany.mockResolvedValue([]);
    findManyWithCustomWhere.mockResolvedValue([]);
  });

  it("WO baru: verifikator tanpa site_only di site lain ikut menerima", async () => {
    findManyWithDetailedRelations.mockResolvedValue([verifier("rohadi")]);

    const recipients = await findEligibleRecipients({
      userLookupService,
      workOrderId: "wo-1",
      siteId: WO_SITE,
      departmentId: "dept-tech",
      excludeUserId: "creator-1",
    });

    expect(recipients.map((r) => r.id)).toEqual(["rohadi"]);
    const where = findManyWithDetailedRelations.mock.calls[0][0];
    expect(where.tenantId).toBe("tenant-1");
    expect(where.OR).toHaveLength(4);
  });

  it("WO baru: verifikator dengan site_only di site lain tidak menerima", async () => {
    findManyWithDetailedRelations.mockResolvedValue([
      verifier("terbatas", [{ resource: "workorders", action: "site_only" }]),
    ]);

    const recipients = await findEligibleRecipients({
      userLookupService,
      workOrderId: "wo-1",
      siteId: WO_SITE,
      excludeUserId: "creator-1",
    });

    expect(recipients).toEqual([]);
  });

  it("WO baru: department_only hanya melebar untuk departemennya sendiri", async () => {
    const deptOnly = [{ resource: "workorders", action: "department_only" }];
    findManyWithDetailedRelations.mockResolvedValue([
      verifier("dept-sama", deptOnly, { departmentId: "dept-tech" }),
      verifier("dept-lain", deptOnly, { departmentId: "dept-ops" }),
    ]);

    const recipients = await findEligibleRecipients({
      userLookupService,
      workOrderId: "wo-1",
      siteId: WO_SITE,
      departmentId: "dept-tech",
      excludeUserId: "creator-1",
    });

    expect(recipients.map((r) => r.id)).toEqual(["dept-sama"]);
  });

  it("WO baru: teknisi aplikasi di site lain tetap tidak menerima", async () => {
    findManyWithDetailedRelations.mockResolvedValue([
      user({
        id: "teknisi",
        siteId: HOME_SITE,
        userSites: [],
        role: {
          name: "Teknisi",
          permission: [{ id: "t1", resource: "m_work_order", action: "read" }],
        },
      }),
    ]);

    const recipients = await findEligibleRecipients({
      userLookupService,
      workOrderId: "wo-1",
      siteId: WO_SITE,
      excludeUserId: "creator-1",
    });

    expect(recipients).toEqual([]);
  });

  it("WO baru: tanpa tenant WO yang diketahui tidak melebar ke site lain", async () => {
    workOrderFindUnique.mockResolvedValue(null);
    findManyWithDetailedRelations.mockResolvedValue([verifier("rohadi")]);

    const recipients = await findEligibleRecipients({
      userLookupService,
      workOrderId: "wo-1",
      siteId: WO_SITE,
      excludeUserId: "creator-1",
    });

    expect(recipients).toEqual([]);
    const where = findManyWithDetailedRelations.mock.calls[0][0];
    expect(where.tenantId).toBeUndefined();
    expect(where.OR).toHaveLength(3);
  });

  it("status/update: query verifikator memuat tenant dan cabang tanpa site_only", async () => {
    await findWorkOrderStakeholders({
      userLookupService,
      workOrderId: "wo-1",
      siteId: WO_SITE,
      departmentId: "dept-tech",
    });

    const where = findManyWithCustomWhere.mock.calls[0][0];
    const scope = where.AND[1];
    expect(scope.tenantId).toBe("tenant-1");
    expect(scope.OR).toHaveLength(4);
    expect(JSON.stringify(scope.OR[3])).toContain('"action":"site_only"');
    expect(JSON.stringify(scope.OR[3])).toContain('"departmentId":"dept-tech"');
  });

  it("status/update: hanya verifikator workorders yang dilebarkan", async () => {
    await findWorkOrderStakeholders({
      userLookupService,
      workOrderId: "wo-1",
      siteId: WO_SITE,
    });

    const widened = findManyWithCustomWhere.mock.calls[0][0].AND[1].OR[3];
    expect(widened.AND[0]).toEqual({
      role: {
        permission: {
          some: {
            resource: "workorders",
            action: { in: ["verify", "approve_request"] },
          },
        },
      },
    });
  });

  it("tenant pagar diambil dari WO, bukan dari sesi pengubahnya", async () => {
    workOrderFindUnique.mockResolvedValue({ tenantId: "tenant-wo" });
    findManyWithDetailedRelations.mockResolvedValue([verifier("rohadi")]);

    const recipients = await findEligibleRecipients({
      userLookupService,
      workOrderId: "wo-1",
      siteId: WO_SITE,
      excludeUserId: "superadmin-1",
    });

    expect(recipients.map((r) => r.id)).toEqual(["rohadi"]);
    expect(workOrderFindUnique).toHaveBeenCalledWith({
      where: { id: "wo-1" },
      select: { tenantId: true },
    });
    expect(findManyWithDetailedRelations.mock.calls[0][0].tenantId).toBe(
      "tenant-wo",
    );
  });

  it("status/update: tenant dari data notifikasi dipakai tanpa query WO", async () => {
    await findWorkOrderStakeholders({
      userLookupService,
      workOrderId: "wo-1",
      siteId: WO_SITE,
      tenantId: "tenant-2",
    });

    expect(findManyWithCustomWhere.mock.calls[0][0].AND[1].tenantId).toBe(
      "tenant-2",
    );
    expect(workOrderFindUnique).not.toHaveBeenCalled();
  });

  it("status/update: WO tak ditemukan hanya memakai syarat site lama", async () => {
    workOrderFindUnique.mockResolvedValue(null);

    await findWorkOrderStakeholders({
      userLookupService,
      workOrderId: "wo-1",
      siteId: WO_SITE,
    });

    expect(findManyWithCustomWhere.mock.calls[0][0].AND[1]).toEqual({
      OR: [
        { siteId: WO_SITE },
        { siteId: null },
        { userSites: { some: { siteId: WO_SITE } } },
      ],
    });
  });
});
