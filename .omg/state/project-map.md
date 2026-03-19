# Project Map

## Modules (`modules/`)
- **Admin**: System administration and tenant management.
- **Attendance**: Employee presence tracking, check-in/out, geofencing.
- **Chat**: Real-time internal communication.
- **Finance**: Expense management, accounting, laba-rugi.
- **Integrations**: MixRadius, Market Price integration.
- **Inventory**: Warehouse management, stock mutasi, asset tracking.
- **Marketing**: Canvasing, sales performance, point claims.
- **Network**: MikroTik management, ACS, ODP/ODC mapping.
- **Notification**: SYSTEM, WORK_ORDER, and Push Notifications.
- **Salary**: Payroll processing, salary components.
- **Work Order**: Task management, material usage, technician assignment.

## Shared Layers (`lib/`)
- **Repositories**: Standardized data access layer.
- **Services**: Business logic orchestration.
- **Prisma Clients**: `prisma.ts`, `prisma-radius.ts`, `prisma-billing.ts`, `prisma-mitra.ts`.
- **Auth Utils**: `auth.ts`, `jwt.ts`, `rbac.ts`.
- **Websocket**: `emitter.ts` for real-time events.

## Entry Points
- `server.ts`: Custom Express server wrapping Next.js.
- `worker.ts`: Background job worker.
- `app/api/mobile/`: Specialized routes for mobile application.
