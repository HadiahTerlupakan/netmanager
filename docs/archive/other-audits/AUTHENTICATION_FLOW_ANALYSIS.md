# Analisis Alur Autentikasi dan Login NetManager

## Ringkasan Eksekutif

Dokumen ini menganalisis secara menyeluruh alur kerja autentikasi dan login aplikasi NetManager, memetakan seluruh dependensi data yang wajib ada mulai dari entitas Site dan Department, detail konfigurasi Role beserta permission yang diperlukan, hingga atribut User, kemudian menyusun kembali struktur data seed yang komprehensif dan sesuai dengan kebutuhan logika aplikasi saat ini agar pengguna dapat login dengan normal.

---

## 1. Alur Autentikasi - Overview

### 1.1 Frontend Flow (LoginForm.tsx)

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE                         │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Email: [user@example.com]                         │  │
│  │  Password: [••••••]                               │  │
│  │  [Masuk Button]                                   │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  signIn('credentials', {            │
        │    email,                         │
        │    password,                      │
        │    portal: 'admin'/'employee',    │
        │    callbackUrl                    │
        │  })                              │
        └─────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              NEXTAUTH API ROUTE                          │
│         app/api/auth/[...nextauth]/route.ts              │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Backend Flow (lib/auth.ts - authorize function)

```mermaid
sequenceDiagram
    participant User
    participant LoginForm
    participant NextAuth
    participant AuthConfig
    participant DB as Prisma DB
    participant Redis

    User->>LoginForm: Input email & password
    LoginForm->>NextAuth: signIn('credentials', {...})
    NextAuth->>AuthConfig: authorize(credentials)

    AuthConfig->>AuthConfig: validateDatabaseConnection()
    AuthConfig->>DB: SELECT 1
    DB-->>AuthConfig: Connection OK

    AuthConfig->>AuthConfig: validateRedisConnection()
    AuthConfig->>Redis: ping()
    Redis-->>AuthConfig: Connection OK

    AuthConfig->>Redis: checkRateLimit(login:email)
    Redis-->>AuthConfig: Rate limit check

    AuthConfig->>DB: userRepository.findByEmail(email)
    Note over DB: WHERE email = ?<br/>AND passwordHash IS NOT NULL
    DB-->>AuthConfig: User record

    AuthConfig->>AuthConfig: compare(password, user.passwordHash)
    alt Password Mismatch
        AuthConfig-->>NextAuth: null (login failed)
    else Password Valid
        AuthConfig->>DB: Find user with role & permissions
        Note over DB: INCLUDE role { permission }, departments
        DB-->>AuthConfig: User with full relations

        AuthConfig->>AuthConfig: Check portal access
        alt portal = 'admin' AND !role.accessAdminPanel
            AuthConfig-->>NextAuth: Error: Access denied
        else portal = 'employee' AND !role.accessEmployeePanel
            AuthConfig-->>NextAuth: Error: Access denied
        else SUPER_ADMIN OR access granted
            AuthConfig-->>NextAuth: { id, email, name, image }
        end
    end

    NextAuth-->>LoginForm: Response { ok, error, url }
    LoginForm->>User: Redirect or show error
```

---

## 2. Dependensi Data untuk Login Berhasil

### 2.1 Hirarki Dependensi (Urutan Pembuatan Data)

```mermaid
graph TD
    A[1. Permissions] --> B[2. Roles]
    B --> C[3. Departments]
    B --> D[4. Sites]
    C --> E[5. Positions]
    D --> F[6. Gudang]
    B --> G[7. Users]
    C --> G
    D --> G
    E --> G

    style A fill:#ff6b6b
    style B fill:#feca57
    style C fill:#48dbfb
    style D fill:#1dd1a1
    style E fill:#5f27cd
    style F fill:#ff9ff3
    style G fill:#54a0ff
```

### 2.2 Tabel: Entitas dan Atribut Wajib

| #   | Entitas        | Wajib untuk Login? | Atribut Wajib                                                         | Dependensi             |
| --- | -------------- | ------------------ | --------------------------------------------------------------------- | ---------------------- |
| 1   | **Permission** | ✅ YA              | id, name, resource, action                                            | -                      |
| 2   | **Role**       | ✅ YA              | id, name, accessAdminPanel, accessEmployeePanel, permission[]         | Permission             |
| 3   | **Department** | ⚠️ OPSIONAL        | id, name, description                                                 | -                      |
| 4   | **Site**       | ⚠️ OPSIONAL        | id, code, name, address, attendanceRadius                             | -                      |
| 5   | **Position**   | ❌ TIDAK           | id, title, code, departmentId                                         | Department             |
| 6   | **Gudang**     | ❌ TIDAK           | id, kode, nama, lokasi, isActive                                      | Site                   |
| 7   | **User**       | ✅ YA              | id, email, passwordHash, name, isActive, roleId, departmentId, siteId | Role, Department, Site |

