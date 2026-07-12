// WhatsApp Provider Interface - Abstraction for all WhatsApp providers

export interface WhatsAppProvider {
  name: string;

  // Send text message
  sendMessage(params: SendMessageParams): Promise<SendResult>;

  // Send message with file attachment
  sendFile?(params: SendFileParams): Promise<SendResult>;

  // Send interactive button message
  sendButton?(params: SendButtonParams): Promise<SendResult>;
}

export interface SendMessageParams {
  phone: string; // Format: 628123456789
  message: string;
}

export interface SendFileParams {
  phone: string;
  fileUrl: string;
  caption?: string;
  filename?: string;
}

export type WhatsAppButtonType = "reply" | "call" | "url" | "copy";

export interface WhatsAppButtonItem {
  type: WhatsAppButtonType;
  displayText: string;
  phoneNumber?: string;
  url?: string;
  copyCode?: string;
}

export interface SendButtonParams {
  phone: string;
  message: string;
  buttons: WhatsAppButtonItem[];
  footer?: string;
  mediaUrl?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  response?: Record<string, unknown>; // Raw response from provider
}

export type WhatsAppProviderId =
  | "WABLAS"
  | "FONNTE"
  | "MPWA"
  | "BAILEYS"
  | "OFFICIAL";

export interface WhatsAppConfig {
  provider: WhatsAppProviderId;
  apiKey: string;
  domain?: string; // For Wablas/MPWA
  deviceId?: string; // For Wablas/MPWA; for BAILEYS = account session id
  phoneNumberId?: string; // For Official WhatsApp API
  accountId?: string; // For BAILEYS session key
}
