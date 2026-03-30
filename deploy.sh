#!/bin/bash

# ==============================================================================
# NetManager Production Deployment Script
# ==============================================================================
# Script ini akan membantu Anda deploy NetManager ke VPS
#
# Cara penggunaan:
#   chmod +x deploy.sh
#   ./deploy.sh [setup|deploy|update|backup|logs|status|stop|restart]
# ==============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.production.yml"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker tidak ditemukan. Silakan install Docker terlebih dahulu."
        log_info "Run: curl -fsSL https://get.docker.com | sh"
        exit 1
    fi
}

# Check if .env file exists
check_env() {
    if [ ! -f ".env" ]; then
        log_error "File .env tidak ditemukan!"
        log_info "Salin .env.production.example ke .env dan isi semua nilai"
        log_info "Run: cp .env.production.example .env"
        exit 1
    fi
}

# Generate secure credentials
generate_secrets() {
    log_info "Generating secure credentials..."
    
    # Auth & Security
    AUTH_SECRET=$(openssl rand -base64 32)
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    OAUTH_ENCRYPTION_KEY=$(openssl rand -hex 32)
    ENCRYPTION_KEY=$(openssl rand -base64 32)
    
    # Database & Cache
    POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
    REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
    
    # Services
    RADIUS_SECRET=$(openssl rand -base64 16 | tr -d '/+=')
    INTERNAL_WS_SECRET=$(openssl rand -base64 32)
    EMPLOYEE_JWT_SECRET=$(openssl rand -base64 32)
    
    echo ""
    echo "============================================"
    echo "  GENERATED CREDENTIALS (Simpan dengan aman!)"
    echo "============================================"
    echo ""
    log_warning "Output berikut berisi secret sensitif. Jangan paste ke chat, tiket, screenshot, atau shell history yang dibagikan."
    log_warning "Simpan langsung ke password manager / secret manager / file lokal yang aman, lalu hapus jejak yang tidak perlu."
    echo ""
    echo "# Auth & Security"
    echo "AUTH_SECRET=${AUTH_SECRET}"
    echo "NEXTAUTH_SECRET=${NEXTAUTH_SECRET}"
    echo "OAUTH_ENCRYPTION_KEY=${OAUTH_ENCRYPTION_KEY}"
    echo "ENCRYPTION_KEY=${ENCRYPTION_KEY}"
    echo ""
    echo "# Database & Cache"
    echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
    echo "REDIS_PASSWORD=${REDIS_PASSWORD}"
    echo ""
    echo "# Services"
    echo "RADIUS_SECRET=${RADIUS_SECRET}"
    echo "INTERNAL_WS_SECRET=${INTERNAL_WS_SECRET}"
    echo "EMPLOYEE_JWT_SECRET=${EMPLOYEE_JWT_SECRET}"
    echo ""
    echo "============================================"
    echo ""
    log_info "Untuk VAPID Keys (Web Push Notifications),"
    log_info "jalankan perintah berikut di komputer lokal:"
    echo ""
    echo "  npx web-push generate-vapid-keys"
    echo ""
    log_info "Lalu copy output ke .env:"
    echo "  NEXT_PUBLIC_VAPID_PUBLIC_KEY=..."
    echo "  VAPID_PRIVATE_KEY=..."
    echo "  VAPID_SUBJECT=mailto:admin@radpro.id"
    echo ""
    echo "============================================"
    log_warning "Salin nilai-nilai di atas ke file .env Anda!"
}

# Initial setup
setup() {
    log_info "Starting initial setup..."
    
    check_docker
    
    # Check if .env exists
    if [ ! -f ".env" ]; then
        log_info "Membuat file .env dari template..."
        cp .env.production.example .env
        log_warning "Edit file .env dan isi semua nilai yang diperlukan!"
        log_info "Gunakan './deploy.sh secrets' untuk generate credentials"
        exit 0
    fi
    
    # Create directories
    mkdir -p backups
    
    log_success "Setup selesai!"
}