**Catatan:**

- **Wajib (YA)**: Data ini harus ada untuk login berhasil
- **Opsional (OPSIONAL)**: Data ini bisa null, tapi direkomendasikan untuk operasi normal
- **Tidak (TIDAK)**: Data ini tidak mempengaruhi login

---

## 3. Detail Entitas untuk Login

### 3.1 Permission Model

```prisma
model Permission {
  id          String   @id
  name        String
  action      String   // read, create, update, delete, site_only, department_only, cancel, verify
  resource    String   // dashboard, network, ftth, paket, pelanggan, etc.
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime
  role        Role[]   @relation("PermissionToRole")

  @@unique([resource, action])
}
```

**Permission Groups dari `lib/permission-config.ts`:**

```typescript
// Admin Portal Resources
PERMISSION_GROUPS = {
  DASHBOARD: ["dashboard"],
  NETWORK: [
    "network",
    "mikrotik",
    "radius",
    "olt",
    "onu",
    "onutype",
    "speedprofiles",
    "vlan",
  ],
  FTTH: ["ftth", "otb", "odc", "odp", "closure", "pole", "kmz", "map"],
  PAKET: ["paket", "bandwidth", "profileppp", "harga"],
  PELANGGAN: ["pelanggan", "ppp", "registration"],
  INVENTORY: [
    "inventory",
    "barang",
    "masuk",
    "keluar",
    "transfer",
    "restock",
    "opname",
    "gudang",
  ],
  WORKORDERS: [
    "workorders",
    "work_order_dashboard",
    "list",
    "site",
    "department",
  ],
  KEHADIRAN: [
    "kehadiran",
    "attendance",
    "report",
    "lembur",
    "holiday",
    "izin",
    "live_tracking",
  ],
  FINANCE: [
    "finance",
    "daily_income",
    "period_income",
    "expense",
    "profit_loss",
  ],
  PENGATURAN: [
    "pengaturan",
    "umum",
    "logo",
    "email",
    "whatsapp",
    "roles",
    "payment_gateway",
    "api",
    "nada_dering",
    "app_version",
  ],
  SYSTEM_LOG: ["system_log", "login", "activity"],
  SUPPORT: ["support"],
  ANNOUNCEMENT: ["announcement"],
  MARKETING: ["marketing", "coupon", "sales", "canvasing"],
  CHAT: ["chat", "broadcast"],
  USERS: ["users"],
};

// Mobile App Resources
PERMISSION_GROUPS_MOBILE = {
  BERANDA: ["m_dashboard", "m_work_order"],
  INVENTORY: ["m_barang", "m_barang_masuk", "m_barang_keluar"],
  KEHADIRAN: ["m_absensi", "m_lembur", "m_izin", "m_holidays"],
  PETA: ["m_topology_map"],
  MARKETING: ["m_canvasing"],
  KOMUNIKASI: ["m_chat"],
};
```

**Actions:**

```typescript
ACTIONS = [
  "read",
  "create",
  "update",
  "delete",
  "site_only",
  "department_only",
  "cancel",
  "verify",
];
```

### 3.2 Role Model

```prisma
model Role {
  id                  String       @id
  name                String       @unique
  description         String?
  createdAt           DateTime     @default(now())
  updatedAt           DateTime
  accessAdminPanel    Boolean      @default(false)
  accessEmployeePanel Boolean      @default(false)
  isRestricted        Boolean      @default(false)
  isTechnical         Boolean      @default(false)
  user                User[]
  permission          Permission[] @relation("PermissionToRole")

  @@map("roles")
}
```

**Role Properties yang Wajib untuk Login:**

| Property              | Type         | Wajib | Deskripsi                                  |
| --------------------- | ------------ | ----- | ------------------------------------------ |
| `id`                  | String       | ✅    | Unique identifier                          |
| `name`                | String       | ✅    | Role name (e.g., 'SUPER_ADMIN', 'teknisi') |
| `accessAdminPanel`    | Boolean      | ✅    | Boleh akses admin panel?                   |
| `accessEmployeePanel` | Boolean      | ✅    | Boleh akses employee panel?                |
| `permission`          | Permission[] | ✅    | Array of permissions (many-to-many)        |

### 3.3 Department Model

```prisma
model Departments {
  id                     String                 @id
  name                   String                 @unique
  description            String?
  jobDescription         String?
  createdAt              DateTime               @default(now())
  updatedAt              DateTime
  user                   User[]
  notifications          Notifications[]
  positions              Positions[]
  sla                    Sla[]
  work_order_escalations WorkOrderEscalations[]
  work_order_templates   WorkOrderTemplates[]
  work_orders            WorkOrders[]

  @@map("departments")
}
```

