# Project Memory — Index

**Last Updated:** 2026-08-09  
**Reconnaissance Confidence:** 85%  
**Purpose:** Persistent knowledge base untuk NetManager project — bertahan melewati context compaction

---

## 📖 Quick Navigation

### Core Documentation
1. **[00-overview.md](00-overview.md)** — Project overview, tujuan, stakeholders, value proposition
2. **[01-stack.md](01-stack.md)** — Technology stack lengkap (runtime, framework, dependencies)
3. **[02-directory-map.md](02-directory-map.md)** — Struktur direktori, file organization, ownership
4. **[03-architecture.md](03-architecture.md)** — Architecture patterns, layering, request lifecycle
5. **[06-database.md](06-database.md)** — Database schema analysis (244 tables across 4 DBs)
6. **[10-configuration.md](10-configuration.md)** — Environment variables, secrets, configuration
7. **[11-testing.md](11-testing.md)** — Testing strategy, coverage, test database setup

### Analysis Reports (External Subagent Results)
- **API Routes:** `docs/reports/api-routes-analysis.json` (599 endpoints)
- **API Report:** `docs/reports/api-routes-report.md` (detailed documentation)
- **API Summary:** `docs/reports/api-routes-executive-summary.md` (business-critical endpoints)

### In Progress / To Be Completed
- **[04-modules.md]** — Module-by-module deep dive (pending)
- **[05-dependency-map.md]** — Module dependency graph (pending)
- **[07-api.md]** — API documentation summary (see reports/ for now)
- **[08-business-rules.md]** — Business logic extraction (subagent working)
- **[09-integrations.md]** — External service integrations (subagent working)
- **[12-critical-flows.md]** — End-to-end flow tracing (pending)
- **[13-risk-map.md]** — Technical debt, code smells, risks (pending)
- **[14-conventions.md]** — Code conventions, patterns, standards (pending)
- **[15-known-issues.md]** — Known bugs, limitations, workarounds (pending)

---

## 🚀 Getting Started

### New to the Project?
**Start here:**
1. Read [00-overview.md](00-overview.md) — Understand what NetManager does
2. Read [01-stack.md](01-stack.md) — Know the technology
3. Read [02-directory-map.md](02-directory-map.md) — Navigate the codebase
4. Read [03-architecture.md](03-architecture.md) — Understand the patterns
5. Setup local environment (see README.md in project root)

### Working on Specific Module?
**Module-specific workflow:**
1. Read [04-modules.md] — Find your module documentation
2. Read [05-dependency-map.md] — Understand dependencies
3. Read [08-business-rules.md] — Know the business rules
4. Check CLAUDE.md — Follow coding standards

### Troubleshooting Integration Issues?
**Integration debugging:**
1. Read [09-integrations.md] — Find integration details
2. Read [10-configuration.md] — Check required env vars
3. Check logs — `lib/logger.ts` structured logging

### Understanding Database Schema?
**Database work:**
1. Read [06-database.md] — Full schema analysis
2. Check `prisma/schema.prisma` — Source of truth
3. Read migration history — `prisma/migrations/`

---

## 🎯 Quick Reference by Role

### Frontend Developer
- [02-directory-map.md](02-directory-map.md) → `/app`, `/components` section
- [03-architecture.md](03-architecture.md) → Presentation Layer
- [01-stack.md](01-stack.md) → Frontend Libraries section
- [11-testing.md](11-testing.md) → UI Component Tests

### Backend Developer
- [03-architecture.md](03-architecture.md) → Service & Repository Layers
- [04-modules.md] → Module deep dive
- [06-database.md](06-database.md) → Database schema
- [08-business-rules.md] → Business logic rules
- [11-testing.md](11-testing.md) → Service Layer Tests

### DevOps Engineer
- [01-stack.md](01-stack.md) → Infrastructure section
- [10-configuration.md](10-configuration.md) → Environment setup
- [02-directory-map.md](02-directory-map.md) → `/k8s` directory
- Jenkinsfile in project root

### QA Engineer
- [11-testing.md](11-testing.md) — Complete testing guide
- [12-critical-flows.md] — Critical flows to test
- [13-risk-map.md] — High-risk areas

### Product Manager / Business Analyst
- [00-overview.md](00-overview.md) — Business value
- [08-business-rules.md] — Business logic
- docs/reports/api-routes-executive-summary.md — Critical endpoints

---

## 📊 Project Statistics

### Codebase Size
- **Total Files:** ~7,493
- **Lines of Code:** ~633,072 (TypeScript/JavaScript)
- **Modules:** 38 domain modules
- **API Endpoints:** 599 routes
- **Test Files:** 582

