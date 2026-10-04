import { NextRequest } from "next/server";
import { apiSuccess, createHandler } from "@/lib/api";
import { LegalPartyDirectory, partyOptionsQuerySchema } from "@/modules/legal";

const directory = new LegalPartyDirectory();
const MAX_OPTIONS = 20;

/** GET /api/admin/legal/party-options?type=MITRA|RESELLER|PELANGGAN|VENDOR|SITE&search= — pihak kontrak untuk dipilih. */
export const GET = createHandler(
  { auth: true, permissions: ["legal:create", "legal:update"], feature: "legal" },
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const { type, search } = partyOptionsQuerySchema.parse({
      type: searchParams.get("type") ?? undefined,
      search: searchParams.get("search") ?? undefined,
    });

    return apiSuccess({ options: await directory.search(type, search, MAX_OPTIONS) });
  },
);
