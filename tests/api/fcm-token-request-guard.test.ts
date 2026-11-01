import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mendaftarkan token melepasnya dari setiap pemilik lain, lintas tenant. Maka
 * setiap rute token FCM (karyawan, mitra, pelanggan, investor) hanya menerima
 * token berbentuk token FCM — bukan string acak, bukan token Expo yang bisa
 * mengosongkan `pushToken` lama orang lain — dan membatasi permintaan per
 * pemilik supaya tidak bisa dipakai menebak atau membanjiri.
 */

const mockMobileAuth = vi.hoisted(() => vi.fn());
const mockUpdateMobileFcmToken = vi.hoisted(() => vi.fn());
const mockInvestorSession = vi.hoisted(() => vi.fn());
const mockAturToken = vi.hoisted(() => vi.fn());

vi.mock("@/lib/mobile-api-auth", () => ({
  getMobileOrCustomerAuthPayload: mockMobileAuth,
}));
vi.mock("@/lib/mobile-investor-auth", () => ({
  requireInvestorMobileSession: mockInvestorSession,
}));
vi.mock("@/modules/investor", () => ({
  getInvestorPushService: () => ({ aturToken: mockAturToken }),
}));
vi.mock("@/modules/notification", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/notification")>()),
  updateMobileFcmToken: mockUpdateMobileFcmToken,
}));

import { POST as postTokenMobile } from "@/app/api/mobile/fcm-token/route";
import { POST as postTokenInvestor } from "@/app/api/mobile/investor/fcm-token/route";

/** Bentuk token FCM: id instans, titik dua, lalu muatan base64url. */
const TOKEN_FCM = `${"d".repeat(22)}:APA91b${"Q_-".repeat(45)}`;

const RUTE = [
  {
    nama: "karyawan, mitra, dan pelanggan",
    post: postTokenMobile,
    url: "/api/mobile/fcm-token",
    pendaftar: mockUpdateMobileFcmToken,
  },
  {
    nama: "investor",
    post: postTokenInvestor,
    url: "/api/mobile/investor/fcm-token",
    pendaftar: mockAturToken,
  },
];

type Rute = (typeof RUTE)[number];

function kirim(rute: Rute, body: unknown) {
  return rute.post(
    new NextRequest(`http://localhost${rute.url}`, {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

function masukSebagai(id: string) {
  mockMobileAuth.mockResolvedValue({
    userId: id,
    id,
    role: "CUSTOMER",
    tenantId: "t-1",
  });
  mockInvestorSession.mockResolvedValue({ id, tenantId: "t-1" });
}

// Setiap tes memakai pemilik sendiri: hitungan pembatas bertahan antartes.
let nomorPemilik = 0;

beforeEach(() => {
  vi.clearAllMocks();
  nomorPemilik += 1;
  masukSebagai(`pemilik-${nomorPemilik}`);
  mockUpdateMobileFcmToken.mockResolvedValue({
    message: "FCM token berhasil disimpan",
  });
  mockAturToken.mockResolvedValue(true);
});

describe.each(RUTE)("rute token FCM $nama", (rute) => {
  it("menerima token FCM yang sah", async () => {
    expect((await kirim(rute, { fcmToken: TOKEN_FCM })).status).toBe(200);
    expect(rute.pendaftar).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["tanpa token", {}],
    ["token bukan string", { fcmToken: 12345 }],
    ["token terlalu pendek", { fcmToken: "fcm-token-1" }],
    ["token Expo", { fcmToken: `ExponentPushToken[${"x".repeat(64)}]` }],
    [
      "token berspasi di tengah",
      { fcmToken: `${TOKEN_FCM.slice(0, 80)} ${TOKEN_FCM.slice(80)}` },
    ],
    ["token terlalu panjang", { fcmToken: "a".repeat(4097) }],
    ["aksi tak dikenal", { fcmToken: TOKEN_FCM, action: "hapus-semua" }],
    ["body bukan JSON", "bukan-json"],
  ])("menolak %s dengan 400", async (_kasus, body) => {
    expect((await kirim(rute, body)).status).toBe(400);
    expect(rute.pendaftar).not.toHaveBeenCalled();
  });

  it("membatasi 10 permintaan per pemilik per menit; pemilik lain tidak ikut terbatas", async () => {
    for (let ke = 0; ke < 10; ke += 1) {
      expect((await kirim(rute, { fcmToken: TOKEN_FCM })).status).toBe(200);
    }
    expect((await kirim(rute, { fcmToken: TOKEN_FCM })).status).toBe(429);

    masukSebagai(`pemilik-lain-${nomorPemilik}`);
    expect((await kirim(rute, { fcmToken: TOKEN_FCM })).status).toBe(200);
  });
});
