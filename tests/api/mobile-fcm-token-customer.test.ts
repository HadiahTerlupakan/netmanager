import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { prismaMock } from "../setup";
import { generatePelangganAccessToken } from "@/lib/jwt";

/**
 * Aplikasi memberi pelanggan token akses portal (audience `pelanggan-portal`).
 * Verifikator token mobile karyawan menolaknya: token itu tidak membawa klaim
 * `role` maupun `tokenVersion`, sehingga `verifyCustomerToken` menolak setiap
 * pelanggan dengan tokenVersion ≥ 1 (bawaan kolomnya 1). Endpoint menjawab 401,
 * dan penangan 401 aplikasi menyegarkan token, mencoba lagi, lalu mengeluarkan
 * pelanggan dari aplikasi. Token pelanggan kini diterima dan tokennya
 * disimpan di baris pelanggan itu.
 */

const evaluateMobileVersion = vi.hoisted(() => vi.fn());
vi.mock("@/modules/app-version", () => ({ evaluateMobileVersion }));

import { POST } from "@/app/api/mobile/fcm-token/route";

const DI_TENANT = { id: "cust-1", tenantId: "tenant-1" };

function tokenPortalPelanggan(status = "AKTIF") {
  return generatePelangganAccessToken({
    id: "cust-1",
    idPelanggan: "P-001",
    nama: "Budi",
    username: "budi",
    status,
    tenantId: "tenant-1",
    sessionId: "sid-1",
  });
}

function kirim(token: string, body: Record<string, string>) {
  return POST(
    new NextRequest("http://localhost/api/mobile/fcm-token", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/mobile/fcm-token dengan token pelanggan", () => {
  beforeEach(() => {
    evaluateMobileVersion.mockResolvedValue({
      isSupported: true,
      minimum: null,
    });
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => unknown) =>
        callback(prismaMock),
    );
    // Seperti baris pelanggan di produksi: tokenVersion bawaan 1.
    prismaMock.pelanggan.findUnique.mockResolvedValue({
      id: "cust-1",
      nama: "Budi",
      username: "budi",
      status: "AKTIF",
      tokenVersion: 1,
      tenantId: "tenant-1",
      fcmTokens: [],
    });
  });

  it("menyimpan token pelanggan yang login dengan token portal", async () => {
    prismaMock.pelanggan.findFirst.mockResolvedValue({
      id: "cust-1",
      fcmTokens: [],
    });

    const response = await kirim(tokenPortalPelanggan(), {
      fcmToken: "fcm-cust",
      action: "add",
    });

    expect(response.status).toBe(200);
    expect(prismaMock.pelanggan.findFirst).toHaveBeenCalledWith({
      where: DI_TENANT,
      select: { id: true, fcmTokens: true },
    });
    expect(prismaMock.pelanggan.update).toHaveBeenCalledWith({
      where: DI_TENANT,
      data: { fcmTokens: { set: ["fcm-cust"] } },
    });
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
  });

  it("melepas token pelanggan saat logout", async () => {
    prismaMock.pelanggan.findFirst.mockResolvedValue({
      id: "cust-1",
      fcmTokens: ["fcm-cust", "fcm-lain"],
    });

    const response = await kirim(tokenPortalPelanggan(), {
      fcmToken: "fcm-cust",
      action: "remove",
    });

    expect(response.status).toBe(200);
    expect(prismaMock.pelanggan.update).toHaveBeenCalledWith({
      where: DI_TENANT,
      data: { fcmTokens: { set: ["fcm-lain"] } },
    });
  });

  it("pelanggan yang sudah dismantle dijawab 403, bukan 401 yang mengeluarkannya", async () => {
    const response = await kirim(tokenPortalPelanggan("DISMANTLE"), {
      fcmToken: "fcm-cust",
    });

    expect(response.status).toBe(403);
    expect(prismaMock.pelanggan.update).not.toHaveBeenCalled();
  });

  it("token pelanggan yang tidak sah dijawab 401 supaya aplikasi menyegarkannya", async () => {
    const [header, payload] = tokenPortalPelanggan().split(".");

    const response = await kirim(`${header}.${payload}.tanda-tangan-palsu`, {
      fcmToken: "fcm-cust",
    });

    expect(response.status).toBe(401);
    expect(prismaMock.pelanggan.update).not.toHaveBeenCalled();
  });
});
