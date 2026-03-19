# OmG Team Assembly

## Task Definition
**Objective:** Continue the Multi-Tenant Architecture audit and remediation, maximizing parallel execution while maintaining strict context hygiene (<50% limits).
**Domain:** Engineering / Security Analysis / Architecture Implementation
**Risk Profile:** High (Cross-tenant boundaries, high parallelism).

## Proposed Team Structure
| Lane | Agent | Model Profile | Reasoning Effort | Role & Responsibilities |
| :--- | :--- | :--- | :--- | :--- |
| **Orchestration** | `omg-director` | `gemini-3.1-pro` | High | Oversee swarm execution, enforce strict context pruning (drop irrelevant traces, keep <50%), coordinate handoffs. |
| **Exploration (API)** | `omg-researcher` | `gemini-3.1-flash` | Standard | Parallel scan of API routes for `tenantId` usage and isolation. |
| **Exploration (DB)** | `omg-researcher` | `gemini-3.1-flash` | Standard | Parallel scan of Prisma schemas, queries, and repositories for multi-tenant leaks. |
| **Exploration (UI)** | `omg-researcher` | `gemini-3.1-flash-lite`| Standard | Parallel scan of frontend components for tenant data boundaries. |
| **Execution (Core)** | `omg-executor` | `gemini-3.1-flash` | Standard | Implement required multi-tenant fixes in core modules. |
| **Execution (Edge)** | `omg-executor` | `gemini-3.1-flash` | Standard | Implement required fixes in edge cases and UI components. |
| **Decision** | `omg-architect` | `gemini-3.1-pro` | High | Evaluate multitenant boundaries against Modular Monolith principles. |
| **Quality** | `omg-reviewer` | `gemini-3.1-pro` | High | Security audit for Tenant IDOR vulnerabilities and cross-tenant data bleed. |
| **Verification** | `omg-verifier` | `gemini-3.1-pro` | High | Validate structural correctness and behavior (run builds, tests). |
| **Editorial** | `omg-editor` | `gemini-3.1-flash` | Standard | Synthesize findings and track progress, discarding old context. |

## Collaboration Protocol
- **Flow:** `omg-director` spawns `omg-researcher` swarm -> `omg-architect` designs fixes -> `omg-executor` swarm applies fixes -> `omg-reviewer` & `omg-verifier` validate -> `omg-editor` documents.
- **Context Management (Critical):** `omg-director` will enforce strict context hygiene. Only synthesized findings and actionable diffs are passed between lanes. All raw file reads and completed task traces must be flushed from active memory to keep context usage below 50%.
- **Handoff Schema:** Must include `owner`, `lane`, `evidence`, and `termination` criteria.
- **Safety Gate:** Any discovered cross-tenant vulnerability triggers an immediate `team-verify` -> `team-fix` loop.
