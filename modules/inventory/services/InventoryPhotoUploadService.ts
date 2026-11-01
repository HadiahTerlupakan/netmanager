import path from "path";
import {
  uploadInventoryPhotos,
  validateInventoryPhotos,
} from "@/lib/utils/image-upload";
import { getInventoryRouteService } from "./InventoryRouteService";

const MAX_PHOTO_COUNT = 5;
const MAX_PHOTO_SIZE_MB = 5;
const EMPTY_PHOTO_FILE_MESSAGE =
  "Foto yang dipilih kosong, isinya tidak terbaca. Simpan fotonya ke HP atau komputer dulu, lalu pilih lagi.";
const VALID_TRANSACTION_TYPES = [
  "inventory-masuk",
  "inventory-keluar",
  "inventory-transfer",
  "finance-transaction",
] as const;
const UPLOADABLE_TRANSACTION_TYPES = [
  "inventory-masuk",
  "inventory-keluar",
  "inventory-transfer",
] as const;

type InventoryPhotoTransactionType = (typeof VALID_TRANSACTION_TYPES)[number];
type UploadableInventoryPhotoTransactionType =
  (typeof UPLOADABLE_TRANSACTION_TYPES)[number];

interface InventoryPhotoUploadInput {
  photos: File[];
  transactionId: string;
  transactionType: string;
}

interface InventoryRouteVerifier {
  verifyInventoryTransaction(input: {
    transactionId: string;
    transactionType: string;
  }): Promise<unknown>;
}

interface InventoryPhotoUploadDependencies {
  now?: () => Date;
  cwd?: () => string;
  routeService?: InventoryRouteVerifier;
  uploadPhotos?: typeof uploadInventoryPhotos;
  validatePhotos?: typeof validateInventoryPhotos;
}

export type InventoryPhotoUploadResult =
  | { ok: true; body: InventoryPhotoUploadSuccessBody }
  | { ok: false; status: number; body: InventoryPhotoUploadErrorBody };

interface InventoryPhotoUploadSuccessBody {
  success: true;
  message: string;
  data: {
    urls: string[];
    transactionId: string;
    transactionType: string;
    count: number;
  };
}

interface InventoryPhotoUploadErrorBody {
  error: string;
  details?: string[];
}

export class InventoryPhotoUploadService {
  private readonly now: () => Date;
  private readonly cwd: () => string;
  private readonly routeService: InventoryRouteVerifier;
  private readonly uploadPhotos: typeof uploadInventoryPhotos;
  private readonly validatePhotos: typeof validateInventoryPhotos;

  constructor(dependencies: InventoryPhotoUploadDependencies = {}) {
    this.now = dependencies.now ?? (() => new Date());
    this.cwd = dependencies.cwd ?? process.cwd;
    this.routeService = dependencies.routeService ?? getInventoryRouteService();
    this.uploadPhotos = dependencies.uploadPhotos ?? uploadInventoryPhotos;
    this.validatePhotos =
      dependencies.validatePhotos ?? validateInventoryPhotos;
  }

  /** Validasi transaksi dan upload foto inventory. */
  async upload(
    input: InventoryPhotoUploadInput,
  ): Promise<InventoryPhotoUploadResult> {
    const invalidInput = this.validateInput(input);
    if (invalidInput) return invalidInput;

    const validPhotos = this.getValidPhotos(input.photos);
    if (validPhotos.length === 0 && this.hasEmptyPhotoFile(input.photos)) {
      return this.createError(400, EMPTY_PHOTO_FILE_MESSAGE);
    }
    const invalidPhotos = this.validatePhotoFiles(validPhotos);
    if (invalidPhotos) return invalidPhotos;

    const transactionType = this.toUploadableTransactionType(
      input.transactionType,
    );
    const missingTransaction = await this.validateTransaction({
      transactionId: input.transactionId,
      transactionType,
    });
    if (missingTransaction) return missingTransaction;

    const urls = await this.uploadPhotos(
      validPhotos,
      input.transactionId,
      transactionType,
      this.buildUploadDirectory(transactionType),
    );

    return this.createSuccessBody(input.transactionId, transactionType, urls);
  }

