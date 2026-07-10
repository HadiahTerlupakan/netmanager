import { v4 as uuidv4 } from "uuid";
import { convertAndSaveImage } from "@/lib/utils/image-upload";
import {
  validateFileSignature,
  validateFileSize,
  type AllowedFileType,
} from "@/lib/utils/file-validation";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const TICKET_UPLOAD_DIRECTORY = "public/uploads/tickets";
const TICKET_STORAGE_CATEGORY = "tickets";

const MIME_TO_SIGNATURE_TYPE: Record<string, AllowedFileType> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const MIME_TO_SIGNATURE_TYPES = Object.keys(MIME_TO_SIGNATURE_TYPE);

const INVALID_TYPE_RESULT = {
  ok: false as const,
  message: "Invalid file type. Only JPG, PNG, WEBP, and GIF are allowed.",
  status: 400,
};

interface SupportTicketUploadDependencies {
  createId?: () => string;
  saveImage?: typeof convertAndSaveImage;
}

export type SupportTicketUploadResult =
  | {
      ok: true;
      data: {
        url: string;
        fileName: string;
        originalName: string;
      };
    }
  | { ok: false; message: string; status: number };

export class SupportTicketUploadService {
  private readonly createId: () => string;
  private readonly saveImage: typeof convertAndSaveImage;

  constructor(dependencies: SupportTicketUploadDependencies = {}) {
    this.createId = dependencies.createId ?? uuidv4;
    this.saveImage = dependencies.saveImage ?? convertAndSaveImage;
  }

  async upload(file: File | null): Promise<SupportTicketUploadResult> {
    const invalidResult = await this.validateFile(file);
    if (invalidResult) return invalidResult;

    const uniqueId = this.createId();
    const publicUrl = await this.saveImage(
      file,
      TICKET_UPLOAD_DIRECTORY,
      uniqueId,
      TICKET_STORAGE_CATEGORY,
    );

    return {
      ok: true,
      data: {
        url: publicUrl,
        fileName: `${uniqueId}.webp`,
        originalName: file.name,
      },
    };
  }

  private async validateFile(
    file: File | null,
  ): Promise<SupportTicketUploadResult | null> {
    if (!file) {
      return { ok: false, message: "No file uploaded", status: 400 };
    }

    if (!MIME_TO_SIGNATURE_TYPES.includes(file.type)) {
      return INVALID_TYPE_RESULT;
    }

    if (!validateFileSize(file, MAX_FILE_SIZE)) {
      return {
        ok: false,
        message: "File size exceeds 5MB limit.",
        status: 400,
      };
    }

    const signatureType = MIME_TO_SIGNATURE_TYPE[file.type]!;
    const signatureValid = await validateFileSignature(file, [signatureType]);
    if (!signatureValid) return INVALID_TYPE_RESULT;

    return null;
  }
}

export const supportTicketUploadService = new SupportTicketUploadService();
