import { createHandler, apiSuccess, requireSessionTenantId } from "@/lib/api";
import { permissionListAllows } from "@/lib/rbac";
import {
  planningPetaService,
  buatTitikRencanaSchema,
} from "@/modules/planning";

/** Nilai `?lingkup=` yang juga mengembalikan node jaringan nyata sebagai latar. */
const LINGKUP_SEMUA = "semua";

/** Izin yang menguasai pembacaan topologi jaringan operasional. */
const IZIN_BACA_PETA_OPERASIONAL = "map:read";

/**
 * GET /api/planning/[id]/peta/titik
 * Seluruh titik dan jalur rencana pada peta planning.
 *
 * `?lingkup=semua` menambahkan node jaringan nyata milik tenant yang sama,
 * supaya rencana bisa digambar di atas konteks jaringan yang sudah berdiri.
 *
 * Latar itu adalah enumerasi topologi operasional (nama, koordinat, splitter,
 * catatan seluruh OLT/ODC/ODP/pole/joinbox satu tenant), jadi ia menuntut
 * `map:read` DI ATAS `planning:read`. Dua izin itu TIDAK boleh ditulis
 * berdampingan di `permissions`: gerbang `createHandler` bersifat "salah satu
 * dari" (`lib/api/handler.ts`, `expandedPerms.some`), sehingga menambahkan
 * `map:read` di sana justru akan melonggarkan akses ke peta planning. Jadi
 * izinnya dihitung di sini dengan `permissionListAllows` dan diserahkan ke
 * service sebagai boolean.
 *
 * Bila izinnya tidak ada, respons tetap 200 dengan titik & jalur rencana —
 * endpoint ini satu-satunya sumber keduanya, dan 403 akan mematikan seluruh
 * peta rencana. Yang terjadi adalah degradasi berpenanda:
 * `latarDisembunyikanKarenaIzin`, yang wajib dikatakan antarmuka.
 */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["planning:read"],
  },
  async (req, ctx) => {
    const peta = await planningPetaService.ambilPeta(
      ctx.params.id,
      requireSessionTenantId(ctx),
      {
        sertakanNodeNyata:
          req.nextUrl.searchParams.get("lingkup") === LINGKUP_SEMUA,
        diizinkanNodeNyata: permissionListAllows(
          {
            permissions: ctx.permissions,
            isSuperAdmin: ctx.session?.user.isSuperAdmin,
          },
          IZIN_BACA_PETA_OPERASIONAL,
        ),
      },
    );

    return apiSuccess(peta);
  },
);

/**
 * POST /api/planning/[id]/peta/titik
 * Menambah titik rencana. Aturan ada di `PlanningPetaService`.
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["planning:update"],
    schema: buatTitikRencanaSchema,
  },
  async (req, ctx) => {
    const titik = await planningPetaService.tambahTitik(
      ctx.params.id,
      ctx.validated,
      ctx.session!.user.id,
      requireSessionTenantId(ctx),
    );

    return apiSuccess(titik, {
      status: 201,
      message: "Titik rencana berhasil ditambahkan",
    });
  },
);
