# Deep Init Summary

## Core Analysis
- **Framework**: Next.js 16.1.7 (Modular Monolith)
- **Primary Language**: TypeScript
- **Database**: Prisma (Multi-DB setup: Core, Radius, Billing, Mitra)
- **Server**: Custom Express/Next.js server in `server.ts`
- **Background Processes**: `worker.ts` for cron/jobs
- **Auth**: Next-Auth + Custom Mobile Auth (JWT) in `lib/auth.ts` and `lib/mobile-auth.ts`
- **Real-time**: Socket.io in `lib/websocket`

## High-Risk Zones
- **Multi-Tenant Boundaries**: Strict `tenantId` filtering is required across all modules.
- **Multi-DB Integration**: Operations spanning multiple Prisma clients (`prisma`, `prismaRadius`, `prismaBilling`, `prismaMitra`).
- **Authorization Middleware**: Complex RBAC/ABAC logic in `lib/authorization-middleware.ts`.
- **API Mobile Routes**: Frequently require manual `tenantId` extraction and validation.

## Infrastructure
- **Deployment**: Docker Compose, K8s (`k8s/` directory)
- **CI/CD**: Jenkinsfile
- **Storage**: AWS S3/R2 via `@aws-sdk/client-s3`
