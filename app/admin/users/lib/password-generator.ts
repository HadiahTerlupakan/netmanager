const PASSWORD_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";

const DEFAULT_PASSWORD_LENGTH = 12;

/**
 * Buat password acak aman menggunakan crypto.getRandomValues bila tersedia.
 * Fallback ke Math.random hanya untuk environment non-browser tanpa crypto.
 */
export function generateStrongPassword(
  length: number = DEFAULT_PASSWORD_LENGTH,
): string {
  const charsetLength = PASSWORD_CHARS.length;

  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    const buffer = new Uint32Array(length);
    globalThis.crypto.getRandomValues(buffer);
    let result = "";
    for (let i = 0; i < length; i++) {
      result += PASSWORD_CHARS.charAt(buffer[i]! % charsetLength);
    }
    return result;
  }

  let result = "";
  for (let i = 0; i < length; i++) {
    result += PASSWORD_CHARS.charAt(Math.floor(Math.random() * charsetLength));
  }
  return result;
}
