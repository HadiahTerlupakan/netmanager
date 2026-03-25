# OmG Taskboard

## Active Lane: attendance-audit
**Status:** In Progress

| Task ID | Status | Owner | Dependency | Worktree | Lane Health | Summary | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ATT-001 | verified | omg-executor | - | root | clean | Fix ESLint 'any' in UsersCompareClient.tsx | Build Success |
| ATT-002 | verified | omg-executor | - | root | clean | Integrate LeaveRequest (SICK/PERMIT) into Admin Attendance API | Build Success |
| ATT-003 | verified | omg-executor | ATT-002 | root | clean | Daily expansion logic for LeaveRequests in Attendance API | Build Success |
| ATT-004 | verified | omg-executor | - | root | clean | UI: Distinct labels for SICK/PERMIT and hide location for non-attendance | Build Success |
| ATT-005 | verified | omg-executor | ATT-003 | root | clean | Fix combined pagination and integrate leaves into CSV Export | Build Success |
| ATT-006 | verified | omg-executor | - | root | clean | Fix date range bug (Mar 24 missing) and add "Belum Checkout" status | Build Success |
| ATT-007 | verified | omg-executor | - | root | clean | Show check-in details for Auto-checkout (Mangkir) and hide for Alpha | Build Success |
| ATT-008 | completed | omg-executor | - | root | clean | API: Deduplicate leave vs attendance and filter auto-gen entries | Build Success |
| ATT-009 | completed | omg-executor | ATT-008 | root | clean | UI: Refine labels for Mangkir (System) vs Alpha (Pure) | Build Success |
| ATT-010 | completed | omg-executor | ATT-008 | root | clean | UI: Hide location for pure Alpha/Leave entries | Build Success |
| ATT-011 | completed | omg-executor | ATT-009 | root | clean | UI: Infer original check-in status (Tepat Waktu/Terlambat) for forgot checkout | Build Success |

## Lane: inventory-restock-audit-remediation (Archived)
**Status:** Completed

| Task ID | Status | Owner | Dependency | Worktree | Lane Health | Summary | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-001 | verified | omg-architect | - | root | clean | Refactor brittle warehouse detection (regex fallback) | Code Audit |
| INV-002 | verified | omg-executor | - | root | clean | Add backend validation for non-negative received quantity | Code Audit |
| INV-003 | verified | omg-executor | - | root | clean | Add "Tutup Pesanan" checkbox for flexible receipt completion | Code Audit |
| INV-004 | verified | omg-executor | - | root | clean | Per-item Arrived Toggle (Explicit Selection) | UI/UX Verified |
| INV-005 | verified | omg-executor | - | root | clean | Bug Fix: Corrected received quantity persistence logic | Code Audit |