**Department Properties yang Digunakan di Login:**

| Property | Type   | Digunakan di         | Deskripsi              |
| -------- | ------ | -------------------- | ---------------------- |
| `id`     | String | User.departmentId    | Foreign key            |
| `name`   | String | Token.departmentName | Ditampilkan di session |

### 3.4 Site Model

```prisma
model Sites {
  id               String           @id
  code             String           @unique
  name             String
  description      String?
  address          String?
  latitude         Float?
  longitude        Float?
  attendanceRadius Int              @default(100)
  isActive         Boolean          @default(true)
  createdAt        DateTime         @default(now())
  updatedAt        DateTime
  expenses         Expense[]
  invoices         Invoice[]
  mikrotikRouter   MikroTikRouter[]
  odcs             Odc[]
  odps             Odp[]
  olts             Olt[]
  otbs             Otb[]
  pelanggan        Pelanggan[]
  poles            Pole[]
  user             User[]
  notifications    Notifications[]
  work_orders      WorkOrders[]
  gudang           Gudang[]         @relation("GudangToSite")

  @@index([isActive])
  @@map("sites")
}
```

**Site Properties yang Digunakan di Login:**

| Property           | Type   | Digunakan di | Deskripsi                    |
| ------------------ | ------ | ------------ | ---------------------------- |
| `id`               | String | User.siteId  | Foreign key                  |
| `code`             | String | -            | Unique site code             |
| `name`             | String | -            | Site name                    |
| `attendanceRadius` | Int    | -            | Radius untuk absensi (meter) |

### 3.5 User Model

```prisma
model User {
  id                 String          @id
  name               String?
  email              String          @unique
  passwordHash       String?
  createdAt          DateTime        @default(now())
  updatedAt          DateTime
  emailVerified      DateTime?
  image              String?
  phone              String?
  departmentId       String?
  siteId             String?
  roleId             String?
  isActive           Boolean         @default(true)
  workingHourMode    WorkingHourMode @default(FIXED)
  startWorkTime      String?
  endWorkTime        String?
  workDays           String?
  shiftId            String?
  flexibleTargetHour Int?
  canvasingTarget    Int             @default(50)
  isSales            Boolean         @default(false)
  pushToken          String?

  // App Version Tracking
  lastVersionCode                            Int?
  lastVersionName                            String?
  lastVersionUpdate                          DateTime?
  pushTokenUpdatedAt                         DateTime?
  tokenVersion                               Int                       @default(0)

  // Relations
  account                                    Account[]
  announcement                               Announcement[]
  attendance                                 Attendance[]
  conversation_participants                  ConversationParticipant[]
  expense                                    Expense[]
  leaveRequest                               LeaveRequest[]
  messages                                   Message[]
  overtime                                   Overtime[]
  pelanggan                                  Pelanggan[]
  session                                    Session[]
  systemLog                                  SystemLog[]
  departments                                Departments?              @relation(fields: [departmentId], references: [id])
  role                                       Role?                     @relation(fields: [roleId], references: [id])
  sites                                      Sites?                    @relation(fields: [siteId], references: [id])
  // ... other relations

  @@index([departmentId])
  @@index([isActive])
  @@index([roleId])
  @@index([siteId])
}
```

**User Properties yang Wajib untuk Login:**

| Property       | Type    | Wajib | Deskripsi                | Validasi di Auth    |
| -------------- | ------- | ----- | ------------------------ | ------------------- |
| `id`           | String  | ✅    | Unique identifier        | -                   |
| `email`        | String  | ✅    | Email login (unique)     | ✅ findByEmail      |
| `passwordHash` | String  | ✅    | Hashed password (bcrypt) | ✅ compare()        |
| `name`         | String? | ❌    | Display name             | -                   |
| `isActive`     | Boolean | ✅    | User aktif?              | ✅ session callback |
| `roleId`       | String? | ✅    | Role reference           | ✅ JWT callback     |
| `departmentId` | String? | ⚠️    | Department reference     | ⚠️ JWT callback     |
| `siteId`       | String? | ⚠️    | Site reference           | ⚠️ JWT callback     |
| `tokenVersion` | Int     | ✅    | Force logout support     | ✅ session callback |

---

## 4. Alur Validasi Login

### 4.1 Step-by-Step Validation

