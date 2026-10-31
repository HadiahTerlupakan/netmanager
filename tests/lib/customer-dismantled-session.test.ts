import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";

import {
  PELANGGAN_SESI,
  useStatefulPelangganStores,
  type PelangganSessionStores,
} from "../helpers/pelanggan-session-stores";
import { refreshCustomerToken } from "@/lib/customer-auth";
import {
  generatePelangganTokenPair,
  invalidatePelangganRefreshTokens,
  verifyPelangganRefreshToken,
} from "@/lib/jwt";
import { MobileCustomerAuthService } from "@/modules/users/services/MobileCustomerAuthService";

/**
 * Pelanggan yang di-dismantle dulu hanya terlempar ke layar login: refresh
 * token ditolak sebagai "tidak valid", sama dengan token rusak. Sesi yang
 * masih sah kini mendapat alasan khusus supaya aplikasi dan portal bisa
 * menjelaskannya. Token yang memang sudah dicabut tetap ditolak biasa, jadi
 * status pelanggan tidak bocor ke pemegang token mati.
 */

let stores: PelangganSessionStores;

const mobileAuth = new MobileCustomerAuthService({
  buildUnsupportedVersionResponse: async (): Promise<null> => null,
} as never);

function webRequest(refreshToken: string) {
  return new NextRequest("https://pelanggan.radpro.id/tagihan", {
    headers: { cookie: `customer-refresh-token=${refreshToken}` },
  });
}

describe("refresh token pelanggan dismantle", () => {
  beforeEach(() => {
    stores = useStatefulPelangganStores();
  });

  it("sesi yang masih sah ditolak dengan alasan CUSTOMER_DISMANTLED", async () => {
    const { refreshToken } = await generatePelangganTokenPair(PELANGGAN_SESI);
    stores.status = "DISMANTLE";

    expect(await verifyPelangganRefreshToken(refreshToken)).toEqual({
      id: PELANGGAN_SESI.id,
      valid: false,
      reason: "CUSTOMER_DISMANTLED",
    });
  });

  it("aplikasi mobile menerima hasil dismantled, bukan token baru", async () => {
    const { refreshToken } = await generatePelangganTokenPair(PELANGGAN_SESI);
    stores.status = "DISMANTLE";

    expect(await mobileAuth.tryRefreshToken(refreshToken)).toEqual({
      kind: "dismantled",
    });
  });

  it("portal web menerima hasil dismantled, bukan token baru", async () => {
    const { refreshToken } = await generatePelangganTokenPair(PELANGGAN_SESI);
    stores.status = "DISMANTLE";

    expect(await refreshCustomerToken(webRequest(refreshToken))).toEqual({
      kind: "dismantled",
    });
  });

  it("token yang sudah dicabut tetap ditolak biasa walau pelanggan dismantle", async () => {
    const { refreshToken } = await generatePelangganTokenPair(PELANGGAN_SESI);
    await invalidatePelangganRefreshTokens(PELANGGAN_SESI.id);
    stores.status = "DISMANTLE";

    expect(await verifyPelangganRefreshToken(refreshToken)).toEqual({
      id: "",
      valid: false,
    });
    expect(await mobileAuth.tryRefreshToken(refreshToken)).toBeNull();
    expect(await refreshCustomerToken(webRequest(refreshToken))).toBeNull();
  });

  it("pelanggan aktif tetap mendapat token baru", async () => {
    const { refreshToken } = await generatePelangganTokenPair(PELANGGAN_SESI);

    expect(await refreshCustomerToken(webRequest(refreshToken))).toMatchObject(
      { kind: "refreshed" },
    );
  });
});
