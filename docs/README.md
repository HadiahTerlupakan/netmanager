# Documentation Index

Dokumentasi project ini dipecah menjadi beberapa kategori untuk memudahkan navigasi dan mengurangi ukuran CLAUDE.md.

## 📁 Structure

```
docs/
├── architecture/          # Architectural patterns & decisions
├── standards/            # Coding standards & best practices
├── guides/              # How-to guides & workflows
└── decisions/           # Architecture Decision Records (ADR)
```

## 🏗️ Architecture

- **[Clean Architecture](architecture/clean-architecture.md)** - Module structure, dependency rules, migration strategy

## 📋 Standards

- **[Error Handling](standards/error-handling.md)** - Result pattern, error categories, exception handling
- **[Authorization](standards/authorization.md)** - RBAC, multi-tenant isolation, ExecutionContext pattern
- **[Caching](standards/caching.md)** - Cache layers, invalidation strategies, key naming
- **[Testing](standards/testing.md)** - Coverage requirements, mocking strategy, test structure
- **[Events](standards/events.md)** - Event naming, payload structure, delivery guarantees
- **[Transactions](standards/transactions.md)** - Transaction patterns, consistency levels, pagination
- **[Security & Performance](standards/security-performance.md)** - Security checklist, logging, performance budget, scalability

## 📖 Guides

- **[Agent Collaboration](guides/agent-collaboration.md)** - Multi-agent protocol, task handoff, conflict resolution

## 🎯 Quick Links

### For New Features
1. Read [Clean Architecture](architecture/clean-architecture.md) untuk struktur module
2. Read [Error Handling](standards/error-handling.md) untuk error pattern
3. Read [Testing](standards/testing.md) untuk test requirements

### For Code Review
1. Check [Clean Architecture](architecture/clean-architecture.md) untuk dependency rules
2. Check [Security & Performance](standards/security-performance.md) untuk security checklist
3. Check CLAUDE.md untuk code quality standards

### For Multi-Agent Work
1. Read [Agent Collaboration](guides/agent-collaboration.md) untuk handoff protocol
2. Create ADR di `decisions/` untuk architectural decisions
3. Update task tracking dengan TaskCreate/TaskUpdate

## 📝 Architecture Decision Records (ADR)

Semua architectural decisions dicatat di folder `decisions/` dengan format:

```markdown
# [YYYY-MM-DD] - [Judul Decision]

## Context
[Situasi dan constraint]

## Decision
[Decision yang diambil]

## Consequences
- Positive: [Keuntungan]
- Negative: [Trade-off]

## Alternatives Considered
- [Alt 1]: [Kenapa tidak dipilih]
```

## 🔄 Maintenance

Dokumentasi ini harus di-update ketika:
- New pattern identified dan validated
- Breaking change di infrastructure
- Security incident (lessons learned)
- Performance optimization (new best practice)
- New tool/technology adoption

---

*Last Updated: 2026-05-05*
