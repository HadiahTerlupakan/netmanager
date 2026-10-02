import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prismaAuth: {} }));

import {
  canCashoutCanvasingBonus,
  hasCanvasingCashoutPermission,
} from "@/modules/marketing/services/CanvasingAccessService";
import { requireEligibleCashoutUser } from "@/modules/marketing/services/point-claim.service.helpers";
import type { IPointClaimRepository } from "@/modules/marketing/domain/ports/IPointClaimRepository";

const AKUMULASI = { canvasingTarget: 10, targetSchema: "ACCUMULATED" };

const findCashoutUser = vi.fn();
const repository = { findCashoutUser } as unknown as IPointClaimRepository;

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

describe("requireEligibleCashoutUser", () => {
  beforeEach(() => findCashoutUser.mockReset());

  it("menolak teknisi tanpa izin cashout", async () => {
    findCashoutUser.mockResolvedValue({ isSales: false, ...AKUMULASI });

    await expect(
      requireEligibleCashoutUser(repository, "u-1", { hasCashoutPermission: false }),
    ).rejects.toMatchObject({ kind: "forbidden" });
  });

  it("meloloskan teknisi yang role-nya diberi izin cashout", async () => {
    findCashoutUser.mockResolvedValue({ isSales: false, ...AKUMULASI });

    await expect(
      requireEligibleCashoutUser(repository, "u-1", { hasCashoutPermission: true }),
    ).resolves.toMatchObject({ canvasingTarget: 10 });
  });

  it("sales tetap lolos tanpa izin tambahan", async () => {
    findCashoutUser.mockResolvedValue({ isSales: true, ...AKUMULASI });

    await expect(
      requireEligibleCashoutUser(repository, "u-1", { hasCashoutPermission: false }),
    ).resolves.toBeTruthy();
  });
});