```mermaid
flowchart TD
    A[User Submit Login] --> B{Database Connected?}
    B -->|No| C[Error: DB Connection Failed]
    B -->|Yes| D{Redis Connected?}
    D -->|No| E[Warn: No Rate Limiting]
    D -->|Yes| F{Rate Limit OK?}
    F -->|No| G[Error: Too Many Attempts]
    F -->|Yes| H[Find User by Email]
    H --> I{User Found?}
    I -->|No| J[Error: Invalid Credentials]
    I -->|Yes| K{Password Valid?}
    K -->|No| J
    K -->|Yes| L{Portal Specified?}
    L -->|No| M[Skip Portal Check]
    L -->|Yes| N{SUPER_ADMIN?}
    N -->|Yes| M
    N -->|No| O{Portal Access Granted?}
    O -->|No| P[Error: Access Denied]
    O -->|Yes| M
    M --> Q[Fetch Role & Permissions]
    Q --> R[Generate JWT Token]
    R --> S[Create Session]
    S --> T[Redirect to Dashboard]

    style C fill:#ff6b6b
    style G fill:#ff6b6b
    style J fill:#ff6b6b
    style P fill:#ff6b6b
    style T fill:#1dd1a1
```

### 4.2 Portal Access Control Matrix

| Role Name   | accessAdminPanel | accessEmployeePanel | Admin Portal | Employee Portal |
| ----------- | ---------------- | ------------------- | ------------ | --------------- |
| SUPER_ADMIN | true             | true                | ✅           | ✅              |
| Admin       | true             | false               | ✅           | ❌              |
| Teknisi     | false            | true                | ❌           | ✅              |
| Sales       | false            | true                | ❌           | ✅              |
| Finance     | true             | false               | ✅           | ❌              |

**Logic di `lib/auth.ts` (lines 170-195):**

```typescript
const portal = creds?.portal;
if (portal) {
  console.log(`[AUTH] Checking access for portal: ${portal}`);
  const userWithRole = await prisma.user.findUnique({
    where: { id: user.id },
    include: { role: true },
  });

  const role = userWithRole?.role;

  // Super Admin bypass
  if (role?.name === "SUPER_ADMIN" || role?.name === "Super Admin") {
    console.log("[AUTH] SUPER_ADMIN access granted");
  } else {
    if (portal === "admin" && !role?.accessAdminPanel) {
      console.warn(
        "[AUTH] Access denied: User tried to access ADMIN portal without permission"
      );
      throw new Error(
        "Akses ditolak. Anda tidak memiliki izin untuk mengakses Portal Admin."
      );
    }

    if (portal === "employee" && !role?.accessEmployeePanel) {
      console.warn(
        "[AUTH] Access denied: User tried to access EMPLOYEE portal without permission"
      );
      throw new Error(
        "Akses ditolak. Anda tidak memiliki izin untuk mengakses Portal Karyawan."
      );
    }
  }
}
```

---

## 5. JWT Token Structure

### 5.1 Token Generation (JWT Callback)

```typescript
// lib/auth.ts lines 218-274
async jwt({ token, user, trigger, session }) {
  // Initial sign in
  if (user) {
    token.id = user.id

    // Fetch role and permissions from DB
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          role: {
            include: {
              permission: true
            }
          },
          departments: true // Include department details
        }
      })

      token.role = dbUser?.role?.name || 'USER'
      token.accessAdminPanel = dbUser?.role?.accessAdminPanel ?? false
      token.accessEmployeePanel = dbUser?.role?.accessEmployeePanel ?? false
      token.permissions = dbUser?.role?.permission.map(p => `${p.resource}:${p.action}`) || []

      // Store department detail
      token.departmentName = dbUser?.departments?.name
      token.isSales = dbUser?.isSales ?? false

      // Handle SUPER_ADMIN special case
      if (token.role === 'SUPER_ADMIN' || token.role === 'Super Admin') {
        token.accessAdminPanel = true
        token.accessEmployeePanel = true
      }

      // Legacy support
      token.departmentId = dbUser?.departmentId
      token.siteId = dbUser?.siteId

      // Token version for force logout feature
      token.tokenVersion = dbUser?.tokenVersion ?? 0
    } catch (error) {
      console.error('[AUTH JWT] Error fetching user role:', error)
      token.role = 'USER'
      token.accessAdminPanel = false
      token.accessEmployeePanel = false
      token.permissions = []
    }
  }

  // Handle session updates
  if (trigger === 'update') {
    // ... refresh token data
  }

  return token
}
```

### 5.2 Token Properties

