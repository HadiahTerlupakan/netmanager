# Security Review: User API Response Data Exposure

**Date:** 2026-05-06  
**Endpoint:** `/api/admin/users` (GET)  
**Reviewer:** AI Assistant

---

## Executive Summary

Review terhadap endpoint `/api/admin/users` menunjukkan bahwa **tidak ada data sensitif yang ter-expose** di response network. Semua field yang dikembalikan sudah aman dan sesuai dengan prinsip least privilege.

---

## Response Structure Analysis

### API Response Format
```json
{
  "success": true,
  "data": {
    "users": [UserListItemDTO[]],
    "meta": {
      "total": number,
      "active": number,
      "inactive": number,
      "page": number,
      "limit": number
    }
  }
}
```

### UserListItemDTO Fields (Exposed)

#### ✅ Safe Fields (Public/Non-Sensitive)
| Field | Type | Purpose | Risk Level |
|-------|------|---------|------------|
| `id` | string | User identifier | ✅ Low - UUID, tidak predictable |
| `email` | string | User email | ✅ Low - business requirement |
| `name` | string \| null | User full name | ✅ Low - public info |
| `phone` | string \| null | Phone number | ⚠️ Medium - PII, tapi diperlukan admin |
| `isActive` | boolean | Account status | ✅ Low - operational data |
| `isSales` | boolean | Sales role flag | ✅ Low - operational data |
| `isAttendanceRequired` | boolean | Attendance requirement | ✅ Low - operational data |
| `lastVersionCode` | number \| null | App version code | ✅ Low - technical metadata |
| `lastVersionName` | string \| null | App version name | ✅ Low - technical metadata |
| `lastVersionUpdate` | Date \| null | Last app update | ✅ Low - technical metadata |
| `lastLoginAt` | Date \| null | Last login timestamp | ✅ Low - audit trail |

#### ✅ Relational Data (Safe)
| Field | Type | Purpose | Risk Level |
|-------|------|---------|------------|
| `departments` | `{ id, name }` \| null | Department info | ✅ Low - organizational data |
| `sites` | `{ id, code, name }` \| null | Site info | ✅ Low - organizational data |
| `role` | `{ id, name }` \| null | Role info | ✅ Low - RBAC metadata |
| `userSites` | Array | Multi-site assignments | ✅ Low - organizational data |

---

## Fields NOT Exposed (Correctly Hidden)

### 🔒 Sensitive Fields (Properly Excluded from DTO)

| Field | Type | Why Hidden | Security Impact |
|-------|------|------------|-----------------|
| `passwordHash` | string | Password hash | 🔴 **CRITICAL** - Never expose |
| `pushToken` | string | FCM/push token | 🔴 **HIGH** - Can be used for impersonation |
| `fcmTokens` | string[] | FCM tokens array | 🔴 **HIGH** - Can be used for impersonation |
| `tokenVersion` | number | Session invalidation counter | 🟡 **MEDIUM** - Internal security mechanism |
| `emailVerified` | Date | Email verification status | 🟡 **MEDIUM** - Internal state |
| `pushTokenUpdatedAt` | Date | Token update timestamp | 🟢 **LOW** - But unnecessary |
| `bankName` | string | Bank information | 🔴 **HIGH** - Financial PII |
| `bankAccountNo` | string | Bank account number | 🔴 **CRITICAL** - Financial PII |
| `bankAccountName` | string | Bank account name | 🔴 **HIGH** - Financial PII |
| `bpjsKesehatan` | boolean | Health insurance status | 🟡 **MEDIUM** - Personal health data |
| `bpjsKetenagakerjaan` | boolean | Employment insurance | 🟡 **MEDIUM** - Personal data |
| `joinDate` | Date | Employment start date | 🟢 **LOW** - But unnecessary for list |
| `ptkpStatus` | string | Tax status | 🟡 **MEDIUM** - Financial PII |
| `employeeType` | string | Employment type | 🟢 **LOW** - But unnecessary for list |
| `basicSalary` | number | Salary amount | 🔴 **CRITICAL** - Financial PII |
| `payPeriodDay` | number | Pay period day | 🟡 **MEDIUM** - Payroll config |
| `payDay` | number | Pay day | 🟡 **MEDIUM** - Payroll config |
| `woIncentiveEnabled` | boolean | Work order incentive flag | 🟢 **LOW** - But unnecessary |
| `woIncentiveRate` | number | Incentive rate | 🟡 **MEDIUM** - Compensation data |
| `lateDeductionRate` | number | Late deduction rate | 🟡 **MEDIUM** - Compensation data |
| `absentDeductionRate` | number | Absent deduction rate | 🟡 **MEDIUM** - Compensation data |
| `overtimeRateNormal` | number | Overtime rate (normal) | 🟡 **MEDIUM** - Compensation data |
| `overtimeRateHoliday` | number | Overtime rate (holiday) | 🟡 **MEDIUM** - Compensation data |
| `overtimeRateNational` | number | Overtime rate (national) | 🟡 **MEDIUM** - Compensation data |
| `overtimeCalcTypeNormal` | string | Overtime calc type | 🟢 **LOW** - But unnecessary |
| `overtimeCalcTypeHoliday` | string | Overtime calc type | 🟢 **LOW** - But unnecessary |
| `overtimeCalcTypeNational` | string | Overtime calc type | 🟢 **LOW** - But unnecessary |
| `workingHourMode` | string | Working hour mode | 🟢 **LOW** - But unnecessary for list |
| `attendanceGeofencePolicy` | string | Geofence policy | 🟢 **LOW** - But unnecessary for list |
| `startWorkTime` | string | Work start time | 🟢 **LOW** - But unnecessary for list |
| `endWorkTime` | string | Work end time | 🟢 **LOW** - But unnecessary for list |
| `workDays` | string | Work days | 🟢 **LOW** - But unnecessary for list |
| `flexibleTargetHour` | number | Flexible target hour | 🟢 **LOW** - But unnecessary for list |
| `canvasingTarget` | number | Canvasing target | 🟢 **LOW** - But unnecessary for list |
| `targetSchema` | string | Target schema | 🟢 **LOW** - But unnecessary for list |
| `tenantId` | string | Tenant ID | 🟢 **LOW** - Internal reference |
| `departmentId` | string | Department ID | 🟢 **LOW** - Already in `departments.id` |
| `siteId` | string | Site ID | 🟢 **LOW** - Already in `sites.id` |
| `roleId` | string | Role ID | 🟢 **LOW** - Already in `role.id` |
| `shiftId` | string | Shift ID | 🟢 **LOW** - But unnecessary for list |

