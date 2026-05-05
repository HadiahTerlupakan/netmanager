import {
  PaymentGatewayConfigSchema,
  type PaymentGatewayConfigDto,
} from "../dto/PaymentGatewayConfig.dto";
import { ValidationError } from "./CreatePaymentRequest.validator";

export function validatePaymentGatewayConfig(
  data: unknown,
): PaymentGatewayConfigDto {
  const result = PaymentGatewayConfigSchema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map((e) => ({
      path: e.path.join("."),
      message: e.message,
    }));

    throw new ValidationError("Invalid payment gateway config", errors);
  }

  return result.data;
}
