import { apiError, apiSuccess, ErrorCodes } from "@/lib/api-response";
import { getInvestorAuth } from "@/lib/auth/investor-auth";

export async function GET() {
  const auth = await getInvestorAuth();
  if (!auth) {
    return apiError("Tidak terautentikasi", ErrorCodes.UNAUTHORIZED, {
      status: 401,
    });
  }

  return apiSuccess({
    authenticated: true,
    user: {
      id: auth.id,
      username: auth.username,
      namaLengkap: auth.namaLengkap,
      role: auth.role,
    },
  });
}
