# Network Performance Monitoring & Configuration Backup API

Dokumentasi untuk endpoint Network Performance Monitoring dan Configuration Backup yang telah diimplementasikan.

## Network Performance Monitoring

### 1. Get All Network Performance Data
- **Endpoint**: `GET /api/network/performance`
- **Deskripsi**: Mengambil semua data performa jaringan dengan filter
- **Query Parameters**:
  - `deviceId` (string, optional): Filter by device ID
  - `deviceType` (string, optional): Filter by device type (OLT, MIKROTIK, ONU)
  - `startDate` (string, optional): Filter by start date (ISO 8601)
  - `endDate` (string, optional): Filter by end date (ISO 8601)
  - `page` (integer, default: 1): Page number
  - `limit` (integer, default: 20): Number of items per page
  - `sortBy` (string, default: timestamp): Sort field
  - `sortOrder` (string, default: desc): Sort order (asc, desc)

### 2. Get Network Performance by ID
- **Endpoint**: `GET /api/network/performance/[id]`
- **Deskripsi**: Mengambil data performa jaringan berdasarkan ID
- **Path Parameters**:
  - `id` (string, required): Performance data ID

### 3. Get Performance History for Device
- **Endpoint**: `GET /api/network/performance/[id]/history`
- **Deskripsi**: Mengambil riwayat performa untuk perangkat tertentu
- **Path Parameters**:
  - `id` (string, required): Device ID
- **Query Parameters**:
  - `startDate` (string, optional): Filter by start date (ISO 8601)
  - `endDate` (string, optional): Filter by end date (ISO 8601)
  - `page` (integer, default: 1): Page number
  - `limit` (integer, default: 20): Number of items per page
  - `sortBy` (string, default: timestamp): Sort field
  - `sortOrder` (string, default: desc): Sort order (asc, desc)

### 4. Create Network Performance Data
- **Endpoint**: `POST /api/network/performance`
- **Deskripsi**: Membuat data performa jaringan baru
- **Request Body**:
  ```json
  {
    "deviceId": "string",
    "deviceType": "OLT|MIKROTIK|ONU",
    "cpuUsage": "number",
    "memoryUsage": "number",
    "temperature": "number",
    "uptime": "number",
    "rxBytes": "number",
    "txBytes": "number",
    "rxPackets": "number",
    "txPackets": "number",
    "rxDrops": "number",
    "txDrops": "number",
    "rxErrors": "number",
    "txErrors": "number",
    "interfaceStatus": "object",
    "connectionCount": "integer",
    "bandwidthUsage": "number",
    "signalStrength": "number",
    "powerLevel": "string",
    "customMetrics": "object"
  }
  ```

## Network Alerts

### 5. Get All Network Alerts
- **Endpoint**: `GET /api/network/alerts`
- **Deskripsi**: Mengambil semua alert jaringan dengan filter
- **Query Parameters**:
  - `deviceId` (string, optional): Filter by device ID
  - `deviceType` (string, optional): Filter by device type (OLT, MIKROTIK, ONU)
  - `status` (string, optional): Filter by alert status (ACTIVE, ACKNOWLEDGED, RESOLVED, SUPPRESSED)
  - `severity` (string, optional): Filter by alert severity (CRITICAL, WARNING, INFO)
  - `alertType` (string, optional): Filter by alert type (CRITICAL, WARNING, INFO)
  - `acknowledged` (boolean, optional): Filter by acknowledgment status
  - `resolved` (boolean, optional): Filter by resolution status
  - `page` (integer, default: 1): Page number
  - `limit` (integer, default: 20): Number of items per page
  - `sortBy` (string, default: createdAt): Sort field
  - `sortOrder` (string, default: desc): Sort order (asc, desc)

### 6. Create Network Alert
- **Endpoint**: `POST /api/network/alerts`
- **Deskripsi**: Membuat alert jaringan baru
- **Request Body**:
  ```json
  {
    "deviceId": "string",
    "deviceType": "OLT|MIKROTIK|ONU",
    "alertType": "CRITICAL|WARNING|INFO",
    "title": "string",
    "message": "string",
    "severity": "CRITICAL|WARNING|INFO",
    "threshold": "number",
    "currentValue": "number",
    "metricName": "string",
    "autoResolve": "boolean",
    "autoResolveTime": "integer"
  }
  ```

### 7. Get Network Alert by ID
- **Endpoint**: `GET /api/network/alerts/[id]`
- **Deskripsi**: Mengambil data alert jaringan berdasarkan ID
- **Path Parameters**:
  - `id` (string, required): Alert ID

