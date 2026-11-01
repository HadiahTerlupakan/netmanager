import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Rute token FCM tidak memakai `createHandler` (autentikasinya mencakup
 * pelanggan dan investor), sehingga dulu sinkron token yang berhasil maupun
 * yang ditolak tidak meninggalkan jejak di log pod. Setiap rute wajib
 * mencatat baris `→`/`←` seperti rute lain — tanpa pernah menulis tokennya.
 */

const mockMobileAuth = vi.hoisted(() => vi.fn());
const mockInvestorSession = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger: mockLogger }));
vi.mock("@/lib/mobile-api-auth", () => ({
  getMobileOrCustomerAuthPayload: mockMobileAuth,
  getMobileAuthPayload: mockMobileAuth,
}));
vi.mock("@/lib/mobile-investor-auth", () => ({
  requireInvestorMobileSession: mockInvestorSession,
}));

import { POST as postTokenMobile } from "@/app/api/mobile/fcm-token/route";
import { POST as postTokenMitra } from "@/app/api/mobile/mitra/fcm-token/route";
import { POST as postTokenInvestor } from "@/app/api/mobile/investor/fcm-token/route";

/** Bentuk token FCM: id instans, titik dua, lalu muatan base64url. */
const TOKEN_FCM = `${"e".repeat(22)}:APA91b${"R_-".repeat(45)}`;

const RUTE = [
  { path: "/api/mobile/fcm-token", post: postTokenMobile },
  { path: "/api/mobile/mitra/fcm-token", post: postTokenMitra },
  { path: "/api/mobile/investor/fcm-token", post: postTokenInvestor },
];

function buatPermintaan(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    body: JSON.stringify({ fcmToken: TOKEN_FCM, action: "add" }),
  });
}

function semuaPanggilanLog(): unknown[][] {
  return [
    ...mockLogger.info.mock.calls,
    ...mockLogger.warn.mock.calls,
    ...mockLogger.error.mock.calls,
  ];
}

describe.each(RUTE)("POST $path mencatat permintaan", ({ path, post }) => {
  beforeEach(() => {
    vi.clearAllMocks();
    const tolak = NextResponse.json({ success: false }, { status: 401 });
    mockMobileAuth.mockResolvedValue(tolak);
    mockInvestorSession.mockResolvedValue(tolak);
  });

  it("menulis baris masuk dan keluar beserta status jawabannya", async () => {
    const response = await post(buatPermintaan(path));

    expect(response.status).toBe(401);
    expect(mockLogger.info).toHaveBeenCalledWith(
      `→ POST ${path}`,
      expect.anything(),
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      `← POST ${path} 401`,
      expect.anything(),
    );
  });

  it("tidak pernah menulis token FCM ke log", async () => {
    await post(buatPermintaan(path));

    expect(JSON.stringify(semuaPanggilanLog())).not.toContain(TOKEN_FCM);
  });
});

describe("galat tak terduga di rute token FCM", () => {
  it("dicatat lengkap, tapi klien hanya menerima pesan generik", async () => {
    vi.clearAllMocks();
    mockInvestorSession.mockRejectedValue(
      new Error("koneksi db-netmanager putus"),
    );

    const response = await postTokenInvestor(
      buatPermintaan("/api/mobile/investor/fcm-token"),
    );
    const isi = JSON.stringify(await response.json());

    expect(response.status).toBe(500);
    expect(isi).toContain("Terjadi kesalahan pada server");
    expect(isi).not.toContain("db-netmanager");
    expect(mockLogger.error).toHaveBeenCalledWith(
      "✗ POST /api/mobile/investor/fcm-token ERROR",
      expect.any(Error),
      expect.anything(),
    );
  });
});
