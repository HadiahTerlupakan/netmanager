import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { logger } from "@/lib/logger";
import type { EndorsementEntity } from "../domain/entities/Endorsement";
import { EndorsementStorageService } from "./EndorsementStorageService";

/**
 * Penyusunan PDF hasil pengesahan.
 *
 * Hasil akhirnya satu berkas: seluruh halaman dokumen asal apa adanya, lalu
 * satu halaman pengesahan berisi tanda tangan, nama, jabatan, waktu, dan sidik
 * jari dokumen asal. Dokumen asal tidak pernah diubah isinya — halaman baru
 * ditambahkan di belakang — supaya sidik jari yang tercetak tetap bisa
 * dicocokkan dengan berkas yang ditandatangani.
 */

const PAGE_WIDTH = 595.28; // A4 potret dalam titik
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const TITLE_SIZE = 16;
const TEXT_SIZE = 10;
const SMALL_SIZE = 8;
const LINE_HEIGHT = 14;
const SIGNATURE_BOX_WIDTH = 220;
const SIGNATURE_BOX_HEIGHT = 70;
const SIGNATURE_COLUMNS = 2;
const COLUMN_GAP = 24;

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

interface TextOptions {
  size?: number;
  font: PDFFont;
  color?: ReturnType<typeof rgb>;
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  options: TextOptions,
) {
  page.drawText(text, {
    x,
    y,
    size: options.size ?? TEXT_SIZE,
    font: options.font,
    color: options.color ?? INK,
  });
}

export class EndorsementPdfService {
  constructor(
    private readonly storage: EndorsementStorageService = new EndorsementStorageService(),
  ) {}

  /**
   * Gabungkan dokumen asal dengan halaman pengesahan lalu simpan hasilnya.
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

    await this.appendEndorsementPage(output, endorsement);

    const bytes = await output.save();
    const buffer = Buffer.from(bytes);

    logger.info(
      `[EndorsementPdf] Menyusun berkas pengesahan ${endorsement.number} (${pages.length} halaman asal)`,
    );

    return this.storage.saveSignedPdf({
      tenantId: endorsement.tenantId,
      endorsementId: endorsement.id,
      buffer,
    });
  }

  private async appendEndorsementPage(
    output: PDFDocument,
    endorsement: EndorsementEntity,
  ): Promise<void> {
    const page = output.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const font = await output.embedFont(StandardFonts.Helvetica);
    const boldFont = await output.embedFont(StandardFonts.HelveticaBold);

    let cursorY = PAGE_HEIGHT - MARGIN;

    drawText(page, "LEMBAR PENGESAHAN", MARGIN, cursorY, {
      font: boldFont,
      size: TITLE_SIZE,
    });
    cursorY -= LINE_HEIGHT * 1.6;

    drawText(page, endorsement.number, MARGIN, cursorY, {
      font,
      size: TEXT_SIZE,
      color: MUTED,
    });
    cursorY -= LINE_HEIGHT * 1.4;

    drawText(page, endorsement.title, MARGIN, cursorY, {
      font: boldFont,
      size: TEXT_SIZE + 2,
    });
    cursorY -= LINE_HEIGHT * 1.6;

    page.drawLine({
      start: { x: MARGIN, y: cursorY },
      end: { x: PAGE_WIDTH - MARGIN, y: cursorY },
      thickness: 0.75,
      color: LINE,
    });
    cursorY -= LINE_HEIGHT * 1.6;

    drawText(
      page,
      "Dokumen berikut telah disahkan secara elektronik oleh pihak-pihak di bawah ini.",
      MARGIN,
      cursorY,
      { font, size: TEXT_SIZE, color: MUTED },
    );
    cursorY -= LINE_HEIGHT * 2;

    cursorY = await this.drawSignatures(
      output,
      page,
      endorsement,
      font,
      boldFont,
      cursorY,
    );

    this.drawFooter(page, endorsement, font, cursorY);
  }

  private async drawSignatures(
    output: PDFDocument,
    page: PDFPage,
    endorsement: EndorsementEntity,
    font: PDFFont,
    boldFont: PDFFont,
    startY: number,
  ): Promise<number> {
    let cursorY = startY;
    const columnWidth = SIGNATURE_BOX_WIDTH + COLUMN_GAP;

    for (const [index, signer] of endorsement.signers.entries()) {
      const column = index % SIGNATURE_COLUMNS;
      const x = MARGIN + column * columnWidth;

      if (column === 0 && index > 0) {
        cursorY -= SIGNATURE_BOX_HEIGHT + LINE_HEIGHT * 4;
      }

      const boxBottom = cursorY - SIGNATURE_BOX_HEIGHT;

      if (signer.signatureKey) {
        await this.drawSignatureImage(
          output,
          page,
          signer.signatureKey,
          x,
          boxBottom,
        );
      }

      page.drawLine({
        start: { x, y: boxBottom - 4 },
        end: { x: x + SIGNATURE_BOX_WIDTH, y: boxBottom - 4 },
        thickness: 0.75,
        color: LINE,
      });

      drawText(page, signer.name, x, boxBottom - LINE_HEIGHT - 4, {
        font: boldFont,
      });

      if (signer.role) {
        drawText(page, signer.role, x, boxBottom - LINE_HEIGHT * 2 - 2, {
          font,
          size: SMALL_SIZE,
          color: MUTED,
        });
      }

      drawText(
        page,
        `Ditandatangani ${formatDateTime(signer.signedAt)} WIB`,
        x,
        boxBottom - LINE_HEIGHT * 3,
        { font, size: SMALL_SIZE, color: MUTED },
      );
    }

    return cursorY - SIGNATURE_BOX_HEIGHT - LINE_HEIGHT * 5;
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
    page: PDFPage,
    endorsement: EndorsementEntity,
    font: PDFFont,
    startY: number,
  ): void {
    const y = Math.max(startY, MARGIN + LINE_HEIGHT * 3);

    page.drawLine({
      start: { x: MARGIN, y: y + LINE_HEIGHT },
      end: { x: PAGE_WIDTH - MARGIN, y: y + LINE_HEIGHT },
      thickness: 0.75,
      color: LINE,
    });

    drawText(
      page,
      `Sidik jari dokumen asal (SHA-256): ${endorsement.sourceFileHash}`,
      MARGIN,
      y,
      { font, size: SMALL_SIZE, color: MUTED },
    );

    drawText(
      page,
      "Lembar ini dihasilkan otomatis; keaslian dokumen dapat diperiksa lewat sidik jari di atas.",
      MARGIN,
      y - LINE_HEIGHT,
      { font, size: SMALL_SIZE, color: MUTED },
    );
  }
}
