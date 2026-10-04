import type { PDFFont } from "pdf-lib";

/**
 * Utilitas teks untuk PDF berfont standar (Helvetica) via pdf-lib.
 *
 * Font standar hanya mengenal WinAnsi: emoji atau aksara non-Latin membuat
 * pdf-lib melempar galat, jadi karakter seperti itu diganti sebelum dicetak.
 */

const REPLACEMENT_CHAR = "?";
const ELLIPSIS = "...";

/** Ganti karakter yang tidak bisa dicetak font; semua spasi/baris baru dirapikan jadi satu spasi. */
export function toPrintableText(font: PDFFont, text: string): string {
  const supported = new Set(font.getCharacterSet());

  return Array.from(text.replace(/\s+/g, " "))
    .map((char) => (supported.has(char.codePointAt(0)!) ? char : REPLACEMENT_CHAR))
    .join("");
}

/** Potong teks dengan elipsis supaya muat di lebar tertentu. */
export function fitText(font: PDFFont, text: string, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;

  let fitted = text;
  while (fitted.length > 0 && font.widthOfTextAtSize(fitted + ELLIPSIS, size) > maxWidth) {
    fitted = fitted.slice(0, -1);
  }

  return fitted + ELLIPSIS;
}

/** Bungkus teks per kata menjadi beberapa baris yang muat di lebar tertentu. */
export function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";

  for (const word of text.split(" ")) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);
    current = fitText(font, word, size, maxWidth);
  }

  if (current) lines.push(current);

  return lines;
}
