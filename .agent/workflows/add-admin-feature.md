---
description: Standard workflow for adding a new Admin Feature with Menu and RBAC
---

1. **Define Permissions**
   - Open `lib/permission-config.ts`
   - Add new group or append to existing group in `PERMISSION_GROUPS`.
   - Format: `GROUP_NAME: ['resource1', 'resource2']`
   - **Effect**: This defines `resource:create`, `resource:read`, `resource:update`, `resource:delete` permissions.

2. **Define Menu Item**
   - Open `lib/menu-config.ts`
   - Add entry to `ADMIN_MENU_CONFIG`
   - **Critical**: `code` must match the resource name for permission mapping.
     - Parent Code: `GROUP_NAME` (maps to `group_name:read`)
     - Child Code: `GROUP_NAME.RESOURCE` (maps to `resource:read`)

3. **Database Seed (RBAC)**
   - Run `npx prisma db seed` to populate new permissions and automatically assign them to `SUPER_ADMIN` role.
   - For other roles (e.g., Technicians, Staff), manually assign permissions via the Admin Portal > Settings > Roles page.

4. **Implement Server-Side Protection**
   - **File**: `app/admin/path/to/page.tsx`
   - **Requirement**: Use `ensurePermission` from `@/lib/rbac`.
   - **Code Snippet**:
     ```tsx
     import { ensurePermission } from '@/lib/rbac'
     
     export default async function Page() {
       await ensurePermission('resource:read') // Match the resource defined in Step 1
       return <ClientComponent />
     }
     ```

5. **Implement API Route Protection**
   - **File**: `app/api/your-feature/route.ts`
   - **Requirement**: Use `hasPermission` from `@/lib/rbac`.
   - **Code Snippet**:
     ```typescript
     import { hasPermission } from '@/lib/rbac'
     
     export async function GET(req: NextRequest) {
         if (!await hasPermission('resource:read')) {
             return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
         }
         // ...
     }
     
     export async function POST(req: NextRequest) {
         if (!await hasPermission('resource:create')) {
             return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
         }
         // ...
     }
     ```

6. **Verify Sidebar & Icon**
   - Check `components/layout/Sidebar.tsx`.
   - Ensure the icon string used in `menu-config.ts` is imported from `react-icons/hi2` and added to `IconMap`.

6. **Verify Access**
   - Login as Super Admin: Should see menu.
   - Login as Restricted User: Should NOT see menu (unless permission granted).
   - Direct URL Access: Should be blocked by `ensurePermission`.
