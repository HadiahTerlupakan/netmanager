import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";
import {
  getWorkOrderService,
  adminWorkOrderRouteService,
} from "@/modules/work-order";
import { logActivitySafe } from "@/lib/logger";

/** POST /api/admin/workorders/[id]/attachments */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("list:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menambah attachment",
    );
  }

  const body = await req.json();
  const { fileName, filePath, fileType, caption, fileSize } = body;

  if (!fileName || !filePath || !fileType) {
    return apiError(
      "fileName, filePath, dan fileType wajib diisi",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  const userContext = await adminWorkOrderRouteService.getUserContext(
    ctx.session!.user,
    ctx.permissions,
  );

  if (!userContext) {
    return ApiErrors.unauthorized();
  }

  const result = await getWorkOrderService().addAttachment(
    ctx.params.id,
    {
      fileName,
      filePath,
      fileType,
      fileSize: fileSize || 0,
      caption,
    },
    userContext,
  );

  if (!result.success) {
    return apiError(
      result.error || "Gagal menambah attachment",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  logActivitySafe({
    action: "UPDATE",
    subject: "Work Order",
    userId: ctx.session!.user.id,
    details: {
      workOrderId: ctx.params.id,
      type: "ATTACHMENT_UPLOAD",
      fileName,
    },
  });

  return apiSuccess(result.data, {
    message: "Attachment berhasil ditambahkan",
  });
});
