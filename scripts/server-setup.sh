#!/bin/bash

# ==============================================================================
# NetManager VPS Server Setup Script
# ==============================================================================
# Script ini akan menginstall semua dependencies yang dibutuhkan untuk
# menjalankan NetManager di Ubuntu 22.04 VPS
#
# Cara penggunaan:
#   wget -O server-setup.sh https://raw.githubusercontent.com/YOUR_REPO/main/server-setup.sh
#   chmod +x server-setup.sh
#   sudo ./server-setup.sh
# ==============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="radpro.id"
APP_DIR="/opt/netmanager"
DEPLOY_USER="deploy"

# Functions
log_header() {
    echo -e "\n${CYAN}============================================${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}============================================${NC}\n"
}

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

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Script ini harus dijalankan sebagai root!"
        log_info "Gunakan: sudo ./server-setup.sh"
        exit 1
    fi
}

# Update system
update_system() {
    log_header "Updating System"
    apt-get update -y
    apt-get upgrade -y
    apt-get install -y curl wget git nano htop unzip
    log_success "System updated!"
}

# Install Docker
install_docker() {
    log_header "Installing Docker"
    
    if command -v docker &> /dev/null; then
        log_warning "Docker sudah terinstall, skip..."
        docker --version
    else
        log_info "Installing Docker..."
        curl -fsSL https://get.docker.com | sh
        
        # Enable and start Docker
        systemctl enable docker
        systemctl start docker
        
        log_success "Docker installed!"
    fi
    
    # Install Docker Compose Plugin (jika belum ada)
    if ! docker compose version &> /dev/null; then
        log_info "Installing Docker Compose plugin..."
        apt-get install -y docker-compose-plugin
    fi
    
    docker compose version
    log_success "Docker Compose ready!"
}

# Setup Firewall
setup_firewall() {
    log_header "Configuring Firewall (UFW)"
    
    # Install UFW if not present
    apt-get install -y ufw
    
    # Default policies
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow SSH (penting! jangan sampai terkunci)
    ufw allow ssh
    ufw allow 22/tcp
    
    # Allow HTTP dan HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Allow RADIUS ports (UDP)
    ufw allow 1812/udp
    ufw allow 1813/udp
    
    # Enable firewall
    echo "y" | ufw enable
    
    ufw status verbose
    log_success "Firewall configured!"
}

# Setup Swap Memory
setup_swap() {
    log_header "Configuring Swap Memory"
    
    # Check existing swap
    if swapon --show | grep -q "/swapfile"; then
        log_warning "Swap sudah ada, skip..."
        free -h
        return
    fi
    
    # Determine swap size (2GB for VPS with < 4GB RAM, 4GB otherwise)
    TOTAL_RAM=$(free -g | awk '/^Mem:/{print $2}')
    if [ "$TOTAL_RAM" -lt 4 ]; then
        SWAP_SIZE="2G"
    else
        SWAP_SIZE="4G"
    fi
    
    log_info "Creating ${SWAP_SIZE} swap file..."
    
    # Create swap
    fallocate -l $SWAP_SIZE /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    
    # Make swap permanent
    if ! grep -q "/swapfile" /etc/fstab; then
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
    fi
    
    # Optimize swap settings
    sysctl vm.swappiness=10
    sysctl vm.vfs_cache_pressure=50
    
    if ! grep -q "vm.swappiness" /etc/sysctl.conf; then
        echo "vm.swappiness=10" >> /etc/sysctl.conf
        echo "vm.vfs_cache_pressure=50" >> /etc/sysctl.conf
    fi
    
    free -h
    log_success "Swap configured!"
}

# Create deploy user
create_deploy_user() {
    log_header "Creating Deploy User"
    
    if id "$DEPLOY_USER" &>/dev/null; then
        log_warning "User '$DEPLOY_USER' sudah ada, skip..."
    else
        log_info "Creating user '$DEPLOY_USER'..."
        useradd -m -s /bin/bash $DEPLOY_USER
        usermod -aG docker $DEPLOY_USER
        usermod -aG sudo $DEPLOY_USER
        
        # Allow deploy user to run docker without sudo
        log_success "User '$DEPLOY_USER' created and added to docker group!"
    fi
}

