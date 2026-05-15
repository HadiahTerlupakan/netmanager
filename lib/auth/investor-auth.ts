import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import type { JWTPayload } from "jose";

const INVESTOR_AUTH_COOKIE = "investor_auth_token";
const INVESTOR_ROLE = "INVESTOR";

export interface InvestorAuthPayload {
  id: string;
  username: string;
  namaLengkap: string;
  role: string;
  tenantId: string | null;
}

export class InvestorAuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403,
  ) {
    super(message);
    this.name = "InvestorAuthError";
  }
}

function getSecret(): Uint8Array {
  const raw = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!raw) throw new Error("NEXTAUTH_SECRET environment variable is required");
  return new TextEncoder().encode(raw);
}

function isInvestorPayload(
  payload: JWTPayload,
): payload is JWTPayload & InvestorAuthPayload {
  return (
    typeof payload.id === "string" &&
    typeof payload.username === "string" &&
    typeof payload.namaLengkap === "string" &&
    payload.role === INVESTOR_ROLE
  );
}

/** Memvalidasi cookie investor_auth_token dan mengembalikan payload terverifikasi. */
export async function getInvestorAuth(): Promise<InvestorAuthPayload | null> {
  const token = (await cookies()).get(INVESTOR_AUTH_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!isInvestorPayload(payload)) return null;
    return {
      id: payload.id,
      username: payload.username,
      namaLengkap: payload.namaLengkap,
      role: payload.role,
      tenantId: (payload.tenantId as string | null | undefined) ?? null,
    };
  } catch {
    return null;
  }
}

/** Variant yang melempar `InvestorAuthError` ketika sesi tidak valid. */
export async function requireInvestorAuth(): Promise<InvestorAuthPayload> {
  const payload = await getInvestorAuth();
  if (!payload) {
    throw new InvestorAuthError("Unauthorized", 401);
  }
  return payload;
}
