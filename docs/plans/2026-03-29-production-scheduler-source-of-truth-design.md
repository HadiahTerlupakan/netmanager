# Design Doc: Production Scheduler Source of Truth Consolidation

- Date: 2026-03-29
- Topic: Cron pod only scheduler in Jenkins + Kubernetes
- Status: Approved

## 1. Introduction

The current production deployment runs scheduled jobs from two different places:

1. The dedicated cron container in `cron/entrypoint.sh`, deployed by `k8s/production/cron-deployment.yaml` and `k8s/staging/cron-deployment.yaml`.
2. The internal Node scheduler started by `cronRegistry.startAll()` inside `server.ts`, `server-api.ts`, and `worker.ts`.

This creates overlapping execution paths in production. The most important confirmed overlaps are:

- `autoCheckout`: cron container calls `/api/cron/auto-checkout` at `23:59`, while `lib/cron-registry.ts` also schedules `autoCheckout` at `23:59`.
- `rabStatusEvaluation`: cron container and `lib/cron-registry.ts` both schedule this job at `01:00`.
- `process-overdue` and related midnight jobs are close enough in time to create operational ambiguity even when their schedules are not identical.

The production app deployment also runs multiple web replicas, so any in-process scheduler started by the app scales with the number of pods unless it is explicitly disabled.

## 2. Proposed Design

Production and staging will use the dedicated cron pod as the only scheduler source of truth.

The application pods will continue serving HTTP traffic, websocket traffic, and background processors that are not time-based schedulers, but they will no longer call `cronRegistry.startAll()` when deployed as normal web pods in staging or production.

### 2.1 Scheduler ownership

- `cron/entrypoint.sh` remains the single source of truth for production and staging schedules.
- `lib/cron-registry.ts` remains available for local development and for any future dedicated internal scheduler process, but it must not auto-start in web pods.
- The HTTP cron routes stay as the execution boundary for scheduled work triggered by the cron pod.

### 2.2 Startup guard

Introduce an explicit runtime gate, for example `ENABLE_INTERNAL_CRON`, and centralize the decision in a helper module.

Expected behavior:

- Local development: internal cron enabled by default.
- Production/staging web pods: internal cron disabled via environment.
- Any future dedicated internal worker/scheduler pod: internal cron can be enabled explicitly.

This must be applied consistently to:

- `server.ts`
- `server-api.ts`
- `worker.ts`

### 2.3 Kubernetes configuration

Both app deployments should explicitly disable internal cron:

- `k8s/production/app-deployment.yaml`
- `k8s/staging/app-deployment.yaml`

The cron deployments should remain unchanged because they do not boot the Node app scheduler; they run `cron/entrypoint.sh` directly.

### 2.4 Safety and locking

Disabling the internal scheduler in web pods removes the confirmed duplicate scheduling path, but it does not fully protect against manual or accidental repeated calls to HTTP cron routes.

As a follow-up hardening step, the HTTP cron routes should acquire execution locks close to the job boundary using `lib/cron-lock.ts` or a shared job-specific locking helper. The highest-value routes are:

- `app/api/cron/auto-checkout/route.ts`
- `app/api/cron/process-absence/route.ts`
- `app/api/cron/attendance-alert/route.ts`

This keeps the design defensive even if a route is triggered twice, called manually, or reintroduced from another scheduler in the future.

## 3. Implementation Steps

1. Add a small helper that decides whether internal cron should start in the current runtime.
2. Gate `cronRegistry.startAll()` behind that helper in all runtime entrypoints.
3. Add explicit `ENABLE_INTERNAL_CRON=false` to staging and production app deployments.
4. Add tests for the startup gate and for the route/manifest behavior that is easy to verify in isolation.
5. Optionally harden the HTTP cron routes with execution locks in a second pass.

## 4. Rollout Strategy

Roll out in two phases.

### Phase 1: Source-of-truth consolidation

- Disable internal cron in app pods.
- Keep the existing cron pod schedules unchanged.
- Verify scheduled jobs still run from the cron pod and no duplicate job execution is observed.

### Phase 2: Route hardening

- Add execution locks to the HTTP cron routes.
- Confirm manual duplicate requests are ignored safely.

This phased rollout minimizes risk because it first removes the known overlap without changing the current external cron schedule topology.

## 5. Success Criteria

- Production web pods do not call `cronRegistry.startAll()`.
- Staging web pods do not call `cronRegistry.startAll()`.
- The dedicated cron pod remains the only active scheduler in production and staging.
- `autoCheckout` and `rabStatusEvaluation` no longer have dual scheduler ownership in production.
- The codebase has one clearly documented production scheduler source of truth.
