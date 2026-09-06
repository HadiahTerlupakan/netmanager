import { MobileWorkOrderActionService } from "@/modules/work-order";
import {
  apiSuccess,
  apiError,
  ErrorCodes,
  ApiErrors,
  createHandler,
} from "@/lib/api";

const service = new MobileWorkOrderActionService();

/**
 * Update mobile work order with action payload.
 */
export const POST = createHandler(
  { auth: true, permissions: ["m_work_order:update"] },
  async (req, ctx) => {
    const user = ctx.session!.user;
    const workOrderId =
      typeof ctx.params.id === "string" ? ctx.params.id.trim() : "";

    if (!workOrderId) {
      return apiError(
        "ID Work Order tidak valid",
        ErrorCodes.VALIDATION_ERROR,
        {
          status: 400,
        },
      );
    }

    let payload: {
      action?: "START" | "CLAIM" | "COMPLETE" | "PAUSE" | "COMMENT" | "NOTE";
      notes?: string;
      photo?: File;
      photos?: File[];
      latitude?: string | number;
      longitude?: string | number;
      locationName?: string;
      photoUrl?: string;
      photoUrls?: string[];
      timestamp?: string;
    } = {};

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      payload = await req.json();
      ctx.validated = payload;
    } else {
      const formData = await req.formData();
      const photo = (formData.get("photo") as File | null) || undefined;
      const photos = formData
        .getAll("photos")
        .filter((item): item is File => item instanceof File);
      payload = {
        action: formData.get("action") as typeof payload.action,
        notes: formData.get("notes") as string,
        photo,
        photos:
          photo && !photos.some((item) => item.name === photo.name)
            ? [...photos, photo]
            : photos,
        latitude: formData.get("latitude") as string,
        longitude: formData.get("longitude") as string,
        locationName: formData.get("locationName") as string,
        timestamp: formData.get("timestamp") as string,
      };
      ctx.validated = {
        action: payload.action,
        notes: payload.notes,
        latitude: payload.latitude,
        longitude: payload.longitude,
        locationName: payload.locationName,
      };
    }

    if (!payload.action) {
      return apiError("Action wajib diisi", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    try {
      await service.handleAction({
        workOrderId,
        tenantId: user.tenantId as string,
        actor: {
          id: user.id,
          name: user.name ?? undefined,
          role: user.role as string | undefined,
          siteId: user.siteId as string | undefined,
          tenantId: user.tenantId as string,
          isSuperAdmin: Boolean(user.isSuperAdmin),
        },
        payload: payload as {
          action: "START" | "CLAIM" | "COMPLETE" | "PAUSE" | "COMMENT" | "NOTE";
          notes?: string;
          photo?: File;
          photos?: File[];
          latitude?: string | number;
          longitude?: string | number;
          locationName?: string;
          photoUrl?: string;
          photoUrls?: string[];
          timestamp?: string;
        },
      });

      return apiSuccess({ message: `Work Order ${payload.action} success` });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Terjadi kesalahan server";

      if (message === "WORK_ORDER_NOT_FOUND") {
        return ApiErrors.notFound("Work Order");
      }

      if (
        message.includes("Akses ditolak") ||
        message.includes("tidak memiliki akses")
      ) {
        return ApiErrors.forbidden(message);
      }

      if (message === "INVALID_ACTION") {
        return apiError("Action tidak valid", ErrorCodes.VALIDATION_ERROR, {
          status: 400,
        });
      }

      if (
        message.includes("wajib") ||
        message.includes("Hanya WO") ||
        message.includes("Tidak dapat memulai WO") ||
        message.includes("Work order tidak dapat diubah")
      ) {
        return apiError(message, ErrorCodes.VALIDATION_ERROR, { status: 400 });
      }

      return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
        status: 500,
      });
    }
  },
);