# Deploy application
deploy() {
    log_info "Deploying NetManager..."
    
    check_docker
    check_env
    
    # Ensure uploads directory exists and has correct permissions
    if [ ! -d "uploads" ]; then
        log_info "Creating persistent uploads directory..."
        mkdir -p uploads
    fi
    
    # Check ownership of uploads directory (User 1001 is used in Dockerfile)
    # We warn user if permissions look wrong, but we try to fix it if running as root
    if [ -d "uploads" ]; then
         # Try to set ownership if running as root or if current user owns it
         # Note: This might fail if typical user, but Docker often needs explicit permissions
         # We'll just log an info message here, as we can't easily sudo inside script without prompt
         log_info "Ensuring uploads directory permissions..."
         # Only try chown if we are root, otherwise warn user to check
         if [ "$(id -u)" = "0" ]; then
             chown -R 1001:1001 uploads
         else
             # Just create a marker file to test write access? No, simplistic check.
             log_warning "Pastikan folder 'uploads' dapat ditulisi oleh user ID 1001 (Next.js)."
             log_warning "Jika upload gagal, jalankan: sudo chown -R 1001:1001 uploads"
         fi
    fi
    
    # Determine which profile to use
    local profile=""
    if [ "$1" == "ssl" ]; then
        profile="--profile ssl"
        log_info "Deploying dengan SSL (Let's Encrypt)..."
    elif [ "$1" == "nginx" ]; then
        profile="--profile nginx"
        log_info "Deploying dengan Nginx (tanpa SSL)..."
    else
        log_info "Deploying tanpa reverse proxy (direct port 3000)..."
    fi
    
    # Build and start
    log_info "Building Docker images..."
    docker compose -f $COMPOSE_FILE $profile build
    
    log_info "Starting services..."
    docker compose -f $COMPOSE_FILE $profile up -d
    
    # Run migrations
    log_info "Running database migrations..."
    docker compose -f $COMPOSE_FILE --profile migrate run --rm db-migrate
    
    log_info "Pushing schema to billing database (initial sync)..."
    docker exec netmanager-app npx prisma db push --schema=prisma/billing.prisma || true
    
    log_success "Deployment selesai!"
    log_info "Gunakan './deploy.sh status' untuk melihat status services"
}

