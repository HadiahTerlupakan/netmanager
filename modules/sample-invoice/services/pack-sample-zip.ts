import AdmZip from "adm-zip";
import type {
  PpnMode,
  SampleInvoice,
  SampleIssuer,
  SamplePackage,
  SampleSet,
} from "../domain/types";
import { renderSamplePdf } from "./render-sample-pdf";

/**
 * Satu berkas ZIP dibangun utuh di memori, jadi isinya dibatasi agar memori
 * pod app dan batas waktu ingress aman. Generate yang lebih besar diunduh
 * per bagian.
 */
export const ZIP_PART_MAX_PDFS = 2000;

export type ZipPart = { key: string; label: string; invoiceNumbers: string[] };

const MONTHS_LONG = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function monthLabel(month: string) {
  const [year, mon] = month.split("-").map(Number);
  return `${MONTHS_LONG[mon - 1]} ${year}`;
}

export function planZipParts(invoices: SampleInvoice[]): ZipPart[] {
  if (invoices.length <= ZIP_PART_MAX_PDFS) {
    return [
      {
        key: "all",
        label: "Semua bulan",
        invoiceNumbers: invoices.map((invoice) => invoice.number),
      },
    ];
  }

  const byMonth = new Map<string, string[]>();
  for (const invoice of invoices) {
    byMonth.set(invoice.month, [
      ...(byMonth.get(invoice.month) ?? []),
      invoice.number,
    ]);
  }

  return [...byMonth].flatMap(([month, numbers]) => {
    if (numbers.length <= ZIP_PART_MAX_PDFS) {
      return [
        { key: month, label: monthLabel(month), invoiceNumbers: numbers },
      ];
    }
    const chunks = Math.ceil(numbers.length / ZIP_PART_MAX_PDFS);
    return Array.from({ length: chunks }, (_, index) => ({
      key: `${month}-${index + 1}`,
      label: `${monthLabel(month)} (bagian ${index + 1} dari ${chunks})`,
      invoiceNumbers: numbers.slice(
        index * ZIP_PART_MAX_PDFS,
        (index + 1) * ZIP_PART_MAX_PDFS,
      ),
    }));
  });
}

export function packSampleZip(args: {
  set: SampleSet;
  packages: SamplePackage[];
  issuer: SampleIssuer;
  ppn: PpnMode;
  part: ZipPart;
}): Buffer {
  const wanted = new Set(args.part.invoiceNumbers);
  const zip = new AdmZip();
  for (const invoice of args.set.invoices) {
    if (!wanted.has(invoice.number)) continue;
    const customer = args.set.customers[invoice.customerIndex];
    const pdf = renderSamplePdf({
      issuer: args.issuer,
      customer,
      pkg: args.packages[customer.packageIndex],
      invoice,
      ppn: args.ppn,
    });
    zip.addFile(`${invoice.month}/${customer.code}.pdf`, pdf);
  }
  return zip.toBuffer();
}

function slug(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "mitra"
  );
}

export function zipFileName(
  mitraName: string,
  part: ZipPart,
  fromMonth: string,
  toMonth: string,
  single: boolean,
) {
  const range = single
    ? `${fromMonth.replace("-", "")}-${toMonth.replace("-", "")}`
    : part.key;
  return `contoh-invoice-${slug(mitraName)}-${range}.zip`;
}