### Database
- **Total Tables:** 244 (across 4 databases)
  - Main: 218 tables
  - Billing: 11 tables
  - RADIUS: 7 tables
  - Mitra: 8 tables
- **Migrations:** 84 migration files
- **Schema Lines:** 11,455 lines

### Dependencies
- **Production:** 141 packages
- **Development:** 39 packages
- **Key Frameworks:** Next.js 16, React 19, Prisma 7, Node 24

---

## 🏗️ Architecture at a Glance

### Application Type
**Modular Monolith** — Single deployable unit, domain modules, event-driven

### Deployment
- **Production:** Kubernetes (3 replicas)
- **CI/CD:** Jenkins pipeline
- **Development:** Docker Compose (local)

### Key Patterns
- **Layered Architecture:** Presentation → Service → Repository → Database
- **Clean Architecture:** 30% migrated (accounting, pelanggan, planning)
- **Event-Driven:** EventBus + BullMQ for async operations
- **Multi-Tenancy:** Row-level isolation via `tenantId`
- **RBAC:** Role-based access control

### External Integrations
- **Network Devices:** MikroTik RouterOS, FreeRADIUS, OLT (SNMP/SSH/Telnet)
- **Payment Gateways:** Xendit, Midtrans, Tripay, Duitku, Moota
- **Communication:** Firebase (push), WhatsApp (Baileys), Email (Nodemailer)
- **Storage:** AWS S3
- **Maps:** OpenLayers, Leaflet

---

## 🔍 How to Use This Documentation

### Context Compaction Recovery
Jika context conversation di-compact:
1. **WAJIB** baca [INDEX.md](INDEX.md) ini terlebih dahulu
2. Baca dokumentasi module yang relevan dengan task
3. Verifikasi informasi penting terhadap source code aktual
4. Jangan hanya mengandalkan dokumentasi — source code adalah source of truth

### Before Making Changes
**Checklist:**
- [ ] Baca module documentation yang akan diubah
- [ ] Check dependency map — apa yang terpengaruh?
- [ ] Review business rules — ada constraint yang dilanggar?
- [ ] Check API routes — ada breaking change?
- [ ] Read testing strategy — test apa yang perlu ditambah?
- [ ] Check conventions — ikuti pattern yang ada
- [ ] Update CHANGELOG.md setelah selesai

### After Significant Changes
**Update dokumentasi jika:**
- Architecture berubah (layering, patterns)
- Module structure berubah (new domain, migration)
- API contract berubah (new endpoint, breaking change)
- Database schema berubah (migration, new table)
- Business rules berubah (validation, calculation)
- External integration berubah (new service, endpoint change)
- Configuration berubah (new env var, secret)

**Cara update:**
1. Edit file yang relevan di `docs/project-memory/`
2. Update "Last Updated" timestamp
3. Commit perubahan dokumentasi bersama code changes
4. Mention di CHANGELOG.md

---

## 🎓 Learning Resources

### Internal Documentation
- **Architecture:** `docs/architecture/clean-architecture.md`
- **Standards:** `docs/standards/*.md`
- **Guides:** `docs/guides/*.md`
- **CLAUDE.md:** AI agent guidelines & project conventions
- **README.md:** Quick start guide

### External References
- Next.js 14 App Router: https://nextjs.org/docs
- Prisma ORM: https://www.prisma.io/docs
- TypeScript: https://www.typescriptlang.org/docs
- Vitest: https://vitest.dev
- Kubernetes: https://kubernetes.io/docs

---

## 🔧 Maintenance

### Document Ownership
**Primary Maintainer:** AI Agents (Claude Code)  
**Contributors:** All developers working on the project  
**Review Cadence:** On significant architectural changes

### Staleness Detection
Dokumentasi dianggap stale jika:
- Source code berubah tapi dokumentasi tidak di-update
- Contradiction antara dokumentasi dan behavior aktual
- Informasi outdated (teknologi sudah deprecated)

**Action:** Update segera atau tandai dengan `⚠️ OUTDATED` di header file

### Version Control
- Dokumentasi di-commit bersama code changes
- File history di git log untuk tracking perubahan
- Branch strategy: same as code (main branch)

---

## 📝 Documentation Standards

### File Naming Convention
- `00-overview.md` — High-level overview
- `01-stack.md` — Technology stack
- `02-directory-map.md` — File structure
- `03-architecture.md` — Architecture deep dive
- `[04-15]-*.md` — Detailed topic documentation
- `INDEX.md` — This file (navigation hub)