| Property              | Type     | Source                          | Deskripsi                  |
| --------------------- | -------- | ------------------------------- | -------------------------- |
| `id`                  | String   | user.id                         | User ID                    |
| `role`                | String   | dbUser.role.name                | Role name                  |
| `accessAdminPanel`    | Boolean  | dbUser.role.accessAdminPanel    | Admin panel access         |
| `accessEmployeePanel` | Boolean  | dbUser.role.accessEmployeePanel | Employee panel access      |
| `permissions`         | String[] | dbUser.role.permission[]        | Array of "resource:action" |
| `departmentName`      | String?  | dbUser.departments.name         | Department name            |
| `departmentId`        | String?  | dbUser.departmentId             | Department ID              |
| `siteId`              | String?  | dbUser.siteId                   | Site ID                    |
| `isSales`             | Boolean  | dbUser.isSales                  | Sales flag                 |
| `tokenVersion`        | Int      | dbUser.tokenVersion             | Force logout support       |

### 5.3 Session Callback - Token Version Validation

```typescript
// lib/auth.ts lines 316-352
async session({ session, token }) {
  if (session.user && token.id) {
    // Validate tokenVersion against database (Force Logout feature)
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: { tokenVersion: true, isActive: true }
      });

      // If user doesn't exist, is inactive, or token version mismatch - invalidate session
      if (!dbUser || !dbUser.isActive) {
        console.log(`[AUTH SESSION] User ${token.id} not found or inactive. Invalidating session.`);
        return { ...session, user: undefined, expires: new Date(0).toISOString() };
      }

      const tokenVersion = (token.tokenVersion as number) ?? 0;
      if (dbUser.tokenVersion > tokenVersion) {
        console.log(`[AUTH SESSION] Token version mismatch for user ${token.id}. DB: ${dbUser.tokenVersion}, Token: ${tokenVersion}. Forcing logout.`);
        return { ...session, user: undefined, expires: new Date(0).toISOString() };
      }
    } catch (error) {
      console.error('[AUTH SESSION] Error validating tokenVersion:', error);
      // On error, allow session to continue (fail-open for auth)
    }

    (session.user as any).id = token.id;
    (session.user as any).role = token.role;
    (session.user as any).accessAdminPanel = token.accessAdminPanel;
    (session.user as any).accessEmployeePanel = token.accessEmployeePanel;
    (session.user as any).permissions = token.permissions;
    (session.user as any).departmentId = token.departmentId;
    (session.user as any).departmentName = token.departmentName;
    (session.user as any).siteId = token.siteId;
    (session.user as any).isSales = token.isSales;
  }
  return session
}
```

---

## 6. Analisis Seed Data Saat Ini

### 6.1 Struktur Seed (`prisma/seed.ts`)

```typescript
// 1. RBAC Setup
// - Create permissions from PERMISSION_GROUPS and PERMISSION_GROUPS_MOBILE
// - Create SUPER_ADMIN role (all permissions)
// - Create teknisi role (mobile permissions only)

// 2. Organization Setup
// - Create Department: Technical, Customer Service, Operations
// - Create Site: HQ, JKT01, JKT02
// - Create Position: Administrator, Teknisi

// 3. Gudang Setup
// - Create Gudang: GDG-PUSAT, GDG-JKT01
// - Connect gudang to sites

// 4. Settings Setup
// - Create application settings

// 5. Users Setup
// - Create admin@example.com (SUPER_ADMIN)
// - Create teknisi@example.com (teknisi)

// 6. Restore from backup (if exists)
// - Restore roles
// - Restore users
```

### 6.2 Masalah Potensial di Seed Saat Ini

| #   | Masalah                                   | Dampak                                                     | Solusi                                                    |
| --- | ----------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------- |
| 1   | Department dan Site opsional di User      | Login bisa sukses tapi user tidak memiliki department/site | Pastikan user memiliki departmentId dan siteId yang valid |
| 2   | Role permission connection menggunakan ID | Setelah reset, permission IDs berubah                      | Gunakan resource_action untuk matching                    |
| 3   | Backup restore menggunakan ID lama        | Department/Site ID invalid setelah reset                   | Map ke default department/site                            |
| 4   | Tidak ada validasi referensi              | User bisa memiliki departmentId/siteId yang tidak valid    | Tambah validasi sebelum create/update                     |

---

## 7. Struktur Seed Data yang Komprehensif

### 7.1 Urutan Pembuatan Data yang Benar

```mermaid
graph LR
    A[1. Permissions] --> B[2. Roles]
    B --> C[3. Departments]
    B --> D[4. Sites]
    C --> E[5. Positions]
    D --> F[6. Gudang]
    B --> G[7. Users]
    C --> G
    D --> G
    E --> G
```

### 7.2 Template Seed Data

