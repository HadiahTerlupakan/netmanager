import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { logger } from "@/lib/logger";
import { fitText, toPrintableText, wrapText } from "@/lib/pdf/pdf-text";
import type {
  EndorsementEntity,
  EndorsementSignerEntity,
} from "../domain/entities/Endorsement";
import { EndorsementStorageService } from "./EndorsementStorageService";

/**
 * Penyusunan PDF hasil pengesahan.
 *
 * Hasil akhirnya satu berkas: seluruh halaman dokumen asal apa adanya, lalu
 * lembar pengesahan berisi tanda tangan, nama, jabatan, waktu, dan sidik jari
 * dokumen asal. Dokumen asal tidak pernah diubah isinya — halaman baru
 * ditambahkan di belakang — supaya sidik jari yang tercetak tetap bisa
 * dicocokkan dengan berkas yang ditandatangani.
 *
 * Lembar pengesahan bisa lebih dari satu halaman bila penanda tangannya banyak.
 */

const PAGE_WIDTH = 595.28; // A4 potret dalam titik
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const TITLE_SIZE = 16;
const TEXT_SIZE = 10;
const HEADING_SIZE = TEXT_SIZE + 2;
const SMALL_SIZE = 8;
const LINE_HEIGHT = 14;
const SIGNATURE_BOX_WIDTH = 220;
const SIGNATURE_BOX_HEIGHT = 70;
const SIGNATURE_COLUMNS = 2;
const COLUMN_GAP = 24;
/** Tinggi satu baris kotak tanda tangan beserta nama, jabatan, dan waktu. */
const SIGNATURE_ROW_HEIGHT = SIGNATURE_BOX_HEIGHT + LINE_HEIGHT * 4;
/** Ruang di dasar halaman terakhir untuk sidik jari dokumen. */
const FOOTER_HEIGHT = LINE_HEIGHT * 3;

const INK = rgb(0.07, 0.09, 0.15);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.8, 0.82, 0.85);

