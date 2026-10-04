import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { toPrintableText } from "@/lib/pdf/pdf-text";
import {
  parseInlineBold,
  type TemplateBlock,
} from "../domain/template-content";

/**
 * Penyusun PDF dari template legal yang sudah terisi.
 *
 * Kop surat (logo, nama, alamat, kontak perusahaan) tercetak di halaman
 * pertama; isi mengalir ke halaman berikutnya bila tidak muat. Pasal diberi
 * nomor otomatis berurutan.
 */

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BODY_SIZE = 10.5;
const BODY_LINE_HEIGHT = 15;
const HEADING_SIZE = 13;
const COMPANY_SIZE = 14;
const SMALL_SIZE = 8.5;
const LOGO_MAX_HEIGHT = 48;
const LOGO_GAP = 12;
const LIST_INDENT = 18;
const PARAGRAPH_GAP = 6;
const BLOCK_GAP = 10;
const SIGNATURE_SPACE = 64;
const SIGNATURE_BLOCK_HEIGHT = 120;

const INK = rgb(0.07, 0.09, 0.15);
const MUTED = rgb(0.38, 0.41, 0.47);
const RULE = rgb(0.75, 0.77, 0.8);

export interface Letterhead {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  logo: { bytes: Buffer; contentType: string } | null;
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

interface Word {
  text: string;
  isBold: boolean;
  /** Menempel ke kata sebelumnya tanpa spasi, mis. koma setelah teks **tebal**. */
  isJoined?: boolean;
}

/** Kursor tulis: halaman aktif, posisi vertikal, dan pembuat halaman baru. */
class Cursor {
  page: PDFPage;
  y: number;

