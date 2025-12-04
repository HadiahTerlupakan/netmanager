# OAuth Setup Guide - NetManager

Panduan lengkap untuk mengkonfigurasi OAuth providers (Google, GitHub, Microsoft/Azure AD) untuk aplikasi NetManager.

## ✅ Current Implementation Status

**COMPLETED FEATURES:**
- ✅ Dynamic OAuth provider management system
- ✅ Login page displays OAuth providers (with fallback support)
- ✅ Admin panel for OAuth configuration at `/admin/pengaturan/oauth`
- ✅ Database schema with encrypted credential storage
- ✅ API endpoints for OAuth provider management
- ✅ Fallback providers when no database configuration exists
- ✅ Environment variable support for OAuth credentials

## Overview

NetManager sekarang mendukung login menggunakan:
- **Google OAuth** - Login dengan akun Google
- **GitHub OAuth** - Login dengan akun GitHub
- **Microsoft/Azure AD** - Login dengan akun Microsoft (opsional)
- **Dynamic Configuration** - Configure OAuth through admin panel
- **Fallback Support** - Shows OAuth buttons even without database configuration
- **Credentials** - Login tradisional dengan email/password atau Employee ID

> **PENTING**: Portal pelanggan (`/pelanggan`) tetap menggunakan JWT authentication dan TIDAK terpengaruh oleh OAuth ini.

## 🚀 What's Working Now

### 1. Login Page OAuth Display
- Login page (`/login`) now shows OAuth provider buttons
- When no OAuth providers are configured in database, shows fallback providers
- Respects environment variables for Microsoft OAuth
- Graceful error handling and loading states

### 2. Admin OAuth Configuration
- **Settings Page**: `/admin/pengaturan/oauth`
- **Features**:
  - Add/Edit/Delete OAuth provider configurations
  - Enable/disable providers
  - Test connection functionality
  - Encrypted credential storage
  - Role-based access control (admin only)

### 3. API Endpoints
- `GET /api/auth/oauth/providers` - Public endpoint for frontend OAuth providers
- `GET /api/admin/oauth/configs` - List OAuth configurations (admin only)
- `POST /api/admin/oauth/configs` - Create/update OAuth configuration (admin only)
- `DELETE /api/admin/oauth/configs/[id]` - Delete OAuth configuration (admin only)

## Prerequisites

