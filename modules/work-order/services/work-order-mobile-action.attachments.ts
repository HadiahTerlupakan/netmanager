import { format } from "date-fns";
import { convertAndSaveImage } from "@/lib/utils/image-upload";
import type { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import type {
  MobileActionContext,
  WorkOrderActionExecutionInput,
} from "./work-order-mobile-action.types";

const DEFAULT_IMAGE_TYPE = "image/jpeg";
const WORK_ORDER_UPLOAD_DIRECTORY = "public/uploads/workorders";
const WORK_ORDER_IMAGE_PURPOSE = "workorder-completion";
const COMPLETION_ATTACHMENT_PREFIX = "[COMPLETION] Bukti Penyelesaian";

export async function storeCompletionAttachments(input: {
  actionInput: WorkOrderActionExecutionInput;
  repository: WorkOrderRepository;
}) {
  const remoteUrls = getRemoteCompletionPhotoUrls(input.actionInput);
  if (remoteUrls.length > 0) {
    await storeRemoteCompletionAttachments({
      workOrderId: input.actionInput.input.workOrderId,
      photoUrls: remoteUrls,
      repository: input.repository,
      userIdForDb: input.actionInput.userIdForDb,
    });
    return;
  }

  await storeLocalCompletionAttachmentsIfNeeded(input);
}

async function storeLocalCompletionAttachmentsIfNeeded(input: {
  actionInput: WorkOrderActionExecutionInput;
  repository: WorkOrderRepository;
}) {
  const files = getLocalCompletionPhotos(input.actionInput);
  if (files.length === 0) {
    return;
  }

  await storeLocalCompletionAttachments({
    actionInput: input.actionInput,
    files,
    repository: input.repository,
  });
}

function getRemoteCompletionPhotoUrls(
  actionInput: WorkOrderActionExecutionInput,
) {
  return actionInput.input.payload.photoUrls || [];
}

function getLocalCompletionPhotos(actionInput: WorkOrderActionExecutionInput) {
  return actionInput.input.payload.photos || [];
}

export async function storeSingleAttachment(input: {
  actionInput: Pick<
    WorkOrderActionExecutionInput,
    "input" | "actionContext" | "userIdForDb"
  >;
  repository: WorkOrderRepository;
}) {
  const remotePhotoUrl = input.actionInput.input.payload.photoUrl;
  if (remotePhotoUrl) {
    await input.repository.addAttachment(
      ...buildRemoteSingleAttachmentArgs(input.actionInput, remotePhotoUrl),
    );
    return;
  }

  if (input.actionInput.input.payload.photo instanceof File) {
    await storeLocalSingleAttachment(input);
  }
}

function buildRemoteSingleAttachmentArgs(
  actionInput: Pick<WorkOrderActionExecutionInput, "input" | "userIdForDb">,
  photoUrl: string,
): Parameters<WorkOrderRepository["addAttachment"]> {
  return [
    actionInput.input.workOrderId,
    `photo_${actionInput.input.payload.action}.jpg`,
    photoUrl,
    0,
    DEFAULT_IMAGE_TYPE,
    actionInput.input.payload.notes || "Update Foto",
    actionInput.userIdForDb,
  ];
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
    ...buildLocalSingleAttachmentArgs(input.actionInput, photo, filePath),
  );
}

function buildLocalSingleAttachmentArgs(
  actionInput: Pick<WorkOrderActionExecutionInput, "input" | "userIdForDb">,
  photo: File,
  filePath: string,
): Parameters<WorkOrderRepository["addAttachment"]> {
  return [
    actionInput.input.workOrderId,
    photo.name,
    filePath,
    photo.size,
    photo.type,
    actionInput.input.payload.notes || "Update Foto",
    actionInput.userIdForDb,
  ];
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

async function storeRemoteCompletionAttachments(input: {
  workOrderId: string;
  photoUrls: string[];
  repository: WorkOrderRepository;
  userIdForDb?: string;
}) {
  const attachmentTasks = input.photoUrls
    .filter(Boolean)
    .map((photoUrl, index) =>
      input.repository.addAttachment(
        ...buildRemoteCompletionAttachmentArgs(input, photoUrl, index),
      ),
    );

  await Promise.all(attachmentTasks);
}

function buildRemoteCompletionAttachmentArgs(
  input: {
    workOrderId: string;
    userIdForDb?: string;
  },
  photoUrl: string,
  index: number,
): Parameters<WorkOrderRepository["addAttachment"]> {
  return [
    input.workOrderId,
    `photo_${index}.jpg`,
    photoUrl,
    0,
    DEFAULT_IMAGE_TYPE,
    createCompletionAttachmentDescription(index),
    input.userIdForDb,
  ];
}

function createCompletionAttachmentDescription(index: number) {
  return `${COMPLETION_ATTACHMENT_PREFIX} ${index + 1}`;
}

async function storeLocalCompletionAttachments(input: {
  actionInput: WorkOrderActionExecutionInput;
  files: File[];
  repository: WorkOrderRepository;
}) {
  for (const [index, file] of input.files.entries()) {
    await storeLocalCompletionAttachment({
      actionInput: input.actionInput,
      file,
      index,
      totalFiles: input.files.length,
      repository: input.repository,
    });
  }
}

async function storeLocalCompletionAttachment(input: {
  actionInput: WorkOrderActionExecutionInput;
  file: File;
  index: number;
  totalFiles: number;
  repository: WorkOrderRepository;
}) {
  const filePath = await saveLocalCompletionAttachmentImage(input);
  await input.repository.addAttachment(
    ...buildCompletionAttachmentArgs(
      input.actionInput,
      input.file,
      filePath,
      input.index,
    ),
  );
}

async function saveLocalCompletionAttachmentImage(input: {
  actionInput: WorkOrderActionExecutionInput;
  file: File;
  index: number;
  totalFiles: number;
}) {
  return saveWorkOrderImage({
    file: input.file,
    fileName: createCompletionAttachmentFileName(
      input.actionInput,
      input.index,
    ),
    workOrderId: input.actionInput.input.workOrderId,
    watermarkLines: buildCompletionWatermark(
      input.actionInput.actionContext,
      input.index,
      input.totalFiles,
    ),
  });
}

function createCompletionAttachmentFileName(
  actionInput: WorkOrderActionExecutionInput,
  index: number,
) {
  return `${actionInput.input.workOrderId}_complete_${Date.now()}_${index}`;
}

function buildCompletionAttachmentArgs(
  actionInput: WorkOrderActionExecutionInput,
  file: File,
  filePath: string,
  index: number,
): Parameters<WorkOrderRepository["addAttachment"]> {
  return [
    actionInput.input.workOrderId,
    file.name,
    filePath,
    file.size,
    file.type,
    createCompletionAttachmentDescription(index),
    actionInput.userIdForDb,
  ];
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
