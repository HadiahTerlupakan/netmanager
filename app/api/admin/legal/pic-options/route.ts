import { NextRequest } from "next/server";
import { apiSuccess, createHandler } from "@/lib/api";
import { UserLookupService } from "@/modules/users";

const directory = new UserLookupService();
const MAX_OPTIONS = 20;
const MAX_KEYWORD_LENGTH = 120;

/** GET /api/admin/legal/pic-options?search= — karyawan aktif untuk dipilih sebagai PIC. */
export const GET = createHandler(
  { auth: true, permissions: ["legal:create", "legal:update"], feature: "legal" },
  async (request: NextRequest) => {
    const keyword = (new URL(request.url).searchParams.get("search") ?? "")
      .trim()
      .slice(0, MAX_KEYWORD_LENGTH);

    return apiSuccess({ options: await directory.searchEmployeeOptions(keyword, MAX_OPTIONS) });
  },
);
