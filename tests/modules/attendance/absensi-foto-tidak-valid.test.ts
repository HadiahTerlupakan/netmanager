import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { AttendanceErrors } from "@/modules/attendance/domain/errors";
import { MobileAttendanceCheckInPayloadParser } from "@/modules/attendance/services/MobileAttendanceCheckInPayloadParser";
import { MobileAttendanceCheckoutPayloadParser } from "@/modules/attendance/services/MobileAttendanceCheckoutPayloadParser";

const PESAN_VALIDASI = "Dimensi foto terlalu kecil. Minimal 200x200px";
const PESAN_UMUM = "Foto tidak dapat diproses. Coba ambil ulang fotonya.";
const BOCOR =
  "ENOENT: no such file or directory, open '/srv/app/public/uploads'";
const ID_PENGGUNA = "e452c1be-cd38-4513-850e-34dd10ea428b";

function fotoDitolakValidasi() {
  return {
    processPhoto: vi
      .fn()
      .mockRejectedValue(AttendanceErrors.photoInvalid(PESAN_VALIDASI)),
  };
}

function fotoGagalInternal() {
  return { processPhoto: vi.fn().mockRejectedValue(new Error(BOCOR)) };
}

function permintaanMultipart(
  nilaiFoto: File | string = new File(
    [new Uint8Array([1, 2, 3])],
    "selfie.png",
    {
      type: "image/png",
    },
  ),
) {
  const formData = new FormData();
  formData.append("photo", nilaiFoto);
  formData.append("latitude", "-6.175");
  formData.append("longitude", "106.827");
  return new NextRequest("http://localhost/api/mobile/attendance/check-in", {
    method: "POST",
    body: formData,
  });
}

function tangkap(janji: Promise<unknown>) {
  return janji.then((): unknown => null).catch((error: unknown) => error);
}

describe("foto absensi yang ditolak validasi", () => {
  it("check-in mengembalikan 400 dengan alasannya, bukan 500", async () => {
    // Pesan validasi ditulis untuk pengguna; sebagai galat tak bertipe ia
    // berubah jadi "Terjadi kesalahan pada server" dan alasannya hilang.
    const parser = new MobileAttendanceCheckInPayloadParser(
      fotoDitolakValidasi() as never,
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
      fotoDitolakValidasi() as never,
    );

    const galat = await tangkap(
      parser.parse(permintaanMultipart(), ID_PENGGUNA),
    );

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

describe("galat internal saat memproses foto", () => {
  it("check-in tidak membocorkan pesan galat internal ke klien", async () => {
    const parser = new MobileAttendanceCheckInPayloadParser(
      fotoGagalInternal() as never,
    );

    const hasil = (await parser.parsePayload(
      permintaanMultipart(),
      ID_PENGGUNA,
    )) as { error?: string };

    expect(hasil.error).toBe(PESAN_UMUM);
    expect(hasil.error).not.toContain("/srv/app");
    expect(hasil.error).not.toContain("ENOENT");
  });

  it("check-out tidak membocorkan pesan galat internal ke klien", async () => {
    const parser = new MobileAttendanceCheckoutPayloadParser(
      fotoGagalInternal() as never,
    );

    const galat = await tangkap(
      parser.parse(permintaanMultipart(), ID_PENGGUNA),
    );
    const badan = await (galat as NextResponse).json();

    expect(badan.error).toBe(PESAN_UMUM);
    expect(JSON.stringify(badan)).not.toContain("/srv/app");
  });
});

describe("medan foto berupa string", () => {
  it.each([
    [
      "check-in",
      (foto: { processPhoto: unknown }) =>
        new MobileAttendanceCheckInPayloadParser(foto as never).parsePayload(
          permintaanMultipart("http://169.254.169.254/latest/meta-data/"),
          ID_PENGGUNA,
        ),
    ],
    [
      "check-out",
      (foto: { processPhoto: unknown }) =>
        new MobileAttendanceCheckoutPayloadParser(foto as never).parse(
          permintaanMultipart("http://169.254.169.254/latest/meta-data/"),
          ID_PENGGUNA,
        ),
    ],
  ])("%s tidak meneruskan string ke pemroses foto", async (_nama, jalankan) => {
    // String pada medan ini diperlakukan sebagai URL lalu di-`fetch`: klien
    // tidak boleh bisa menyuruh server menembak alamat pilihannya.
    const foto = { processPhoto: vi.fn().mockResolvedValue(null) };

    await tangkap(jalankan(foto) as Promise<unknown>);

    expect(foto.processPhoto).not.toHaveBeenCalled();
  });
});
