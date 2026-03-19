# Architectural Rules: Modular Monolith

## Core Principles
1. **Module Isolation:** All core business logic resides in `modules/`. Each module must act as an independent bounded context.
2. **No Direct Cross-Module Database Access:** A module's Repository (`modules/*/repositories/*`) MUST NOT perform direct SQL JOINs or Prisma relations (like `include`) into tables owned by another module. 
3. **Service-to-Service Communication:** If Module A needs data from Module B, Module A's Service must call Module B's Service. Data aggregation happens at the application/service layer, not the database layer.
4. **Thin Controllers:** API Routes (`app/api/*`) must remain thin. They are only responsible for request parsing, authorization (via `auth: true` or `authorize` middleware), and passing data to the appropriate module Service.
5. **Database Layer:** Prisma Client is the ORM. Query logic must be encapsulated within the Repository layer inside each module. Avoid deep nested `include` statements if specific `select` statements can fulfill the requirement efficiently.

## Security Constraints
- **IDOR Prevention:** All API endpoints dealing with specific IDs (`[id]/route.ts`) MUST verify ownership or tenancy (`siteId`, `tenantId`, `userId`) against the current session context before returning or modifying data.
- **No Hardcoded Secrets:** Credentials and API keys must use environment variables (`process.env.*`) and must never be hardcoded in application code or shell scripts.
