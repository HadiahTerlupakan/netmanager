import { NextRequest } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { getMitraMobileCapabilities } from "@/lib/mobile-auth";
import { UserRepository } from "@/modules/users";
import { prismaMitra } from "@/modules/database";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(req);
    if (authResult instanceof Response) return authResult;

    const session = authResult;

    // Handle Mitra users - they are in a separate table
    if (session.role === "MITRA") {
      const mitra = await prismaMitra.mitra.findUnique({
        where: { id: session.id },
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          mitraType: true,
          phone: true,
          siteId: true,
        },
      });

      if (!mitra) return ApiErrors.notFound("Mitra tidak ditemukan");
      if (!mitra.isActive)
        return ApiErrors.forbidden("Akun Mitra Anda tidak aktif");

      const { features } = getMitraMobileCapabilities(mitra.mitraType);

      const userData: {
        id: string;
        name: string;
        email: string;
        role: string;
        features: string[];
        employeeType: string;
        isSales: boolean;
        image: string | null;
        workDays: string[];
        workingHourMode: string;
        isOnLeave: boolean;
      } = {
        id: mitra.id,
        name: mitra.name,
        email: mitra.email,
        role: "MITRA",
        features,
        employeeType: mitra.mitraType,
        isSales: mitra.mitraType === "MITRA_SALES",
        image: null,
        workDays: [],
        workingHourMode: "FLEXIBLE",
        isOnLeave: false,
      };

      return apiSuccess(userData);
    }

    // Handle regular User (Karyawan)
    const userRepo = new UserRepository();
    const user = await userRepo.findById(session.id);

    if (!user) return ApiErrors.notFound("User tidak ditemukan");
    // Check isActive flag instead of status string
    if (user.isActive === false)
      return ApiErrors.forbidden("Akun Anda tidak aktif");

    const { getUserFeaturesWithCanvasing } =
      await import("@/modules/marketing");
    const features = await getUserFeaturesWithCanvasing(session.id);

    // Format response matching the mobile app's User type expectations
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: session.role,
      features,
      employeeType:
        (user as unknown as { employeeType?: string }).employeeType ||
        "KARYAWAN",
      isSales: session.role?.toUpperCase().includes("SALES") ?? false,
      image: user.image,
      // These fields are not in UserPublic/findById select, use defaults for mobile API
      workDays: [] as string[],
      workingHourMode: "FLEXIBLE",
      isOnLeave: false,
    };

    return apiSuccess(userData);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Gagal mengambil profile";
    return ApiErrors.internalError(message);
  }
}