Sebelum memulai, pastikan Anda memiliki:
- Akses ke [Google Cloud Console](https://console.cloud.google.com/)
- Akun GitHub dengan akses ke [Developer Settings](https://github.com/settings/developers)
- (Opsional) Azure account untuk Microsoft OAuth

## 1. Google OAuth Setup

### 1.1 Buat OAuth Client ID

1. Buka [Google Cloud Console](https://console.cloud.google.com/)
2. Pilih atau buat project baru
3. Navigate ke **APIs & Services** > **Credentials**
4. Klik **Create Credentials** > **OAuth client ID**
5. Pilih **Web application**
6. Konfigurasi:
   - **Name**: NetManager OAuth
   - **Authorized JavaScript origins**:
     ```
     http://localhost:3000
     https://yourdomain.com
     ```
   - **Authorized redirect URIs**:
     ```
     http://localhost:3000/api/auth/callback/google
     https://yourdomain.com/api/auth/callback/google
     https://admin.yourdomain.com/api/auth/callback/google
     https://karyawan.yourdomain.com/api/auth/callback/google
     https://helpdesk.yourdomain.com/api/auth/callback/google
     https://finance.yourdomain.com/api/auth/callback/google
     ```

7. Klik **Create** dan simpan **Client ID** dan **Client Secret**

### 1.2 Tambahkan ke Environment Variables

Edit file `.env`:
```bash
GOOGLE_CLIENT_ID="your-google-client-id-here"
GOOGLE_CLIENT_SECRET="your-google-client-secret-here"
```

## 2. GitHub OAuth Setup

### 2.1 Buat OAuth App

1. Buka [GitHub Developer Settings](https://github.com/settings/developers)
2. Klik **New OAuth App**
3. Konfigurasi:
   - **Application name**: NetManager
   - **Homepage URL**: `https://yourdomain.com`
   - **Authorization callback URL**:
     ```
     http://localhost:3000/api/auth/callback/github
     https://yourdomain.com/api/auth/callback/github
     ```
     > Catatan: GitHub hanya allow 1 callback URL. Untuk multiple subdomains, gunakan wildcard atau register separate apps.

4. Klik **Register application**
5. Generate **Client Secret** dan simpan bersama **Client ID**

### 2.2 Tambahkan ke Environment Variables

Edit file `.env`:
```bash
GITHUB_CLIENT_ID="your-github-client-id-here"
GITHUB_CLIENT_SECRET="your-github-client-secret-here"
```

## 3. Microsoft/Azure AD OAuth Setup (Optional)

### 3.1 Register Application di Azure

1. Buka [Azure Portal](https://portal.azure.com/)
2. Navigate ke **Azure Active Directory** > **App registrations**
3. Klik **New registration**
4. Konfigurasi:
   - **Name**: NetManager
   - **Supported account types**: Pilih sesuai kebutuhan
   - **Redirect URI**: 
     - Platform: Web
     - URI: `https://yourdomain.com/api/auth/callback/azure-ad`

5. Klik **Register**
6. Di halaman **Overview**, copy:
   - **Application (client) ID**
   - **Directory (tenant) ID**

7. Navigate ke **Certificates & secrets** > **New client secret**
8. Buat secret dan copy nilainya (hanya ditampilkan sekali!)

### 3.2 Tambahkan ke Environment Variables

Edit file `.env`:
```bash
AZURE_AD_CLIENT_ID="your-azure-client-id-here"
AZURE_AD_CLIENT_SECRET="your-azure-client-secret-here"
AZURE_AD_TENANT_ID="your-azure-tenant-id-here"
```

## 4. Auth Secret Configuration

Generate secure random secret untuk Auth.js:

```bash
# Menggunakan OpenSSL (Linux/Mac)
openssl rand -base64 32

# Menggunakan PowerShell (Windows)
-join((48..57)+(65..90)+(97..122)|Get-Random -Count 32|%{[char]$_})
```

Tambahkan ke `.env`:
```bash
AUTH_SECRET="your-generated-secret-here"
NEXTAUTH_SECRET="your-generated-secret-here"  # Backward compatibility
```

## 5. Environment Variables Lengkap

File `.env` lengkap untuk OAuth:

```bash
# Auth.js Configuration
AUTH_SECRET="your-generated-secret-here"
AUTH_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-generated-secret-here"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# GitHub OAuth  
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# Microsoft/Azure AD OAuth (Optional)
AZURE_AD_CLIENT_ID="your-azure-client-id"
AZURE_AD_CLIENT_SECRET="your-azure-client-secret"
AZURE_AD_TENANT_ID="your-azure-tenant-id"

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/netmanager"

# Redis
REDIS_URL="redis://localhost:6380"
```

## 6. Testing

### 6.1 Local Development

1. Start development server:
   ```bash
   npm run dev
   ```

2. Navigate ke `http://localhost:3000/login`

3. Klik salah satu OAuth button:
   - **Continue with Google**
   - **Continue with GitHub**
   - **Continue with Microsoft** (jika enabled)

4. Setelah OAuth flow selesai, Anda akan diredirect ke `/admin`

### 6.2 Verify OAuth User Creation

1. Check database untuk user baru:
   ```sql
   SELECT id, name, email, role, "emailVerified", image 
   FROM "User" 
   WHERE email = 'your-oauth-email@gmail.com';
   ```

2. Check OAuth account link:
   ```sql
   SELECT * FROM "Account" 
   WHERE "userId" = 'user-id-from-above';
   ```

## 7. User Role Management

OAuth users akan secara otomatis dibuat dengan role `USER`. Untuk mengubah role:

### Via Prisma Studio
```bash
npx prisma studio
```
Kemudian edit role di UI.

### Via SQL
```sql
UPDATE "User" 
SET role = 'ADMIN' 
WHERE email = 'user@example.com';
```

### Via Admin Panel
Navigate ke `/admin/users` dan edit user role.

## 8. Production Deployment

Untuk production:

1. **Update Authorized Redirect URIs** di semua OAuth providers dengan production URLs

2. **Set Environment Variables** di production environment (Vercel, Railway, dll):
   ```bash
   AUTH_URL=https://yourdomain.com
   NEXTAUTH_URL=https://yourdomain.com
   # ... tambahkan semua OAuth credentials
   ```

3. **HTTPS Required**: OAuth providers require HTTPS untuk production

4. **Domain Verification**: Beberapa providers memerlukan domain verification

## 9. Troubleshooting

### Error: "Configuration Error"
- Check bahwa semua environment variables sudah diset
- Pastikan tidak ada typo di variable names
- Restart development server setelah update `.env`

### Error: "Redirect URI Mismatch"
- Pastikan redirect URI di OAuth provider match dengan yang dikonfigurasi
- Format harus exact: `https://yourdomain.com/api/auth/callback/{provider}`

### OAuth User Tidak Ter-create
-Check database connection
- Check Prisma schema sudah ter-generate
- Check logs untuk error messages

### Session Tidak Persist
- Check `AUTH_SECRET` / `NEXTAUTH_SECRET` sudah diset
- Check cookies di browser (should see `next-auth.session-token`)

## 10. Security Best Practices

1. **Never commit `.env` to git** - Sudah ada di `.gitignore`
2. **Use different secrets** untuk dev dan production  
3. **Rotate secrets regularly** (recommended: setiap 90 hari)
4. **Restrict OAuth scopes** ke minimum yang diperlukan
5. **Monitor OAuth usage** via provider dashboards

## 11. Portal Pelanggan (TIDAK Berubah)

Portal pelanggan tetap menggunakan JWT authentication:
- Login: `/pelanggan/login` dengan ID Pelanggan + Password
- Auth: `/api/pelanggan/auth/login`
- **TIDAK menggunakan OAuth**

## 12. Additional Resources

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [GitHub OAuth](https://docs.github.com/en/apps/oauth-apps)  
- [Azure AD OAuth](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
