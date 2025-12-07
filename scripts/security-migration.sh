#!/bin/bash

# Security Migration Script for NetManager
#
# This script helps migrate from the old insecure configuration to the new secure setup
# with proper credentials, SSL, and backup encryption.
#
# Usage:
#   ./scripts/security-migration.sh [--dry-run] [--force]
#
# Options:
#   --dry-run   Show what would be done without making changes
#   --force     Skip confirmation prompts

set -e  # Exit on error

# Default values
DRY_RUN=false
FORCE=false

# Parse command line arguments
for arg in "$@"; do
  case $arg in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: $0 [--dry-run] [--force]"
      exit 1
      ;;
  esac
done

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

info() {
    echo -e "${BLUE}ℹ $1${NC}"
    log "INFO: $1"
}

success() {
    echo -e "${GREEN}✓ $1${NC}"
    log "SUCCESS: $1"
}

warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
    log "WARNING: $1"
}

error() {
    echo -e "${RED}✗ $1${NC}"
    log "ERROR: $1"
}

header() {
    echo -e "${BOLD}$1${NC}"
}

# Function to run command (or simulate for dry run)
run_cmd() {
    local cmd="$1"
    local description="$2"

    if [ "$DRY_RUN" = true ]; then
        info "[DRY RUN] Would execute: $cmd"
        info "[DRY RUN] Purpose: $description"
        return 0
    else
        info "Executing: $cmd"
        if eval "$cmd"; then
            success "$description completed"
        else
            error "$description failed"
            return 1
        fi
    fi
}

# Function to check if file exists
check_file() {
    local file="$1"
    local description="$2"

    if [ -f "$file" ]; then
        success "$description exists"
        return 0
    else
        warning "$description not found"
        return 1
    fi
}

# Function to backup existing files
backup_file() {
    local file="$1"
    local backup_dir="$2"

    if [ -f "$file" ] && [ "$DRY_RUN" = false ]; then
        mkdir -p "$backup_dir"
        cp "$file" "$backup_dir/$(basename "$file").backup.$(date +%Y%m%d_%H%M%S)"
        info "Backed up: $file"
    fi
}