  constructor(private readonly output: PDFDocument) {
    this.page = output.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  /** Pindah ke halaman baru bila sisa ruang kurang dari `height`. */
  ensureSpace(height: number): void {
    if (this.y - height >= MARGIN) return;

    this.page = this.output.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }
}

function toWords(text: string, fonts: Fonts): Word[] {
  const words: Word[] = [];
  let previousText = "";
  for (const segment of parseInlineBold(text)) {
    const font = segment.isBold ? fonts.bold : fonts.regular;
    // Menempel hanya bila tidak ada spasi di batas kedua segmen pada sumbernya.
    const isGlued =
      words.length > 0 && !/\s$/.test(previousText) && !/^\s/.test(segment.text);
    previousText = segment.text;
    toPrintableText(font, segment.text)
      .split(" ")
      .filter(Boolean)
      .forEach((word, index) =>
        words.push({ text: word, isBold: segment.isBold, isJoined: index === 0 && isGlued }),
      );
  }
  return words;
}

function wordWidth(word: Word, fonts: Fonts, size: number): number {
  return (word.isBold ? fonts.bold : fonts.regular).widthOfTextAtSize(word.text, size);
}

/** Bungkus kata bergaya campuran menjadi baris yang muat di lebar tertentu. */
function wrapWords(words: Word[], fonts: Fonts, size: number, maxWidth: number): Word[][] {
  const space = fonts.regular.widthOfTextAtSize(" ", size);
  const lines: Word[][] = [];
  let line: Word[] = [];
  let lineWidth = 0;

  for (const word of words) {
    const width = wordWidth(word, fonts, size);
    const gap = word.isJoined ? 0 : space;
    const nextWidth = line.length ? lineWidth + gap + width : width;
    if (line.length && nextWidth > maxWidth) {
      lines.push(line);
      line = [word];
      lineWidth = width;
      continue;
    }
    line.push(word);
    lineWidth = nextWidth;
  }

  if (line.length) lines.push(line);
  return lines;
}

function drawWordLine(
  cursor: Cursor,
  line: Word[],
  start: { x: number; size: number },
  fonts: Fonts,
): void {
  const space = fonts.regular.widthOfTextAtSize(" ", start.size);
  let x = start.x;
  line.forEach((word, index) => {
    if (index > 0 && !word.isJoined) x += space;
    const font = word.isBold ? fonts.bold : fonts.regular;
    cursor.page.drawText(word.text, { x, y: cursor.y, size: start.size, font, color: INK });
    x += font.widthOfTextAtSize(word.text, start.size);
  });
}

/** Tulis teks berparagraf (pisah baris baru) dengan dukungan **tebal**. */
function drawRichText(
  cursor: Cursor,
  text: string,
  fonts: Fonts,
  layout: { x: number; width: number },
): void {
  for (const paragraph of text.split(/\n+/).filter((part) => part.trim())) {
    const lines = wrapWords(toWords(paragraph, fonts), fonts, BODY_SIZE, layout.width);
    for (const line of lines) {
      cursor.ensureSpace(BODY_LINE_HEIGHT);
      cursor.y -= BODY_LINE_HEIGHT;
      drawWordLine(cursor, line, { x: layout.x, size: BODY_SIZE }, fonts);
    }
    cursor.y -= PARAGRAPH_GAP;
  }
}

function drawCentered(cursor: Cursor, text: string, font: PDFFont, size: number): void {
  const printable = toPrintableText(font, text);
  const lines = wrapWords(
    printable.split(" ").filter(Boolean).map((word) => ({ text: word, isBold: true })),
    { regular: font, bold: font },
    size,
    CONTENT_WIDTH,
  );
  for (const line of lines) {
    const lineText = line.map((word) => word.text).join(" ");
    cursor.ensureSpace(size * 1.5);
    cursor.y -= size * 1.5;
    cursor.page.drawText(lineText, {
      x: MARGIN + (CONTENT_WIDTH - font.widthOfTextAtSize(lineText, size)) / 2,
      y: cursor.y,
      size,
      font,
      color: INK,
    });
  }
}

export class LegalTemplateRenderer {
  /** Susun PDF berkop surat dari blok template yang sudah terisi. */
  async render(blocks: TemplateBlock[], letterhead: Letterhead): Promise<Buffer> {
    const output = await PDFDocument.create();
    const fonts: Fonts = {
      regular: await output.embedFont(StandardFonts.Helvetica),
      bold: await output.embedFont(StandardFonts.HelveticaBold),
    };
    const cursor = new Cursor(output);

    await this.drawLetterhead(output, cursor, letterhead, fonts);
    let articleNumber = 0;
    for (const block of blocks) {
      if (block.type === "article") articleNumber++;
      this.drawBlock(cursor, block, fonts, articleNumber);
      cursor.y -= BLOCK_GAP;
    }

    return Buffer.from(await output.save());
  }

  private async drawLetterhead(
    output: PDFDocument,
    cursor: Cursor,
    letterhead: Letterhead,
    fonts: Fonts,
  ): Promise<void> {
    const logo = await this.embedLogo(output, letterhead.logo);
    const logoWidth = logo ? (logo.width * LOGO_MAX_HEIGHT) / logo.height : 0;
    const textX = MARGIN + (logo ? logoWidth + LOGO_GAP : 0);
    const top = cursor.y;

    if (logo) {
      cursor.page.drawImage(logo, {
        x: MARGIN,
        y: top - LOGO_MAX_HEIGHT,
        width: logoWidth,
        height: LOGO_MAX_HEIGHT,
      });
    }

    cursor.page.drawText(toPrintableText(fonts.bold, letterhead.companyName), {
      x: textX,
      y: top - COMPANY_SIZE,
      size: COMPANY_SIZE,
      font: fonts.bold,
      color: INK,
    });
    const contact = [letterhead.address, letterhead.phone, letterhead.email]
      .filter(Boolean)
      .join("  ·  ");
    if (contact) {
      cursor.page.drawText(toPrintableText(fonts.regular, contact), {
        x: textX,
        y: top - COMPANY_SIZE - SMALL_SIZE * 2,
        size: SMALL_SIZE,
        font: fonts.regular,
        color: MUTED,
        maxWidth: PAGE_WIDTH - MARGIN - textX,
      });
    }

    cursor.y = top - Math.max(LOGO_MAX_HEIGHT, COMPANY_SIZE + SMALL_SIZE * 3) - 8;
    cursor.page.drawLine({
      start: { x: MARGIN, y: cursor.y },
      end: { x: PAGE_WIDTH - MARGIN, y: cursor.y },
      thickness: 1,
      color: RULE,
    });
    cursor.y -= BLOCK_GAP * 2;
  }

