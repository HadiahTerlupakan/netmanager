import type { RealtimeEventType, RealtimeScope } from "./contracts";

export const LEGACY_TO_REALTIME_EVENT: Record<string, RealtimeEventType> = {
  "notification:new": "notification.new",
  "notification:count": "notification.count",
  "ticket:new": "ticket.new",
  "ticket:update": "ticket.update",
  "ticket:reply": "ticket.reply",
  "ticket:message": "ticket.message",
  "ticket:count": "ticket.count",
  "workorder:new": "workorder.new",
  "workorder:update": "workorder.update",
  "workorder:assigned": "workorder.assigned",
  "workorder:activity": "workorder.activity",
  "inventory:update": "inventory.update",
  "chat:message": "chat.message",
  "announcement:new": "announcement.new",
  "payment:pending_new": "payment.pending.new",
  "payment:pending:new": "payment.pending.new",
  "mikrotik:update": "mikrotik.update",
  "radius:stats": "radius.stats",
  "radius:sessions": "radius.sessions",
  "profile:refresh": "profile.refresh",
  "partner:invitation": "partner.invitation",
  "partner:response": "partner.response",
  "session:forceLogout": "session.force_logout",
  "user:status": "user.status",
  "user:permissions_update": "user.permissions_update",
  "admin:location:update": "admin.location.update",
};

export function getEventSubscriptionNames(event: string): string[] {
  const legacyAliases = Object.entries(LEGACY_TO_REALTIME_EVENT)
    .filter(([, realtimeEvent]) => realtimeEvent === event)
    .map(([legacyEvent]) => legacyEvent);

  return [event, ...legacyAliases];
}

export function buildScopeChannel(scope: RealtimeScope): string {
  switch (scope.kind) {
    case "user":
      return `users/${scope.id}/events`;
    case "department":
      return `departments/${scope.id}/events`;
    case "admin":
      return `admins/${scope.id}/events`;
    case "workorder":
      return `workorders/${scope.id}/events`;
    case "ticket":
      return `tickets/${scope.id}/events`;
  }
}

export function buildPresencePath(userId: string): string {
  return `presence/users/${userId}`;
}

export function buildScopeConsumerPath(
  scope: RealtimeScope,
  userId?: string,
): string {
  const scopeKey = encodeURIComponent(`${scope.kind}:${scope.id}`);
  const basePath = `presence/scopes/${scopeKey}/consumers`;

  if (!userId) {
    return basePath;
  }

  return `${basePath}/${userId}`;
}