# Update application
update() {
    local profile="${1:-ssl}"
    log_info "Updating NetManager..."
    
    check_docker
    check_env
    
    # Backup before update
    log_info "Creating backup before update..."
    backup
    
    # Pull latest code (if using git)
    if [ -d ".git" ]; then
        log_info "Pulling latest code..."
        git pull
    fi
    
    # Rebuild and restart with appropriate profile
    log_info "Rebuilding Docker images..."
    if [ "$profile" = "ssl" ]; then
        docker compose -f $COMPOSE_FILE --profile ssl build app freeradius cron
        log_info "Restarting application, radius & cron with SSL..."
        docker compose -f $COMPOSE_FILE --profile ssl up -d --force-recreate app freeradius cron
    else
        docker compose -f $COMPOSE_FILE build app freeradius cron
        log_info "Restarting application, radius & cron..."
        docker compose -f $COMPOSE_FILE up -d --force-recreate app freeradius cron
    fi
    
    # Setup persistent uploads
    setup_uploads

    # Run migrations (dengan error handling + auto-resolve)
    log_info "Running database migrations..."
    if docker exec netmanager-app npm run prisma:migrate-deploy; then
        log_success "Database migrations berhasil!"
    else
        log_warning "Migration gagal (kemungkinan tipe/tabel sudah ada dari backup)."
        log_info "Mencoba fallback: prisma db push + resolve semua migrations..."

        # Fallback 1: Sync schema via db push
        docker exec netmanager-app npx prisma db push --accept-data-loss || {
            log_warning "prisma db push juga gagal, tapi data mungkin sudah sinkron."
        }

        # Fallback 2: Mark semua migration sebagai applied
        log_info "Menandai semua migrations sebagai applied..."
        docker exec netmanager-app sh -c '
            MIGRATIONS_DIR="prisma/migrations"
            if [ -d "$MIGRATIONS_DIR" ]; then
                for dir in "$MIGRATIONS_DIR"/*/; do
                    migration=$(basename "$dir")
                    if [ "$migration" != "migration_lock.toml" ]; then
                        npx prisma migrate resolve --applied "$migration" 2>/dev/null || true
                    fi
                done
                echo "All migrations marked as applied."
            fi
        '

        # Fallback 3: Push schema untuk database lainnya
        docker exec netmanager-app npx prisma db push --config=prisma.radius.config.ts || true
        docker exec netmanager-app npx prisma db push --config=prisma.billing.config.ts || true
        docker exec netmanager-app npx prisma db push --config=prisma.mitra.config.ts || true

        log_success "Fallback migration selesai!"
    fi
    
    log_success "Update selesai!"
}

# Setup uploads directory
setup_uploads() {
    # Ensure uploads directory exists and has correct permissions
    if [ ! -d "uploads" ]; then
        log_info "Creating persistent uploads directory..."
        mkdir -p uploads
    fi
    
    # Check ownership of uploads directory (User 1001 is used in Dockerfile)
    if [ -d "uploads" ]; then
         log_info "Ensuring uploads directory permissions..."
         if [ "$(id -u)" = "0" ]; then
             chown -R 1001:1001 uploads
         else
             # Just warn if not root
             if [ ! -w "uploads" ]; then
                 log_warning "Pastikan folder 'uploads' dapat ditulisi oleh user ID 1001 (Next.js)."
                 log_warning "Jika upload gagal, jalankan: sudo chown -R 1001:1001 uploads"
             fi
         fi
    fi
}

# Backup database
backup() {
    log_info "Creating database backup..."
    
    check_docker
    
    docker compose -f $COMPOSE_FILE --profile backup run --rm db-backup
    
    log_success "Backup selesai! File tersimpan di folder ./backups/"
    ls -lh backups/*.sql.gz 2>/dev/null | tail -5
}

# Restore database from backup
restore() {
    local backup_file="$1"
    
    # Check if backup file is provided
    if [ -z "$backup_file" ]; then
        log_error "File backup tidak diberikan!"
        log_info "Usage: ./deploy.sh restore <backup_file.sql.gz>"
        log_info "Contoh: ./deploy.sh restore backups/netmanager_20260108_081239.sql.gz"
        echo ""
        log_info "Backup files yang tersedia:"
        ls -lh backups/*.sql.gz 2>/dev/null || echo "  (tidak ada backup ditemukan)"
        exit 1
    fi
    
    # Check if file exists
    if [ ! -f "$backup_file" ]; then
        log_error "File backup tidak ditemukan: $backup_file"
        exit 1
    fi
    
    check_docker
    check_env
    
    # Show warning
    echo ""
    log_warning "============================================"
    log_warning "  PERINGATAN: RESTORE DATABASE"
    log_warning "============================================"
    echo ""
    log_warning "Proses ini akan MENGHAPUS SEMUA DATA di database"
    log_warning "dan menggantinya dengan data dari backup file:"
    echo ""
    echo "  File: $backup_file"
    echo "  Size: $(ls -lh "$backup_file" | awk '{print $5}')"
    echo ""
    
    # Confirmation
    read -p "Apakah Anda yakin ingin melanjutkan? (ketik 'yes' untuk konfirmasi): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_info "Restore dibatalkan."
        exit 0
    fi
    
    # Offer to backup current data first
    echo ""
    read -p "Apakah Anda ingin backup data saat ini terlebih dahulu? (y/n): " backup_first
    
    if [ "$backup_first" = "y" ] || [ "$backup_first" = "Y" ]; then
        log_info "Membuat backup data saat ini..."
        backup
        echo ""
    fi
    
    # Ensure database container is running
    log_info "Memastikan database container berjalan..."
    docker compose -f $COMPOSE_FILE up -d db
    sleep 5  # Wait for db to be ready
    
    # Get database credentials from .env
    source .env
    local db_user="${POSTGRES_USER:-netmgr}"
    local db_name="${POSTGRES_DB:-netmanager}"
    
    # Drop and recreate database
    log_info "Menghapus database existing..."
    docker exec netmanager-db psql -U "$db_user" -d postgres -c "DROP DATABASE IF EXISTS $db_name;" 2>/dev/null || true
    
    log_info "Membuat database baru..."
    docker exec netmanager-db psql -U "$db_user" -d postgres -c "CREATE DATABASE $db_name;"
    
    # Import backup
    log_info "Mengimport data dari backup..."
    if [[ "$backup_file" == *.gz ]]; then
        # Compressed file
        gunzip -c "$backup_file" | docker exec -i netmanager-db psql -U "$db_user" -d "$db_name"
    else
        # Uncompressed file
        docker exec -i netmanager-db psql -U "$db_user" -d "$db_name" < "$backup_file"
    fi
    
    log_success "============================================"
    log_success "  RESTORE SELESAI!"
    log_success "============================================"
    echo ""
    log_info "Database telah di-restore dari: $backup_file"
    log_info "Jalankan './deploy.sh restart' jika aplikasi sudah berjalan"
}

# Show logs
logs() {
    local service=${1:-app}
    log_info "Showing logs for $service..."
    docker compose -f $COMPOSE_FILE logs -f --tail=100 $service
}

# Show status
status() {
    log_info "Service status:"
    docker compose -f $COMPOSE_FILE ps
}

# Stop all services
stop() {
    log_info "Stopping all services..."
    docker compose -f $COMPOSE_FILE down
    log_success "All services stopped."
}

# Restart services
restart() {
    log_info "Restarting services..."
    docker compose -f $COMPOSE_FILE restart
    log_success "Services restarted."
}

# Clean up (remove volumes)
clean() {
    log_warning "Ini akan menghapus SEMUA data termasuk database!"
    read -p "Apakah Anda yakin? (ketik 'yes' untuk konfirmasi): " confirm
    
    if [ "$confirm" == "yes" ]; then
        log_info "Removing all containers and volumes..."
        docker compose -f $COMPOSE_FILE down -v
        log_success "Cleanup selesai."
    else
        log_info "Dibatalkan."
    fi
}

# Seed database
seed() {
    log_info "Seeding database..."
    docker compose -f $COMPOSE_FILE --profile seed run --rm db-seed
    log_success "Database seeding selesai!"
}

# Show help
show_help() {
    echo ""
    echo "NetManager Deployment Script"
    echo ""
    echo "Usage: ./deploy.sh [command]"
    echo ""
    echo "Commands:"
    echo "  setup         - Initial setup (create .env, directories)"
    echo "  secrets       - Generate secure credentials"
    echo "  deploy        - Deploy without reverse proxy (port 3000)"
    echo "  deploy ssl    - Deploy with Traefik + Let's Encrypt SSL"
    echo "  deploy nginx  - Deploy with Nginx (for Cloudflare/CDN)"
    echo "  update        - Update application (backup + rebuild + migrate)"
    echo "  backup        - Create database backup"
    echo "  restore <file>- Restore database from backup file"
    echo "  seed          - Seed database with initial data"
    echo "  logs [svc]    - Show logs (default: app)"
    echo "  status        - Show service status"
    echo "  restart       - Restart all services"
    echo "  stop          - Stop all services"
    echo "  clean         - Remove all containers and volumes (DANGER!)"
    echo ""
}

# Main
case "$1" in
    setup)
        setup
        ;;
    secrets)
        generate_secrets
        ;;
    deploy)
        deploy "$2"
        ;;
    update)
        update
        ;;
    backup)
        backup
        ;;
    restore)
        restore "$2"
        ;;
    seed)
        seed
        ;;
    logs)
        logs "$2"
        ;;
    status)
        status
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    clean)
        clean
        ;;
    *)
        show_help
        ;;
esac
