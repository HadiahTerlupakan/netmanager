# Attendance Geofence Policy Design

**Date:** 2026-03-08

**Problem**

Attendance geofence behavior is currently one-size-fits-all in practice: mobile warns when outside the zone, while backend records outside status but does not enforce it. That works for mixed operations, but it does not let the business explicitly distinguish users who must be on-site from users who are allowed to work remotely.

**Goal**

Add a configurable per-user geofence policy so attendance can behave differently for WFO, hybrid, and WFH users without coupling location policy to schedule policy.

## Recommended Design

Introduce a new user-level enum field named `attendanceGeofencePolicy` with these values:

- `STRICT`: user must be inside one of their allowed site geofences to check in or check out.
- `WARN`: user may attend outside the geofence, but mobile shows a warning and backend stores outside metadata.
- `DISABLED`: geofence does not block or warn for this user, though submitted coordinates may still be recorded.

This field is separate from `workingHourMode`. `workingHourMode` controls schedule semantics (`FIXED`, `SHIFT`, `FLEXIBLE`), while `attendanceGeofencePolicy` controls location enforcement semantics.

## Why This Approach

- It matches the real business need: some people are WFO, some hybrid, some WFH.
- It avoids overloading `workingHourMode`, which already means something different.
- It keeps backend as the source of truth, so manipulated mobile requests cannot bypass enforcement.
- It fits the current data model, where users already have site assignments and geofence zones are derived from those assignments.

## Data Model

Add a new enum and field in Prisma:

- Enum: `AttendanceGeofencePolicy`
- Field on `User`: `attendanceGeofencePolicy AttendanceGeofencePolicy @default(WARN)`

Defaulting to `WARN` makes rollout safe for existing users by preserving current behavior until admins choose stricter or looser policies.

## Backend Behavior

### Geofence Evaluation

Reuse the existing `GeofenceService.validateGeofence(userId, latitude, longitude)` result as the shared geofence fact source.

### Enforcement Rules

For both `checkIn` and `checkOut` in `modules/attendance/services/AttendanceService.ts`:

- `STRICT`
  - If geofence result is outside, reject the request with a domain error such as `OUTSIDE_GEOFENCE`.
  - Persist nothing for the rejected attendance event.
- `WARN`
  - Accept the request.
  - Persist `OUTSIDE` status, nearest distance, and nearest site name as today.
- `DISABLED`
  - Accept the request.
  - Do not block based on geofence.
  - If coordinates are present, it is still acceptable to store diagnostic location metadata for audit visibility.

### API Contract

Expose the resolved geofence policy from `GET /api/mobile/geofence` so mobile can render the right UX without duplicating business rules.

Recommended response shape extension:

```json
{
  "success": true,
  "data": {
    "zones": [],
    "policy": "WARN",
    "config": {
      "enableWarning": true,
      "requirePhoto": true
    }
  }
}
```

## Mobile Behavior

Update `mobile-netmanager/app/(app)/absensi.tsx` to drive the warning/blocking flow from backend policy.

- `STRICT`
  - If outside geofence, show a blocking modal.
  - Do not let user continue submission.
- `WARN`
  - Keep current warning flow.
  - User can continue after confirming.
- `DISABLED`
  - Skip the outside-geofence warning modal.

Mobile remains advisory for UX, but backend remains authoritative for enforcement.

## Admin UX

Add `attendanceGeofencePolicy` to user management UI, most naturally beside existing working-hours configuration in `app/admin/users/[id]/WorkingHoursSettings.tsx` or the equivalent user detail form.

Suggested labels:

- `STRICT` -> `Wajib dalam area site`
- `WARN` -> `Boleh di luar area, tampilkan peringatan`
- `DISABLED` -> `Nonaktifkan aturan geofence`

## Migration and Rollout

- Add Prisma migration for enum + user field.
- Default all existing users to `WARN`.
- Add admin control before enforcing `STRICT` anywhere.
- No mobile hard break should occur if mobile temporarily receives no `policy`; fallback can remain `WARN` during rollout.

## Error Handling

Introduce a clear backend error code for strict violations, for example:

- code: `OUTSIDE_GEOFENCE`
- message: `Anda berada di luar area absensi yang diizinkan`

This lets mobile display a specific message for strict users.

## Testing Strategy

Backend must cover:

- `STRICT` inside geofence -> pass
- `STRICT` outside geofence -> reject
- `WARN` outside geofence -> pass and persist outside metadata
- `DISABLED` outside geofence -> pass
- `checkOut` mirrors the same policy behavior

Mobile must cover:

- `STRICT` outside -> modal blocks submission
- `WARN` outside -> modal allows continue
- `DISABLED` outside -> no geofence modal

## Non-Goals

- No per-day override yet
- No per-site default override yet
- No automatic derivation from `workingHourMode`

These can be added later if operational needs evolve, but they are not required for a correct first version.
