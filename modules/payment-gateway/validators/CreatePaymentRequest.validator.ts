import {
  CreatePaymentRequestSchema,
  type CreatePaymentRequestDto,
} from "../dto/CreatePaymentRequest.dto";

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export function validateCreatePaymentRequest(
  data: unknown,
): CreatePaymentRequestDto {
  const result = CreatePaymentRequestSchema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map((e) => ({
      path: e.path.join("."),
      message: e.message,
    }));

    throw new ValidationError("Invalid payment request data", errors);
  }

  return result.data;
}
