#!/bin/bash

# ==============================================================================
# NetManager Quick Deploy Script
# ==============================================================================
# Script untuk deploy NetManager dari komputer lokal ke server VPS
#
# Cara penggunaan:
#   ./quick-deploy.sh deploy@SERVER_IP           # Full deploy (pertama kali)
#   ./quick-deploy.sh deploy@SERVER_IP update    # Update saja (tanpa rebuild full)
# ==============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
REMOTE_DIR="/opt/netmanager"
SSH_OPTIONS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

# Functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

show_help() {
    echo ""
    echo -e "${CYAN}NetManager Quick Deploy Script${NC}"
    echo ""
    echo "Usage: ./quick-deploy.sh [user@server] [command]"
    echo ""
    echo "Commands:"
    echo "  (kosong)    - Full deploy (sync + build + migrate)"
    echo "  update      - Quick update (sync + restart)"
    echo "  sync        - Hanya sync file saja"
    echo "  logs        - Lihat logs aplikasi"
    echo "  status      - Lihat status services"
    echo "  restart     - Restart semua services"
    echo ""
    echo "Contoh:"
    echo "  ./quick-deploy.sh deploy@192.168.1.100"
    echo "  ./quick-deploy.sh deploy@192.168.1.100 update"
    echo "  ./quick-deploy.sh root@radpro.id logs"
    echo ""
}

# Check arguments
if [ -z "$1" ]; then
    show_help
    exit 1
fi

if [ "$1" == "-h" ] || [ "$1" == "--help" ]; then
    show_help
    exit 0
fi

SERVER=$1
COMMAND=${2:-deploy}

log_info "Target server: ${CYAN}$SERVER${NC}"
log_info "Command: ${CYAN}$COMMAND${NC}"
echo ""

# Files to sync
SYNC_FILES=(
    "app"
    "components"
    "config"
    "docs"
    "hooks"
    "lib"
    "modules"
    "prisma"
    "public"
    "scripts"
    "types"
    "worker"
    "deploy.sh"
    "docker-compose.production.yml"
    "docker-compose.yml"
    "Dockerfile"
    "next.config.ts"
    "nginx.conf"
    "nginx-custom.conf"
    "package.json"
    "package-lock.json"
    "proxy.ts"
    "server.ts"
    "tailwind.config.ts"
    "tsconfig.json"
    "postcss.config.js"
    ".dockerignore"
    ".eslintrc.json"
    ".eslintignore"
)

# Sync files to server
sync_files() {
    log_info "Syncing files to server..."
    
    # Create exclude file
    EXCLUDE_FILE=$(mktemp)
    cat > "$EXCLUDE_FILE" << EOF
node_modules
.next
.git
*.log
.DS_Store
.env
backups
EOF
    
    # Build rsync command
    RSYNC_OPTS="-avz --progress --delete --exclude-from=$EXCLUDE_FILE"
    
    # Sync each file/directory
    for item in "${SYNC_FILES[@]}"; do
        if [ -e "$item" ]; then
            log_info "  Syncing: $item"
            rsync $RSYNC_OPTS -e "ssh $SSH_OPTIONS" "$item" "$SERVER:$REMOTE_DIR/" 2>/dev/null || true
        fi
    done
    
    # Cleanup
    rm -f "$EXCLUDE_FILE"
    
    log_success "Files synced!"
}

# Deploy to server
full_deploy() {
    log_info "Starting full deployment..."
    
    # Sync files
    sync_files
    
    # Deploy on server
    log_info "Building and deploying on server..."
    ssh $SSH_OPTIONS "$SERVER" << EOF
        cd $REMOTE_DIR
        
        # Check if .env exists
        if [ ! -f ".env" ]; then
            echo "[WARNING] File .env tidak ditemukan!"
            echo "Salin .env.production.example ke .env dan isi konfigurasi"
            exit 1
        fi
        
        # Make deploy.sh executable
        chmod +x deploy.sh
        
        # Run deployment
        ./deploy.sh deploy ssl
EOF
    
    log_success "Deployment complete!"
}

# Quick update (tanpa rebuild penuh)
quick_update() {
    log_info "Starting quick update..."
    
    # Sync files
    sync_files
    
    # Update on server
    log_info "Updating on server..."
    ssh $SSH_OPTIONS "$SERVER" << EOF
        cd $REMOTE_DIR
        chmod +x deploy.sh
        ./deploy.sh update
EOF
    
    log_success "Update complete!"
}

# Just sync files
just_sync() {
    sync_files
}

# Show logs
show_logs() {
    log_info "Connecting to server for logs..."
    ssh $SSH_OPTIONS -t "$SERVER" "cd $REMOTE_DIR && ./deploy.sh logs app"
}

# Show status
show_status() {
    ssh $SSH_OPTIONS "$SERVER" "cd $REMOTE_DIR && ./deploy.sh status"
}

# Restart services
restart_services() {
    ssh $SSH_OPTIONS "$SERVER" "cd $REMOTE_DIR && ./deploy.sh restart"
    log_success "Services restarted!"
}

# Main
case "$COMMAND" in
    deploy)
        full_deploy
        ;;
    update)
        quick_update
        ;;
    sync)
        just_sync
        ;;
    logs)
        show_logs
        ;;
    status)
        show_status
        ;;
    restart)
        restart_services
        ;;
    *)
        log_error "Unknown command: $COMMAND"
        show_help
        exit 1
        ;;
esac

echo ""
log_success "Done! 🚀"
