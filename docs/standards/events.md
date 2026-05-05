# Events Pattern

## Event Naming Convention

```typescript
// Pattern: <domain>.<entity>.<action>
"attendance.leave.approved"
"finance.invoice.paid"
"work-order.task.completed"
"users.user.created"
```

## Event Payload Structure

```typescript
interface DomainEvent<T> {
  id: string;              // Unique event ID
  type: string;            // Event type (e.g., "attendance.leave.approved")
  version: number;         // Schema version
  timestamp: Date;         // When event occurred
  userId: string;          // Who triggered the event
  tenantId: string;        // Tenant context
  data: T;                 // Event-specific payload
  metadata?: Record<string, unknown>;
}
```

## Delivery Guarantee

- Default: **at-least-once** (handlers wajib idempotent)
- Critical events: **exactly-once** dengan deduplication key
- Retry strategy: exponential backoff, max 3 attempts
- Dead Letter Queue untuk failed events

## Schema Versioning

- Event payload wajib include `version` field
- Backward compatibility untuk 2 versi terakhir
- Deprecated fields: soft delete dengan warning log
- Breaking changes: bump version + migration guide

## Event Handler Pattern

```typescript
// Idempotent handler
async function handleLeaveApproved(event: DomainEvent<LeaveApprovedData>) {
  // Check if already processed (idempotency)
  const processed = await checkProcessed(event.id);
  if (processed) return;

  // Process event
  await syncAttendance(event.data);
  await sendNotification(event.data);

  // Mark as processed
  await markProcessed(event.id);
}
```

## Dead Letter Queue

- Failed events masuk DLQ setelah 3 retry
- Alert untuk DLQ > 10 events
- Manual replay mechanism untuk recovery
- Log failure reason untuk debugging

## Event Dispatcher Location

- Semua dispatchers di `modules/events/dispatchers/`
- One dispatcher per domain (e.g., `LeaveEventDispatcher`, `InvoiceEventDispatcher`)
