import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EligibleUser } from "@/modules/notification/services/NotificationService.helpers";

const findManyWithDetailedRelations = vi.fn();
const findManyWithCustomWhere = vi.fn();
const assignmentFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workOrderAssignments: {
      findMany: (...args: unknown[]) => assignmentFindMany(...args),
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
