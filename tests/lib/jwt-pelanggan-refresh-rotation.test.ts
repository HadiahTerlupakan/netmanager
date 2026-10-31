import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { redisMock } from "../setup";
import {
  PELANGGAN_SESI,
  useStatefulPelangganStores,
} from "../helpers/pelanggan-session-stores";
import { refreshCustomerToken } from "@/lib/customer-auth";
import {
  generatePelangganTokenPair,
  verifyPelangganRefreshToken,
} from "@/lib/jwt";
import { MobileCustomerAuthService } from "@/modules/users/services/MobileCustomerAuthService";

/**
 * Refresh token yang sudah diputar dulu tetap sah sampai 7 hari, sehingga
 * token curian bisa dipakai ulang. Setiap putaran kini hanya menerima token
 * terbaru sesi itu; token lama yang muncul lagi setelah masa tenggang dianggap
 * curian dan mengakhiri sesinya.
 */

const MASA_TENGGANG_MS = 30_000;

const mobileAuth = new MobileCustomerAuthService({
  buildUnsupportedVersionResponse: async (): Promise<null> => null,
} as never);

async function refreshMobile(refreshToken: string) {
  const result = await mobileAuth.tryRefreshToken(refreshToken);
  return result?.kind === "success" ? result.refreshToken : null;
}

async function refreshWeb(refreshToken: string) {
  const result = await refreshCustomerToken(
    new NextRequest("https://pelanggan.radpro.id/tagihan", {
      headers: { cookie: `customer-refresh-token=${refreshToken}` },
    }),
  );
  return result?.kind === "refreshed" ? result.refreshToken : null;
}

function signLegacyRefreshToken(claims: { sid?: string }) {
  return jwt.sign(
    { id: PELANGGAN_SESI.id, tokenVersion: 3, type: "refresh", ...claims },
    process.env.NEXTAUTH_SECRET!,
    { expiresIn: "7d", issuer: "netmanager", audience: "pelanggan-portal" },
  );
}

function advanceClock(ms: number) {
  vi.setSystemTime(Date.now() + ms);
}

describe("rotasi refresh token pelanggan", () => {
  beforeEach(() => {
    useStatefulPelangganStores();
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects a rotated-away token after the grace window and ends its session", async () => {
    const login = await generatePelangganTokenPair(PELANGGAN_SESI);
    const rotated = await refreshMobile(login.refreshToken);
    expect(rotated).not.toBeNull();

    advanceClock(MASA_TENGGANG_MS + 1_000);

    expect(await refreshMobile(login.refreshToken)).toBeNull();
    expect(await refreshMobile(rotated!)).toBeNull();
  });

  it("keeps the customer's other devices signed in when one session is replayed", async () => {
    const web = await generatePelangganTokenPair(PELANGGAN_SESI);
    const mobile = await generatePelangganTokenPair(PELANGGAN_SESI);
    await refreshMobile(mobile.refreshToken);

    advanceClock(MASA_TENGGANG_MS + 1_000);
    await refreshMobile(mobile.refreshToken);

    expect(await refreshWeb(web.refreshToken)).not.toBeNull();
  });

  it.each([0, 1])(
    "accepts two near-simultaneous web refreshes with one token and keeps the token from refresh %i usable",
    async (kept) => {
      const login = await generatePelangganTokenPair(PELANGGAN_SESI);

      const results = await Promise.all([
        refreshWeb(login.refreshToken),
        refreshWeb(login.refreshToken),
      ]);
      expect(results).not.toContain(null);

      advanceClock(MASA_TENGGANG_MS + 1_000);

      expect(await refreshWeb(results[kept]!)).not.toBeNull();
    },
  );

  it("accepts a retried mobile refresh inside the grace window", async () => {
    const login = await generatePelangganTokenPair(PELANGGAN_SESI);
    expect(await refreshMobile(login.refreshToken)).not.toBeNull();

    advanceClock(5_000);
    const retried = await refreshMobile(login.refreshToken);
    expect(retried).not.toBeNull();

    advanceClock(MASA_TENGGANG_MS + 1_000);
    expect(await refreshMobile(retried!)).not.toBeNull();
  });

  it("does not stretch the grace window when the old token keeps coming back", async () => {
    const login = await generatePelangganTokenPair(PELANGGAN_SESI);
    await refreshMobile(login.refreshToken);

    advanceClock(MASA_TENGGANG_MS - 10_000);
    expect(await refreshMobile(login.refreshToken)).not.toBeNull();

    advanceClock(MASA_TENGGANG_MS - 10_000);
    expect(await refreshMobile(login.refreshToken)).toBeNull();
  });

  it.each([
    ["with a session id", { sid: "sesi-lama" }],
    ["without a session id", {}],
  ])(
    "migrates a token issued before rotation %s and then accepts only its successor",
    async (_label, claims) => {
      const legacy = signLegacyRefreshToken(claims);

      const migrated = await refreshMobile(legacy);
      expect(migrated).not.toBeNull();
      const verified = await verifyPelangganRefreshToken(migrated!);
      expect(verified.valid && verified.sessionId).toBeTruthy();
      if ("sid" in claims) {
        expect(verified).toMatchObject({ sessionId: claims.sid });
      }

      advanceClock(MASA_TENGGANG_MS + 1_000);

      expect(await refreshMobile(migrated!)).not.toBeNull();
      expect(await refreshMobile(legacy)).toBeNull();
    },
  );

  it("still refreshes a rotated-away token when the rotation store cannot be read", async () => {
    const login = await generatePelangganTokenPair(PELANGGAN_SESI);
    const rotated = await refreshMobile(login.refreshToken);
    advanceClock(MASA_TENGGANG_MS + 1_000);
    redisMock.get.mockRejectedValueOnce(new Error("Redis down"));

    expect(await refreshMobile(login.refreshToken)).not.toBeNull();
    expect(await refreshMobile(rotated!)).not.toBeNull();
  });

  it("keeps the new token usable when storing it as current fails", async () => {
    const login = await generatePelangganTokenPair(PELANGGAN_SESI);
    redisMock.setex.mockRejectedValueOnce(new Error("Redis down"));

    const rotated = await refreshMobile(login.refreshToken);
    expect(rotated).not.toBeNull();

    advanceClock(MASA_TENGGANG_MS + 1_000);
    expect(await refreshMobile(rotated!)).not.toBeNull();
  });
});
