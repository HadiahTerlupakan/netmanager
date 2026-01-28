export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const SIGNATURES: Record<string, number[]> = {
  jpg: [0xFF, 0xD8, 0xFF],
  png: [0x89, 0x50, 0x4E, 0x47],
  pdf: [0x25, 0x50, 0x44, 0x46]
  // Add other types as needed
};

export async function validateFileSignature(file: File, allowedTypes: ('jpg' | 'png' | 'pdf')[]): Promise<boolean> {
  try {
    const arrayBuffer = await file.slice(0, 4).arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    for (const type of allowedTypes) {
      const signature = SIGNATURES[type];
      if (!signature) continue;

      let match = true;
      for (let i = 0; i < signature.length; i++) {
        if (bytes[i] !== signature[i]) {
          match = false;
          break;
        }
      }

      if (match) return true;
    }

    return false;
  } catch (error) {
    console.error('Error validating file signature:', error);
    return false;
  }
}

export function validateFileSize(file: File, maxSize: number = MAX_FILE_SIZE): boolean {
  return file.size <= maxSize;
}
