import { sanitizeInput } from "@/lib/utils/sanitize";
import { hargaPaketSchema } from "@/lib/validations/hargapaket";
import * as z from "zod";
import type {
  HargaPaketCreateInput,
  HargaPaketUpdateInput,
} from "../repositories/HargaPaketRepository";

function getOptionalIdentifier(
  value: string | null | undefined,
): string | null | undefined {
  if (value === null || value === "") {
    return null;
  }

  if (!value?.trim()) {
    return undefined;
  }

  return value;
}

function getSanitizedOptionalText(
  value: string | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return sanitizeInput(value);
}

export function validateHargaPaketCreateInput(
  data: Partial<HargaPaketCreateInput>,
): HargaPaketCreateInput {
  const sanitizedData = {
    ...data,
    name: getSanitizedOptionalText(data.name),
    bandwidthId: getOptionalIdentifier(data.bandwidthId) ?? undefined,
    description: getSanitizedOptionalText(data.description),
  };

  const validation = hargaPaketSchema.safeParse(sanitizedData);
  if (!validation.success) {
    throw {
      code: "VALIDATION_ERROR",
      message: "Validasi gagal",
      details: z.flattenError(validation.error),
    };
  }

  return {
    ...validation.data,
    tenantId: data.tenantId,
  };
}

export function sanitizeHargaPaketUpdateInput(
  data: Partial<HargaPaketUpdateInput> & { bandwidthId?: string | null },
): HargaPaketUpdateInput {
  return {
    ...(data.name !== undefined
      ? { name: getSanitizedOptionalText(data.name) }
      : {}),
    ...(data.harga !== undefined ? { harga: data.harga } : {}),
    ...(data.durasi !== undefined ? { durasi: data.durasi } : {}),
    ...(data.durasiUnit !== undefined ? { durasiUnit: data.durasiUnit } : {}),
    ...(data.profilePPPId !== undefined
      ? { profilePPPId: data.profilePPPId }
      : {}),
    ...(data.description !== undefined
      ? { description: getSanitizedOptionalText(data.description) }
      : {}),
    ...(data.featured !== undefined ? { featured: data.featured } : {}),
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.tenantId !== undefined ? { tenantId: data.tenantId } : {}),
    ...(data.siteId !== undefined
      ? { siteId: getOptionalIdentifier(data.siteId) }
      : {}),
    ...(data.bandwidthId !== undefined
      ? { bandwidthId: getOptionalIdentifier(data.bandwidthId) }
      : {}),
  };
}
