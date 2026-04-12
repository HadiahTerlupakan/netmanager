import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import {
  verifyPelangganAccessToken,
  generatePelangganAccessToken,
} from "./jwt";
import { prisma } from "./prisma";

// Cookie names
export const CUSTOMER_ACCESS_TOKEN_COOKIE = "customer-token";
export const CUSTOMER_REFRESH_TOKEN_COOKIE = "customer-refresh-token";

// Cookie options
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export interface CustomerSession {
  id: string;
  idPelanggan: string;
  nama: string;
  username: string;
  status: string;
}

async function readCustomerAccessTokenFromCookies(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
) {
  return cookieStore.get(CUSTOMER_ACCESS_TOKEN_COOKIE)?.value ?? null;
}

/**
 * Get customer session from request
 */
export async function getCustomerSession(
  request: NextRequest,
): Promise<CustomerSession | null> {
  try {
    let token = request.cookies.get(CUSTOMER_ACCESS_TOKEN_COOKIE)?.value;

    // If no cookie, check Authorization header (Bearer token) for Mobile App
    if (!token) {
      const authHeader = request.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return null;
    }

    const decoded = verifyPelangganAccessToken(token);
    if (!decoded) {
      return null;
    }

    return {
      id: decoded.id,
      idPelanggan: decoded.idPelanggan,
      nama: decoded.nama,
      username: decoded.username,
      status: decoded.status,
    };
  } catch {
    return null;
  }
}

/**
 * Get customer session from server cookies.
 */
export async function getCustomerSessionFromCookies(): Promise<CustomerSession | null> {
  try {
    const cookieStore = await cookies();
    const token = await readCustomerAccessTokenFromCookies(cookieStore);

    if (!token) {
      return null;
    }

    const decoded = verifyPelangganAccessToken(token);
    if (!decoded) {
      return null;
    }

    return {
      id: decoded.id,
      idPelanggan: decoded.idPelanggan,
      nama: decoded.nama,
      username: decoded.username,
      status: decoded.status,
    };
  } catch {
    return null;
  }
}

/**
 * Require customer page auth and redirect guests or inactive users.
 */
export async function requireCustomerPageAuth(): Promise<CustomerSession> {
  const session = await getCustomerSessionFromCookies();

  if (!session) {
    redirect("/login");
  }

  if (session.status !== "AKTIF") {
    redirect("/login?reason=inactive");
  }

  return session;
}

/**
 * Require customer authentication for API routes
 * Returns the customer session or throws an error response
 */
export async function requireCustomerAuth(request: NextRequest): Promise<
  | {
      session: CustomerSession;
      response?: never;
    }
  | {
      session?: never;
      response: NextResponse;
    }
> {
  const session = await getCustomerSession(request);

  if (!session) {
    return {
      response: NextResponse.json(
        {
          error: "Tidak terautentikasi",
          message: "Silakan login terlebih dahulu",
        },
        { status: 401 },
      ),
    };
  }

  // Check if customer is still active
  if (session.status !== "AKTIF") {
    return {
      response: NextResponse.json(
        {
          error: "Akses ditolak",
          message: "Akun Anda tidak aktif. Hubungi customer service.",
        },
        { status: 403 },
      ),
    };
  }

  return { session };
}

/**
 * Set customer auth cookies
 */
export function setCustomerAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken?: string,
) {
  // Set access token (15 minutes)
  response.cookies.set(CUSTOMER_ACCESS_TOKEN_COOKIE, accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: 60 * 15, // 15 minutes
  });

  // Set refresh token if provided (7 days)
  if (refreshToken) {
    response.cookies.set(CUSTOMER_REFRESH_TOKEN_COOKIE, refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
  }

  return response;
}

/**
 * Clear customer auth cookies
 */
export function clearCustomerAuthCookies(response: NextResponse) {
  response.cookies.delete(CUSTOMER_ACCESS_TOKEN_COOKIE);
  response.cookies.delete(CUSTOMER_REFRESH_TOKEN_COOKIE);
  return response;
}

/**
 * Refresh customer access token using refresh token
 */
export async function refreshCustomerToken(request: NextRequest): Promise<{
  accessToken: string;
  session: CustomerSession;
} | null> {
  try {
    const refreshToken = request.cookies.get(
      CUSTOMER_REFRESH_TOKEN_COOKIE,
    )?.value;

    if (!refreshToken) {
      return null;
    }

    // Import here to avoid circular dependency
    const { verifyPelangganRefreshToken } = await import("./jwt");
    const result = await verifyPelangganRefreshToken(refreshToken);

    if (!result.valid) {
      return null;
    }

    // Get fresh customer data
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: result.id },
      select: {
        id: true,
        idPelanggan: true,
        nama: true,
        username: true,
        status: true,
      },
    });

    if (!pelanggan || pelanggan.status !== "AKTIF") {
      return null;
    }

    // Generate new access token
    const accessToken = generatePelangganAccessToken({
      id: pelanggan.id,
      idPelanggan: pelanggan.idPelanggan,
      nama: pelanggan.nama,
      username: pelanggan.username,
      status: pelanggan.status,
    });

    return {
      accessToken,
      session: {
        id: pelanggan.id,
        idPelanggan: pelanggan.idPelanggan,
        nama: pelanggan.nama,
        username: pelanggan.username,
        status: pelanggan.status,
      },
    };
  } catch {
    return null;
  }
}
