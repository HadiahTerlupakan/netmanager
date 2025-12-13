# Debugging Guide: User Role and Menu Permission Issues

This guide helps you diagnose and fix issues where users don't see the correct menus based on their assigned roles.

## Quick Diagnosis

### 1. Use the Debug API Endpoint

Check any user's permissions with this API:
```
GET /api/debug/user-permissions?email=user@example.com
```
or
```
GET /api/debug/user-permissions?employeeId=EMP001
```

This will return:
- User and employee information
- Custom roles assigned
- Permission codes from each role
- Final merged permissions
- List of visible/hidden menu items

### 2. Run Database Validation

Check your database for common issues:
```bash
npm run check:roles
```

This will identify:
- Inactive custom roles
- Roles without permissions
- Invalid JSON in permission data
- Users without role assignments
- Unknown permission codes

## Common Issues and Solutions

### Issue 1: Custom Role is Inactive

**Symptoms:** User has role assigned but sees only basic menus

**Check:** Look for `[USER-CREATION] WARNING: Custom role is inactive` in logs

**Solution:**
- Run `npm run fix:roles` to activate all roles
- Or manually activate in database: `UPDATE custom_roles SET is_active = true`

### Issue 2: Invalid Permission Data

**Symptoms:** User has role but no menus appear

**Check:** API returns `allowedFeatures: []` or shows parsing errors

**Solution:**
- Run `npm run fix:roles` to repair JSON formats
- Or manually fix the `allowedFeatures` column in `custom_roles` table

### Issue 3: EmployeeRole Missing

**Symptoms:** User exists but has no custom permissions

**Check:** Debug API shows `customRoles: []`

**Solution:**
- Create missing EmployeeRole record
- Ensure user creation completes successfully

### Issue 4: Permission Code Mismatch

**Symptoms:** Some menus missing even with role assigned

**Check:** Unknown permission codes in validation output

**Solution:**
- Update role's allowedFeatures with correct menu codes
- Run `npm run fix:roles` to remove invalid codes

## Debug Logging

The system now logs detailed permission information:

### User Creation Logs
Look for these logs in your server:
- `[USER-CREATION] Custom role found:` - Role validation
- `[USER-CREATION] User created successfully:` - User creation
- `[USER-CREATION] Employee created successfully:` - Employee linking
- `[USER-CREATION] EmployeeRole created successfully:` - Role assignment

### Login Logs
Check browser console or server logs:
- `[AUTH LOGIN] Checking permissions for user:` - Permission lookup start
- `[AUTH LOGIN] Employee found:` - Employee lookup success
- `[AUTH LOGIN] Permissions result:` - Final permission array

## Menu Permission Codes

These are the valid permission codes:

### Admin Menus
- `DASHBOARD` - Admin Dashboard
- `USERS` - User Management
- `ROLES` - Role Management
- `PELANGGAN` - Customer Management
- `NETWORK` - Network Management
- `FINANCE` - Finance Management
- `HELPDESK` - Helpdesk
- `HRIS` - HR Information System
- `LAPORAN` - Reports
- `SETTINGS` - Settings

### Network Sub-menus
- `NETWORK.OLT` - OLT Management
- `NETWORK.ONU` - ONU Management
- `NETWORK.IPS` - IP Management
- `NETWORK.VLAN` - VLAN Management

### Finance Portal
- `FINANCE.DASHBOARD` - Finance Dashboard
- `FINANCE.INVOICES` - Invoice Management
- `FINANCE.PAYMENTS` - Payment Management
- `FINANCE.REPORTS` - Financial Reports

### Employee Portal
- `EMPLOYEE.DASHBOARD` - Employee Dashboard
- `EMPLOYEE.PROFILE` - Employee Profile
- `EMPLOYEE.NOTIFICATIONS` - Notifications
- `EMPLOYEE.TASKS` - Tasks

## Manual Testing Steps

1. **Create Test User**
   - Go to Admin → Users → Create New User
   - Select a role with known permissions
   - Check server logs for successful creation

2. **Test Login**
   - Login with new user credentials
   - Check browser console for permission logs
   - Verify correct menus appear

3. **Verify Permissions**
   - Use debug API to check permissions
   - Compare expected vs actual menu items
   - Identify missing permission codes

4. **Fix Issues**
   - Run validation script: `npm run check:roles`
   - Run repair script: `npm run fix:roles` if needed
   - Restart application if database changes were made

## Database Schema

Key tables for permissions:

- `custom_roles` - Role definitions with permission codes
- `employee_roles` - Links employees to custom roles
- `users` - Base user accounts
- `employees` - Employee profiles linked to users

Permission flow:
1. User login → Find employee record
2. Employee → Find custom roles via employee_roles
3. Custom roles → Extract permission codes from allowedFeatures
4. Permission codes → Filter menu items in UI

## Getting Help

If issues persist:

1. Check server logs for error messages
2. Run `npm run check:roles` for database issues
3. Use debug API endpoint for specific user analysis
4. Verify permission codes match exactly (case-sensitive)

Remember: Role permissions are cached in the user's session. Log out and log back in after making permission changes.