```typescript
// ============================================================================
// COMPREHENSIVE SEED DATA STRUCTURE
// ============================================================================

// 1. PERMISSIONS (Wajib)
const permissions = [
  // DASHBOARD
  { resource: 'dashboard', action: 'read' },
  { resource: 'dashboard', action: 'create' },
  // ... semua kombinasi resource:action
]

// 2. ROLES (Wajib)
const roles = [
  {
    name: 'SUPER_ADMIN',
    description: 'Super Administrator with full access',
    accessAdminPanel: true,
    accessEmployeePanel: true,
    permissions: 'ALL' // Semua permissions
  },
  {
    name: 'ADMIN',
    description: 'Administrator - Admin Panel Access',
    accessAdminPanel: true,
    accessEmployeePanel: false,
    permissions: ['dashboard:*', 'users:*', 'pelanggan:*', ...]
  },
  {
    name: 'TEKNISI',
    description: 'Field Technician - Employee Portal Access',
    accessAdminPanel: false,
    accessEmployeePanel: true,
    permissions: ['m_dashboard:*', 'm_work_order:*', 'm_absensi:*', ...]
  },
  {
    name: 'SALES',
    description: 'Sales - Employee Portal Access',
    accessAdminPanel: false,
    accessEmployeePanel: true,
    permissions: ['m_dashboard:*', 'm_canvasing:*', ...]
  },
  {
    name: 'FINANCE',
    description: 'Finance - Admin Panel Access',
    accessAdminPanel: true,
    accessEmployeePanel: false,
    permissions: ['finance:*', 'daily_income:*', 'expense:*', ...]
  }
]

// 3. DEPARTMENTS (Opsional tapi direkomendasikan)
const departments = [
  { name: 'Technical', description: 'Technical Support & Network Operations' },
  { name: 'Customer Service', description: 'Customer Support & Relations' },
  { name: 'Operations', description: 'Field Operations & Maintenance' },
  { name: 'Finance', description: 'Finance & Accounting' },
  { name: 'Marketing', description: 'Marketing & Sales' },
  { name: 'HR', description: 'Human Resources' }
]

// 4. SITES (Opsional tapi direkomendasikan)
const sites = [
  { code: 'HQ', name: 'Headquarters', address: 'Jl. Utama No. 1, Jakarta' },
  { code: 'JKT01', name: 'Jakarta Selatan', address: 'Jl. Sudirman No. 123' },
  { code: 'JKT02', name: 'Jakarta Utara', address: 'Jl. Mangga Dua No. 456' }
]

// 5. POSITIONS (Opsional)
const positions = [
  { title: 'Administrator', code: 'ADMIN', departmentId: 'Technical' },
  { title: 'Teknisi', code: 'TECH', departmentId: 'Technical' },
  { title: 'Sales Representative', code: 'SALES', departmentId: 'Marketing' },
  { title: 'Finance Officer', code: 'FIN', departmentId: 'Finance' }
]

// 6. GUDANG (Opsional)
const gudangs = [
  { kode: 'GDG-PUSAT', nama: 'Gudang Pusat', lokasi: 'Jl. Utama No. 1', siteId: 'HQ' },
  { kode: 'GDG-JKT01', nama: 'Gudang Jakarta Selatan', lokasi: 'Jl. Sudirman No. 123', siteId: 'JKT01' }
]

// 7. USERS (Wajib)
const users = [
  {
    email: 'admin@example.com',
    passwordHash: 'hashed_password_here',
    name: 'System Administrator',
    roleId: 'SUPER_ADMIN',
    departmentId: 'Technical',
    siteId: 'HQ',
    isActive: true,
    tokenVersion: 0
  },
  {
    email: 'teknisi@example.com',
    passwordHash: 'hashed_password_here',
    name: 'Budi Santoso',
    roleId: 'TEKNISI',
    departmentId: 'Technical',
    siteId: 'HQ',
    isActive: true,
    tokenVersion: 0
  },
  {
    email: 'sales@example.com',
    passwordHash: 'hashed_password_here',
    name: 'Ani Wijaya',
    roleId: 'SALES',
    departmentId: 'Marketing',
    siteId: 'JKT01',
    isActive: true,
    tokenVersion: 0,
    isSales: true
  },
  {
    email: 'finance@example.com',
    passwordHash: 'hashed_password_here',
    name: 'Citra Dewi',
    roleId: 'FINANCE',
    departmentId: 'Finance',
    siteId: 'HQ',
    isActive: true,
    tokenVersion: 0
  }
]
```

---

## 8. Rekomendasi Perbaikan

### 8.1 Validasi Data Sebelum Login

