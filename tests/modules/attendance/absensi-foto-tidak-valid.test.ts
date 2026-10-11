import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { MobileAttendanceCheckInPayloadParser } from "@/modules/attendance/services/MobileAttendanceCheckInPayloadParser";
import { MobileAttendanceCheckoutPayloadParser } from "@/modules/attendance/services/MobileAttendanceCheckoutPayloadParser";

const PESAN_VALIDASI = "Dimensi foto terlalu kecil. Minimal 200x200px";
const ID_PENGGUNA = "e452c1be-cd38-4513-850e-34dd10ea428b";

function fotoPalsuYangDitolak() {
  return {
    processPhoto: vi.fn().mockRejectedValue(new Error(PESAN_VALIDASI)),
  };
}

function permintaanMultipart() {
  const formData = new FormData();
  formData.append(
    "photo",
    new File([new Uint8Array([1, 2, 3])], "selfie.png", { type: "image/png" }),
  );
  formData.append("latitude", "-6.175");
  formData.append("longitude", "106.827");
  return new NextRequest("http://localhost/api/mobile/attendance/check-in", {
    method: "POST",
    body: formData,
  });
}

describe("foto absensi yang ditolak validasi", () => {
  it("check-in mengembalikan 400 dengan alasannya, bukan 500", async () => {
    // Pesan validasi sudah siap-tampil; sebagai `Error` biasa ia berubah jadi
    // "Terjadi kesalahan pada server" dan orang yang memotret tidak tahu apa
    // yang salah.
    const parser = new MobileAttendanceCheckInPayloadParser(
      fotoPalsuYangDitolak() as never,
    );

    const hasil = await parser.parsePayload(permintaanMultipart(), ID_PENGGUNA);

    expect(hasil).toMatchObject({
      success: false,
      status: 400,
      error: PESAN_VALIDASI,
    });
  });

  it("check-out mengembalikan 400 dengan alasannya, bukan 500", async () => {
    const parser = new MobileAttendanceCheckoutPayloadParser(
      fotoPalsuYangDitolak() as never,
    );

    const galat = await parser
      .parse(permintaanMultipart(), ID_PENGGUNA)
      .then((): unknown => null)
      .catch((error: unknown) => error);

    expect(galat).toBeInstanceOf(NextResponse);
    expect((galat as NextResponse).status).toBe(400);
    await expect((galat as NextResponse).json()).resolves.toMatchObject({
      error: PESAN_VALIDASI,
    });
  });

  it("foto yang lolos validasi tetap diteruskan", async () => {
    const foto = {
      processPhoto: vi.fn().mockResolvedValue("/uploads/selfie.webp"),
    };
    const parser = new MobileAttendanceCheckInPayloadParser(foto as never);

    const hasil = await parser.parsePayload(permintaanMultipart(), ID_PENGGUNA);

    expect(hasil).toMatchObject({
      success: true,
      data: { photoUrl: "/uploads/selfie.webp" },
    });
  });
});
