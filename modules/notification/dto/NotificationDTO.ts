/**
 * Notification DTOs (Data Transfer Objects)
 */

// ==================== Response DTOs ====================

// ==================== Request DTOs ====================

/**
 * DTO for creating notification
 */
export interface CreateNotificationDTO {
  userId: string;
  title: string;
  message: string;
  type: string;
  data?: Record<string, unknown>;
}

/**
 * DTO for sending push notification
 */
export interface SendPushNotificationDTO {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * DTO for sending WhatsApp message
 */
export interface SendWhatsAppDTO {
  phoneNumber: string;
  message: string;
  templateName?: string;
  templateParams?: Record<string, string>;
}

/**
 * DTO for sending email
 */
export interface SendEmailDTO {
  to: string;
  subject: string;
  body: string;
  html?: string;
}
