import { describe, expect, it, vi } from "vitest";

import { selesaikanTautanPendek } from "@/lib/geo/tautan-peta-pendek";

function responsPengalihan(lokasi: string) {
  return new Response(null, { status: 302, headers: { location: lokasi } });
}

function responsTanpaPengalihan() {
  return new Response(null, { status: 200 });
}

const URL_PENDEK = "https://maps.app.goo.gl/abc";
const URL_PANJANG_SAH = "https://www.google.com/maps?q=-6.2,106.8";

describe("selesaikanTautanPendek", () => {
  it("mengambil koordinat dari tautan panjang hasil pengalihan", async () => {
    const ambil = vi.fn().mockResolvedValue(responsPengalihan(URL_PANJANG_SAH));

    await expect(selesaikanTautanPendek(URL_PENDEK, ambil)).resolves.toEqual({
      status: "berhasil",
      latitude: -6.2,
      longitude: 106.8,
    });
  });

  it("menolak pengalihan yang berpindah ke host di luar daftar", async () => {
    const ambil = vi
      .fn()
      .mockResolvedValue(responsPengalihan("https://penyerang.test/apa"));

    expect((await selesaikanTautanPendek(URL_PENDEK, ambil)).status).toBe(
      "gagal",
    );
  });

  it("menolak pengalihan ke alamat internal", async () => {
    const ambil = vi
      .fn()
      .mockResolvedValue(responsPengalihan("http://169.254.169.254/latest"));

    expect((await selesaikanTautanPendek(URL_PENDEK, ambil)).status).toBe(
      "gagal",
    );
  });

  it("menolak localhost", async () => {
    const ambil = vi
      .fn()
      .mockResolvedValue(responsPengalihan("http://127.0.0.1:3000/admin"));

    expect((await selesaikanTautanPendek(URL_PENDEK, ambil)).status).toBe(
      "gagal",
    );
  });

  it.each([
    ["protokol http", "http://www.google.com/maps?q=-6.2,106.8"],
    ["kredensial", "https://user:pass@www.google.com/maps?q=-6.2,106.8"],
    ["port non-default", "https://www.google.com:8443/maps?q=-6.2,106.8"],
  ])("menolak pengalihan ke host sah dengan %s", async (_nama, lokasi) => {
    const ambil = vi.fn().mockResolvedValue(responsPengalihan(lokasi));

    expect((await selesaikanTautanPendek(URL_PENDEK, ambil)).status).toBe(
      "gagal",
    );
  });

  it("memeriksa ulang penjaga pada lompatan kedua", async () => {
    const ambil = vi
      .fn()
      .mockResolvedValueOnce(responsPengalihan("https://goo.gl/maps/lagi"))
      .mockResolvedValueOnce(
        responsPengalihan("https://www.google.com:8443/maps"),
      );

    expect((await selesaikanTautanPendek(URL_PENDEK, ambil)).status).toBe(
      "gagal",
    );
    expect(ambil).toHaveBeenCalledTimes(2);
  });

  it("berhenti setelah batas pengalihan terlampaui", async () => {
    const ambil = vi
      .fn()
      .mockImplementation(async () =>
        responsPengalihan("https://goo.gl/maps/lagi"),
      );

    const hasil = await selesaikanTautanPendek(URL_PENDEK, ambil);

    expect(hasil.status).toBe("gagal");
    expect(ambil.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it("menolak tautan awal yang bukan host Google", async () => {
    const ambil = vi.fn();

    expect(
      (await selesaikanTautanPendek("https://penyerang.test/x", ambil)).status,
    ).toBe("gagal");
    expect(ambil).not.toHaveBeenCalled();
  });

  it("tidak mengirim kredensial dan tidak mengikuti pengalihan otomatis", async () => {
    const ambil = vi.fn().mockResolvedValue(responsPengalihan(URL_PANJANG_SAH));

    await selesaikanTautanPendek(URL_PENDEK, ambil);

    const opsi = ambil.mock.calls[0][1];
    expect(opsi.method).toBe("HEAD");
    expect(opsi.redirect).toBe("manual");
    expect(opsi.credentials).toBe("omit");
  });

  it("membuang query dan fragment sebelum mengirim permintaan", async () => {
    const ambil = vi.fn().mockResolvedValue(responsPengalihan(URL_PANJANG_SAH));

    await selesaikanTautanPendek(`${URL_PENDEK}?rahasia=1#bagian`, ambil);

    expect(ambil.mock.calls[0][0]).toBe(URL_PENDEK);
  });

  it("mengulang sekali dengan GET bila HEAD tidak memuat location", async () => {
    const ambil = vi
      .fn()
      .mockResolvedValueOnce(responsTanpaPengalihan())
      .mockResolvedValueOnce(responsPengalihan(URL_PANJANG_SAH));

    await expect(selesaikanTautanPendek(URL_PENDEK, ambil)).resolves.toEqual({
      status: "berhasil",
      latitude: -6.2,
      longitude: 106.8,
    });
    expect(ambil.mock.calls[0][1].method).toBe("HEAD");
    expect(ambil.mock.calls[1][1].method).toBe("GET");
    expect(ambil.mock.calls[1][1].redirect).toBe("manual");
    expect(ambil.mock.calls[1][1].credentials).toBe("omit");
  });

  it("gagal bila GET pun tidak memuat location, tanpa pengulangan lagi", async () => {
    const ambil = vi
      .fn()
      .mockImplementation(async () => responsTanpaPengalihan());

    expect((await selesaikanTautanPendek(URL_PENDEK, ambil)).status).toBe(
      "gagal",
    );
    expect(ambil).toHaveBeenCalledTimes(2);
  });

  it("tidak membocorkan galat jaringan mentah ke klien", async () => {
    const ambil = vi
      .fn()
      .mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:443"));

    const hasil = await selesaikanTautanPendek(URL_PENDEK, ambil);

    expect(hasil.status).toBe("gagal");
    expect(JSON.stringify(hasil)).not.toMatch(/10\.0\.0\.5|ECONNREFUSED/);
  });

  it("tidak membaca badan respons", async () => {
    const respons = responsPengalihan(URL_PANJANG_SAH);
    const bacaTeks = vi.spyOn(respons, "text");
    const ambil = vi.fn().mockResolvedValue(respons);

    await selesaikanTautanPendek(URL_PENDEK, ambil);

    expect(bacaTeks).not.toHaveBeenCalled();
  });
});
