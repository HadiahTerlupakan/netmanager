# Agent Collaboration Protocol

## Overview

Project ini menggunakan **multi-agent AI system**. Semua agent (Claude, GPT, Gemini, Cursor, Copilot, atau custom agent lainnya) **wajib mengikuti protokol ini** untuk memastikan konsistensi dan kontinuitas.

## Universal Communication Format

**Task Delegation Format (WAJIB):**
```markdown
## TASK HANDOFF

**Task ID:** [UUID atau format: YYYY-MM-DD-NO]
**Previous Agent:** [Nama agent sebelumnya]
**Current Agent:** [Nama agent saat ini]
**Status:** [IN_PROGRESS | BLOCKED | COMPLETED]

### Context Summary
[Summary singkat apa yang sudah dikerjakan dan current state]

### What Has Been Done
- [x] Item 1 yang sudah selesai
- [x] Item 2 yang sudah selesai

### What Needs to Be Done
- [ ] Item yang perlu dikerjakan
- [ ] Item berikutnya

### Important Decisions Made
- Decision 1: [Kenapa dipilih]
- Decision 2: [Kenapa dipilih]

### Files Modified
- `path/to/file.ts` - [Apa yang diubah]
- `path/to/file2.ts` - [Apa yang diubah]

### Blockers (if any)
- [Jika ada masalah yang menghalangi]

### Next Steps
[Rekomendasi langkah berikutnya]
```

## Context Preservation Rules

**1. Task Tracking (WAJIB):**
- Setiap task wajib ada Task ID
- Gunakan TaskCreate/TaskUpdate untuk tracking progress
- Jangan pernah hapus task tanpa alasan jelas

**2. File State Documentation:**
```typescript
/**
 * @agent [Nama Agent]
 * @date [YYYY-MM-DD]
 * @task [Task ID]
 * @status [IN_PROGRESS|COMPLETED]
 * @next [Apa yang perlu dilanjutkan]
 * 
 * CHANGELOG:
 * - [YYYY-MM-DD] [Agent]: [Deskripsi perubahan]
 * - [YYYY-MM-DD] [Agent]: [Deskripsi perubahan]
 */
```

**3. Decision Log:**
Setiap architectural decision wajib dicatat di `docs/decisions/`:
```markdown
# [YYYY-MM-DD] - [Judul Decision]

## Context
[Apa situasinya, constraint apa yang ada]

## Decision
[Decision yang diambil]

## Consequences
- Positive: [Keuntungan]
- Negative: [Kerugian/trade-off]

## Alternatives Considered
- [Alt 1]: [Kenapa tidak dipilih]
- [Alt 2]: [Kenapa tidak dipilih]
```

## Agent Responsibility Matrix

| Agent Type | Primary Role | Secondary Role | Forbidden Actions |
|------------|-------------|----------------|-------------------|
| **Claude** | Arsitektur, Refactor besar, Code Review | Dokumentasi, Testing | Jangan ubah config tanpa approval |
| **GPT-4** | Implementasi fitur, Debugging | Refactor kecil, Dokumentasi | Jangan ubah arsitektur fundamental |
| **Copilot** | Code completion, Boilerplate | Simple refactoring | Jangan ubah business logic |
| **Cursor** | Full-stack development, UI | Integration | Jangan ubah database schema |
| **Custom Agent** | [Definisikan sendiri] | [Definisikan sendiri] | [Definisikan sendiri] |

## Code Consistency Across Agents

**1. Style Enforcement:**
Semua agent wajib ikut aturan di section [CODE QUALITY] di CLAUDE.md.

**2. Pattern Library:**
Gunakan pattern yang sudah ada di codebase:
```typescript
// Jangan invent pattern baru kalau sudah ada pattern exist
// ✅ Gunakan pattern yang sama dengan file lain
const result = await service.create(data); // ✅ Sudah ada pattern ini

// ❌ Jangan invent pattern baru
const response = await myCustomHandler(data); // ❌ Pattern tidak konsisten
```

**3. Before Modifying Existing Code:**
```markdown
1. Baca file target sepenuhnya
2. Identifikasi pattern yang digunakan
3. Ikuti pattern yang sama
4. Kalau pattern lama (deprecated), migrate ke pattern baru
5. Jangan mix pattern lama dan baru dalam satu file
```

## Conflict Resolution

**When Two Agents Disagree:**
1. **Technical disagreement**: Default ke standar yang ada di CLAUDE.md
2. **Architectural disagreement**: Buat ADR (Architecture Decision Record), diskusi dengan human
3. **Style disagreement**: Follow existing code style di file yang dimodifikasi
4. **Breaking change**: WAJIB approval dari human

## Handoff Triggers

**Wajib Handoff ke Agent Lain:**
1. Task terlalu besar untuk satu session (estimasi > 2 jam)
2. Butuh expertise berbeda (e.g., dari backend ke frontend)
3. Blocked dan butuh fresh perspective
4. Human explicitly request agent switch

**How to Handoff:**
```markdown
1. Update task dengan summary progress
2. Commit/push changes (kalau ada)
3. Format handoff message sesuai template
4. Mention next agent (if specific)
```
