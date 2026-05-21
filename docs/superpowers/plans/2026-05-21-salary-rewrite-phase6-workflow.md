# Phase 6: Workflow & Compliance

## Objective
Implement workflow services for payroll compliance validation, multi-step approval, and audit trail logging.

## Components

### 1. ComplianceRuleEngine
- Runs compliance checks against payroll entries
- Configurable rules with severity levels (ERROR, WARNING)
- Built-in rules: UMR_CHECK, NEGATIVE_NET_SALARY, OVERTIME_DAILY_CAP, BPJS_ENROLLMENT
- Returns structured results with affected entries, messages, and suggestions

### 2. PayrollApprovalService
- Configurable multi-step approval workflow
- Validates if a user can approve at current step
- Tracks approval/rejection/revision-request actions
- Supports auto-approve below threshold

### 3. PayrollAuditService
- Creates audit log entries for any payroll entity change
- Tracks field-level changes (old value → new value)
- Requires reason for sensitive operations (unlock, delete, recalculate)

## Files

### Implementation
- `modules/salary-v2/workflow/compliance/ComplianceRuleEngine.ts`
- `modules/salary-v2/workflow/approval/PayrollApprovalService.ts`
- `modules/salary-v2/workflow/audit/PayrollAuditService.ts`
- `modules/salary-v2/workflow/index.ts`

### Tests
- `tests/modules/salary-v2/workflow/compliance.test.ts`
- `tests/modules/salary-v2/workflow/approval.test.ts`
- `tests/modules/salary-v2/workflow/audit.test.ts`

## Design Principles
- Pure services, no database access (depend on interfaces)
- Fully testable with mocks
- Follow existing patterns from Phase 1-5

## Verification
```bash
npx vitest run tests/modules/salary-v2/workflow/
```

## Commit
```
feat(salary-v2): add workflow module (compliance, approval, audit)
```
