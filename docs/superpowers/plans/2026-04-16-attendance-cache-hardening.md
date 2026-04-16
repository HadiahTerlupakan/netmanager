# Attendance Cache Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hardening cache attendance agar Redis failure tidak memutus alur attendance inti dan invalidation settings.

**Architecture:** Pertahankan key cache yang ada, tetapi ubah semua read/write/invalidation Redis di scope attendance menjadi best-effort. Source of truth tetap repository/database, sedangkan Redis hanya akselerator.

**Tech Stack:** Next.js, TypeScript, Prisma, Vitest, ioredis.

---

### Task 1: Tambah failing tests
- [ ] Tambah test fallback Redis untuk AttendanceTimezoneService.
- [ ] Tambah test fallback Redis untuk HolidayRepository.
- [ ] Tambah test fallback Redis untuk AttendanceService.
- [ ] Tambah test route settings general tetap sukses saat invalidasi cache attendance gagal.

### Task 2: Implementasi minimal
- [ ] Bungkus operasi Redis get/setex/del di AttendanceTimezoneService.
- [ ] Bungkus operasi Redis get/setex/del di HolidayRepository.
- [ ] Bungkus operasi Redis get/setex di AttendanceService.
- [ ] Perbaiki invalidation di route settings general agar eksplisit dan tidak silent swallow tanpa log.

### Task 3: Verifikasi
- [ ] Jalankan test attendance terkait.
- [ ] Jalankan test API settings terkait.
- [ ] Jalankan typecheck.
