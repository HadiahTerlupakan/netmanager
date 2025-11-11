# Database Seeding Guide

## 📋 Overview

Database seeding digunakan untuk mengisi database dengan data default, terutama user admin untuk pertama kali setup.

## 🚀 Cara Menjalankan Seed

### Opsi 1: Menggunakan npm script (Recommended)

```bash
npm run prisma:seed
```

Script ini akan:
1. ✅ Auto-generate Prisma Client (jika belum)
2. ✅ Connect ke database
3. ✅ Create atau update admin user
4. ✅ Show login credentials

### Opsi 2: Langsung menggunakan tsx

```bash
npx tsx prisma/seed.ts
```

**⚠️ Catatan:** Pastikan Prisma Client sudah di-generate dengan `npx prisma generate` sebelum menjalankan seed.

## ⚙️ Konfigurasi

### Default Values

Jika tidak di-set di `.env`, seed akan menggunakan:
- **Email:** `admin@example.com`
- **Password:** `admin123`
- **Name:** `Administrator`
- **Role:** `ADMIN`

### Custom Configuration

Tambahkan di file `.env`:

```env
SEED_ADMIN_EMAIL=your-admin@example.com
SEED_ADMIN_PASSWORD=your-secure-password
```

Lalu jalankan seed:

```bash
npm run prisma:seed
```

## 🔄 Idempotent

Seed script adalah **idempotent**, artinya:
- ✅ Bisa dijalankan berkali-kali tanpa error
- ✅ Jika user sudah ada, akan di-update (password & role)
- ✅ Jika user belum ada, akan di-create
- ✅ Tidak akan membuat duplicate user

## 📝 Contoh Output

```
🌱 Starting database seed...

✓ Database connection OK
📧 Admin email: admin@example.com
🔐 Hashing password...
➕ Creating new admin user...
✓ User created successfully
   ID: cmhuyfzkj0000k1vdubdn8fq1
   Email: admin@example.com
   Role: ADMIN
   Name: Administrator

✅ Seed completed successfully!

📝 Login credentials:
   Email: admin@example.com
   Password: admin123

💡 Tip: Set SEED_ADMIN_EMAIL dan SEED_ADMIN_PASSWORD di .env untuk custom credentials
```

## 🔧 Troubleshooting

### Error: "Prisma Client not generated"

**Solusi:**
```bash
npx prisma generate
npm run prisma:seed
```

Atau gunakan script yang sudah include generate:
```bash
npm run prisma:seed  # Sudah include prisma generate
```

### Error: "Database connection failed"

**Solusi:**
1. Pastikan database berjalan:
   ```bash
   npm run db:ps
   ```

2. Cek `DATABASE_URL` di `.env`:
   ```env
   DATABASE_URL=postgresql://netmgr:netmgr@localhost:5433/netmanager?schema=public
   ```

3. Restart database jika perlu:
   ```bash
   npm run db:down
   npm run db:up
   ```

### Error: "Invalid email format"

**Solusi:**
Pastikan `SEED_ADMIN_EMAIL` di `.env` adalah email yang valid:
```env
SEED_ADMIN_EMAIL=admin@example.com  # ✅ Valid
SEED_ADMIN_EMAIL=admin              # ❌ Invalid
```

### Error: "Password must be at least 6 characters"

**Solusi:**
Pastikan `SEED_ADMIN_PASSWORD` minimal 6 karakter:
```env
SEED_ADMIN_PASSWORD=admin123  # ✅ Valid (8 chars)
SEED_ADMIN_PASSWORD=admin     # ❌ Invalid (5 chars)
```

## 🔄 Reset & Seed

Untuk reset database dan seed ulang:

```bash
# Reset database (hapus semua data) dan seed
npm run prisma:reset-seed
```

**⚠️ WARNING:** Ini akan menghapus SEMUA data di database!

## 📚 Related Commands

| Command | Description |
|---------|-------------|
| `npm run prisma:seed` | Run seed (auto-generate Prisma Client) |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Run migrations |
| `npm run prisma:reset` | Reset database (hapus semua data) |
| `npm run prisma:reset-seed` | Reset database + seed |

## ✅ Best Practices

1. **Selalu generate Prisma Client sebelum seed:**
   - Script `prisma:seed` sudah include generate otomatis
   - Atau jalankan manual: `npx prisma generate`

2. **Gunakan environment variables untuk production:**
   ```env
   SEED_ADMIN_EMAIL=admin@yourdomain.com
   SEED_ADMIN_PASSWORD=strong-secure-password-here
   ```

3. **Jangan commit credentials ke git:**
   - Gunakan `.env` (sudah di-ignore oleh git)
   - Jangan hardcode password di seed script

4. **Seed hanya untuk development/staging:**
   - Jangan jalankan seed di production database
   - Gunakan migration untuk setup production data

## 🎯 Use Cases

### 1. First Time Setup

```bash
# Setup database pertama kali
npm run db:up              # Start database
npm run prisma:migrate     # Run migrations
npm run prisma:seed        # Create admin user
```

### 2. Reset Development Database

```bash
# Reset dan seed ulang
npm run prisma:reset-seed
```

### 3. Update Admin Password

```bash
# Update password di .env
echo "SEED_ADMIN_PASSWORD=new-password" >> .env

# Run seed (akan update existing user)
npm run prisma:seed
```

---

**Terakhir diupdate:** $(date)

