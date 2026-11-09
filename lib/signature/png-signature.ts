/**
 * Pemeriksaan gambar tanda tangan PNG dari data URL kanvas.
 *
 * Isinya datang dari pihak luar tanpa akun, jadi bentuk, ukuran berkas, dan
 * dimensi gambar diperiksa sebelum menyentuh penyimpanan. Fungsi murni: tidak
 * melempar error aplikasi, pemanggil yang menentukan pesannya.
 */

export const PNG_DATA_URL_PREFIX = "data:image/png;base64,";

/** Delapan byte pertama berkas PNG yang sah. */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** Chunk PNG: panjang data (4) + jenis (4) + data + CRC (4). */
const CHUNK_LENGTH_BYTES = 4;
const CHUNK_TYPE_BYTES = 4;
const CHUNK_CRC_BYTES = 4;
const CHUNK_OVERHEAD_BYTES =
  CHUNK_LENGTH_BYTES + CHUNK_TYPE_BYTES + CHUNK_CRC_BYTES;
/** IHDR selalu 13 byte: lebar, tinggi, bit depth, color type, kompresi, filter, interlace. */
const IHDR_DATA_LENGTH = 13;
const IHDR_BIT_DEPTH_OFFSET = 8;
const IHDR_COLOR_TYPE_OFFSET = 9;
const IHDR_COMPRESSION_OFFSET = 10;
const IHDR_FILTER_OFFSET = 11;
const IHDR_INTERLACE_OFFSET = 12;
/** Kanvas peramban mengekspor PNG 8 bit per kanal. */
const REQUIRED_BIT_DEPTH = 8;
/** 2 = RGB, 6 = RGBA (keluaran `canvas.toDataURL("image/png")`). */
const ALLOWED_COLOR_TYPES: ReadonlySet<number> = new Set([2, 6]);
const REQUIRED_COMPRESSION_METHOD = 0;
const REQUIRED_FILTER_METHOD = 0;
/** 0 = tanpa interlace. */
const REQUIRED_INTERLACE_METHOD = 0;
const BASE64_BODY_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

export interface PngSignatureLimits {
  maxBytes: number;
  /** Tanpa batas bila tidak diisi. */
  maxWidth?: number;
  maxHeight?: number;
}

export type PngSignatureRejection =
  | "NOT_PNG"
  | "EMPTY"
  | "TOO_LARGE"
  | "BAD_DIMENSIONS";

export type DecodedPngSignature =
  | { ok: true; buffer: Buffer; width: number; height: number }
  | { ok: false; reason: PngSignatureRejection };

function reject(reason: PngSignatureRejection): DecodedPngSignature {
  return { ok: false, reason };
}

function isWithin(value: number, max: number | undefined): boolean {
  return value > 0 && (max === undefined || value <= max);
}

function hasPngMagic(buffer: Buffer): boolean {
  return buffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC);
}

interface PngChunk {
  type: string;
  data: Buffer;
}

/**
 * Pecah berkas PNG menjadi chunk. Null bila strukturnya rusak: chunk
 * terpotong, tidak berakhir di IEND, atau ada byte sesudah IEND.
 */
function readPngChunks(buffer: Buffer): PngChunk[] | null {
  const chunks: PngChunk[] = [];
  let offset = PNG_MAGIC.length;
  while (offset < buffer.byteLength) {
    if (offset + CHUNK_OVERHEAD_BYTES > buffer.byteLength) return null;
    const length = buffer.readUInt32BE(offset);
    const typeStart = offset + CHUNK_LENGTH_BYTES;
    const dataStart = typeStart + CHUNK_TYPE_BYTES;
    const dataEnd = dataStart + length;
    if (dataEnd + CHUNK_CRC_BYTES > buffer.byteLength) return null;
    const type = buffer.toString("latin1", typeStart, dataStart);
    chunks.push({ type, data: buffer.subarray(dataStart, dataEnd) });
    offset = dataEnd + CHUNK_CRC_BYTES;
    // Apa pun sesudah IEND (chunk tambahan atau data titipan) ditolak.
    if (type === "IEND") return offset === buffer.byteLength ? chunks : null;
  }
  return null;
}

interface PngHeader {
  width: number;
  height: number;
}

/**
 * Header PNG yang sah untuk tanda tangan: chunk pertama IHDR 13 byte,
 * 8 bit per kanal, RGB/RGBA, tanpa interlace, ada data gambar (IDAT).
 */
function readSignatureHeader(chunks: PngChunk[]): PngHeader | null {
  const [ihdr] = chunks;
  if (ihdr?.type !== "IHDR" || ihdr.data.byteLength !== IHDR_DATA_LENGTH) {
    return null;
  }
  const { data } = ihdr;
  const isSupportedFormat =
    data[IHDR_BIT_DEPTH_OFFSET] === REQUIRED_BIT_DEPTH &&
    ALLOWED_COLOR_TYPES.has(data[IHDR_COLOR_TYPE_OFFSET]) &&
    data[IHDR_COMPRESSION_OFFSET] === REQUIRED_COMPRESSION_METHOD &&
    data[IHDR_FILTER_OFFSET] === REQUIRED_FILTER_METHOD &&
    data[IHDR_INTERLACE_OFFSET] === REQUIRED_INTERLACE_METHOD;
  if (!isSupportedFormat) return null;
  if (!chunks.some((chunk) => chunk.type === "IDAT")) return null;
  return { width: data.readUInt32BE(0), height: data.readUInt32BE(4) };
}

function hasDimensionLimits(limits: PngSignatureLimits): boolean {
  return limits.maxWidth !== undefined || limits.maxHeight !== undefined;
}

/**
 * Ubah data URL PNG menjadi buffer setelah lolos semua pemeriksaan.
 *
 * Bila batas dimensi diberikan (mode ketat), base64-nya wajib bersih dan
 * struktur berkasnya diperiksa: chunk utuh sampai IEND tanpa sisa, IHDR
 * 8 bit RGB/RGBA tanpa interlace, dan dimensi dalam batas. Tanpa batas
 * dimensi hanya awalan, ukuran, dan magic bytes yang diperiksa (perilaku
 * lama pengesahan).
 */
export function decodePngSignatureDataUrl(
  dataUrl: string,
  limits: PngSignatureLimits,
): DecodedPngSignature {
  if (!dataUrl.startsWith(PNG_DATA_URL_PREFIX)) return reject("NOT_PNG");

  const isStrict = hasDimensionLimits(limits);
  const body = dataUrl.slice(PNG_DATA_URL_PREFIX.length);
  if (isStrict && !BASE64_BODY_PATTERN.test(body)) return reject("NOT_PNG");

  const buffer = Buffer.from(body, "base64");
  if (buffer.byteLength === 0) return reject("EMPTY");
  if (buffer.byteLength > limits.maxBytes) return reject("TOO_LARGE");

  // Awalan data URL bisa dipalsukan; isi berkasnya yang menentukan.
  if (!hasPngMagic(buffer)) return reject("NOT_PNG");
  if (!isStrict) return { ok: true, buffer, width: 0, height: 0 };

  const chunks = readPngChunks(buffer);
  const header = chunks ? readSignatureHeader(chunks) : null;
  if (!header) return reject("NOT_PNG");

  const { width, height } = header;
  if (
    !isWithin(width, limits.maxWidth) ||
    !isWithin(height, limits.maxHeight)
  ) {
    return reject("BAD_DIMENSIONS");
  }

  return { ok: true, buffer, width, height };
}
