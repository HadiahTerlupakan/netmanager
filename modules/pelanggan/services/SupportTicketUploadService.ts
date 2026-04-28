import { v4 as uuidv4 } from "uuid";
import { convertAndSaveImage } from "@/lib/utils/image-upload";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const TICKET_UPLOAD_DIRECTORY = "public/uploads/tickets";
const TICKET_STORAGE_CATEGORY = "tickets";
const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

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

  /** Validasi dan simpan gambar lampiran support ticket. */
  async upload(file: File | null): Promise<SupportTicketUploadResult> {
    const invalidResult = this.validateFile(file);

    if (invalidResult) {
      return invalidResult;
    }

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

  private validateFile(file: File | null) {
    if (!file) {
      return { ok: false as const, message: "No file uploaded", status: 400 };
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return {
        ok: false as const,
        message: "Invalid file type. Only JPG, PNG, WEBP, and GIF are allowed.",
        status: 400,
      };
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        ok: false as const,
        message: "File size exceeds 5MB limit.",
        status: 400,
      };
    }

    return null;
  }
}

export const supportTicketUploadService = new SupportTicketUploadService();
