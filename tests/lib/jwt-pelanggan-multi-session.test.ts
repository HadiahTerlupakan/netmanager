import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it } from "vitest";

import { redisMock } from "../setup";
import {
  PELANGGAN_SESI,
  useStatefulPelangganStores,
  type PelangganSessionStores,
} from "../helpers/pelanggan-session-stores";
import {
  generatePelangganRefreshToken,
  generatePelangganTokenPair,
  invalidatePelangganRefreshTokens,
  revokePelangganSession,
  verifyPelangganRefreshToken,
} from "@/lib/jwt";

let stores: PelangganSessionStores;

async function isRefreshValid(refreshToken: string) {
  return (await verifyPelangganRefreshToken(refreshToken)).valid;
}

describe("sesi pelanggan di beberapa perangkat", () => {
  beforeEach(() => {
    stores = useStatefulPelangganStores();
  });

  it("keeps the first device signed in after a login on a second device", async () => {
    const web = await generatePelangganTokenPair(PELANGGAN_SESI);
    const mobile = await generatePelangganTokenPair(PELANGGAN_SESI);

    expect(await isRefreshValid(web.refreshToken)).toBe(true);
    expect(await isRefreshValid(mobile.refreshToken)).toBe(true);
  });

  it("keeps the web session when the mobile app rotates its refresh token", async () => {
    const web = await generatePelangganTokenPair(PELANGGAN_SESI);
    const mobile = await generatePelangganTokenPair(PELANGGAN_SESI);
    const mobileSession = await verifyPelangganRefreshToken(
      mobile.refreshToken,
    );

    const rotated = await generatePelangganRefreshToken(
      PELANGGAN_SESI.id,
      undefined,
      mobileSession.sessionId,
    );

    expect(await isRefreshValid(web.refreshToken)).toBe(true);
    expect(await verifyPelangganRefreshToken(rotated)).toMatchObject({
      valid: true,
      sessionId: mobileSession.sessionId,
    });
  });

  it("signs out every device when the password changes", async () => {
    const web = await generatePelangganTokenPair(PELANGGAN_SESI);
    const mobile = await generatePelangganTokenPair(PELANGGAN_SESI);

    await invalidatePelangganRefreshTokens(PELANGGAN_SESI.id);

    expect(await isRefreshValid(web.refreshToken)).toBe(false);
    expect(await isRefreshValid(mobile.refreshToken)).toBe(false);
  });

  it("refuses to refresh a dismantled customer", async () => {
    const web = await generatePelangganTokenPair(PELANGGAN_SESI);

    stores.status = "DISMANTLE";

    expect(await isRefreshValid(web.refreshToken)).toBe(false);
  });
});

describe("logout pelanggan per perangkat", () => {
  beforeEach(() => {
    stores = useStatefulPelangganStores();
  });

  it("ends only the device that logged out", async () => {
    const web = await generatePelangganTokenPair(PELANGGAN_SESI);
    const mobile = await generatePelangganTokenPair(PELANGGAN_SESI);

    expect(await revokePelangganSession(web.refreshToken)).toBe(true);

    expect(await isRefreshValid(web.refreshToken)).toBe(false);
    expect(await isRefreshValid(mobile.refreshToken)).toBe(true);
  });

  it("ends the session named by an access token, which is all the mobile app sends", async () => {
    const web = await generatePelangganTokenPair(PELANGGAN_SESI);
    const mobile = await generatePelangganTokenPair(PELANGGAN_SESI);

    expect(await revokePelangganSession(mobile.accessToken)).toBe(true);

    expect(await isRefreshValid(mobile.refreshToken)).toBe(false);
    expect(await isRefreshValid(web.refreshToken)).toBe(true);
  });

  it("ends the session even when its access token has expired", async () => {
    const mobile = await generatePelangganTokenPair(PELANGGAN_SESI);
    const { sessionId } = await verifyPelangganRefreshToken(
      mobile.refreshToken,
    );
    const expiredAccess = jwt.sign(
      { id: PELANGGAN_SESI.id, sid: sessionId },
      process.env.NEXTAUTH_SECRET!,
      { expiresIn: -60, issuer: "netmanager", audience: "pelanggan-portal" },
    );

    expect(await revokePelangganSession(expiredAccess)).toBe(true);

    expect(await isRefreshValid(mobile.refreshToken)).toBe(false);
  });

  it("signs out every device when the ended session cannot be recorded", async () => {
    const web = await generatePelangganTokenPair(PELANGGAN_SESI);
    const mobile = await generatePelangganTokenPair(PELANGGAN_SESI);
    redisMock.setex.mockRejectedValueOnce(new Error("Redis down"));

    await revokePelangganSession(web.refreshToken);

    expect(await isRefreshValid(web.refreshToken)).toBe(false);
    expect(await isRefreshValid(mobile.refreshToken)).toBe(false);
  });

  it("signs out every device for a token issued before sessions had an id", async () => {
    const legacy = jwt.sign(
      {
        id: PELANGGAN_SESI.id,
        tokenVersion: stores.tokenVersion,
        type: "refresh",
      },
      process.env.NEXTAUTH_SECRET!,
      { expiresIn: "7d", issuer: "netmanager", audience: "pelanggan-portal" },
    );
    const mobile = await generatePelangganTokenPair(PELANGGAN_SESI);

    expect(await revokePelangganSession(legacy)).toBe(true);

    expect(await isRefreshValid(legacy)).toBe(false);
    expect(await isRefreshValid(mobile.refreshToken)).toBe(false);
  });

  it("does not claim a token that is not a customer token", async () => {
    expect(await revokePelangganSession("bukan-token")).toBe(false);
    expect(stores.tokenVersion).toBe(3);
  });

  it("still refreshes when the ended-session store cannot be read", async () => {
    const web = await generatePelangganTokenPair(PELANGGAN_SESI);
    redisMock.exists.mockRejectedValueOnce(new Error("Redis down"));

    expect(await isRefreshValid(web.refreshToken)).toBe(true);
  });
});
