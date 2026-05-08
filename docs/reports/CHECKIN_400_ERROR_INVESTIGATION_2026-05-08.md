# Investigation: Mobile Check-in 400 Error

**Date:** 2026-05-08  
**Error Time:** 2026-05-08T03:33:54.363Z  
**User:** Wisnu (wisnu@sblnet.id) - Teknisi  
**App Version:** 1.0.38+39  
**Platform:** Android

## Phase 1: Root Cause Investigation

### 1. Error Evidence

**Backend Log:**
```
[2026-05-08T03:33:54.363Z] [INFO] → POST /api/mobile/attendance/check-in
[2026-05-08T03:33:54.412Z] [WARN] ← POST /api/mobile/attendance/check-in 400 (49ms)
```

**Mobile Error:**
```
AxiosError: Request failed with status code 400
```

**Critical Missing Information:**
- ❌ Response body dari server (pesan error spesifik)
- ❌ Request payload yang dikirim mobile
- ❌ Detail validasi mana yang gagal

### 2. Possible Validation Failures

Berdasarkan code review, ada 4 kemungkinan penyebab 400:

#### A. Koordinat Tidak Valid
**Location:** `MobileAttendanceCheckInPayloadParser.parseCoordinates()`

**Kondisi gagal:**
- `latitude` atau `longitude` adalah `NaN`
- `latitude` < -90 atau > 90
- `longitude` < -180 atau > 180

**Error message:**
- "Koordinat tidak valid"
- "Latitude harus antara -90 dan 90"
- "Longitude harus antara -180 dan 180"

#### B. Photo URL Tidak Valid
**Location:** `MobileAttendanceCheckInPayloadParser.resolvePhotoUrl()`

**Kondisi gagal:**
- `photoUrl` bukan string
- `photoUrl` bukan URL valid
- `photoUrl` bukan dari trusted domain

**Trusted domains:**
```typescript
["cdn.radpro.id", "localhost:3000", "0.0.0.0:3000", "localhost"]
+ host dari request header
+ local network IP (192.168.x.x, 10.x.x.x, 127.x.x.x, 172.16-31.x.x)
```

**Error message:**
- "Photo URL tidak valid"
- "Format Photo URL tidak valid"

#### C. CapturedAt Tidak Valid
**Location:** `MobileAttendanceCheckInPayloadParser.parseCapturedAt()`

**Kondisi gagal:**
- `capturedAt` adalah string tapi bukan format date valid

**Error message:**
- "Format capturedAt tidak valid"

#### D. Business Logic Error
**Location:** `AttendanceService.checkIn()`

**Kondisi gagal:**
- `OUTSIDE_GEOFENCE` - User di luar area absensi
- `DUPLICATE_ENTRY` - Sudah check-in hari ini
- `CHECKIN_REJECTED:*` - Ditolak karena alasan tertentu

**Error message:**
- "Anda berada di luar area absensi yang diizinkan"
- "Anda sudah melakukan check-in hari ini"
- "Check-in ditolak: {reason}"

### 3. Hypothesis Ranking

**Most Likely → Least Likely:**

1. **Photo URL validation failure** (60% probability)
   - Mobile app mungkin mengirim photoUrl dari local storage
   - URL bisa jadi tidak match dengan trusted domains
   - Kubernetes pod hostname: `netmanager-app-7dd4c4874b-jqpwn:3000`
   - Ini bukan trusted domain dan bukan local network IP

2. **Koordinat tidak valid** (25% probability)
   - Mobile mengirim koordinat null/undefined
   - Atau koordinat di luar range valid

3. **Business logic error** (10% probability)
   - OUTSIDE_GEOFENCE
   - DUPLICATE_ENTRY

4. **CapturedAt tidak valid** (5% probability)
   - Format date salah dari mobile

## Phase 2: Diagnostic Instrumentation Added

### Layer 1: API Route
**File:** `app/api/mobile/attendance/check-in/route.ts`

**Added logging:**
- Request received (userId, email, contentType)
- Failure details (error, code, status, details)
- Success confirmation

### Layer 2: Service
**File:** `modules/attendance/services/MobileAttendanceCheckInRouteService.ts`

**Added logging:**
- Check-in start (userId, tenantId)
- Timezone resolved
- Payload parsing result
- Parsed payload details (hasPhotoUrl, hasCoordinates, hasOfflineTime)
- Check-in completion
- Error details with stack trace

### Layer 3: Payload Parser
**File:** `modules/attendance/services/MobileAttendanceCheckInPayloadParser.ts`

**Added logging:**
- JSON payload received (hasLatitude, hasLongitude, hasPhotoUrl, hasCapturedAt)
- Raw values (latitude, longitude, photoUrl)
- Validation failures for each field (capturedAt, coordinates, photoUrl)

## Phase 3: Next Steps

### Immediate Actions Required

1. **Deploy logging changes**
   ```bash
   npm run build
   # Deploy to staging/production
   ```

2. **Wait for next occurrence**
   - Monitor logs for detailed error
   - Capture exact payload that causes 400

3. **Analyze logs to identify exact failure point**
   - Which validation failed?
   - What was the invalid value?

### Alternative: Reproduce Locally

If we can get the exact payload from mobile team:

1. Create test case with exact payload
2. Run locally to see which validation fails
3. Fix validation or mobile app accordingly

## Phase 4: Potential Fixes (DO NOT APPLY YET)

**⚠️ WAIT FOR EVIDENCE BEFORE FIXING**

### If Photo URL validation is the issue:

**Option A:** Add Kubernetes pod hostname pattern to trusted domains
```typescript
const K8S_POD_PATTERN = /^netmanager-app-[a-z0-9]+-[a-z0-9]+:\d+$/;
```

**Option B:** Relax photo URL validation for internal requests
```typescript
if (url.hostname.includes('netmanager-app')) return { data: photoUrl };
```

**Option C:** Accept any URL in non-production
```typescript
if (process.env.NODE_ENV !== 'production') return { data: photoUrl };
```

### If Coordinates validation is the issue:

**Option A:** Make coordinates truly optional
```typescript
// Already optional in validateCoordinates, but check if mobile sends empty string
if (latitude === '' || longitude === '') return { valid: true };
```

### If Business logic is the issue:

**Option A:** Review geofence configuration
**Option B:** Check duplicate detection logic

## Conclusion

**Status:** Waiting for evidence  
**Action:** Deploy logging changes and monitor next occurrence  
**DO NOT:** Apply fixes without confirming root cause

---

**Investigation by:** Claude (Systematic Debugging)  
**Next Review:** After next error occurrence with detailed logs
