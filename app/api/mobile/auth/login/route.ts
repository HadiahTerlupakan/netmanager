import { NextResponse } from "next/server";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { prismaAuth } from "@/modules/database";
import { prismaMitraAuth } from "@/modules/database";
import { compare } from "bcryptjs";
import {
  getMitraMobileCapabilities,
  signMobileRefreshToken,
  signMobileToken,
} from "@/lib/mobile-auth";
import { getAppVersionService } from "@/modules/app-version";

function parseVersionCode(value: unknown): number {
  const parsed =
    typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // DEBUG LOGGING
    console.log(
      "[MobileAuth] Login Request Body:",
      JSON.stringify(body, null, 2),
    );

    const { email, password, versionCode, loginType } = body;
    const parsedVersionCode = parseVersionCode(versionCode);

    // IMPORTANT: Log what we received to debug why "loginType" might be wrong
    console.log(`[MobileAuth] Parsed: email=${email}, loginType=${loginType}`);

    if (!email || !password) {
      return apiError(
        "Email/Username dan password harus diisi",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    // SMART LOGIN - AUTO DETECT
    // If loginType is provided, try that first.
    // If not found in that table, fallback to the other table SILENTLY.

    const targetType = loginType || "EMPLOYEE"; // Default to EMPLOYEE if undefined

    // Strategy:
    // 1. Try Primary Target (based on tab)
    // 2. If user NOT FOUND, try Secondary Target
    // 3. If user FOUND but password wrong, FAIL (don't try other to prevent ambiguity)

    // ==========================================
    // ATTEMPT 1: Primary Target
    // ==========================================
    if (targetType === "CUSTOMER") {
      // ... Customer Logic ...
      // If not found -> try employee
    } else {
      // ... Employee Logic ...
      // If not found -> try customer
    }

    // Helper Types
    type FailedLoginResult = {
      found: true;
      success: false;
      error?: string;
      status?: number;
      response?: NextResponse;
    };
    type SuccessfulLoginResult = {
      found: true;
      success: true;
      data: Record<string, unknown>;
    };
    type LoginResult =
      | { found: false }
      | FailedLoginResult
      | SuccessfulLoginResult;

    // Helper: Try Login as Customer
    const tryCustomerLogin = async (): Promise<LoginResult> => {
      const customer = await prismaAuth.pelanggan.findFirst({
        where: {
          OR: [
            { username: { equals: email, mode: "insensitive" } },
            { idPelanggan: { equals: email, mode: "insensitive" } },
            { email: { equals: email, mode: "insensitive" } },
          ],
        },
        include: { hargaPaket: true },
      });

      if (!customer) return { found: false };

      // User found, check password
      // Prefer bcrypt hash comparison; fall back to legacy plaintext if hash not yet set
      let isPasswordValid = false;
      if (customer.passwordHash) {
        isPasswordValid = await compare(password, customer.passwordHash);
      } else {
        // Legacy fallback: passwordHash not yet set, compare plaintext
        // TODO: migrate this customer's password to bcrypt hash
        console.warn(
          `[MobileAuth] WARNING: Customer ${customer.id} is using legacy plaintext password. Please migrate to bcrypt hash.`,
        );
        isPasswordValid = customer.password === password;
      }

      if (!isPasswordValid)
        return { found: true, success: false, error: "Password salah" };

      const unsupportedVersionResponse =
        await buildUnsupportedVersionResponse(parsedVersionCode);
      if (unsupportedVersionResponse) {
        return {
          found: true,
          success: false,
          response: unsupportedVersionResponse,
        };
      }

      // Success
      if (parsedVersionCode > 0) {
        await prismaAuth.pelanggan.update({
          where: { id: customer.id },
          data: {
            lastVersionCode: parsedVersionCode,
            lastVersionName: body.versionName || null,
            lastVersionUpdate: new Date(),
          },
        });
      }

      const { generatePelangganAccessToken, generatePelangganRefreshToken } =
        await import("@/lib/jwt");
      const customerVersionMetadata = {
        appVersionCode: parsedVersionCode || undefined,
        appVersionName: body.versionName || null,
      };
      const token = generatePelangganAccessToken(
        {
          id: customer.id,
          idPelanggan: customer.idPelanggan,
          nama: customer.nama,
          username: customer.username,
          status: customer.status,
          tenantId: customer.tenantId,
          ...customerVersionMetadata,
        },
        "7d",
      );
      const refreshToken = await generatePelangganRefreshToken(
        customer.id,
        customerVersionMetadata,
      );

      return {
        found: true,
        success: true,
        data: {
          token,
          refreshToken,
          user: {
            id: customer.id,
            name: customer.nama,
            email: customer.username,
            role: "CUSTOMER",
            isSales: false,
            features: { canvasing: false, attendance: false, workOrder: true },
            memberId: customer.idPelanggan,
            planName: customer.hargaPaket?.name || "Paket Internet",
            address: customer.alamat,
          },
        },
      };
    };

    // Helper: Try Login as Employee
    const tryEmployeeLogin = async (): Promise<LoginResult> => {
      const user = await prismaAuth.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        include: { role: { include: { permission: true } } },
      });

      if (!user) return { found: false };
      if (!user.passwordHash) return { found: false }; // Treat no password as not found/inactive

      const isValid = await compare(password, user.passwordHash);
      if (!isValid)
        return { found: true, success: false, error: "Password salah" };

      // Check Access
      const hasMobileAccess =
        user.role?.accessEmployeePanel || user.role?.name === "SUPER_ADMIN";
      if (!hasMobileAccess)
        return {
          found: true,
          success: false,
          error: "Akun tidak memiliki akses mobile app",
          status: 403,
        };

      const unsupportedVersionResponse =
        await buildUnsupportedVersionResponse(parsedVersionCode);
      if (unsupportedVersionResponse) {
        return {
          found: true,
          success: false,
          response: unsupportedVersionResponse,
        };
      }

      // Update version
      if (parsedVersionCode > 0) {
        await prismaAuth.user.update({
          where: { id: user.id },
          data: {
            lastVersionCode: parsedVersionCode,
            lastVersionName: body.versionName,
            lastVersionUpdate: new Date(),
          },
        });
      }

      const tokenPayload = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role?.name || "USER",
        appVersionCode: parsedVersionCode,
        appVersionName: body.versionName || null,
        tenantId: user.tenantId,
        isSuperAdmin: user.role?.isSuperAdmin ?? false,
      };
      const token = await signMobileToken(tokenPayload);
      const refreshToken = await signMobileRefreshToken(tokenPayload);
      const { getUserFeaturesWithCanvasing } =
        await import("@/modules/marketing");
      const features = await getUserFeaturesWithCanvasing(user.id);

      return {
        found: true,
        success: true,
        data: {
          token,
          refreshToken,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role?.name,
            employeeType: user.employeeType,
            workDays: user.workDays,
            workingHourMode: user.workingHourMode,
            isSales: user.isSales,
            features,
          },
        },
      };
    };

    // Helper: Try Login as Mitra
    const tryMitraLogin = async (): Promise<LoginResult> => {
      const mitra = await prismaMitraAuth.mitra.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
      });

      if (!mitra) return { found: false };
      if (!mitra.passwordHash) return { found: false };
      if (!mitra.isActive)
        return {
          found: true,
          success: false,
          error: "Akun mitra tidak aktif",
          status: 403,
        };

      const isValid = await compare(password, mitra.passwordHash);
      if (!isValid)
        return { found: true, success: false, error: "Password salah" };

      const unsupportedVersionResponse =
        await buildUnsupportedVersionResponse(parsedVersionCode);
      if (unsupportedVersionResponse) {
        return {
          found: true,
          success: false,
          response: unsupportedVersionResponse,
        };
      }

      const tokenPayload = {
        id: mitra.id,
        email: mitra.email,
        name: mitra.name,
        role: "MITRA",
        mitraType: mitra.mitraType,
        appVersionCode: parsedVersionCode,
        appVersionName: body.versionName || null,
        tenantId: mitra.tenantId,
      };
      const token = await signMobileToken(tokenPayload);
      const refreshToken = await signMobileRefreshToken(tokenPayload);

      const { features } = getMitraMobileCapabilities(mitra.mitraType);

      return {
        found: true,
        success: true,
        data: {
          token,
          refreshToken,
          user: {
            id: mitra.id,
            name: mitra.name,
            email: mitra.email,
            role: "MITRA",
            employeeType: mitra.mitraType,
            isSales: mitra.mitraType === "MITRA_SALES",
            features,
          },
        },
      };
    };

    // EXECUTION FLOW
    let result: LoginResult;

    if (targetType === "MITRA") {
      result = await tryMitraLogin();
      if (!result.found) {
        const empResult = await tryEmployeeLogin();
        if (empResult.found) {
          result = empResult;
        } else {
          const custResult = await tryCustomerLogin();
          if (custResult.found) result = custResult;
        }
      }
    } else if (targetType === "CUSTOMER") {
      result = await tryCustomerLogin();
      if (!result.found) {
        const empResult = await tryEmployeeLogin();
        if (empResult.found) {
          result = empResult;
        } else {
          const mitraResult = await tryMitraLogin();
          if (mitraResult.found) result = mitraResult;
        }
      }
    } else {
      result = await tryEmployeeLogin();
      if (!result.found) {
        const mitraResult = await tryMitraLogin();
        if (mitraResult.found) {
          result = mitraResult;
        } else {
          const custResult = await tryCustomerLogin();
          if (custResult.found) result = custResult;
        }
      }
    }

    // Final Response Handler
    if (!result.found) {
      return apiError("Email/ID tidak ditemukan", ErrorCodes.UNAUTHORIZED, {
        status: 401,
      });
    }

    if (!result.success) {
      const failedResult = result as FailedLoginResult;
      if (failedResult.response) {
        return failedResult.response;
      }
      return apiError(
        failedResult.error ?? "Login gagal",
        ErrorCodes.UNAUTHORIZED,
        { status: failedResult.status || 401 },
      );
    }

    return NextResponse.json({
      success: true,
      ...result.data,
    });
  } catch (error) {
    console.error("Mobile Login Error:", error);
    return apiError(
      "Terjadi kesalahan server. Silakan coba lagi.",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }
}
