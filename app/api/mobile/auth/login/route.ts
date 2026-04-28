import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

import { apiError, ErrorCodes } from "@/lib/api-response";
import { getAppVersionService } from "@/modules/app-version";
import {
  tryMobileCustomerLogin,
  tryMobileEmployeeLogin,
} from "@/modules/users";
import { tryMobileMitraLogin } from "@/modules/mitra";

/** Menangani login mobile untuk employee, customer, dan mitra. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = body.email;
    const password = body.password;
    const versionCode = parseVersionCode(body.versionCode);
    const versionName = body.versionName || null;
    const loginType = body.loginType || "EMPLOYEE";

    if (!email || !password) {
      return apiError(
        "Email/Username dan password harus diisi",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    const unsupportedResponse =
      await buildUnsupportedVersionResponse(versionCode);
    if (unsupportedResponse) {
      return unsupportedResponse;
    }

    const result = await resolveLoginResult({
      email,
      password,
      versionCode,
      versionName,
      loginType,
    });
    if (!result.found) {
      return apiError("Email/ID tidak ditemukan", ErrorCodes.UNAUTHORIZED, {
        status: 401,
      });
    }

    if (result.success === false) {
      if (result.response) {
        return result.response;
      }

      return apiError(result.error ?? "Login gagal", ErrorCodes.UNAUTHORIZED, {
        status: result.status || 401,
      });
    }

    return NextResponse.json({ success: true, ...result.data });
  } catch (error) {
    logger.error("Mobile Login Error:", error);
    return apiError(
      "Terjadi kesalahan server. Silakan coba lagi.",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }
}

function parseVersionCode(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

async function buildUnsupportedVersionResponse(versionCode: number) {
  const versionAccess =
    await getAppVersionService().evaluateVersionAccess(versionCode);
  if (versionAccess.isSupported) {
    return null;
  }

  return apiError(
    "Aplikasi harus diperbarui untuk melanjutkan.",
    ErrorCodes.APP_VERSION_UNSUPPORTED,
    {
      status: 426,
      details: {
        currentVersionCode: versionCode,
        minimumVersion: versionAccess.minimumVersion,
        latestVersion: versionAccess.latestVersion,
        isForceUpdate: versionAccess.isForceUpdate,
        updateAvailable: versionAccess.updateAvailable,
      },
    },
  );
}

async function resolveLoginResult(input: {
  email: string;
  password: string;
  versionCode: number;
  versionName?: string | null;
  loginType: string;
}) {
  if (input.loginType === "MITRA") {
    return tryPriorityLogins(
      [tryMobileMitraLogin, tryMobileEmployeeLogin, tryMobileCustomerLogin],
      input,
    );
  }

  if (input.loginType === "CUSTOMER") {
    return tryPriorityLogins(
      [tryMobileCustomerLogin, tryMobileEmployeeLogin, tryMobileMitraLogin],
      input,
    );
  }

  return tryPriorityLogins(
    [tryMobileEmployeeLogin, tryMobileMitraLogin, tryMobileCustomerLogin],
    input,
  );
}

type MobileLoginHandlerResult =
  | { found: false }
  | {
      found: true;
      success: false;
      error?: string;
      status?: number;
      response?: NextResponse;
    }
  | { found: true; success: true; data: Record<string, unknown> };

type MobileLoginHandlerInput = {
  email: string;
  password: string;
  versionCode: number;
  versionName?: string | null;
};

async function tryPriorityLogins(
  loginHandlers: Array<
    (input: MobileLoginHandlerInput) => Promise<MobileLoginHandlerResult>
  >,
  input: MobileLoginHandlerInput,
) {
  for (const loginHandler of loginHandlers) {
    const result = await loginHandler(input);
    if (result.found) {
      return result;
    }
  }

  return { found: false as const };
}
