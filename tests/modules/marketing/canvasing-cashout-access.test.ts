import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.hoisted(() => vi.fn());

vi.mock("@/modules/database", () => ({
  prisma: { user: { findUnique } },
}));
vi.mock("@/lib/prisma", () => ({ prismaAuth: {} }));

import {
  canCashoutCanvasingBonus,
  hasCanvasingCashoutPermission,
} from "@/modules/marketing/services/CanvasingAccessService";
import { hasCashoutPermission } from "@/modules/marketing/services/marketing-point-claim-route.helpers";
import { requireEligibleCashoutUser } from "@/modules/marketing/services/point-claim.service.helpers";

const AKUMULASI = { canvasingTarget: 10, targetSchema: "ACCUMULATED" };

function policy(permissions: string[], isSuperAdmin = false) {
  return { session: { id: "u-1" }, permissions, isSuperAdmin };
}

describe("canCashoutCanvasingBonus", () => {
  it("sales selalu boleh; non-sales hanya dengan izin cashout", () => {
    expect(canCashoutCanvasingBonus({ isSales: true, hasCashoutPermission: false })).toBe(true);
    expect(canCashoutCanvasingBonus({ isSales: false, hasCashoutPermission: true })).toBe(true);
    expect(canCashoutCanvasingBonus({ isSales: false, hasCashoutPermission: false })).toBe(false);
  });
});

describe("hasCanvasingCashoutPermission", () => {
  it("hanya m_canvasing:cashout yang dihitung, bukan izin canvasing biasa", () => {
    expect(
      hasCanvasingCashoutPermission([
        { resource: "m_canvasing", action: "read" },
        { resource: "m_canvasing", action: "create" },
      ]),
    ).toBe(false);
    expect(
      hasCanvasingCashoutPermission([{ resource: "m_canvasing", action: "cashout" }]),
    ).toBe(true);
  });
});

describe("hasCashoutPermission (route policy)", () => {
  it("teknisi dengan m_canvasing:create saja tidak dapat izin cashout", () => {
    expect(hasCashoutPermission(policy(["m_canvasing:read", "m_canvasing:create"]))).toBe(false);
  });

  it("izin m_canvasing:cashout atau super admin memberi izin", () => {
    expect(hasCashoutPermission(policy(["m_canvasing:cashout"]))).toBe(true);
    expect(hasCashoutPermission(policy([], true))).toBe(true);
  });
});

describe("requireEligibleCashoutUser", () => {
  beforeEach(() => findUnique.mockReset());

  it("menolak teknisi tanpa izin cashout", async () => {
    findUnique.mockResolvedValue({ isSales: false, ...AKUMULASI });

    await expect(
      requireEligibleCashoutUser("u-1", { hasCashoutPermission: false }),
    ).rejects.toMatchObject({ kind: "forbidden" });
  });

  it("meloloskan teknisi yang role-nya diberi izin cashout", async () => {
    findUnique.mockResolvedValue({ isSales: false, ...AKUMULASI });

    await expect(
      requireEligibleCashoutUser("u-1", { hasCashoutPermission: true }),
    ).resolves.toMatchObject({ canvasingTarget: 10 });
  });

  it("sales tetap lolos tanpa izin tambahan", async () => {
    findUnique.mockResolvedValue({ isSales: true, ...AKUMULASI });

    await expect(
      requireEligibleCashoutUser("u-1", { hasCashoutPermission: false }),
    ).resolves.toBeTruthy();
  });
});