```typescript
// Tambahkan validasi di UserRepository.findByEmail
async findByEmail(email: string): Promise<UserWithPassword | null> {
  const user = await this.client.user.findUnique({
    where: {
      email,
      passwordHash: { not: null }
    },
    include: {
      role: {
        include: {
          permission: true
        }
      },
      departments: true,
      sites: true
    }
  })

  // Validasi: User harus memiliki role
  if (!user || !user.roleId) {
    return null
  }

  // Validasi: Role harus ada
  if (!user.role) {
    return null
  }

  // Validasi: Role harus memiliki permissions
  if (!user.role.permission || user.role.permission.length === 0) {
    console.warn(`[UserRepository] User ${email} has role without permissions`)
  }

  // Validasi: Department harus valid jika departmentId ada
  if (user.departmentId && !user.departments) {
    console.warn(`[UserRepository] User ${email} has invalid departmentId`)
  }

  // Validasi: Site harus valid jika siteId ada
  if (user.siteId && !user.sites) {
    console.warn(`[UserRepository] User ${email} has invalid siteId`)
  }

  return {
    ...user,
    passwordHash: user.passwordHash!
  }
}
```

### 8.2 Perbaikan Seed Script

```typescript
// prisma/seed-improved.ts

async function main() {
  console.log("🌱 Seeding database...\n");

  // STEP 1: Create Permissions
  console.log("📋 Creating permissions...");
  const permissions = await createPermissions();
  console.log(`   ✅ Created ${permissions.length} permissions`);

  // STEP 2: Create Roles
  console.log("👥 Creating roles...");
  const roles = await createRoles(permissions);
  console.log(`   ✅ Created ${roles.length} roles`);

  // STEP 3: Create Departments
  console.log("🏢 Creating departments...");
  const departments = await createDepartments();
  console.log(`   ✅ Created ${departments.length} departments`);

  // STEP 4: Create Sites
  console.log("📍 Creating sites...");
  const sites = await createSites();
  console.log(`   ✅ Created ${sites.length} sites`);

  // STEP 5: Create Positions
  console.log("💼 Creating positions...");
  const positions = await createPositions(departments);
  console.log(`   ✅ Created ${positions.length} positions`);

  // STEP 6: Create Gudang
  console.log("📦 Creating gudang...");
  const gudangs = await createGudang(sites);
  console.log(`   ✅ Created ${gudangs.length} gudang`);

  // STEP 7: Create Users
  console.log("👤 Creating users...");
  const users = await createUsers(roles, departments, sites);
  console.log(`   ✅ Created ${users.length} users`);

  // STEP 8: Validate data
  console.log("\n✅ Validating data...");
  await validateLoginData(users);
  console.log("   ✅ All data validated successfully");

  console.log("\n✅ Seeding completed!");
}

async function validateLoginData(users: any[]) {
  for (const user of users) {
    // Validasi: User memiliki passwordHash
    if (!user.passwordHash) {
      throw new Error(`User ${user.email} missing passwordHash`);
    }

    // Validasi: User memiliki role
    if (!user.roleId) {
      throw new Error(`User ${user.email} missing roleId`);
    }

    // Validasi: Role valid
    const role = await prisma.role.findUnique({ where: { id: user.roleId } });
    if (!role) {
      throw new Error(`User ${user.email} has invalid roleId: ${user.roleId}`);
    }

    // Validasi: Role memiliki permissions
    const roleWithPerms = await prisma.role.findUnique({
      where: { id: user.roleId },
      include: { permission: true },
    });
    if (!roleWithPerms?.permission || roleWithPerms.permission.length === 0) {
      throw new Error(`Role ${role.name} has no permissions`);
    }

    // Validasi: Department valid jika ada
    if (user.departmentId) {
      const dept = await prisma.departments.findUnique({
        where: { id: user.departmentId },
      });
      if (!dept) {
        throw new Error(
          `User ${user.email} has invalid departmentId: ${user.departmentId}`
        );
      }
    }

    // Validasi: Site valid jika ada
    if (user.siteId) {
      const site = await prisma.sites.findUnique({
        where: { id: user.siteId },
      });
      if (!site) {
        throw new Error(
          `User ${user.email} has invalid siteId: ${user.siteId}`
        );
      }
    }
  }
}
```

### 8.3 Checklist Validasi Login

```markdown
Sebelum menjalankan aplikasi, pastikan:

✅ Permissions Table

- [ ] Minimal 1 permission record
- [ ] Setiap permission memiliki resource dan action yang valid

✅ Roles Table

- [ ] Minimal 1 role record
- [ ] Setiap role memiliki accessAdminPanel atau accessEmployeePanel = true
- [ ] Setiap role memiliki minimal 1 permission

✅ Users Table

- [ ] Minimal 1 user dengan passwordHash
- [ ] Setiap user memiliki roleId yang valid
- [ ] Setiap user memiliki isActive = true
- [ ] Setiap user memiliki tokenVersion (default 0)

✅ Departments Table (Opsional)

- [ ] Jika user.departmentId ada, department harus valid

✅ Sites Table (Opsional)

- [ ] Jika user.siteId ada, site harus valid

✅ Database Connection

- [ ] PostgreSQL running
- [ ] Connection string valid
- [ ] Migrations applied

✅ Redis Connection (Opsional)

- [ ] Redis running (untuk rate limiting)
```

