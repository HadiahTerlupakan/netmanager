import { prisma } from "@/modules/database";
import { prismaMitra } from "@/modules/database";
import {
  WorkOrderRepository,
  validateMobileAssignedWorkOrderAccess,
  syncWoStatusToTicket,
} from "@/modules/work-order";
import { convertAndSaveImage } from "@/lib/utils/image-upload";
import { format } from "date-fns";
import { notifyAdminsAboutMobileAction } from "@/modules/notification";
import { logger } from "@/lib/logger";
import {
  apiSuccess,
  apiError,
  ApiErrors,
  ErrorCodes,
  createHandler,
} from "@/lib/api";

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const tenantId = user.tenantId as string;
  const userId = user.id;
  const workOrderId =
    typeof ctx.params.id === "string" ? ctx.params.id.trim() : "";
  const repository = new WorkOrderRepository(prisma);

  if (!workOrderId) {
    return apiError("ID Work Order tidak valid", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });
  }

  // Fetch User to get Name (for notifications)
  const dbUser = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: { name: true },
  });

  // Mitra users use null for FKs to user table
  const userIdForDb = dbUser ? userId : undefined;

  const workOrder = await repository.findById(workOrderId);

  if (!workOrder) return ApiErrors.notFound("Work Order tidak ditemukan");

  const mobileUserContext = {
    id: userId,
    name: user.name ?? undefined,
    role: user.role as string | undefined,
    permissions: [] as string[],
    siteId: user.siteId as string | undefined,
    tenantId: user.tenantId as string | undefined,
    isSuperAdmin: Boolean(user.isSuperAdmin),
  };

  let action: string | undefined;
  let notes: string | undefined;
  let photo: File | undefined;
  let photos: File[] = [];
  let latitude: string | number | undefined;
  let longitude: string | number | undefined;
  let locationName: string | undefined;
  let photoUrl: string | undefined;
  let photoUrls: string[] | undefined;
  let timestampStr: string | undefined;

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await req.json();
    action = body.action;
    notes = body.notes;
    latitude = body.latitude;
    longitude = body.longitude;
    locationName = body.locationName;
    photoUrl = body.photoUrl;
    photoUrls = body.photoUrls;
    timestampStr = body.timestamp;
    ctx.validated = body; // Sync for audit log
  } else {
    const formData = await req.formData();
    action = formData.get("action") as string;
    notes = formData.get("notes") as string;
    photo = (formData.get("photo") as File | null) || undefined;
    latitude = formData.get("latitude") as string;
    longitude = formData.get("longitude") as string;
    locationName = formData.get("locationName") as string;
    timestampStr = formData.get("timestamp") as string;

    const photosFromForm = formData.getAll("photos") as File[];
    photos = photosFromForm.filter((p) => p instanceof File);
    if (photo instanceof File && !photos.some((p) => p.name === photo!.name)) {
      photos.push(photo);
    }

    ctx.validated = { action, notes, latitude, longitude, locationName }; // Minimal sync for audit
  }

  if (!action)
    return apiError("Action wajib diisi", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });

  const allowedStatuses =
    action === "CLAIM"
      ? ["PENDING"]
      : ["ASSIGNED", "IN_PROGRESS", "ON_HOLD", "COMPLETED"];
  const invalidStatusMessage =
    action === "CLAIM"
      ? "Hanya WO berstatus PENDING yang dapat diklaim"
      : "Work order tidak dapat diubah pada status ini";

  try {
    await validateMobileAssignedWorkOrderAccess({
      repository,
      workOrderId,
      userContext: mobileUserContext,
      allowedStatuses,
      invalidStatusMessage,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan server";
    if (message.includes("tidak ditemukan")) {
      return ApiErrors.notFound("Work Order tidak ditemukan");
    }
    if (
      message.includes("Akses ditolak") ||
      message.includes("tidak memiliki akses")
    ) {
      return ApiErrors.forbidden(message);
    }
    return apiError(message, ErrorCodes.VALIDATION_ERROR, { status: 400 });
  }

  let locationStr = "Loc: Unknown";
  const coords =
    latitude && longitude
      ? `(${String(latitude).slice(0, 8)}, ${String(longitude).slice(0, 8)})`
      : "";
  if (locationName && coords) locationStr = `${locationName} ${coords}`;
  else if (locationName) locationStr = locationName;
  else if (coords) locationStr = `Loc: ${coords}`;

  const timestamp = timestampStr ? new Date(timestampStr) : undefined;
  const ticketNumber =
    workOrder.ticket?.ticketNumber || workOrder.workOrderNumber || workOrderId;

  // Actions Logic
  if (action === "START") {
    if (!["ASSIGNED", "ON_HOLD"].includes(workOrder.status)) {
      return apiError(
        `Tidak dapat memulai WO dengan status: ${workOrder.status}`,
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }
    await repository.start(workOrderId, userIdForDb, timestamp);
    await syncWoStatusToTicket(workOrderId, "IN_PROGRESS");
    if (notes)
      await repository.addUpdate({
        workOrderId,
        updateType: "NOTE",
        message: notes,
        createdById: userIdForDb,
      });
  } else if (action === "CLAIM") {
    if (workOrder.status !== "PENDING")
      return apiError(
        "Hanya WO berstatus PENDING yang dapat diklaim",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    await repository.assign(workOrderId, userId, "Lead", userId);
  } else if (action === "COMPLETE") {
    if (workOrder.status !== "IN_PROGRESS")
      return apiError(
        "Hanya WO berstatus IN_PROGRESS yang dapat diselesaikan",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );

    if (photoUrls && Array.isArray(photoUrls) && photoUrls.length > 0) {
      for (let i = 0; i < photoUrls.length; i++) {
        if (!photoUrls[i]) continue;
        await repository.addAttachment(
          workOrderId,
          `photo_${i}.jpg`,
          photoUrls[i],
          0,
          "image/jpeg",
          `[COMPLETION] Bukti Penyelesaian ${i + 1}`,
          userIdForDb,
        );
      }
    } else if (photos.length > 0) {
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        if (!(p instanceof File)) continue;
        const watermarkLines = [
          format(new Date(), "dd MMM yyyy HH:mm"),
          `#${ticketNumber}`,
          `Tech: ${dbUser?.name || user.name || "Unknown"}`,
          locationStr,
          `[COMPLETED] ${i + 1}/${photos.length}`,
        ];
        const dateStr = format(new Date(), "yyyy-MM-dd");
        const filePath = await convertAndSaveImage(
          p,
          `public/uploads/workorders/${dateStr}`,
          `${workOrderId}_complete_${Date.now()}_${i}`,
          "workorder-completion",
          workOrderId,
          watermarkLines,
        );
        await repository.addAttachment(
          workOrderId,
          p.name,
          filePath,
          p.size,
          p.type,
          `[COMPLETION] Bukti Penyelesaian ${i + 1}`,
          userIdForDb,
        );
      }
    }
    await repository.complete(workOrderId, notes, userIdForDb, timestamp);
    await syncWoStatusToTicket(workOrderId, "COMPLETED");

    // Mitra Commission
    try {
      const mitra = await prismaMitra.mitra.findUnique({
        where: { id: userId },
        select: {
          mitraType: true,
          mitraRateWoPsb: true,
          mitraRateWoMaintenance: true,
        },
      });
      if (mitra?.mitraType === "MITRA_TEKNISI") {
        const { getMitraWalletService } = await import("@/modules/mitra");
        const walletService = getMitraWalletService();
        if (workOrder.isWarranty && workOrder.warrantyOwnerId) {
          if (workOrder.warrantyOwnerId === userId) {
            await walletService.addEarning(
              userId,
              0,
              `Pengerjaan Garansi Mandiri #${ticketNumber}`,
              workOrderId,
              "WORK_ORDER",
            );
          } else {
            const rate =
              (workOrder.type === "INSTALLATION"
                ? mitra.mitraRateWoPsb
                : mitra.mitraRateWoMaintenance) || 0;
            if (rate > 0)
              await walletService.addEarning(
                userId,
                rate,
                `Komisi WO #${ticketNumber} (${workOrder.type}) - Lelang Garansi`,
                workOrderId,
                "WORK_ORDER",
              );
            const originalOwner = await prismaMitra.mitra.findUnique({
              where: { id: workOrder.warrantyOwnerId },
              select: { penaltyPsb: true },
            });
            await walletService.deductBalance(
              workOrder.warrantyOwnerId,
              originalOwner?.penaltyPsb || 50000,
              `Denda Garansi SLA #${ticketNumber}`,
              workOrderId,
              "WORK_ORDER",
            );
          }
        } else {
          const rate =
            (workOrder.type === "INSTALLATION"
              ? mitra.mitraRateWoPsb
              : mitra.mitraRateWoMaintenance) || 0;
          if (rate > 0)
            await walletService.addEarning(
              userId,
              rate,
              `Komisi WO #${ticketNumber} (${workOrder.type})`,
              workOrderId,
              "WORK_ORDER",
            );
        }
      }
    } catch (e) {
      logger.error("[MitraCommission] Error:", e as Error);
    }
  } else if (action === "PAUSE") {
    if (workOrder.status !== "IN_PROGRESS")
      return apiError(
        "Hanya WO berstatus IN_PROGRESS yang dapat ditunda",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    await repository.updateStatus(
      workOrderId,
      "ON_HOLD",
      userIdForDb,
      timestamp,
    );
    await syncWoStatusToTicket(workOrderId, "ON_HOLD");
    if (notes)
      await repository.addUpdate({
        workOrderId,
        updateType: "NOTE",
        message: `Work Order Paused: ${notes}`,
        createdById: userIdForDb,
      });
  } else if (action === "COMMENT" || action === "NOTE") {
    if (!notes && !photo && !photoUrl)
      return apiError(
        "Catatan atau foto wajib diisi",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    if (photoUrl) {
      await repository.addAttachment(
        workOrderId,
        `photo_${action}.jpg`,
        photoUrl,
        0,
        "image/jpeg",
        notes || "Update Foto",
        userIdForDb,
      );
    } else if (photo instanceof File) {
      const watermarkLines = [
        format(new Date(), "dd MMM yyyy HH:mm"),
        `#${ticketNumber}`,
        `Tech: ${dbUser?.name || user.name || "Unknown"}`,
        locationStr,
      ];
      const dateStr = format(new Date(), "yyyy-MM-dd");
      const filePath = await convertAndSaveImage(
        photo,
        `public/uploads/workorders/${dateStr}`,
        `${workOrderId}_${action.toLowerCase()}_${Date.now()}`,
        "workorder-completion",
        workOrderId,
        watermarkLines,
      );
      await repository.addAttachment(
        workOrderId,
        photo.name,
        filePath,
        photo.size,
        photo.type,
        notes || "Update Foto",
        userIdForDb,
      );
    }
    await repository.addUpdate({
      workOrderId,
      updateType: action as
        | "STATUS_CHANGE"
        | "PROGRESS_UPDATE"
        | "NOTE"
        | "PHOTO"
        | "COMMENT",
      message: notes || (photo || photoUrl ? "Mengunggah foto" : ""),
      createdById: userIdForDb,
    });
  } else {
    return apiError("Action tidak valid", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });
  }

  // Notify Admins
  await notifyAdminsAboutMobileAction({
    workOrderId,
    workOrderNumber: workOrder.workOrderNumber,
    title: workOrder.title,
    actionType: action as
      | "START"
      | "COMPLETE"
      | "PAUSE"
      | "CLAIM"
      | "NOTE"
      | "COMMENT",
    actionMessage: `${action} Work Order: ${notes || ""}`,
    triggeredByUserId: userId,
    triggeredByName: dbUser?.name || user.name || "Unknown",
    ...(workOrder.departmentId && { departmentId: workOrder.departmentId }),
    ...(workOrder.siteId && { siteId: workOrder.siteId }),
  });

  return apiSuccess({ message: `Work Order ${action} success` });
});
