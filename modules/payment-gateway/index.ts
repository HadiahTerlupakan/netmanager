// Domain Entities
export type { PaymentGatewayTransaction } from "./domain/entities/PaymentGatewayTransaction";
export type { PaymentGatewayConfig } from "./domain/entities/PaymentGatewayConfig";
export type {
  WebhookEvent,
  WebhookEventStatus,
} from "./domain/entities/WebhookEvent";

// Domain Value Objects
export {
  PaymentStatus,
  isValidPaymentStatus,
} from "./domain/value-objects/PaymentStatus";
export type { PaymentStatus as PaymentStatusType } from "./domain/value-objects/PaymentStatus";
export {
  PaymentMethod,
  normalizePaymentMethod,
} from "./domain/value-objects/PaymentMethod";
export type { PaymentMethod as PaymentMethodType } from "./domain/value-objects/PaymentMethod";
export {
  ProviderType,
  isValidProviderType,
  PROVIDER_SIGNATURE_HEADERS,
  SIGNATURE_REQUIRED,
} from "./domain/value-objects/ProviderType";
export type { ProviderType as ProviderTypeType } from "./domain/value-objects/ProviderType";

// Domain Ports
export type { IPaymentGatewayRepository } from "./domain/ports/IPaymentGatewayRepository";
export type { IPaymentGatewayConfigRepository } from "./domain/ports/IPaymentGatewayConfigRepository";
export type { IWebhookEventRepository } from "./domain/ports/IWebhookEventRepository";

// DTOs
export * from "./dto";

// Validators
export * from "./validators";

// Services
export { PaymentGatewayManager } from "./services/PaymentGatewayService";
export { WebhookProcessingService } from "./services/webhook-processing-service";
export type { ProcessWebhookResult } from "./services/webhook-processing-service";

// Provider Interface
export type {
  PaymentProvider,
  ProviderConfig,
  CreatePaymentParams,
  PaymentResult,
  TransactionStatus,
  WebhookResult,
  TestResult,
} from "./services/provider-interface";