---

## 9. Troubleshooting Login Issues

### 9.1 Common Issues dan Solusi

| Issue                       | Kemungkinan Penyebab             | Solusi                                   |
| --------------------------- | -------------------------------- | ---------------------------------------- |
| "Invalid credentials"       | Email tidak ditemukan            | Cek user ada di database                 |
| "Invalid credentials"       | Password salah                   | Reset password atau cek passwordHash     |
| "Database connection error" | PostgreSQL tidak running         | Start database service                   |
| "Akses ditolak"             | Role tidak memiliki akses portal | Cek accessAdminPanel/accessEmployeePanel |
| "User tidak ditemukan"      | User tidak memiliki role         | Assign role ke user                      |
| "Session invalid"           | tokenVersion mismatch            | Update user.tokenVersion di DB           |
| "No permissions"            | Role tanpa permissions           | Assign permissions ke role               |

### 9.2 Debug Queries

```sql
-- Cek user dengan role dan permissions
SELECT
  u.id,
  u.email,
  u.name,
  u.isActive,
  u.tokenVersion,
  r.name as role_name,
  r.accessAdminPanel,
  r.accessEmployeePanel,
  COUNT(p.id) as permission_count
FROM "User" u
LEFT JOIN "roles" r ON u."roleId" = r.id
LEFT JOIN "_PermissionToRole" pr ON r.id = pr."roleId"
LEFT JOIN "Permission" p ON pr."permissionId" = p.id
WHERE u.email = 'admin@example.com'
GROUP BY u.id, r.id;

-- Cek permissions untuk role
SELECT
  r.name as role_name,
  p.resource,
  p.action,
  p.name as permission_name
FROM "roles" r
JOIN "_PermissionToRole" pr ON r.id = pr."roleId"
JOIN "Permission" p ON pr."permissionId" = p.id
WHERE r.name = 'SUPER_ADMIN'
ORDER BY p.resource, p.action;

-- Cek user department dan site
SELECT
  u.email,
  u.name,
  d.name as department_name,
  s.name as site_name,
  s.code as site_code
FROM "User" u
LEFT JOIN "departments" d ON u."departmentId" = d.id
LEFT JOIN "sites" s ON u."siteId" = s.id
WHERE u.email = 'admin@example.com';
```

---

## 10. Kesimpulan

### 10.1 Dependensi Wajib untuk Login

Untuk login berhasil, data berikut **WAJIB** ada di database:

1. **Permission** - Minimal 1 permission record
2. **Role** - Minimal 1 role dengan:
   - `accessAdminPanel = true` ATAU `accessEmployeePanel = true`
   - Minimal 1 permission terhubung
3. **User** - Minimal 1 user dengan:
   - `email` (unique)
   - `passwordHash` (hashed dengan bcrypt)
   - `roleId` (valid reference ke Role)
   - `isActive = true`
   - `tokenVersion` (default 0)

### 10.2 Dependensi Opsional tapi Direkomendasikan

1. **Department** - Untuk organisasi user
2. **Site** - Untuk lokasi kerja dan absensi
3. **Position** - Untuk jabatan user
4. **Gudang** - Untuk inventory management

### 10.3 Rekomendasi Implementasi

1. ✅ Gunakan seed script yang sudah divalidasi
2. ✅ Tambahkan validasi data sebelum login
3. ✅ Implementasikan error handling yang jelas
4. ✅ Gunakan logging untuk debugging
5. ✅ Test login dengan berbagai role
6. ✅ Dokumentasikan user credentials

---

## Appendix

### A. Environment Variables yang Diperlukan

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# NextAuth
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000
COOKIE_DOMAIN=.example.com

# Redis (opsional untuk rate limiting)
REDIS_URL=redis://localhost:6379

# Session
SESSION_MAX_AGE=604800  # 7 days
SESSION_UPDATE_AGE=1800  # 30 minutes
```

### B. Default Login Credentials (dari seed.ts)

```
Admin:    admin@example.com / admin123
Teknisi:  teknisi@example.com / tech123
```

### C. File Referensi

- `lib/auth.ts` - Konfigurasi NextAuth
- `lib/permission-config.ts` - Permission groups
- `lib/repositories/UserRepository.ts` - User repository
- `prisma/seed.ts` - Seed script
- `components/auth/LoginForm.tsx` - Login form
- `app/api/auth/[...nextauth]/route.ts` - Auth API route
