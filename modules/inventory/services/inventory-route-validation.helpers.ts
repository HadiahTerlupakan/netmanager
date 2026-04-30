import type { KondisiBarang } from "../types/asset.enums";

export function validateInventoryMutationCreateBody(
  body: Record<string, unknown>,
) {
  const basicError = validateRequiredMutationFields(body);
  if (basicError) return basicError;

  const conditionError = validateMutationCondition(body.kondisi);
  if (conditionError) return conditionError;

  const photoError = validateMutationPhotoPayload(body);
  if (photoError) return photoError;

  return null;
}

export function isValidKondisi(kondisi: unknown): kondisi is KondisiBarang {
  return kondisi === "BARU" || kondisi === "BEKAS" || kondisi === "RUSAK";
}

function validateRequiredMutationFields(body: Record<string, unknown>) {
  const parsedJumlah = Number(body.jumlah);
  if (
    body.barangId &&
    body.gudangId &&
    Number.isFinite(parsedJumlah) &&
    parsedJumlah > 0
  ) {
    return null;
  }

  return createValidationError(
    "Barang, gudang, dan jumlah harus diisi dengan benar",
  );
}

function validateMutationCondition(kondisi: unknown) {
  if (!kondisi || isValidKondisi(kondisi)) return null;
  return createValidationError(
    "Kondisi tidak valid. Pilih: BARU, BEKAS, atau RUSAK",
  );
}

function validateMutationPhotoPayload(body: Record<string, unknown>) {
  if (body.fotoBukti && !Array.isArray(body.fotoBukti)) {
    return createValidationError("fotoBukti harus berupa array URL foto");
  }
  if (body.fotoMetadata && typeof body.fotoMetadata !== "object") {
    return createValidationError("fotoMetadata harus berupa object JSON");
  }
  return null;
}

function createValidationError(error: string) {
  return { success: false as const, status: 400, error };
}