  private validateInput(input: InventoryPhotoUploadInput) {
    if (!input.transactionId) {
      return this.createError(
        400,
        "Foto belum bisa diunggah karena catatannya belum tersimpan. Simpan catatannya dulu, lalu unggah fotonya.",
      );
    }

    if (
      !VALID_TRANSACTION_TYPES.includes(
        input.transactionType as InventoryPhotoTransactionType,
      )
    ) {
      // Hanya terjadi bila halaman mengirim jenis yang salah, bukan ulah staf.
      return this.createError(
        400,
        "Foto belum bisa diunggah dari halaman ini. Muat ulang halaman, lalu coba lagi. Kalau tetap gagal, laporkan ke admin.",
      );
    }

    return null;
  }

  private toUploadableTransactionType(
    transactionType: string,
  ): UploadableInventoryPhotoTransactionType {
    if (
      UPLOADABLE_TRANSACTION_TYPES.includes(
        transactionType as UploadableInventoryPhotoTransactionType,
      )
    ) {
      return transactionType as UploadableInventoryPhotoTransactionType;
    }

    return "inventory-masuk";
  }

  private hasEmptyPhotoFile(photos: File[]) {
    return photos.some((file) => file instanceof File && file.size === 0);
  }

  private getValidPhotos(photos: File[]) {
    return photos.filter((file) => file instanceof File && file.size > 0);
  }

  private validatePhotoFiles(photos: File[]) {
    if (photos.length === 0) {
      return this.createError(
        400,
        "Belum ada foto yang dipilih. Pilih paling sedikit 1 foto.",
      );
    }

    const validation = this.validatePhotos(
      photos,
      MAX_PHOTO_COUNT,
      MAX_PHOTO_SIZE_MB,
    );
    if (validation.isValid) return null;

    return {
      ok: false as const,
      status: 400,
      body: {
        error: `Foto belum bisa diunggah:\n${validation.errors.join("\n")}`,
        details: validation.errors,
      },
    };
  }

  private async validateTransaction(input: {
    transactionId: string;
    transactionType: UploadableInventoryPhotoTransactionType;
  }) {
    if (input.transactionId.startsWith("temp-")) return null;

    const transaction =
      await this.routeService.verifyInventoryTransaction(input);
    if (transaction) return null;

    return this.createError(
      404,
      this.getMissingTransactionMessage(input.transactionType),
    );
  }

  private getMissingTransactionMessage(
    transactionType: UploadableInventoryPhotoTransactionType,
  ) {
    const errorByType: Partial<
      Record<UploadableInventoryPhotoTransactionType, string>
    > = {
      "inventory-masuk": "Catatan barang masuk untuk foto ini tidak ditemukan",
      "inventory-keluar":
        "Catatan barang keluar untuk foto ini tidak ditemukan",
      "inventory-transfer": "Catatan transfer untuk foto ini tidak ditemukan",
    };

    const catatan =
      errorByType[transactionType] || "Catatan untuk foto ini tidak ditemukan";
    return `${catatan}, mungkin sudah dihapus. Muat ulang halaman, lalu coba lagi.`;
  }

  private buildUploadDirectory(
    transactionType: UploadableInventoryPhotoTransactionType,
  ) {
    const currentDate = this.now();
    const year = currentDate.getFullYear().toString();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    return path.join(
      this.cwd(),
      "public",
      "uploads",
      transactionType,
      year,
      month,
    );
  }

  private createSuccessBody(
    transactionId: string,
    transactionType: UploadableInventoryPhotoTransactionType,
    urls: string[],
  ): InventoryPhotoUploadResult {
    return {
      ok: true,
      body: {
        success: true,
        message: `${urls.length} foto berhasil diunggah`,
        data: { urls, transactionId, transactionType, count: urls.length },
      },
    };
  }

  private createError(
    status: number,
    error: string,
  ): InventoryPhotoUploadResult {
    return { ok: false, status, body: { error } };
  }
}

export const inventoryPhotoUploadService = new InventoryPhotoUploadService();
