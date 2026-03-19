# OmG Workflow Protocol

## Active Flow: Multitenant Audit

1. **Phase 1: team-plan** 
   - Establish scope of multitenant audit (Database layer, API layer, UI layer).
2. **Phase 2: team-prd**
   - Define exact acceptance criteria for "Secure Multitenancy" in this codebase.
3. **Phase 3: taskboard**
   - Generate discrete subagent tasks.
4. **Phase 4: team-exec**
   - Spawn `omg-researcher` agents in parallel to scan `modules/`, `app/api/`, and `lib/prisma.ts`.
5. **Phase 5: team-verify**
   - `omg-reviewer` evaluates findings for false positives.
6. **Phase 6: team-fix** (If needed)
   - Remediate any discovered tenant-leaks.
