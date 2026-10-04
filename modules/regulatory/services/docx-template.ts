import { readFile } from "fs/promises";
import path from "path";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

/**
 * Pengisian template .docx dengan penanda {kunci}. Template disimpan di folder
 * modul dan ikut tersalin ke image produksi (Dockerfile menyalin `modules/`).
 */

const TEMPLATE_DIRECTORY = path.join(process.cwd(), "modules", "regulatory", "templates");

/** Isi template bernama `fileName` dengan nilai; penanda tanpa nilai menjadi kosong. */
export async function fillDocxTemplate(fileName: string, values: Record<string, string>): Promise<Buffer> {
  const template = await readFile(path.join(TEMPLATE_DIRECTORY, fileName));
  const document = new Docxtemplater(new PizZip(template), {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });
  document.render(values);
  return document.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
}
