export {
  getNotificationsForUser,
  getReadableNotificationForUser,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
} from "./services/NotificationService";
export type { NotificationType } from "./services/NotificationService.types";

export type {
  BaileysSessionStatus,
  BaileysSessionInfo,
} from "./services/whatsapp/baileys-session-manager";

async function baileys() {
  return import("./services/whatsapp/baileys-session-manager");
}

export async function getBaileysSession(sessionId: string) {
  return (await baileys()).getBaileysSession(sessionId);
}

export async function listBaileysSessions() {
  return (await baileys()).listBaileysSessions();
}

export async function startBaileysSession(sessionId: string) {
  return (await baileys()).startBaileysSession(sessionId);
}

export async function stopBaileysSession(sessionId: string) {
  return (await baileys()).stopBaileysSession(sessionId);
}

export async function sendBaileysMessage(
  sessionId: string,
  phone: string,
  message: string,
) {
  return (await baileys()).sendBaileysMessage(sessionId, phone, message);
}

export async function sendBaileysFile(
  sessionId: string,
  phone: string,
  fileUrl: string,
  caption: string,
) {
  return (await baileys()).sendBaileysFile(sessionId, phone, fileUrl, caption);
}

export async function restoreAllBaileySessions() {
  return (await baileys()).restoreAllBaileySessions();
}
