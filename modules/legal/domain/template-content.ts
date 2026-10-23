/**
 * Isi template dokumen legal: blok terbatas yang memang dipakai surat legal,
 * plus isian otomatis {{kunci}}. Murni — tanpa I/O.
 *
 * Teks mendukung **tebal** sebagai satu-satunya format sebaris; baris baru
 * memisahkan paragraf di dalam satu blok.
 */

export type TemplateBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "article"; title: string; text: string }
  | { type: "list"; items: string[] }
  | {
      type: "signatures";
      left: { label: string; name: string };
      right: { label: string; name: string };
    };

export const TEMPLATE_BLOCK_TYPES = [
  "heading",
  "paragraph",
  "article",
  "list",
  "signatures",
] as const;

/** Isian otomatis yang tersedia, untuk tombol "Sisipkan isian" di editor. */
export const TEMPLATE_PLACEHOLDERS = [
  { key: "judul", label: "Judul dokumen" },
  { key: "nomor", label: "Nomor dokumen" },
  { key: "tanggal", label: "Tanggal hari ini" },
  { key: "tanggal_mulai", label: "Tanggal mulai" },
  { key: "tanggal_berakhir", label: "Tanggal berakhir" },
  { key: "nilai", label: "Nilai (Rp)" },
  { key: "perusahaan.nama", label: "Nama perusahaan" },
  { key: "perusahaan.alamat", label: "Alamat perusahaan" },
  { key: "perusahaan.telepon", label: "Telepon perusahaan" },
  { key: "pihak.nama", label: "Nama pihak" },
  { key: "pihak.alamat", label: "Alamat pihak" },
  { key: "pihak.telepon", label: "Telepon pihak" },
] as const;

export type TemplatePlaceholderKey = (typeof TEMPLATE_PLACEHOLDERS)[number]["key"];
export type TemplateValues = Partial<Record<TemplatePlaceholderKey, string>>;

/** Penanda isian yang belum diketahui — tampil jelas di PDF untuk dilengkapi. */
export const EMPTY_PLACEHOLDER_MARK = "........................";

const PLACEHOLDER_PATTERN = /\{\{\s*([a-z_.]+)\s*\}\}/g;

/** Ganti {{kunci}} dengan nilainya; kunci kosong/tak dikenal jadi titik-titik. */
export function fillPlaceholders(text: string, values: TemplateValues): string {
  return text.replace(PLACEHOLDER_PATTERN, (_match, key: string) => {
    const value = values[key as TemplatePlaceholderKey];
    return value && value.trim() ? value : EMPTY_PLACEHOLDER_MARK;
  });
}

/** Isi semua teks dalam blok dengan nilai isian. */
export function fillTemplateBlocks(
  blocks: TemplateBlock[],
  values: TemplateValues,
): TemplateBlock[] {
  const fill = (text: string) => fillPlaceholders(text, values);

  return blocks.map((block) => {
    switch (block.type) {
      case "heading":
      case "paragraph":
        return { ...block, text: fill(block.text) };
      case "article":
        return { ...block, title: fill(block.title), text: fill(block.text) };
      case "list":
        return { ...block, items: block.items.map(fill) };
      case "signatures":
        return {
          ...block,
          left: { label: fill(block.left.label), name: fill(block.left.name) },
          right: { label: fill(block.right.label), name: fill(block.right.name) },
        };
    }
  });
}

/** Segmen teks sebaris: **tebal** atau biasa. */
export interface InlineSegment {
  text: string;
  isBold: boolean;
}

/** Pecah teks menjadi segmen biasa/tebal berdasarkan penanda **...**. */
export function parseInlineBold(text: string): InlineSegment[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("**") && part.endsWith("**")
        ? { text: part.slice(2, -2), isBold: true }
        : { text: part, isBold: false },
    );
}
