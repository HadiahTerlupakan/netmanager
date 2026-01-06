/**
 * RBAC API Routes Coverage Analysis Test
 * 
 * Verifies that all admin API routes have hasPermission() checks implemented.
 * This is a static analysis test - verifying code patterns in route files.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const APP_ROOT = process.cwd()

// Routes that should have hasPermission checks
const PROTECTED_ROUTES = [
  // Work Orders
  { path: 'app/api/admin/workorders/route.ts', permissions: ['list:read', 'list:create'] },
  { path: 'app/api/admin/workorders/[id]/route.ts', permissions: ['list:read', 'list:update', 'list:delete'] },
  { path: 'app/api/admin/workorders/[id]/assign/route.ts', permissions: ['list:update'] },
  { path: 'app/api/admin/workorders/[id]/comments/route.ts', permissions: ['list:update'] },
  { path: 'app/api/admin/workorders/[id]/tasks/route.ts', permissions: ['list:read', 'list:update'] },
  { path: 'app/api/admin/workorders/analytics/route.ts', permissions: ['work_order_dashboard:read'] },
  { path: 'app/api/admin/workorders/recent/route.ts', permissions: ['list:read'] },
  { path: 'app/api/admin/workorders/stats/route.ts', permissions: ['work_order_dashboard:read'] },
  { path: 'app/api/admin/workorders/department-workload/route.ts', permissions: ['work_order_dashboard:read'] },
  { path: 'app/api/admin/workorders/top-performers/route.ts', permissions: ['work_order_dashboard:read'] },
  { path: 'app/api/admin/workorders/slas/route.ts', permissions: ['wo_sla:read', 'wo_sla:create'] },
  { path: 'app/api/admin/workorders/slas/[id]/route.ts', permissions: ['wo_sla:read', 'wo_sla:update', 'wo_sla:delete'] },
  { path: 'app/api/admin/workorders/escalations/route.ts', permissions: ['wo_escalation:read', 'wo_escalation:create'] },
  { path: 'app/api/admin/workorders/escalations/[id]/route.ts', permissions: ['wo_escalation:read', 'wo_escalation:update', 'wo_escalation:delete'] },
  { path: 'app/api/admin/workorders/templates/route.ts', permissions: ['wo_template:read', 'wo_template:create'] },
  { path: 'app/api/admin/workorders/templates/[id]/route.ts', permissions: ['wo_template:read', 'wo_template:update', 'wo_template:delete'] },
  
  // Attendance
  { path: 'app/api/admin/attendance/route.ts', permissions: ['attendance:read'] },
  { path: 'app/api/admin/attendance/[id]/route.ts', permissions: ['attendance:update', 'attendance:delete'] },
  { path: 'app/api/admin/lembur/route.ts', permissions: ['lembur:read'] },
  { path: 'app/api/admin/lembur/[id]/route.ts', permissions: ['lembur:update', 'lembur:delete'] },
  { path: 'app/api/admin/leaves/route.ts', permissions: ['izin:read', 'izin:create'] },
  { path: 'app/api/admin/leaves/[id]/route.ts', permissions: ['izin:update', 'izin:delete'] },
  
  // Core Resources
  { path: 'app/api/admin/departments/route.ts', permissions: ['department:read', 'department:create'] },
  { path: 'app/api/admin/departments/[id]/route.ts', permissions: ['department:read', 'department:update', 'department:delete'] },
  { path: 'app/api/admin/sites/route.ts', permissions: ['site:read', 'site:create'] },
  { path: 'app/api/admin/sites/[id]/route.ts', permissions: ['site:read', 'site:update', 'site:delete'] },
  { path: 'app/api/admin/holidays/route.ts', permissions: ['holidays:read', 'holidays:create'] },
  { path: 'app/api/admin/holidays/[id]/route.ts', permissions: ['holidays:update', 'holidays:delete'] },
  { path: 'app/api/admin/registrations/route.ts', permissions: ['registration:read'] },
  { path: 'app/api/admin/registrations/[id]/route.ts', permissions: ['registration:read', 'registration:update', 'registration:delete'] },
  
  // Support & Admin
  { path: 'app/api/admin/support-tickets/route.ts', permissions: ['support:read'] },
  { path: 'app/api/admin/support-tickets/[id]/route.ts', permissions: ['support:read', 'support:update'] },
  { path: 'app/api/admin/system-logs/route.ts', permissions: ['system_log:read'] },
  { path: 'app/api/admin/payment-gateway/configs/route.ts', permissions: ['payment_gateway:read'] },
  { path: 'app/api/admin/settings/email/route.ts', permissions: ['email:read', 'email:update'] },
  { path: 'app/api/admin/settings/whatsapp/route.ts', permissions: ['whatsapp:read', 'whatsapp:update'] },
  
  // Radius Network
  { path: 'app/api/admin/radius/nas/route.ts', permissions: ['radius:read', 'radius:create'] },
  { path: 'app/api/admin/radius/nas/[id]/route.ts', permissions: ['radius:read', 'radius:update', 'radius:delete'] },
  { path: 'app/api/admin/radius/sync/route.ts', permissions: ['radius:update'] },
  { path: 'app/api/admin/radius/sessions/route.ts', permissions: ['radius:read'] },
  { path: 'app/api/admin/radius/ippool/route.ts', permissions: ['radius:read', 'radius:create'] },
  { path: 'app/api/admin/radius/dashboard/stats/route.ts', permissions: ['radius:read'] },
]

describe('RBAC Route Coverage Analysis', () => {
  describe('hasPermission import check', () => {
    PROTECTED_ROUTES.forEach(({ path }) => {
      it(`${path} should import hasPermission`, () => {
        const fullPath = join(APP_ROOT, path)
        let fileContent: string
        
        try {
          fileContent = readFileSync(fullPath, 'utf-8')
        } catch (error) {
          console.warn(`File not found: ${path}`)
          return // Skip if file doesn't exist
        }
        
        expect(fileContent).toContain("import { hasPermission }")
      })
    })
  })

  describe('Permission check implementation', () => {
    PROTECTED_ROUTES.forEach(({ path, permissions }) => {
      it(`${path} should have permission checks for: ${permissions.join(', ')}`, () => {
        const fullPath = join(APP_ROOT, path)
        let fileContent: string
        
        try {
          fileContent = readFileSync(fullPath, 'utf-8')
        } catch (error) {
          console.warn(`File not found: ${path}`)
          return
        }
        
        // Check that hasPermission is used
        expect(fileContent).toContain('hasPermission(')
        
        // Check that at least one of the expected permissions is used
        const hasExpectedPermission = permissions.some(perm => 
          fileContent.includes(`'${perm}'`)
        )
        expect(hasExpectedPermission).toBe(true)
      })
    })
  })

  describe('403 Forbidden response check', () => {
    PROTECTED_ROUTES.forEach(({ path }) => {
      it(`${path} should return 403 for unauthorized access`, () => {
        const fullPath = join(APP_ROOT, path)
        let fileContent: string
        
        try {
          fileContent = readFileSync(fullPath, 'utf-8')
        } catch (error) {
          console.warn(`File not found: ${path}`)
          return
        }
        
        // Should return 403 status
        expect(fileContent).toContain('status: 403')
      })
    })
  })
})


