import { z } from "zod";
import type { CanvasingStatus } from "../domain/entities/CanvasingEntity";
import type {
  CreateCanvasingInput,
  UpdateCanvasingInput,
} from "../domain/ports/ICanvasingRepository";

export const CANVASING_PACKAGE_VALUES = [
  "HOME_10MBPS",
  "HOME_20MBPS",
  "HOME_30MBPS",
  "HOME_50MBPS",
  "HOME_100MBPS",
] as const;

export const CANVASING_PACKAGE_OPTIONS = [
  { value: "HOME_10MBPS", label: "Home 10 Mbps" },
  { value: "HOME_20MBPS", label: "Home 20 Mbps" },
  { value: "HOME_30MBPS", label: "Home 30 Mbps" },
  { value: "HOME_50MBPS", label: "Home 50 Mbps" },
  { value: "HOME_100MBPS", label: "Home 100 Mbps" },
] as const satisfies ReadonlyArray<{
  value: (typeof CANVASING_PACKAGE_VALUES)[number];
  label: string;
}>;

export const CANVASING_STATUS_VALUES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;

const REQUIRED_FIELD_MESSAGE = "Wajib diisi";
const INVALID_EMAIL_MESSAGE = "Format email tidak valid";
const INVALID_CABLE_MESSAGE = "Kabel minimal 1 meter";
const INVALID_NUMBER_MESSAGE = "Nilai harus berupa angka yang valid";
const INVALID_PACKAGE_MESSAGE = "Paket tidak valid";
const INVALID_STATUS_MESSAGE = "Status canvasing tidak valid";
export const GENERIC_STATUS_UPDATE_FORBIDDEN_MESSAGE =
  "Perubahan status harus melalui endpoint aksi khusus";

const requiredTextField = z.string().trim().min(1, REQUIRED_FIELD_MESSAGE);

const optionalNullableTextField = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue === "" ? null : trimmedValue;
}, z.string().trim().nullable().optional());

const optionalNullableEmailField = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue === "" ? null : trimmedValue;
}, z.string().trim().email(INVALID_EMAIL_MESSAGE).nullable().optional());

const integerCableField = z.coerce
  .number({ error: INVALID_NUMBER_MESSAGE })
  .int(INVALID_NUMBER_MESSAGE)
  .min(1, INVALID_CABLE_MESSAGE);

const canvasingPackageField = z.enum(CANVASING_PACKAGE_VALUES, {
  error: INVALID_PACKAGE_MESSAGE,
});

const canvasingStatusField = z.enum(CANVASING_STATUS_VALUES, {
  error: INVALID_STATUS_MESSAGE,
});

const optionalCoordinateField = z.preprocess(
  (value) => {
    if (value === "" || value === undefined) {
      return null;
    }

    return value;
  },
  z.coerce.number({ error: INVALID_NUMBER_MESSAGE }).nullable().optional(),
);

export const canvasingFormSchema = z.object({
  nama: requiredTextField,
  noKtp: requiredTextField,
  noTelpon: requiredTextField,
  email: optionalNullableEmailField,
  alamat: requiredTextField,
  paket: canvasingPackageField,
  kabel: integerCableField,
  odp: optionalNullableTextField,
  sn: optionalNullableTextField,
});

export const createCanvasingSchema = canvasingFormSchema.extend({
  latitude: optionalCoordinateField,
  longitude: optionalCoordinateField,
  foto: optionalNullableTextField,
  fotoKtp: optionalNullableTextField,
  salesId: optionalNullableTextField,
  mitraId: optionalNullableTextField,
});

export const updateCanvasingSchema = z
  .object({
    nama: requiredTextField.optional(),
    noKtp: requiredTextField.optional(),
    noTelpon: requiredTextField.optional(),
    email: optionalNullableEmailField,
    alamat: requiredTextField.optional(),
    kabel: integerCableField.optional(),
    paket: canvasingPackageField.optional(),
    odp: optionalNullableTextField,
    sn: optionalNullableTextField,
    foto: optionalNullableTextField,
    fotoKtp: optionalNullableTextField,
  })
  .strict();

export type CanvasingFormValues = {
  nama: string;
  noKtp: string;
  noTelpon: string;
  email: string;
  alamat: string;
  paket: string;
  kabel: number;
  odp: string;
  sn: string;
};

export type CanvasingFormErrors = Partial<
  Record<keyof CanvasingFormValues, string>
>;

export const DEFAULT_CANVASING_FORM_VALUES: CanvasingFormValues = {
  nama: "",
  noKtp: "",
  noTelpon: "",
  email: "",
  alamat: "",
  kabel: 150,
  odp: "",
  paket: "HOME_10MBPS",
  sn: "",
};

/** Validate canvasing form values for reusable create/edit UI. */
export function validateCanvasingForm(values: CanvasingFormValues): {
  isValid: boolean;
  errors: CanvasingFormErrors;
} {
  const parsedValues = canvasingFormSchema.safeParse(values);

  if (parsedValues.success) {
    return {
      isValid: true,
      errors: {},
    };
  }

  return {
    isValid: false,
    errors: mapValidationErrors<CanvasingFormValues>(parsedValues.error),
  };
}

/** Parse and sanitize create payload before writing canvasing data. */
export function parseCreateCanvasingInput(
  payload: unknown,
): CreateCanvasingInput {
  return createCanvasingSchema.parse(payload);
}

/** Check whether generic canvasing update payload tries to change status. */
export function hasGenericStatusUpdate(payload: unknown): boolean {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  return Object.prototype.hasOwnProperty.call(payload, "status");
}

/** Parse and sanitize update payload before updating canvasing data. */
export function parseUpdateCanvasingInput(
  payload: unknown,
): UpdateCanvasingInput {
  if (hasGenericStatusUpdate(payload)) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["status"],
        message: GENERIC_STATUS_UPDATE_FORBIDDEN_MESSAGE,
      },
    ]);
  }

  return updateCanvasingSchema.parse(payload);
}

/** Parse optional status query into a valid canvasing status. */
export function parseCanvasingStatusParam(
  status: string | null,
): CanvasingStatus | undefined {
  const normalizedStatus = status?.trim();

  if (!normalizedStatus) {
    return undefined;
  }

  return canvasingStatusField.parse(normalizedStatus);
}

/** Convert zod validation errors into short field messages. */
export function mapValidationErrors<TField extends Record<string, unknown>>(
  error: z.ZodError,
): Partial<Record<keyof TField, string>> {
  const fieldErrors: Partial<Record<keyof TField, string>> = {};

  for (const issue of error.issues) {
    const fieldName = issue.path[0];

    if (typeof fieldName !== "string" || fieldName in fieldErrors) {
      continue;
    }

    fieldErrors[fieldName as keyof TField] = issue.message;
  }

  return fieldErrors;
}

/** Extract the first readable validation message for API responses. */
export function getCanvasingValidationMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Payload canvasing tidak valid";
}
