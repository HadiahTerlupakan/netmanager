import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

/**
 * `bacaDuplikat` diuji dengan bentuk yang SUNGGUH dikirim server, bukan bentuk
 * yang ditulis tangan di test. Penolakan dilempar `ProspekService.buat` yang
 * asli (repository dipalsukan) dan diterjemahkan `createHandler` yang asli,
 * jadi bila `lib/api/handler.ts` kelak memindahkan `code` atau `details`,
 * test ini yang merah — bukan layar yang diam-diam menampilkan toast umum.
 *
 * Mock di bawah hanya memotong I/O yang tidak dilewati jalur `auth: false`,
 * sama seperti `tests/lib/api-handler-mobile-auth.test.ts`.
 */

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getUserPermissions: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/middleware/request-logger", () => ({
  logRequest: vi.fn(),
  logResponse: vi.fn(),
  logAuditActivity: vi.fn().mockResolvedValue(undefined),
}));

import { createHandler } from "@/lib/api/handler";
import { bacaDuplikat } from "@/app/admin/presurvei/prospek/prospekFormState";
import type { ProspekEntity } from "@/modules/presurvei/domain/entities/Prospek";
import type { IProspekRepository } from "@/modules/presurvei/domain/ports/IProspekRepository";
import { ProspekService } from "@/modules/presurvei/services/ProspekService";

const prospekLama = {
  id: "prospek-lama",
  nama: "Budi Lama",
  noTelp: "081234567890",
  status: "DIHUBUNGI",
  pemilikId: "sales-3",
} as ProspekEntity;

/** Respons nyata `createHandler` untuk `POST` prospek yang bentrok. */
async function kirimProspekBentrok(): Promise<Response> {
  const repository = {
    findByNoTelp: vi.fn().mockResolvedValue([prospekLama]),
    create: vi.fn(),
  } as unknown as IProspekRepository;
  const service = new ProspekService(repository);

  const route = createHandler({ auth: false }, async () => {
    await service.buat({
      nama: "Budi Baru",
      noTelp: "081234567890",
      alamat: "Jl. Merdeka 10",
      sumber: "WALK_IN",
    });
    throw new Error("buat() seharusnya menolak duplikat");
  });

  return route(
    new NextRequest("http://localhost/api/presurvei/prospek", {
      method: "POST",
    }),
    { params: Promise.resolve({}) },
  );
}

describe("penolakan duplikat di kawat", () => {
  it("dikenali bacaDuplikat beserta prospek yang bentrok", async () => {
    const respons = await kirimProspekBentrok();
    const badan: unknown = await respons.json();

    expect(bacaDuplikat(respons.status, badan)).toEqual([
      {
        id: "prospek-lama",
        nama: "Budi Lama",
        status: "DIHUBUNGI",
        pemilikId: "sales-3",
      },
    ]);
  });
});
