import type { TemplateBlock, TemplateBlockType } from "../../components/legal-types";

/**
 * Aturan murni editor blok template (tanpa React): blok baru, pemindahan,
 * penyisipan isian, dan pembersihan sebelum dikirim ke server.
 */

/** Batas yang sejalan dengan validasi server. */
export const MAX_TEMPLATE_BLOCKS = 200;
export const MAX_BLOCK_TEXT_LENGTH = 5000;
export const MAX_LABEL_LENGTH = 200;
export const MAX_LIST_ITEMS = 50;
export const MIN_TEMPLATE_NAME_LENGTH = 3;
export const MAX_TEMPLATE_NAME_LENGTH = 100;

export const BLOCK_TYPE_LABEL: Record<TemplateBlockType, string> = {
  heading: "Judul",
  paragraph: "Paragraf",
  article: "Pasal",
  list: "Daftar bernomor",
  signatures: "Tanda tangan",
};

export const BLOCK_TYPE_ORDER: TemplateBlockType[] = [
  "heading",
  "paragraph",
  "article",
  "list",
  "signatures",
];

const LIST_ITEM_SEPARATOR = "\n";

/** Blok kosong siap diisi untuk tipe yang dipilih. */
export function createBlock(type: TemplateBlockType): TemplateBlock {
  switch (type) {
    case "heading":
    case "paragraph":
      return { type, text: "" };
    case "article":
      return { type, title: "", text: "" };
    case "list":
      return { type, items: [""] };
    case "signatures":
      return {
        type,
        left: { label: "PIHAK PERTAMA", name: "{{perusahaan.nama}}" },
        right: { label: "PIHAK KEDUA", name: "{{pihak.nama}}" },
      };
  }
}

/** Tukar blok dengan tetangganya; indeks di luar batas mengembalikan daftar semula. */
export function moveBlock(
  blocks: TemplateBlock[],
  index: number,
  offset: -1 | 1,
): TemplateBlock[] {
  const target = index + offset;
  if (target < 0 || target >= blocks.length) return blocks;

  const next = [...blocks];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Butir daftar sebagai teks satu butir per baris, untuk textarea. */
export function listItemsToText(items: string[]): string {
  return items.join(LIST_ITEM_SEPARATOR);
}

/** Teks textarea menjadi butir daftar; baris kosong dipertahankan selama diedit. */
export function textToListItems(text: string): string[] {
  return text.split(LIST_ITEM_SEPARATOR);
}

/** Ubah teks utama (`text`) atau judul pasal (`title`); blok lain dibiarkan. */
export function setBlockText(
  block: TemplateBlock,
  field: "text" | "title",
  value: string,
): TemplateBlock {
  if (field === "text" && "text" in block) return { ...block, text: value };
  if (field === "title" && block.type === "article") return { ...block, title: value };

  return block;
}

/** Ganti butir daftar dari teks textarea (satu butir per baris). */
export function setListText(block: TemplateBlock, text: string): TemplateBlock {
  return block.type === "list" ? { ...block, items: textToListItems(text) } : block;
}

/** Ubah label atau nama satu sisi blok tanda tangan. */
export function setSignatureText(
  block: TemplateBlock,
  side: "left" | "right",
  field: "label" | "name",
  value: string,
): TemplateBlock {
  if (block.type !== "signatures") return block;

  return { ...block, [side]: { ...block[side], [field]: value } };
}

/** Penanda isian `{{kunci}}` yang disisipkan ke teks. */
export function placeholderToken(key: string): string {
  return `{{${key}}}`;
}

/** Hasil penyisipan teks: nilai baru dan posisi kursor sesudahnya. */
export interface TextInsertion {
  value: string;
  cursor: number;
}

/** Sisipkan teks menggantikan seleksi [start, end) pada nilai semula. */
export function insertAtSelection(
  value: string,
  insert: string,
  start: number,
  end: number,
): TextInsertion {
  return {
    value: value.slice(0, start) + insert + value.slice(end),
    cursor: start + insert.length,
  };
}

const isBlank = (text: string) => !text.trim();

/** Rapikan isi sebelum dikirim: butir daftar kosong dibuang. */
export function normalizeTemplateContent(blocks: TemplateBlock[]): TemplateBlock[] {
  return blocks.map((block) =>
    block.type === "list"
      ? { ...block, items: block.items.filter((item) => !isBlank(item)) }
      : block,
  );
}

/** Pesan galat pertama isi template, atau null bila siap dikirim. */
export function findTemplateContentError(blocks: TemplateBlock[]): string | null {
  if (blocks.length === 0) return "Tambahkan minimal satu blok isi";
  if (blocks.length > MAX_TEMPLATE_BLOCKS) {
    return `Isi template maksimal ${MAX_TEMPLATE_BLOCKS} blok`;
  }

  const listPosition = blocks.findIndex(
    (block) =>
      block.type === "list" &&
      (block.items.length === 0 || block.items.length > MAX_LIST_ITEMS),
  );

  return listPosition === -1
    ? null
    : `Blok ${listPosition + 1}: daftar bernomor harus berisi 1–${MAX_LIST_ITEMS} butir`;
}

/** Isi template yang sudah dirapikan, atau pesan galatnya. */
export function prepareTemplateContent(
  blocks: TemplateBlock[],
): { content: TemplateBlock[]; error: null } | { content: null; error: string } {
  const content = normalizeTemplateContent(blocks);
  const error = findTemplateContentError(content);

  return error ? { content: null, error } : { content, error: null };
}
