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
    
    AUTH_SECRET=$(openssl rand -base64 32)
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
    REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
    RADIUS_SECRET=$(openssl rand -base64 16 | tr -d '/+=')
    OAUTH_ENCRYPTION_KEY=$(openssl rand -hex 32)
    
    echo ""
    echo "============================================"
    echo "  GENERATED CREDENTIALS (Simpan dengan aman!)"
    echo "============================================"
    echo ""
    echo "AUTH_SECRET=${AUTH_SECRET}"
    echo "NEXTAUTH_SECRET=${NEXTAUTH_SECRET}"
    echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
    echo "REDIS_PASSWORD=${REDIS_PASSWORD}"
    echo "RADIUS_SECRET=${RADIUS_SECRET}"
    echo "OAUTH_ENCRYPTION_KEY=${OAUTH_ENCRYPTION_KEY}"
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
    
    log_success "Deployment selesai!"
    log_info "Gunakan './deploy.sh status' untuk melihat status services"
}

# Update application
update() {
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
    
    # Rebuild and restart
    log_info "Rebuilding Docker images..."
    docker compose -f $COMPOSE_FILE build app
    
    log_info "Restarting application..."
    docker compose -f $COMPOSE_FILE up -d app
    
    # Run migrations
    log_info "Running database migrations..."
    docker compose -f $COMPOSE_FILE --profile migrate run --rm db-migrate
    
    log_success "Update selesai!"
}

# Backup database
backup() {
    log_info "Creating database backup..."
    
    check_docker
    
    docker compose -f $COMPOSE_FILE --profile backup run --rm db-backup
    
    log_success "Backup selesai! File tersimpan di folder ./backups/"
    ls -lh backups/*.sql.gz 2>/dev/null | tail -5
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
