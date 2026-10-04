import { NextRequest } from "next/server";
import { apiSuccess, createHandler } from "@/lib/api";
import {
  EndorsementSignerOptionsService,
  signerOptionsQuerySchema,
} from "@/modules/endorsement";

const options = new EndorsementSignerOptionsService();

/** GET /api/admin/endorsements/signer-options?search= — karyawan untuk dipilih sebagai penanda tangan. */
export const GET = createHandler(
  { auth: true, permissions: ["pengesahan:create"] },
  async (request: NextRequest) => {
    const { search } = signerOptionsQuerySchema.parse({
      search: new URL(request.url).searchParams.get("search") ?? undefined,
    });

    return apiSuccess({ options: await options.search(search) });
  },
);