---

## Security Assessment

### ✅ Strengths

1. **Password Protection**: `passwordHash` tidak pernah ter-expose di DTO manapun
2. **Financial Data Protection**: Semua data salary, bank account, dan compensation rates tidak ter-expose
3. **Token Protection**: Push tokens dan FCM tokens tidak ter-expose
4. **Proper DTO Mapping**: Menggunakan dedicated DTO (`UserListItemDTO`) yang hanya expose field yang diperlukan
5. **Layered Architecture**: Mapper layer (`UserMapper.toListDTO()`) memastikan hanya field safe yang dikembalikan

### ⚠️ Considerations

1. **Phone Number Exposure**: 
   - **Status**: Ter-expose di list endpoint
   - **Risk**: Medium - PII data
   - **Justification**: Diperlukan untuk admin management dan contact purposes
   - **Recommendation**: ✅ Acceptable - admin memang perlu akses ini

2. **Email Exposure**:
   - **Status**: Ter-expose di list endpoint
   - **Risk**: Low-Medium - dapat digunakan untuk phishing
   - **Justification**: Business requirement untuk user management
   - **Recommendation**: ✅ Acceptable - dengan catatan RBAC enforcement ketat

3. **Last Login Tracking**:
   - **Status**: Ter-expose di list endpoint
   - **Risk**: Low - dapat digunakan untuk user behavior analysis
   - **Justification**: Audit trail dan monitoring user activity
   - **Recommendation**: ✅ Acceptable - operational necessity

---

## RBAC Enforcement

### Authorization Check
```typescript
// app/api/admin/users/route.ts:15-20
export const GET = createHandler(
  {
    auth: true,
    permissions: ["users:read"],  // ✅ Proper permission check
  },
  async (req, ctx) => {
    // ...
  }
);
```

### Tenant Isolation
```typescript
// AdminUserRouteService.ts:159-162
private resolveListTenantId(session: AdminSession, tenantId?: string) {
  if (!session.user.isSuperAdmin) return session.user.tenantId || undefined;
  return tenantId || session.user.tenantId || undefined;
}
```

✅ **Non-superadmin users hanya bisa melihat user di tenant mereka sendiri**

### Site Restriction
```typescript
// AdminUserRouteService.ts:40-43
const { isRestricted, primarySiteId } = checkSiteRestriction(
  { ...session, user: { ...session.user, permissions } },
  "users",
);
```

✅ **Users dengan site restriction hanya bisa melihat user di site mereka**

---

## Recommendations

### ✅ Current Implementation is Secure

**No immediate action required.** Implementasi saat ini sudah mengikuti best practices:

1. ✅ Sensitive data tidak ter-expose
2. ✅ Proper DTO mapping dengan whitelist approach
3. ✅ RBAC enforcement di API layer
4. ✅ Tenant isolation implemented
5. ✅ Site-based access control implemented

### 🔄 Optional Enhancements (Future)

1. **Field-Level Permissions** (Low Priority):
   ```typescript
   // Contoh: Hide phone number untuk role tertentu
   phone: hasPermission(session, "users:view_phone") ? user.phone : null
   ```

2. **Audit Logging** (Medium Priority):
   - Log setiap akses ke user list endpoint
   - Track siapa yang mengakses data user siapa
   - Implementasi: Sudah ada di `logger.apiRequest()` ✅

3. **Rate Limiting** (Medium Priority):
   - Batasi jumlah request per user per time window
   - Prevent data scraping attempts

4. **Response Pagination** (Already Implemented ✅):
   ```typescript
   // AdminUserRouteService.ts:54-63
   return {
     users: result.data,
     meta: {
       total: result.total,
       page: query.page ? parseInt(query.page) : 1,
       limit: query.limit ? parseInt(query.limit) : result.data.length,
     },
   };
   ```

---

## Conclusion

**Status: ✅ SECURE**

Endpoint `/api/admin/users` sudah aman dan tidak ter-expose data sensitif. Implementasi mengikuti security best practices dengan:

- Proper DTO mapping (whitelist approach)
- RBAC enforcement
- Tenant isolation
- Site-based access control
- No sensitive data exposure (passwords, tokens, financial data)

**Tidak ada action item yang urgent.** Sistem sudah production-ready dari sisi security.

---

## References

- **DTO Definition**: `modules/users/dto/UserDTO.ts`
- **Mapper Implementation**: `modules/users/mappers/user-mapper.helpers.ts:132-165`
- **API Route**: `app/api/admin/users/route.ts`
- **Service Layer**: `modules/users/services/AdminUserRouteService.ts`
- **Entity Definition**: `modules/users/domain/entities/UserEntity.ts`
