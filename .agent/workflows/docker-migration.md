---
description: Workflow untuk deploy Prisma migration ke Docker production
---

# Deploy Migration ke Docker Production

Panduan untuk menerapkan Prisma migration ke server production yang menggunakan Docker.

## Prerequisites

- SSH access ke server production
- File migration sudah dibuat di folder `prisma/migrations/`

## Langkah-langkah

### 1. Buat Migration di Lokal (jika belum ada)

```bash
npx prisma migrate dev --name <nama_migration>
```

### 2. Copy Migration ke Server Production

Ada 2 cara:

**Cara A: Via Git (Recommended)**

```bash
# Di lokal
git add prisma/migrations/<folder_migration>/
git commit -m "feat: add migration <nama>"
git push

# Di server
git pull
```

**Cara B: Buat langsung di server**

```bash
mkdir -p prisma/migrations/<folder_migration>
cat > prisma/migrations/<folder_migration>/migration.sql << 'EOF'
-- SQL content here
EOF
```

// turbo

### 3. Copy Migration ke Container

```bash
docker cp prisma/migrations/<folder_migration> netmanager-app:/app/prisma/migrations/
```

// turbo

### 4. Jalankan Migration

```bash
docker exec netmanager-app npx prisma migrate deploy
```

## Quick Command (One-liner)

```bash
docker cp prisma/migrations/<folder_migration> netmanager-app:/app/prisma/migrations/ && docker exec netmanager-app npx prisma migrate deploy
```

## Container Reference

| Service  | Container Name     |
| -------- | ------------------ |
| App      | `netmanager-app`   |
| Database | `netmanager-db`    |
| Redis    | `netmanager-redis` |

## Troubleshooting

### Cek status migration

```bash
docker exec netmanager-app npx prisma migrate status
```

### Akses database langsung

```bash
docker exec -it netmanager-db psql -U netmgr -d netmanager
```

### Rollback (jika perlu)

Prisma tidak support auto-rollback. Restore dari backup:

```bash
./deploy.sh restore backups/<backup_file.sql.gz>
```
