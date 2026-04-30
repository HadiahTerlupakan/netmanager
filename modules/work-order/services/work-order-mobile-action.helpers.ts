import { format } from "date-fns";
import { convertAndSaveImage } from "@/lib/utils/image-upload";
import type { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import type {
  MobileActionContext,
  MobileActionPayload,
  WorkOrderActionExecutionInput,
} from "./work-order-mobile-action.types";

const MAX_COORDINATE_LENGTH = 8;
const DEFAULT_IMAGE_TYPE = "image/jpeg";
const WORK_ORDER_UPLOAD_DIRECTORY = "public/uploads/workorders";
const WORK_ORDER_IMAGE_PURPOSE = "workorder-completion";

/** Bangun konteks aksi mobile yang dipakai lintas flow. */
export function buildActionContext(input: {
  actorName: string;
  payload: MobileActionPayload;
  ticketNumber: string;
  workOrderId: string;
}): MobileActionContext {
  return {
    actorName: input.actorName,
    timestamp: input.payload.timestamp
      ? new Date(input.payload.timestamp)
      : undefined,
    locationLabel: buildLocationLabel(input.payload),
    ticketNumber: input.ticketNumber,
    workOrderId: input.workOrderId,
  };
}

/** Pastikan payload catatan minimal punya note atau foto. */
export function ensureNotePayload(payload: MobileActionPayload) {
  if (payload.notes || payload.photo || payload.photoUrl) {
    return;
  }

  throw new Error("Catatan atau foto wajib diisi");
}

/** Ambil pesan default bila note kosong namun ada foto. */
export function getDefaultNoteMessage(payload: MobileActionPayload) {
  return payload.photo || payload.photoUrl ? "Mengunggah foto" : "";
}

/** Validasi status work order berdasarkan daftar status yang diizinkan. */
export function ensureWorkOrderStatus(
  status: string | undefined,
  allowed: string[],
  message: string,
) {
  if (status && allowed.includes(status)) {
    return;
  }

  if (message === "Hanya WO berstatus IN_PROGRESS yang dapat diselesaikan") {
    throw new Error(message);
  }

  throw new Error(`${message}: ${status}`);
}

/** Simpan seluruh lampiran penyelesaian work order. */
export async function storeCompletionAttachments(input: {
  actionInput: WorkOrderActionExecutionInput;
  repository: WorkOrderRepository;
}) {
  const remoteUrls = input.actionInput.input.payload.photoUrls || [];
  if (remoteUrls.length > 0) {
    await storeRemoteCompletionAttachments({
      workOrderId: input.actionInput.input.workOrderId,
      photoUrls: remoteUrls,
      repository: input.repository,
      userIdForDb: input.actionInput.userIdForDb,
    });
    return;
  }

  const files = input.actionInput.input.payload.photos || [];
  if (files.length === 0) {
    return;
  }

  await storeLocalCompletionAttachments({
    actionInput: input.actionInput,
    files,
    repository: input.repository,
  });
}

/** Simpan satu lampiran foto untuk comment atau note. */
export async function storeSingleAttachment(input: {
  actionInput: Pick<
    WorkOrderActionExecutionInput,
    "input" | "actionContext" | "userIdForDb"
  >;
  repository: WorkOrderRepository;
}) {
  if (input.actionInput.input.payload.photoUrl) {
    await input.repository.addAttachment(
      input.actionInput.input.workOrderId,
      `photo_${input.actionInput.input.payload.action}.jpg`,
      input.actionInput.input.payload.photoUrl,
      0,
      DEFAULT_IMAGE_TYPE,
      input.actionInput.input.payload.notes || "Update Foto",
      input.actionInput.userIdForDb,
    );
    return;
  }

  if (!(input.actionInput.input.payload.photo instanceof File)) {
    return;
  }

  await storeLocalSingleAttachment(input);
}

async function storeLocalSingleAttachment(input: {
  actionInput: Pick<
    WorkOrderActionExecutionInput,
    "input" | "actionContext" | "userIdForDb"
  >;
  repository: WorkOrderRepository;
}) {
  const photo = input.actionInput.input.payload.photo as File;
  const filePath = await saveWorkOrderImage({
    file: photo,
    fileName: createSingleAttachmentFileName(input.actionInput),
    workOrderId: input.actionInput.input.workOrderId,
    watermarkLines: createSingleAttachmentWatermark(input.actionInput),
  });

  await input.repository.addAttachment(
    input.actionInput.input.workOrderId,
    photo.name,
    filePath,
    photo.size,
    photo.type,
    input.actionInput.input.payload.notes || "Update Foto",
    input.actionInput.userIdForDb,
  );
}

function createSingleAttachmentFileName(
  actionInput: Pick<WorkOrderActionExecutionInput, "input">,
) {
  return `${actionInput.input.workOrderId}_${actionInput.input.payload.action.toLowerCase()}_${Date.now()}`;
}

function createSingleAttachmentWatermark(
  actionInput: Pick<WorkOrderActionExecutionInput, "actionContext">,
) {
  return [
    format(new Date(), "dd MMM yyyy HH:mm"),
    `#${actionInput.actionContext.ticketNumber}`,
    `Tech: ${actionInput.actionContext.actorName}`,
    actionInput.actionContext.locationLabel,
  ];
}

function buildLocationLabel(payload: MobileActionPayload) {
  const coords = buildCoordinateLabel(payload.latitude, payload.longitude);
  if (payload.locationName && coords) {
    return `${payload.locationName} ${coords}`;
  }

  if (payload.locationName) {
    return payload.locationName;
  }

  return coords ? `Loc: ${coords}` : "Loc: Unknown";
}

function buildCoordinateLabel(
  latitude?: string | number,
  longitude?: string | number,
) {
  if (!latitude || !longitude) {
    return "";
  }

  const lat = String(latitude).slice(0, MAX_COORDINATE_LENGTH);
  const lng = String(longitude).slice(0, MAX_COORDINATE_LENGTH);
  return `(${lat}, ${lng})`;
}

async function storeRemoteCompletionAttachments(input: {
  workOrderId: string;
  photoUrls: string[];
  repository: WorkOrderRepository;
  userIdForDb?: string;
}) {
  await Promise.all(
    input.photoUrls
      .filter(Boolean)
      .map((photoUrl, index) =>
        input.repository.addAttachment(
          input.workOrderId,
          `photo_${index}.jpg`,
          photoUrl,
          0,
          DEFAULT_IMAGE_TYPE,
          `[COMPLETION] Bukti Penyelesaian ${index + 1}`,
          input.userIdForDb,
        ),
      ),
  );
}

async function storeLocalCompletionAttachments(input: {
  actionInput: WorkOrderActionExecutionInput;
  files: File[];
  repository: WorkOrderRepository;
}) {
  for (const [index, file] of input.files.entries()) {
    const filePath = await saveWorkOrderImage({
      file,
      fileName: `${input.actionInput.input.workOrderId}_complete_${Date.now()}_${index}`,
      workOrderId: input.actionInput.input.workOrderId,
      watermarkLines: buildCompletionWatermark(
        input.actionInput.actionContext,
        index,
        input.files.length,
      ),
    });

    await input.repository.addAttachment(
      input.actionInput.input.workOrderId,
      file.name,
      filePath,
      file.size,
      file.type,
      `[COMPLETION] Bukti Penyelesaian ${index + 1}`,
      input.actionInput.userIdForDb,
    );
  }
}

function buildCompletionWatermark(
  actionContext: MobileActionContext,
  index: number,
  totalFiles: number,
) {
  return [
    format(new Date(), "dd MMM yyyy HH:mm"),
    `#${actionContext.ticketNumber}`,
    `Tech: ${actionContext.actorName}`,
    actionContext.locationLabel,
    `[COMPLETED] ${index + 1}/${totalFiles}`,
  ];
}

async function saveWorkOrderImage(input: {
  file: File;
  fileName: string;
  workOrderId: string;
  watermarkLines: string[];
}) {
  const dateFolder = format(new Date(), "yyyy-MM-dd");
  return convertAndSaveImage(
    input.file,
    `${WORK_ORDER_UPLOAD_DIRECTORY}/${dateFolder}`,
    input.fileName,
    WORK_ORDER_IMAGE_PURPOSE,
    input.workOrderId,
    input.watermarkLines,
  );
}