# Create app directory
create_app_directory() {
    log_header "Creating Application Directory"
    
    if [ -d "$APP_DIR" ]; then
        log_warning "Directory $APP_DIR sudah ada!"
    else
        mkdir -p $APP_DIR
        log_success "Created $APP_DIR"
    fi
    
    # Set ownership
    chown -R $DEPLOY_USER:$DEPLOY_USER $APP_DIR
    chmod 755 $APP_DIR
    
    log_success "Directory ready: $APP_DIR"
}

# Configure DNS reminder
dns_reminder() {
    log_header "DNS Configuration Reminder"
    
    # Get server IP
    SERVER_IP=$(curl -s ifconfig.me || curl -s ipinfo.io/ip || echo "YOUR_SERVER_IP")
    
    echo -e "${YELLOW}=================================================${NC}"
    echo -e "${YELLOW}  PENTING: Konfigurasi DNS di Domain Provider${NC}"
    echo -e "${YELLOW}=================================================${NC}"
    echo ""
    echo "Tambahkan record DNS berikut untuk domain ${CYAN}$DOMAIN${NC}:"
    echo ""
    echo "  ${GREEN}Type${NC}    ${GREEN}Name${NC}           ${GREEN}Value${NC}              ${GREEN}Keterangan${NC}"
    echo "  ────    ────           ─────              ──────────"
    echo "  A       @              $SERVER_IP    Domain utama"
    echo "  A       www            $SERVER_IP    WWW redirect"
    echo "  A       admin          $SERVER_IP    Portal Admin"
    echo "  A       karyawan       $SERVER_IP    Portal Karyawan"
    echo ""
    echo -e "${YELLOW}Atau gunakan CNAME jika menggunakan Cloudflare:${NC}"
    echo ""
    echo "  ${GREEN}Type${NC}    ${GREEN}Name${NC}           ${GREEN}Value${NC}"
    echo "  ────    ────           ─────"
    echo "  A       @              $SERVER_IP"
    echo "  CNAME   www            $DOMAIN"
    echo "  CNAME   admin          $DOMAIN"
    echo "  CNAME   karyawan       $DOMAIN"
    echo ""
}

# Print next steps
print_next_steps() {
    log_header "Setup Complete!"
    
    echo ""
    echo -e "${GREEN}Server siap untuk deployment NetManager!${NC}"
    echo ""
    echo "Langkah selanjutnya:"
    echo ""
    echo "  1. ${CYAN}Konfigurasi DNS${NC} (lihat petunjuk di atas)"
    echo ""
    echo "  2. ${CYAN}Transfer aplikasi dari komputer lokal:${NC}"
    echo "     ./quick-deploy.sh deploy@$(curl -s ifconfig.me 2>/dev/null || echo 'SERVER_IP')"
    echo ""
    echo "  3. ${CYAN}Atau clone dari git (jika menggunakan git):${NC}"
    echo "     su - $DEPLOY_USER"
    echo "     cd $APP_DIR"
    echo "     git clone YOUR_REPO_URL ."
    echo "     cp .env.production.example .env"
    echo "     nano .env  # Edit konfigurasi"
    echo "     ./deploy.sh secrets  # Generate credentials"
    echo "     ./deploy.sh deploy ssl  # Deploy dengan SSL"
    echo ""
    echo -e "${YELLOW}Server IP: $(curl -s ifconfig.me 2>/dev/null || echo 'Unknown')${NC}"
    echo ""
}

# Main
main() {
    log_header "NetManager VPS Setup for Ubuntu 22.04"
    
    check_root
    update_system
    install_docker
    setup_firewall
    setup_swap
    create_deploy_user
    create_app_directory
    dns_reminder
    print_next_steps
}

main "$@"
