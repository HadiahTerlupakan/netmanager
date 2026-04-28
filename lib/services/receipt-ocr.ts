import { logger } from "@/lib/logger";
import { GeminiOcrService, resolveGeminiMimeType } from "@/modules/settings";

export interface ReceiptOCRResult {
  is_valid_receipt: boolean;
  is_potentially_fake: boolean;
  nominal?: number;
  tanggal?: string;
  nama_pengirim?: string;
  bank_pengirim?: string;
  bank_tujuan?: string;
  catatan_analisis: string;
}

const receiptSchema = {
  type: "OBJECT",
  properties: {
    is_valid_receipt: {
      type: "BOOLEAN",
      description:
        "Apakah gambar ini merupakan gambar struk/bukti transfer bank atau E-wallet yang valid? Jika hanya bon belanja toko grosir, foto acak, atau selfie, isi false.",
    },
    is_potentially_fake: {
      type: "BOOLEAN",
      description:
        "Apakah gambar ini memiliki indikasi struk palsu atau hasil editan secara visual? (Misal: font berbeda ukuran/warna, bekas tempelan, pixel kasar di area teks/nominal). PENTING: JANGAN ANGGAP PALSU hanya karena tanggalnya berada di masa depan atau masa lalu, selama visual gambarnya sendiri tampak asli.",
    },
    nominal: {
      type: "NUMBER",
      description:
        "Jumlah nominal transfer yang tertera pada struk. Kembalikan dalam bentuk angka bulat (integer) tanpa titik/koma pemisah ribuan. Contoh: 150000.",
    },
    tanggal: {
      type: "STRING",
      description:
        "Tanggal transaksi yang tertera pada struk. Tanggal dan waktu jika ada.",
    },
    nama_pengirim: {
      type: "STRING",
      description: "Nama pengirim (A/n Pengirim) jika tertera.",
    },
    bank_pengirim: {
      type: "STRING",
      description: "Nama bank atau metode e-wallet dari pengirim.",
    },
    bank_tujuan: {
      type: "STRING",
      description: "Nama bank tujuan atau nama penerima akhir transfer.",
    },
    catatan_analisis: {
      type: "STRING",
      description:
        "Penjelasan singkat mengenai analisis keaslian. Sebutkan alasan kenapa ditandai potentially_fake jika true. Jika asli, beri keterangan bahwa struk tampak wajar.",
    },
  },
  required: ["is_valid_receipt", "is_potentially_fake", "catatan_analisis"],
};

const receiptPrompt =
  'Anda adalah asisten verifikator keuangan yang sangat teliti. Analisis gambar bukti pembayaran (struk transfer bank / e-wallet) ini. Ekstrak data nominal, tanggal, dan nama bank. PENTING: Perhatikan dengan saksama indikasi editan/palsu SECARA VISUAL seperti: 1) Ada bekas tempelan kotak menutupi teks asli, 2) Font teks nominal atau nama tidak sesuai dengan font standar bank pada umumnya, 3) Pixel disekitar teks penting terlihat lebih kasar (bekas hapusan/smudge). Isi `is_potentially_fake` menjadi true HANYA JIKA ada indikasi visual ini. JANGAN isi true hanya karena masalah logika tanggal seperti "berada di masa depan".';

/** Service untuk mendeteksi keaslian dan mengekstrak data bukti pembayaran. */
export async function analyzeReceiptWithOCR(
  fileBuffer: ArrayBuffer,
  fileType: string,
  tenantId?: string | null,
): Promise<ReceiptOCRResult> {
  try {
    return await new GeminiOcrService().generateJson<ReceiptOCRResult>({
      tenantId,
      prompt: receiptPrompt,
      mimeType: resolveGeminiMimeType(fileType),
      base64Data: Buffer.from(fileBuffer).toString("base64"),
      responseSchema: receiptSchema,
      temperature: 0.1,
    });
  } catch (error) {
    logger.error("[ReceiptOCR] Error:", error);
    return {
      is_valid_receipt: true,
      is_potentially_fake: false,
      catatan_analisis: `[Sistem OCR Gagal: ${(error as Error).message}] Pembayaran tidak diverifikasi otomatis.`,
    };
  }
}
