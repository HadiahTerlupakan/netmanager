import { logger } from "@/lib/logger";
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export type AllowedFileType = "jpg" | "png" | "pdf" | "gif" | "webp";

interface Signature {
  bytes: number[];
  offset?: number;
  tail?: {
    offset: number;
    bytes: number[];
  };
}

const SIGNATURES: Record<AllowedFileType, Signature> = {
  jpg: { bytes: [0xff, 0xd8, 0xff] },
  png: { bytes: [0x89, 0x50, 0x4e, 0x47] },
  pdf: { bytes: [0x25, 0x50, 0x44, 0x46] },
  gif: { bytes: [0x47, 0x49, 0x46, 0x38] },
  webp: {
    bytes: [0x52, 0x49, 0x46, 0x46],
    tail: { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
  },
};

const MAGIC_BYTES_READ = 12;

function matchesAt(
  bytes: Uint8Array,
  offset: number,
  needle: readonly number[],
): boolean {
  if (offset + needle.length > bytes.length) return false;
  for (let i = 0; i < needle.length; i++) {
    if (bytes[offset + i] !== needle[i]) return false;
  }
  return true;
}

export async function validateFileSignature(
  file: File,
  allowedTypes: AllowedFileType[],
): Promise<boolean> {
  if (allowedTypes.length === 0) return false;

  try {
    const arrayBuffer = await file.slice(0, MAGIC_BYTES_READ).arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    return allowedTypes.some((type) => {
      const sig = SIGNATURES[type];
      if (!sig) return false;
      const headMatched = matchesAt(bytes, sig.offset ?? 0, sig.bytes);
      if (!headMatched) return false;
      if (!sig.tail) return true;
      return matchesAt(bytes, sig.tail.offset, sig.tail.bytes);
    });
  } catch (error) {
    logger.error("Error validating file signature:", error);
    return false;
  }
}

export function validateFileSize(
  file: File,
  maxSize: number = MAX_FILE_SIZE,
): boolean {
  return file.size <= maxSize;
}