### 8. Update Network Alert
- **Endpoint**: `PUT /api/network/alerts/[id]`
- **Deskripsi**: Memperbarui data alert jaringan
- **Path Parameters**:
  - `id` (string, required): Alert ID
- **Request Body**:
  ```json
  {
    "title": "string",
    "message": "string",
    "severity": "CRITICAL|WARNING|INFO",
    "status": "ACTIVE|ACKNOWLEDGED|RESOLVED|SUPPRESSED",
    "acknowledged": "boolean",
    "resolved": "boolean",
    "autoResolve": "boolean",
    "autoResolveTime": "integer"
  }
  ```

### 9. Delete Network Alert
- **Endpoint**: `DELETE /api/network/alerts/[id]`
- **Deskripsi**: Menghapus data alert jaringan
- **Path Parameters**:
  - `id` (string, required): Alert ID

## Device Backup & Configuration Restore

### 10. Get All Device Backups
- **Endpoint**: `GET /api/network/backups`
- **Deskripsi**: Mengambil semua data backup perangkat dengan filter
- **Query Parameters**:
  - `deviceId` (string, optional): Filter by device ID
  - `deviceType` (string, optional): Filter by device type (OLT, MIKROTIK, ONU)
  - `backupType` (string, optional): Filter by backup type (MANUAL, SCHEDULED, AUTOMATIC)
  - `status` (string, optional): Filter by backup status (PENDING, IN_PROGRESS, COMPLETED, FAILED, CANCELLED)
  - `startDate` (string, optional): Filter by start date (ISO 8601)
  - `endDate` (string, optional): Filter by end date (ISO 8601)
  - `page` (integer, default: 1): Page number
  - `limit` (integer, default: 20): Number of items per page
  - `sortBy` (string, default: createdAt): Sort field
  - `sortOrder` (string, default: desc): Sort order (asc, desc)

### 11. Create Device Backup
- **Endpoint**: `POST /api/network/backups`
- **Deskripsi**: Membuat backup perangkat baru
- **Request Body**:
  ```json
  {
    "deviceId": "string",
    "deviceType": "OLT|MIKROTIK|ONU",
    "backupName": "string",
    "description": "string",
    "backupType": "MANUAL|SCHEDULED|AUTOMATIC",
    "backupMethod": "string",
    "scheduledAt": "string",
    "retentionDays": "integer",
    "isAutoCleanup": "boolean"
  }
  ```

### 12. Get Device Backup by ID
- **Endpoint**: `GET /api/network/backups/[id]`
- **Deskripsi**: Mengambil data backup perangkat berdasarkan ID
- **Path Parameters**:
  - `id` (string, required): Backup ID

### 13. Delete Device Backup
- **Endpoint**: `DELETE /api/network/backups/[id]`
- **Deskripsi**: Menghapus data backup perangkat
- **Path Parameters**:
  - `id` (string, required): Backup ID

### 14. Restore Configuration from Backup
- **Endpoint**: `POST /api/network/backups/[id]/restore`
- **Deskripsi**: Memulih konfigurasi dari backup
- **Path Parameters**:
  - `id` (string, required): Backup ID
- **Request Body**:
  ```json
  {
    "deviceId": "string",
    "deviceType": "OLT|MIKROTIK|ONU",
    "backupId": "string",
    "restoreName": "string",
    "description": "string",
    "restoreMethod": "string",
    "scheduledAt": "string",
    "rollbackEnabled": "boolean"
  }
  ```

## Response Format

### Success Response
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Error Response
```json
{
  "error": "Error message"
}
```

## Authentication

Semua endpoint memerlukan autentikasi dengan role admin. Gunakan session yang valid untuk mengakses endpoint ini.

## Database Migration

Endpoint-endpoint ini akan berfungsi setelah menjalankan migrasi database untuk menambahkan model:
- NetworkPerformance
- NetworkAlert
- DeviceBackup
- ConfigurationRestore

Jalankan perintah berikut untuk migrasi:
```bash
npx prisma migrate dev
```

## Notes

- Semua endpoint menggunakan pagination untuk data yang banyak
- Response format konsisten dengan endpoint lain yang ada di sistem
- Error handling sudah diimplementasikan dengan pesan yang jelas
- Support untuk filter berdasarkan tanggal, device type, dan status
- Include @ts-ignore untuk mengatasi error TypeScript sementara sebelum migrasi database