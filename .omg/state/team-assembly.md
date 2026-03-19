# OmG Team Assembly

## Task Definition
**Objective:** Audit the codebase for Multi-Tenant Architecture implementation and security.
**Domain:** Engineering / Security Analysis
**Risk Profile:** High (Cross-tenant data leakage is a critical security vulnerability).

## Proposed Team Structure
| Lane | Agent | Model Profile | Reasoning Effort | Role & Responsibilities |
| :--- | :--- | :--- | :--- | :--- |
| **Orchestration** | `omg-director` | `gemini-3.1-pro` | High | Manage context limit (<50%), distribute tasks, oversee subagent parallel execution. |
| **Exploration** | `omg-researcher` | `gemini-3.1-flash` | Standard | Parallel codebase scanning for `tenantId` usage, Prisma schema analysis, and API middleware checks. |
| **Decision** | `omg-architect` | `gemini-3.1-pro` | High | Evaluate multitenant boundaries against Modular Monolith principles. |
| **Quality** | `omg-reviewer` | `gemini-3.1-pro` | High | Security audit for Tenant IDOR vulnerabilities and cross-tenant data bleed. |
| **Editorial** | `omg-editor` | `gemini-3.1-flash` | Standard | Synthesize findings into a concise, actionable audit report. |

## Collaboration Protocol
- **Flow:** `omg-director` -> `omg-researcher` (parallel lanes) -> `omg-reviewer` -> `omg-architect` -> `omg-editor`.
- **Context Management:** `omg-director` will enforce strict context hygiene, dropping raw trace data and only passing synthesized findings to downstream agents.
- **Handoff Schema:** Findings must include explicit file paths and vulnerability confidence scores before handing off to the `omg-architect`.
- **Safety Gate:** Any discovered cross-tenant vulnerability must trigger an immediate `verify-fix` loop proposal.
