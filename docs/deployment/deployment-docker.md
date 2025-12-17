# Docker Deployment Guide

Panduan untuk deploy NetManager menggunakan Docker dengan subdomain support.

## Prerequisites

- Server dengan Docker dan Docker Compose installed
- Domain dengan DNS di Cloudflare
- Git repository access

## Architecture

```
Internet → Cloudflare (SSL) → Server:80 → Traefik → Next.js App
                                              ↓
                              *.domain.com → /subdomain path
```

## Quick Start

### 1. Clone Repository
```bash
git clone <your-repo-url> netmanager
cd netmanager
```

### 2. Setup Environment
```bash
# Copy production template
cp .env.production.example .env

# Edit with your values
nano .env
```

**Required changes in `.env`:**
```env
DOMAIN=yourdomain.com
NEXTAUTH_URL=https://yourdomain.com
AUTH_URL=https://yourdomain.com
POSTGRES_PASSWORD=<strong-password>
REDIS_PASSWORD=<strong-password>
AUTH_SECRET=<generate-with-openssl-rand-base64-32>
NEXTAUTH_SECRET=<same-as-auth-secret>
```

### 3. Setup Cloudflare DNS

Di Cloudflare Dashboard, tambahkan DNS records:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | @ | `<server-ip>` | Proxied ✓ |
| A | admin | `<server-ip>` | Proxied ✓ |
| A | employee | `<server-ip>` | Proxied ✓ |
| A | finance | `<server-ip>` | Proxied ✓ |
| A | helpdesk | `<server-ip>` | Proxied ✓ |
| A | pelanggan | `<server-ip>` | Proxied ✓ |

**Cloudflare SSL Settings:**
- SSL/TLS → Overview → Set to **Flexible**
- SSL/TLS → Edge Certificates → Always Use HTTPS → **On**

### 4. Deploy

```bash
# Build and start all services
docker-compose --profile prod up -d --build

# Check status
docker-compose --profile prod ps

# View logs
docker-compose --profile prod logs -f app
```

### 5. Run Database Migrations

```bash
# Run migrations inside container
docker exec -it netmanager-app npx prisma migrate deploy

# Seed database (first time only)
docker exec -it netmanager-app npx prisma db seed
```

## Accessing the Application

After deployment:

| URL | Portal |
|-----|--------|
| `https://yourdomain.com` | Landing / Login |
| `https://admin.yourdomain.com` | Admin Portal |
| `https://employee.yourdomain.com` | Employee Portal |
| `https://finance.yourdomain.com` | Finance Portal |
| `https://helpdesk.yourdomain.com` | Helpdesk Portal |
| `https://pelanggan.yourdomain.com` | Customer Portal |

## Common Commands

### Start/Stop

```bash
# Start production
docker-compose --profile prod up -d

# Stop production
docker-compose --profile prod down

# Restart app only
docker-compose --profile prod restart app
```

### Logs

```bash
# All logs
docker-compose --profile prod logs -f

# App logs only
docker-compose --profile prod logs -f app

# Traefik logs
docker-compose --profile prod logs -f traefik
```

### Updates

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose --profile prod up -d --build
```

### Database Backup

```bash
docker-compose --profile backup run --rm db-backup
```

## Troubleshooting

### App not starting
```bash
# Check logs
docker-compose --profile prod logs app

# Common issues:
# - Missing environment variables
# - Database connection failed
# - Build errors
```

### Subdomain not working
1. Verify DNS records in Cloudflare
2. Check Traefik logs: `docker-compose --profile prod logs traefik`
3. Ensure DOMAIN variable is set correctly in `.env`

### Database connection issues
```bash
# Check if DB is running
docker-compose ps db

# Check DB logs
docker-compose logs db
```

## Development Mode

For local development, DON'T use the prod profile:

```bash
# Start database services only
docker-compose up -d

# Run Next.js locally
npm run dev
```
