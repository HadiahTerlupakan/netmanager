import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { generateSampleSet } from "../domain/generate-sample-set";
import { createRandom } from "../domain/random";
import type {
  SampleGenerateInput,
  SampleIssuer,
  SampleSet,
} from "../domain/types";
import { SampleInvoiceBatchRepository } from "../repositories/SampleInvoiceBatchRepository";
import { parseGenerateInput } from "../validators/generate-input";
import { packSampleZip, planZipParts, zipFileName } from "./pack-sample-zip";
import { findMitraOption } from "./mitra-options";
import { getSampleInvoiceLimits } from "./sample-invoice-limits";

/** Isian yang disimpan di riwayat: tanpa daftar jalan, dengan seed acaknya. */
export type StoredSampleInput = Omit<SampleGenerateInput, "streets"> & {
  seed: number;
};

/** Isian ditolak; pesannya ditampilkan apa adanya ke admin. */
export class SampleInvoiceInputError extends Error {}

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const MAX_SEED = 2 ** 31;

const repo = new SampleInvoiceBatchRepository();

const wibToday = (now: Date) =>
  new Date(now.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);

export async function generateSampleBatch(
  tenantId: string,
  actor: { id: string; name: string },
  raw: unknown,
  now = new Date(),
) {
  const today = wibToday(now);
  const parsed = parseGenerateInput(
    raw,
    await getSampleInvoiceLimits(tenantId),
    today,
  );
  if ("message" in parsed) throw new SampleInvoiceInputError(parsed.message);
  // Id dan nama mitra datang dari browser; nama yang disimpan dari database.
  const mitra = await findMitraOption(parsed.input.mitraId);
  if (!mitra) throw new SampleInvoiceInputError("Mitra tidak ditemukan");

  const { streets: _streets, ...rest } = parsed.input;
  const input: StoredSampleInput = {
    ...rest,
    mitraName: mitra.name,
    seed: randomInt(MAX_SEED),
  };
  const sampleSet = generateSampleSet(parsed.input, {
    today,
    random: createRandom(input.seed),
  });

  const row = await repo.create({
    tenantId,
    mitraId: input.mitraId,
    mitraName: input.mitraName,
    createdById: actor.id,
    createdByName: actor.name,
    generatedAt: now,
    input,
    sampleSet,
    customerCount: sampleSet.customers.length,
    invoiceCount: sampleSet.invoices.length,
    fromMonth: input.fromMonth,
    toMonth: input.toMonth,
  });
  return { batchId: row.id, parts: planZipParts(sampleSet.invoices) };
}

export function listSampleBatches(filter: {
  mitraId?: string;
  page: number;
  limit: number;
}) {
  return repo.list(filter);
}

export async function getSampleBatchParts(id: string) {
  const row = await repo.findById(id);
  return row ? planZipParts((row.sampleSet as SampleSet).invoices) : null;
}

/** ZIP disusun ulang dari set tersimpan, jadi isinya sama di setiap unduhan. */
export async function buildSampleBatchZip(id: string, partKey: string) {
  const row = await repo.findById(id);
  if (!row) return null;
  const set = row.sampleSet as SampleSet;
  const input = row.input as StoredSampleInput;
  const parts = planZipParts(set.invoices);
  const part = parts.find((candidate) => candidate.key === partKey);
  if (!part) return null;

  return {
    fileName: zipFileName(
      input.mitraName,
      part,
      input.fromMonth,
      input.toMonth,
      parts.length === 1,
    ),
    buffer: packSampleZip({
      set,
      packages: input.packages,
      issuer: input.issuer,
      ppn: input.ppn,
      part,
    }),
  };
}

export function deleteSampleBatch(id: string) {
  return repo.delete(id);
}

/** Nama perusahaan dari pengaturan pajak bila ada; sisanya diisi admin. */
export async function getIssuerPrefill(
  tenantId: string,
): Promise<SampleIssuer> {
  const config = await prisma.taxConfig.findFirst({
    where: { tenantId },
    select: { companyName: true },
  });
  return { name: config?.companyName ?? "", address: "", phone: "" };
}
