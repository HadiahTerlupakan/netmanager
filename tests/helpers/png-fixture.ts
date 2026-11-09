/**
 * Berkas PNG kecil dengan struktur chunk yang sah (IHDR, IDAT, IEND) untuk
 * tes tanda tangan. CRC tidak dihitung karena pemeriksa tidak memakainya.
 */

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface PngFixtureOptions {
  width?: number;
  height?: number;
  bitDepth?: number;
  colorType?: number;
  interlace?: number;
  /** Besar data IDAT palsu. */
  idatBytes?: number;
  /** Byte tambahan setelah IEND. */
  trailing?: Buffer;
  /** Chunk tambahan setelah IEND. */
  isChunkAfterEnd?: boolean;
}

/** Satu chunk PNG: panjang, jenis, data, CRC (nol). */
export function pngChunk(type: string, data: Buffer = Buffer.alloc(0)) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.byteLength, 0);
  header.write(type, 4, "latin1");
  return Buffer.concat([header, data, Buffer.alloc(4)]);
}

/** Buffer PNG dengan header sesuai opsi. */
export function buildPng(options: PngFixtureOptions = {}): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(options.width ?? 600, 0);
  ihdr.writeUInt32BE(options.height ?? 200, 4);
  ihdr[8] = options.bitDepth ?? 8;
  ihdr[9] = options.colorType ?? 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = options.interlace ?? 0;
  return Buffer.concat([
    PNG_MAGIC,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", Buffer.alloc(options.idatBytes ?? 32, 7)),
    pngChunk("IEND"),
    ...(options.isChunkAfterEnd ? [pngChunk("tEXt", Buffer.from("x"))] : []),
    options.trailing ?? Buffer.alloc(0),
  ]);
}

/** Data URL PNG seperti keluaran `canvas.toDataURL("image/png")`. */
export function buildPngDataUrl(options: PngFixtureOptions = {}): string {
  return `data:image/png;base64,${buildPng(options).toString("base64")}`;
}