function formatDateTime(value: Date | null): string {
  if (!value) return "-";

  return value.toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

interface TextStyle {
  font: PDFFont;
  size?: number;
  color?: ReturnType<typeof rgb>;
}

/**
 * Kursor penulisan lembar pengesahan: halaman aktif dan posisi vertikalnya.
 * Membuka halaman baru otomatis bila ruang yang diminta tidak cukup.
 */
class SheetCursor {
  page: PDFPage;
  y: number;

  constructor(private readonly output: PDFDocument) {
    this.page = output.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  /** Pastikan ada ruang setinggi `height` di atas footer; bila tidak, pindah halaman. */
  ensureSpace(height: number): void {
    if (this.y - height >= MARGIN + FOOTER_HEIGHT) return;

    this.page = this.output.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  text(content: string, x: number, y: number, style: TextStyle): void {
    this.page.drawText(toPrintableText(style.font, content), {
      x,
      y,
      size: style.size ?? TEXT_SIZE,
      font: style.font,
      color: style.color ?? INK,
    });
  }

  rule(y: number, fromX = MARGIN, toX = PAGE_WIDTH - MARGIN): void {
    this.page.drawLine({
      start: { x: fromX, y },
      end: { x: toX, y },
      thickness: 0.75,
      color: LINE,
    });
  }
}

export class EndorsementPdfService {
  constructor(
    private readonly storage: EndorsementStorageService = new EndorsementStorageService(),
  ) {}

  /**
   * Gabungkan dokumen asal dengan lembar pengesahan lalu simpan hasilnya.
   *
   * Mengembalikan kunci objek dan sidik jari berkas final.
   */
  async buildSignedPdf(
    endorsement: EndorsementEntity,
  ): Promise<{ key: string; hash: string }> {
    const sourceBytes = await this.storage.read(endorsement.sourceFileKey);
    const output = await PDFDocument.create();

    const source = await PDFDocument.load(sourceBytes);
    const pages = await output.copyPages(source, source.getPageIndices());
    for (const page of pages) output.addPage(page);

    await this.appendEndorsementSheet(output, endorsement);

    const buffer = Buffer.from(await output.save());

    logger.info(
      `[EndorsementPdf] Menyusun berkas pengesahan ${endorsement.number} (${pages.length} halaman asal)`,
    );

    return this.storage.saveSignedPdf({
      tenantId: endorsement.tenantId,
      endorsementId: endorsement.id,
      buffer,
    });
  }

  private async appendEndorsementSheet(
    output: PDFDocument,
    endorsement: EndorsementEntity,
  ): Promise<void> {
    const fonts: Fonts = {
      regular: await output.embedFont(StandardFonts.Helvetica),
      bold: await output.embedFont(StandardFonts.HelveticaBold),
    };
    const cursor = new SheetCursor(output);

    this.drawHeader(cursor, endorsement, fonts);
    await this.drawSignatures(output, cursor, endorsement.signers, fonts);
    this.drawFooter(cursor, endorsement, fonts.regular);
  }

  private drawHeader(
    cursor: SheetCursor,
    endorsement: EndorsementEntity,
    fonts: Fonts,
  ): void {
    cursor.text("LEMBAR PENGESAHAN", MARGIN, cursor.y, {
      font: fonts.bold,
      size: TITLE_SIZE,
    });
    cursor.y -= LINE_HEIGHT * 1.6;

    cursor.text(endorsement.number, MARGIN, cursor.y, {
      font: fonts.regular,
      color: MUTED,
    });
    cursor.y -= LINE_HEIGHT * 1.4;

    const titleLines = wrapText(
      fonts.bold,
      toPrintableText(fonts.bold, endorsement.title),
      HEADING_SIZE,
      CONTENT_WIDTH,
    );
    for (const line of titleLines) {
      cursor.text(line, MARGIN, cursor.y, { font: fonts.bold, size: HEADING_SIZE });
      cursor.y -= LINE_HEIGHT * 1.2;
    }
    cursor.y -= LINE_HEIGHT * 0.4;

    cursor.rule(cursor.y);
    cursor.y -= LINE_HEIGHT * 1.6;

    cursor.text(
      "Dokumen berikut telah disahkan secara elektronik oleh pihak-pihak di bawah ini.",
      MARGIN,
      cursor.y,
      { font: fonts.regular, color: MUTED },
    );
    cursor.y -= LINE_HEIGHT * 2;
  }

  private async drawSignatures(
    output: PDFDocument,
    cursor: SheetCursor,
    signers: EndorsementSignerEntity[],
    fonts: Fonts,
  ): Promise<void> {
    const columnWidth = SIGNATURE_BOX_WIDTH + COLUMN_GAP;

    for (const [index, signer] of signers.entries()) {
      const column = index % SIGNATURE_COLUMNS;
      if (column === 0) {
        if (index > 0) cursor.y -= SIGNATURE_ROW_HEIGHT;
        cursor.ensureSpace(SIGNATURE_ROW_HEIGHT);
      }

      const x = MARGIN + column * columnWidth;
      await this.drawSignatureBlock(output, cursor, signer, x, fonts);
    }

    cursor.y -= SIGNATURE_ROW_HEIGHT + LINE_HEIGHT;
  }

  private async drawSignatureBlock(
    output: PDFDocument,
    cursor: SheetCursor,
    signer: EndorsementSignerEntity,
    x: number,
    fonts: Fonts,
  ): Promise<void> {
    const boxBottom = cursor.y - SIGNATURE_BOX_HEIGHT;

    if (signer.signatureKey) {
      await this.drawSignatureImage(
        output,
        cursor.page,
        signer.signatureKey,
        x,
        boxBottom,
      );
    }

    cursor.rule(boxBottom - 4, x, x + SIGNATURE_BOX_WIDTH);

    const fit = (font: PDFFont, text: string, size: number) =>
      fitText(font, toPrintableText(font, text), size, SIGNATURE_BOX_WIDTH);

    cursor.text(
      fit(fonts.bold, signer.name, TEXT_SIZE),
      x,
      boxBottom - LINE_HEIGHT - 4,
      { font: fonts.bold },
    );

    if (signer.role) {
      cursor.text(
        fit(fonts.regular, signer.role, SMALL_SIZE),
        x,
        boxBottom - LINE_HEIGHT * 2 - 2,
        { font: fonts.regular, size: SMALL_SIZE, color: MUTED },
      );
    }

    cursor.text(
      `Ditandatangani ${formatDateTime(signer.signedAt)} WIB`,
      x,
      boxBottom - LINE_HEIGHT * 3,
      { font: fonts.regular, size: SMALL_SIZE, color: MUTED },
    );
  }

  /**
   * Gambar tanda tangan ditempel dengan menjaga rasio aslinya supaya goresan
   * tidak melar mengikuti kotak.
   */
  private async drawSignatureImage(
    output: PDFDocument,
    page: PDFPage,
    signatureKey: string,
    x: number,
    y: number,
  ): Promise<void> {
    try {
      const image = await output.embedPng(
        await this.storage.read(signatureKey),
      );
      const scale = Math.min(
        SIGNATURE_BOX_WIDTH / image.width,
        SIGNATURE_BOX_HEIGHT / image.height,
      );

      page.drawImage(image, {
        x,
        y,
        width: image.width * scale,
        height: image.height * scale,
      });
    } catch (error) {
      // Satu tanda tangan yang gagal dimuat tidak boleh membatalkan seluruh
      // berkas; ketiadaannya terlihat jelas di lembar hasil.
      logger.error(
        `[EndorsementPdf] Gagal menempel tanda tangan ${signatureKey}:`,
        error,
      );
    }
  }

  private drawFooter(
    cursor: SheetCursor,
    endorsement: EndorsementEntity,
    font: PDFFont,
  ): void {
    const y = MARGIN + LINE_HEIGHT;
    const style = { font, size: SMALL_SIZE, color: MUTED };

    cursor.rule(y + LINE_HEIGHT);
    cursor.text(
      `Sidik jari dokumen asal (SHA-256): ${endorsement.sourceFileHash}`,
      MARGIN,
      y,
      style,
    );
    cursor.text(
      "Lembar ini dihasilkan otomatis; keaslian dokumen dapat diperiksa lewat sidik jari di atas.",
      MARGIN,
      y - LINE_HEIGHT,
      style,
    );
  }
}
