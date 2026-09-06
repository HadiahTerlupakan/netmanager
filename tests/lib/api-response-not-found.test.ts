import { describe, expect, it } from "vitest";
import { ApiErrors } from "@/lib/api-response";

/**
 * `ApiErrors.notFound` menambahkan " tidak ditemukan" pada argumennya. Puluhan
 * pemanggil di aplikasi ini meneruskan kalimat utuh — baik literal maupun
 * pesan dinamis dari service (`error.message`, `result.error`, dan
 * `handleError` yang meneruskan teks di balik prefix `NOT_FOUND:`) — sehingga
 * pengguna menerima "Planning tidak ditemukan tidak ditemukan". Penggandaan itu
 * terverifikasi di produksi pada `GET /api/planning/<id>`.
 *
 * Pemanggil dinamis tidak bisa diperbaiki satu per satu karena isi pesannya
 * baru diketahui saat runtime, jadi pencegahannya terpusat di sini.
 */
const readBody = async (response: Response) =>
  (await response.json()) as { error: string; code: string };

describe("ApiErrors.notFound", () => {
  it("menambahkan frasa saat diberi nama resource saja", async () => {
    const body = await readBody(ApiErrors.notFound("Rencana"));

    expect(body.error).toBe("Rencana tidak ditemukan");
  });

  it("memakai default saat tidak diberi argumen", async () => {
    const body = await readBody(ApiErrors.notFound());

    expect(body.error).toBe("Data tidak ditemukan");
  });

  it("tidak menggandakan frasa saat diberi kalimat utuh", async () => {
    const body = await readBody(ApiErrors.notFound("Planning tidak ditemukan"));

    expect(body.error).toBe("Planning tidak ditemukan");
  });

  it("tidak menggandakan frasa versi Inggris", async () => {
    const body = await readBody(ApiErrors.notFound("Customer not found"));

    expect(body.error).toBe("Customer not found");
  });

  // Pesan yang membawa keterangan lanjutan harus utuh, bukan disisipi frasa
  // di ujungnya. Sebelumnya menjadi "... gunakan POST untuk create tidak
  // ditemukan".
  it("mempertahankan keterangan setelah frasa", async () => {
    const body = await readBody(
      ApiErrors.notFound(
        "Pengaturan tidak ditemukan, gunakan POST untuk create",
      ),
    );

    expect(body.error).toBe(
      "Pengaturan tidak ditemukan, gunakan POST untuk create",
    );
  });

  it("selalu membalas status 404 dengan kode NOT_FOUND", async () => {
    const response = ApiErrors.notFound("Rencana");
    const body = await readBody(response);

    expect(response.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
  });
});
