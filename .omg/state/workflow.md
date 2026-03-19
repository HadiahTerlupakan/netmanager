# OmG Execution Workflow

## Current Phase: Orchestration Setup
The team has been assembled and optimized for high-parallelism exploration and remediation of the multi-tenant architecture, with strict context pruning enforced.

## Approved Execution Path
1. **`team-plan`**: Formulate the multi-tenant audit strategy, prioritizing API, Database, and UI components into parallel workstreams.
2. **`team-prd`**: Define the strict acceptance criteria for cross-tenant isolation.
3. **`taskboard`**: Update `.omg/state/taskboard.md` with explicit tasks for each exploration swarm.
4. **`team-exec`**: Spawn parallel `omg-researcher` and `omg-executor` subagents to process tasks. Context pruning runs after each lane handoff.
5. **`team-verify`**: `omg-verifier` and `omg-reviewer` run structural checks, build verifications, and IDOR/leak checks.
6. **`team-fix`**: Triggered automatically if verification fails.

## Operational Constraints
- **Context Limit**: Must not exceed 50%.
- **Context Pruning**: Raw file reads and obsolete discussions must be flushed before advancing to the next phase.
- **Subagent Swarms**: `omg-director` manages multiple concurrent lanes for exploration and execution.
- **Safety**: Do not commit changes without `omg-verifier` signoff on isolation correctness.