### Writing Style
- **Bahasa:** English (technical documentation)
- **Tone:** Professional, concise, actionable
- **Format:** Markdown with clear headers, lists, tables
- **Code Examples:** Always include when explaining patterns
- **Dates:** ISO format (YYYY-MM-DD)

### Content Requirements
- **Last Updated:** Every file must have timestamp
- **Purpose Statement:** Why this document exists
- **Quick Navigation:** Links to related docs
- **Examples:** Real examples from codebase
- **Verification:** How to verify information is still accurate

---

## 🚦 Confidence Levels

### Overall Confidence: 85%

**High Confidence (90-100%):**
- Technology stack
- Directory structure
- Database schema
- API endpoints inventory
- Configuration requirements

**Medium Confidence (70-89%):**
- Architecture patterns (still discovering nuances)
- Business rules (partial coverage)
- Module dependencies (high-level understood)
- External integrations (interfaces known, details pending)

**Low Confidence (50-69%):**
- Complete business logic extraction (in progress)
- All edge cases and special rules
- Historical context for decisions
- Performance bottlenecks
- Production issues history

**Unknown Areas (<50%):**
- Detailed user workflows across all portals
- Complete external API contract details
- All production incidents and resolutions
- Customer-specific customizations
- Undocumented features or workarounds

### How to Improve Confidence
1. **Verify against source code** — Always double-check
2. **Run the code** — Test behavior, don't assume
3. **Ask domain experts** — Clarify business rules
4. **Check git history** — Understand why decisions were made
5. **Update documentation** — Improve for next person

---

## ⚠️ Important Notes

### Source of Truth
1. **Source Code** — Ultimate truth
2. **Database Schema** (Prisma) — Data structure truth
3. **CHANGELOG.md** — Change history truth
4. **This Documentation** — Context & understanding
5. **Comments in Code** — Only for non-obvious WHY

**Priority:** Code > Schema > Changelog > Docs > Comments

### When Documentation Conflicts with Code
**Always trust the code.** Dokumentasi adalah snapshot, code adalah reality.

**Action:**
1. Verify behavior dari source code
2. Update dokumentasi yang salah
3. Commit correction dengan prefix `docs: fix incorrect info in ...`

### Limitations of This Documentation
- **Not Real-Time:** Manual updates required
- **Not Complete:** Some areas still pending
- **Not Prescriptive:** Describes what IS, not always what SHOULD BE
- **Not Comprehensive:** Focus on high-value information

**For comprehensive details:** Read source code directly

---

## 📞 Support

### Questions About Documentation?
- Check source code to verify
- Read CLAUDE.md for conventions
- Check git log for context
- Ask team members for clarification

### Need to Add New Documentation?
1. Follow naming convention (`[number]-topic.md`)
2. Add entry to this INDEX.md
3. Include "Last Updated" timestamp
4. Link related documentation
5. Commit with descriptive message

### Found Outdated Information?
1. Verify against source code
2. Update the file
3. Update timestamp
4. Commit with `docs: update [topic] - [what changed]`

---

## 🎯 Reconnaissance Status

### Completed Phases ✅
- [x] Phase 1 — Complete Inventory
- [x] Phase 2 — Technology Reconnaissance
- [x] Phase 3 — Architecture Discovery
- [x] Phase 4 — Dependency Graph (high-level)
- [x] Phase 5 — Database Deep Dive
- [x] Phase 6 — API & Route Discovery
- [x] Phase 8 — Configuration & Environment
- [x] Phase 9 — Testing & Expected Behavior
- [x] Phase 13 — Build Project Memory (this!)

### In Progress 🔄
- [ ] Phase 7 — Business Logic Extraction (subagent working)
- [ ] Phase 10 — External Integrations (subagent working)
- [ ] Phase 11 — Critical Flow Tracing
- [ ] Phase 12 — Codebase Risk Analysis

### Pending ⏳
- [ ] Phase 14 — File-to-Knowledge Mapping
- [ ] Phase 15 — Knowledge Consistency Check
- [ ] Phase 16 — Final Self-Test
- [ ] Phase 17 — Future Context Protocol

---

## 🏁 Next Steps

### For AI Agents
1. Load this INDEX.md first when starting new conversation
2. Read relevant documentation for the task
3. Verify critical information against source code
4. Update documentation if anything changed
5. Use as recovery mechanism after context compaction

### For Human Developers
1. Bookmark this INDEX.md
2. Consult before major changes
3. Update after architectural changes
4. Use as onboarding material for new team members
5. Contribute improvements

---

**Project Memory Build:** IN PROGRESS (85% complete)  
**Total Documentation Files:** 7 core files + reports  
**Last Major Update:** 2026-08-09  
**Maintainer:** AI Agents + Development Team