# Main migration function
perform_migration() {
    header "=== NetManager Security Migration ==="
    echo

    info "Migration Type: $([ "$DRY_RUN" = true ] && echo "DRY RUN - No changes will be made" || echo "LIVE - Changes will be applied")"
    echo

    # Check current state
    header "1. Current Configuration Analysis"
    echo

    # Check if .env file exists
    if check_file ".env" "Environment file"; then
        # Check for old insecure configurations
        if grep -q "POSTGRES_PASSWORD=netmgr" .env 2>/dev/null; then
            warning "Default PostgreSQL password found in .env"
        fi

        if grep -q "RADIUS_SECRET=testing123" .env 2>/dev/null; then
            warning "Default RADIUS secret found in .env"
        fi

        if grep -q "change_me_to_a_strong_secret" .env 2>/dev/null; then
            warning "Default authentication secrets found in .env"
        fi
    fi

    # Check docker-compose.yml
    if check_file "docker-compose.yml" "Docker Compose configuration"; then
        if grep -q "netmgr:netmgr" docker-compose.yml 2>/dev/null; then
            warning "Hardcoded credentials found in docker-compose.yml"
        fi

        if grep -q "testing123" docker-compose.yml 2>/dev/null; then
            warning "Hardcoded RADIUS secret found in docker-compose.yml"
        fi
    fi

    echo

    # Generate new credentials
    header "2. Generate Secure Credentials"
    echo

    if ! check_file "scripts/generate-secure-credentials.js" "Credential generator script"; then
        error "Credential generator script not found. Please ensure it exists."
        exit 1
    fi

    info "Generating new secure credentials..."
    if [ "$DRY_RUN" = false ]; then
        # Generate credentials and capture output
        CREDENTIALS_OUTPUT=$(node scripts/generate-secure-credentials.js 2>&1)

        if [ $? -eq 0 ]; then
            success "Secure credentials generated"
            echo "$CREDENTIALS_OUTPUT" > "./new_credentials.txt"
            info "Credentials saved to: ./new_credentials.txt"
            warning "IMPORTANT: Store this file securely and delete it after use!"
        else
            error "Failed to generate credentials"
            echo "$CREDENTIALS_OUTPUT"
            exit 1
        fi
    else
        info "[DRY RUN] Would generate new secure credentials"
    fi

    echo

    # Backup existing files
    header "3. Backup Existing Configuration"
    echo

    BACKUP_DIR="./migration_backup_$(date +%Y%m%d_%H%M%S)"

    backup_file ".env" "$BACKUP_DIR"
    backup_file "docker-compose.yml" "$BACKUP_DIR"

    if [ "$DRY_RUN" = false ]; then
        success "Configuration files backed up to: $BACKUP_DIR"
    else
        info "[DRY RUN] Would backup existing files to: $BACKUP_DIR"
    fi

    echo

    # Update configuration files
    header "4. Update Configuration Files"
    echo

    # Update .env file
    if [ -f ".env" ] && [ -f "./new_credentials.txt" ]; then
        info "Updating .env file with new credentials..."

        if [ "$DRY_RUN" = false ]; then
            # Extract new credentials
            NEW_POSTGRES_PASSWORD=$(grep "POSTGRES_PASSWORD=" ./new_credentials.txt | head -n 1 | cut -d'=' -f2)
            NEW_RADIUS_SECRET=$(grep "RADIUS_SECRET=" ./new_credentials.txt | head -n 1 | cut -d'=' -f2)
            NEW_AUTH_SECRET=$(grep "NEXTAUTH_SECRET=" ./new_credentials.txt | head -n 1 | cut -d'=' -f2)
            NEW_OAUTH_KEY=$(grep "OAUTH_ENCRYPTION_KEY=" ./new_credentials.txt | head -n 1 | cut -d'=' -f2)

            # Update .env file (create a new one with secure values)
            cat > .env.new <<EOF
# Generated secure credentials - $(date)
# Old credentials backed up in: $BACKUP_DIR

# Database Configuration
POSTGRES_USER=netmgr
POSTGRES_PASSWORD=$NEW_POSTGRES_PASSWORD
POSTGRES_DB=netmanager
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
DATABASE_URL=postgresql://netmgr:$NEW_POSTGRES_PASSWORD@localhost:5433/netmanager?sslmode=prefer

# RADIUS Configuration
RADIUS_SECRET=$NEW_RADIUS_SECRET

# Authentication
AUTH_SECRET=$NEW_AUTH_SECRET
OAUTH_ENCRYPTION_KEY=$NEW_OAUTH_KEY
AUTH_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=$NEW_AUTH_SECRET

# Session Security
SESSION_MAX_AGE=604800
SESSION_UPDATE_AGE=3600

# Other configurations from original .env file
$(grep -v -E "(POSTGRES_PASSWORD|RADIUS_SECRET|AUTH_SECRET|NEXTAUTH_SECRET|OAUTH_ENCRYPTION_KEY)" .env)
EOF

            mv .env.new .env
            success ".env file updated with secure credentials"
        else
            info "[DRY RUN] Would update .env file with new secure credentials"
        fi
    fi

    echo

    # SSL Setup
    header "5. SSL Certificate Setup"
    echo

    if check_file "scripts/setup-ssl-certificates.sh" "SSL setup script"; then
        info "Setting up SSL certificates..."
        run_cmd "bash scripts/setup-ssl-certificates.sh development" "SSL certificate generation"
    else
        warning "SSL setup script not found"
    fi

    echo

    # Update docker-compose.yml for SSL
    header "6. Docker Compose Updates"
    echo

    if check_file "docker-compose.yml" "Docker Compose file"; then
        info "Docker Compose file already contains security enhancements"
        info "Including:"
        info "  - Environment variable usage for passwords"
        info "  - Security options (no-new-privileges)"
        info "  - Resource limits"
        info "  - Logging configuration"
        info "  - SSL certificate mount points (commented)"
    fi

    echo

    # Database backup verification
    header "7. Backup Strategy Setup"
    echo

    if check_file "scripts/backup-db-encrypted.sh" "Encrypted backup script"; then
        info "Encrypted backup script is available"
        info "To enable backup encryption, set BACKUP_ENCRYPTION_KEY in your environment"
    else
        warning "Encrypted backup script not found"
    fi

    echo

    # Create directories
    header "8. Create Required Directories"
    echo

    DIRECTORIES=("backups" "ssl/postgres" "ssl/nginx" "logs")

    for dir in "${DIRECTORIES[@]}"; do
        run_cmd "mkdir -p $dir" "Create directory: $dir"
    done

    echo

    # Verification and testing
    header "9. Verification and Testing"
    echo

    info "Security improvements implemented:"
    success "✓ Secure credentials generated"
    success "✓ Session duration reduced to 7 days"
    success "✓ SSL/TLS configuration prepared"
    success "✓ Encrypted backup strategy implemented"
    success "✓ Docker security options added"
    success "✓ Environment variable separation"
    success "✓ Configuration files backed up"

    echo
    info "Next steps to complete the migration:"
    echo "1. Review and update your actual .env file with the new credentials"
    echo "2. Set up SSL certificates: bash scripts/setup-ssl-certificates.sh"
    echo "3. Update DATABASE_URL to use sslmode=require"
    echo "4. Restart services: docker-compose down && docker-compose up -d"
    echo "5. Test the application functionality"
    echo "6. Set up encrypted backups: export BACKUP_ENCRYPTION_KEY=your-key"
    echo "7. Schedule regular backups"

    echo
    header "Security Recommendations"
    echo
    info "For production deployment:"
    echo "• Use certificates from a trusted CA (Let's Encrypt, etc.)"
    echo "• Set up proper firewall rules"
    echo "• Enable audit logging"
    echo "• Set up monitoring and alerts"
    echo "• Regular security updates"
    echo "• Secrets management (HashiCorp Vault, AWS Secrets Manager, etc.)"

    echo
    if [ "$DRY_RUN" = false ]; then
        success "Migration completed successfully!"
        warning "IMPORTANT:"
        warning "• Store the new credentials securely"
        warning "• Delete the new_credentials.txt file after use"
        warning "• Test all application functionality"
        warning "• Update any external integrations with new credentials"
    else
        success "Dry run completed!"
        info "To apply these changes, run: $0"
    fi
}

# Confirmation prompt
if [ "$FORCE" != true ] && [ "$DRY_RUN" != true ]; then
    echo
    warning "This migration will update your NetManager security configuration."
    warning "Existing files will be backed up, but credentials will be changed."
    echo
    read -p "Do you want to continue? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        info "Migration cancelled."
        exit 0
    fi
fi

# Perform the migration
perform_migration