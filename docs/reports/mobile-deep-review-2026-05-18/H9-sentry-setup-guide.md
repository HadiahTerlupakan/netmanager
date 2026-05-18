# Sentry RN Setup — Recommendation

**Status:** TelemetryService generic siap di `src/services/TelemetryService.ts`. Pasang Sentry sebagai follow-up agar telemetry yang sudah ditambahkan otomatis ter-pipe ke crash reporting.

## Kenapa perlu

Saat ini:
- Native crash & unhandled JS rejection LOLOS — hanya `presentAppError` yang report manual.
- Tidak ada visibility ke produksi tanpa user manual lapor.
- TelemetryService logger.info hanya ada di device user, tidak ter-aggregate.

## Steps

### 1. Install
```bash
cd mobile-netmanager
npx @sentry/wizard@latest -i reactNative
# Atau manual:
# npm install @sentry/react-native
# cd ios && pod install
```

### 2. Setup di entry point
`index.js` (sebelum `registerRootComponent`):
```ts
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enableNative: true,
  enableNativeCrashHandling: true,
  enableAutoSessionTracking: true,
  tracesSampleRate: 0.1,
  // PII filter — strip token & password dari payload
  beforeSend(event) {
    if (event.request?.headers) {
      delete event.request.headers['Authorization'];
    }
    return event;
  },
});
```

### 3. Wire ke TelemetryService
`src/services/TelemetryService.ts`, tambah import + breadcrumb:
```ts
import * as Sentry from '@sentry/react-native';

export function trackEvent(...) {
  // ... existing logger ...
  Sentry.addBreadcrumb({
    category: namespace,
    message: event,
    data: payload,
    level: 'info',
  });
}

export function trackError(...) {
  // ... existing logger ...
  if (error instanceof Error) {
    Sentry.captureException(error, {
      tags: { telemetry_event: fullEvent, namespace },
      extra: payload,
    });
  }
}
```

### 4. ErrorBoundary + ErrorReportingService integration
Wrap root dengan `Sentry.ErrorBoundary`:
```tsx
<Sentry.ErrorBoundary fallback={<ErrorScreen />}>
  <App />
</Sentry.ErrorBoundary>
```

`ErrorReportingService.captureException` → tambah Sentry capture:
```ts
captureException(error, context) {
  // ... existing /api/mobile/error-report POST ...
  Sentry.captureException(error, { extra: context });
}
```

### 5. EAS secrets
```bash
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value <dsn>
```

### 6. Source maps upload
Tambah ke `eas.json` post-build hook untuk upload source maps automatically.

## Verifikasi

- Trigger crash di dev: `throw new Error('test')` di komponen → ada di Sentry dashboard
- Trigger TelemetryService.trackError → ada breadcrumb + exception
- Native crash di Android → ada di dashboard

## Estimasi

Setup awal: 0.5 hari. Native rebuild + EAS submit: 0.5 hari. Total ~1 hari.

## Alternatif

Kalau tidak mau Sentry, RNFirebase Crashlytics sudah tersedia (RNFirebase Messaging sudah dipakai). Cukup pasang Crashlytics + wire serupa.
