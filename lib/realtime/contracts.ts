export type RealtimeEventType =
  | "notification.new"
  | "notification.count"
  | "ticket.new"
  | "ticket.update"
  | "ticket.reply"
  | "ticket.message"
  | "ticket.count"
  | "workorder.new"
  | "workorder.update"
  | "workorder.assigned"
  | "workorder.activity"
  | "inventory.update"
  | "chat.message"
  | "attendance.checkin"
  | "attendance.checkout"
  | "attendance.absent"
  | "announcement.new"
  | "payment.pending.new"
  | "mikrotik.update"
  | "radius.stats"
  | "radius.sessions"
  | "profile.refresh"
  | "partner.invitation"
  | "partner.response"
  | "session.force_logout"
  | "user.status"
  | "user.permissions_update"
  | "admin.location.update";

export interface RealtimeScope {
  kind: "user" | "department" | "admin" | "workorder" | "ticket";
  id: string;
}

export interface RealtimeEnvelope<TPayload = unknown> {
  id: string;
  type: RealtimeEventType;
  scope: RealtimeScope;
  payload: TPayload;
  triggeredBy?: string;
  createdAt: string;
  version: 1;
  /**
   * Tenant pemilik event. Satu-satunya sumbu isolasi yang tersedia bagi aturan
   * Firestore: jalur dokumen hanya memuat id scope, dan aturan tidak bisa
   * menanyakan Postgres. Tanpa field ini, scope `workorder` dan `ticket` hanya
   * bisa dibuka seluruhnya untuk admin atau seluruhnya untuk semua orang —
   * teknisi yang ditugaskan tidak kebagian, atau tenant lain ikut kebagian.
   */
  tenantId: string | null;
}

export interface PresenceSnapshot {
  userId: string;
  isOnline: boolean;
  source: "web" | "mobile" | "system";
  updatedAt: string;
  lastSeenAt: string;
}

export interface SetPresenceInput {
  userId: string;
  isOnline: boolean;
  source: "web" | "mobile" | "system";
  lastSeenAt?: string;
}