  /** Logo PNG/JPG; logo yang gagal dibaca dilewati, kop tetap tercetak. */
  private async embedLogo(
    output: PDFDocument,
    logo: Letterhead["logo"],
  ): Promise<PDFImage | null> {
    if (!logo) return null;
    try {
      return logo.contentType.includes("png")
        ? await output.embedPng(logo.bytes)
        : await output.embedJpg(logo.bytes);
    } catch {
      return null;
    }
  }

  private drawBlock(cursor: Cursor, block: TemplateBlock, fonts: Fonts, articleNumber: number): void {
    const body = { x: MARGIN, width: CONTENT_WIDTH };

    switch (block.type) {
      case "heading":
        drawCentered(cursor, block.text, fonts.bold, HEADING_SIZE);
        return;
      case "paragraph":
        drawRichText(cursor, block.text, fonts, body);
        return;
      case "article":
        drawCentered(cursor, `Pasal ${articleNumber}`, fonts.bold, BODY_SIZE);
        if (block.title.trim()) drawCentered(cursor, block.title, fonts.bold, BODY_SIZE);
        cursor.y -= PARAGRAPH_GAP;
        drawRichText(cursor, block.text, fonts, body);
        return;
      case "list":
        this.drawList(cursor, block.items, fonts);
        return;
      case "signatures":
        this.drawSignatures(cursor, block, fonts);
        return;
    }
  }

  private drawList(cursor: Cursor, items: string[], fonts: Fonts): void {
    items.forEach((item, index) => {
      cursor.ensureSpace(BODY_LINE_HEIGHT);
      const markerY = cursor.y - BODY_LINE_HEIGHT;
      cursor.page.drawText(`${index + 1}.`, {
        x: MARGIN,
        y: markerY,
        size: BODY_SIZE,
        font: fonts.regular,
        color: INK,
      });
      drawRichText(cursor, item, fonts, {
        x: MARGIN + LIST_INDENT,
        width: CONTENT_WIDTH - LIST_INDENT,
      });
    });
  }

  private drawSignatures(
    cursor: Cursor,
    block: Extract<TemplateBlock, { type: "signatures" }>,
    fonts: Fonts,
  ): void {
    cursor.ensureSpace(SIGNATURE_BLOCK_HEIGHT);
    const columnWidth = CONTENT_WIDTH / 2;
    const top = cursor.y - BODY_LINE_HEIGHT * 2;

    [block.left, block.right].forEach((party, index) => {
      const centerX = MARGIN + columnWidth * index + columnWidth / 2;
      const label = toPrintableText(fonts.bold, party.label);
      const name = toPrintableText(fonts.bold, party.name);
      const lineY = top - SIGNATURE_SPACE;

      cursor.page.drawText(label, {
        x: centerX - fonts.bold.widthOfTextAtSize(label, BODY_SIZE) / 2,
        y: top,
        size: BODY_SIZE,
        font: fonts.bold,
        color: INK,
      });
      cursor.page.drawLine({
        start: { x: centerX - columnWidth * 0.35, y: lineY },
        end: { x: centerX + columnWidth * 0.35, y: lineY },
        thickness: 0.75,
        color: INK,
      });
      cursor.page.drawText(name, {
        x: centerX - fonts.bold.widthOfTextAtSize(name, BODY_SIZE) / 2,
        y: lineY - BODY_LINE_HEIGHT,
        size: BODY_SIZE,
        font: fonts.bold,
        color: INK,
        maxWidth: columnWidth * 0.9,
      });
    });

    cursor.y = top - SIGNATURE_SPACE - BODY_LINE_HEIGHT * 2;
  }
}
