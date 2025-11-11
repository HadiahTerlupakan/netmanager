# CI/CD Pipeline Documentation

NetManager menggunakan GitHub Actions untuk Continuous Integration dan Continuous Deployment.

## 📋 Overview

CI/CD Pipeline terdiri dari beberapa workflow:

1. **CI Pipeline** (`ci.yml`) - Automated checks pada setiap push dan PR
2. **Release Pipeline** (`release.yml`) - Automated release saat tag dibuat
3. **Deploy Pipeline** (`deploy.yml`) - Deployment ke staging/production

---

## 🔄 CI Pipeline (`ci.yml`)

### Trigger
- Push ke branch `main` atau `develop`
- Pull Request ke branch `main` atau `develop`

### Jobs

#### 1. Lint & Type Check
- **Job:** `lint`
- **Tujuan:** Memastikan code quality dan type safety
- **Steps:**
  - Checkout code
  - Setup Node.js 20
  - Install dependencies
  - Run ESLint
  - Run TypeScript type check

#### 2. Run Tests
- **Job:** `test`
- **Tujuan:** Menjalankan semua unit dan integration tests
- **Services:**
  - PostgreSQL 16 (test database)
  - Redis 7 (cache)
- **Steps:**
  - Checkout code
  - Setup Node.js 20
  - Install dependencies
  - Generate Prisma Client
  - Run database migrations
  - Run tests dengan Vitest
  - Upload test coverage (optional)

**Environment Variables:**
```yaml
DATABASE_URL: postgresql://postgres:postgres@localhost:5432/netmanager_test
REDIS_URL: redis://localhost:6379
NEXTAUTH_SECRET: test-secret-key-for-ci
NEXTAUTH_URL: http://localhost:3000
NODE_ENV: test
VITEST: true
```

#### 3. Build Check
- **Job:** `build`
- **Tujuan:** Memastikan aplikasi bisa di-build tanpa error
- **Dependencies:** `lint`, `test`
- **Steps:**
  - Checkout code
  - Setup Node.js 20
  - Install dependencies
  - Generate Prisma Client
  - Build Next.js application

#### 4. Security Audit
- **Job:** `security`
- **Tujuan:** Mengecek vulnerability di dependencies
- **Steps:**
  - Checkout code
  - Setup Node.js 20
  - Install dependencies
  - Run `npm audit`
  - Fail jika ada high/critical vulnerabilities

---

## 🚀 Release Pipeline (`release.yml`)

### Trigger
- Push tag dengan format `v*` (contoh: `v1.0.0`)

### Jobs

#### Create Release
- **Job:** `release`
- **Tujuan:** Membuat GitHub Release otomatis
- **Steps:**
  - Checkout code
  - Setup Node.js 20
  - Install dependencies
  - Generate Prisma Client
  - Build application
  - Create GitHub Release dengan release notes

---

## 🚢 Deploy Pipeline (`deploy.yml`)

### Trigger
- Manual workflow dispatch (dengan pilihan environment)
- Push ke branch `main` (auto-deploy ke staging)

### Jobs

#### Deploy
- **Job:** `deploy`
- **Tujuan:** Deploy aplikasi ke environment yang dipilih
- **Environments:** `staging`, `production`
- **Steps:**
  - Checkout code
  - Setup Node.js 20
  - Install dependencies
  - Generate Prisma Client
  - Build application
  - Deploy ke Vercel (jika configured)
  - Send deployment notification

### Required Secrets

Untuk deployment ke Vercel, tambahkan secrets berikut di GitHub:

1. `VERCEL_TOKEN` - Vercel authentication token
2. `VERCEL_ORG_ID` - Vercel organization ID
3. `VERCEL_PROJECT_ID` - Vercel project ID

**Cara mendapatkan secrets:**

1. **VERCEL_TOKEN:**
   - Login ke Vercel
   - Settings → Tokens
   - Create new token

2. **VERCEL_ORG_ID & VERCEL_PROJECT_ID:**
   - Install Vercel CLI: `npm i -g vercel`
   - Run: `vercel link`
   - Check `.vercel/project.json` untuk IDs

---

## 🔧 Setup & Configuration

### 1. Setup GitHub Actions

Workflow files sudah ada di `.github/workflows/`. Tidak perlu setup tambahan, workflow akan otomatis berjalan saat:
- Push ke `main` atau `develop`
- Pull Request dibuat
- Tag dibuat (untuk release)

### 2. Environment Variables

Untuk local development, pastikan file `.env` sudah di-setup dengan benar. Untuk CI/CD, environment variables sudah di-set di workflow files.

### 3. Test Database

CI menggunakan PostgreSQL dan Redis dari Docker services. Tidak perlu setup manual.

### 4. Coverage Reports

Test coverage akan di-upload ke Codecov (jika configured). Untuk setup Codecov:

1. Sign up di [codecov.io](https://codecov.io)
2. Connect GitHub repository
3. Add `CODECOV_TOKEN` secret di GitHub (optional)

---

## 📊 Workflow Status

Anda bisa melihat status workflow di:
- GitHub repository → Actions tab
- Pull Request page (status checks)
- Commit page (status checks)

### Status Badge

Tambahkan badge di README.md:

```markdown
![CI/CD](https://github.com/your-username/netmanager/workflows/CI%2FCD%20Pipeline/badge.svg)
```

---

## 🐛 Troubleshooting

### Tests Failing

1. **Database connection error:**
   - Pastikan PostgreSQL service running di CI
   - Check `DATABASE_URL` environment variable

2. **Redis connection error:**
   - Pastikan Redis service running di CI
   - Check `REDIS_URL` environment variable

3. **Prisma errors:**
   - Pastikan `prisma generate` dijalankan sebelum tests
   - Check migration files

### Build Failing

1. **Type errors:**
   - Run `npm run typecheck` local
   - Fix type errors sebelum push

2. **Build errors:**
   - Run `npm run build` local
   - Check Next.js build logs

### Deployment Failing

1. **Vercel deployment:**
   - Check Vercel secrets di GitHub
   - Verify Vercel project configuration
   - Check Vercel deployment logs

2. **Environment variables:**
   - Pastikan semua required env vars sudah di-set
   - Check Vercel environment variables

---

## 🔐 Security Best Practices

1. **Never commit secrets:**
   - Gunakan GitHub Secrets untuk sensitive data
   - Jangan hardcode credentials di workflow files

2. **Dependency updates:**
   - Review `npm audit` results
   - Update dependencies secara berkala

3. **Code review:**
   - Require PR reviews sebelum merge
   - Run CI checks sebelum merge

---

## 📚 Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Vercel Deployment](https://vercel.com/docs)
- [Codecov Documentation](https://docs.codecov.com)

---

## 🎯 Next Steps

1. **Setup Vercel deployment** (jika belum):
   - Connect repository ke Vercel
   - Add required secrets
   - Test deployment

2. **Setup Codecov** (optional):
   - Sign up dan connect repository
   - Add coverage badge

3. **Add more checks** (optional):
   - E2E tests dengan Playwright
   - Performance tests
   - Security scanning

---

**Terakhir diupdate:** $(date)

