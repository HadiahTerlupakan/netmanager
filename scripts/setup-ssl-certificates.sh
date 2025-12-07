#!/bin/bash

# SSL Certificate Setup Script for NetManager
#
# This script generates SSL certificates for PostgreSQL and other services
# to enable encrypted connections in production environments.
#
# Usage:
#   ./scripts/setup-ssl-certificates.sh [development|production]
#
# Environment variables:
#   CERT_ORG - Organization name (default: NetManager)
#   CERT_COUNTRY - Country code (default: US)
#   CERT_STATE - State/Province (default: California)
#   CERT_LOCALITY - City/Locality (default: San Francisco)

set -e  # Exit on error

# Default configuration
CERT_ORG=${CERT_ORG:-NetManager}
CERT_COUNTRY=${CERT_COUNTRY:-US}
CERT_STATE=${CERT_STATE:-California}
CERT_LOCALITY=${CERT_LOCALITY:-San Francisco}
CERT_DOMAIN=${CERT_DOMAIN:-localhost}
CERT_EMAIL=${CERT_EMAIL:-admin@netmanager.local}

# Certificate directories
SSL_DIR="./ssl"
POSTGRES_SSL_DIR="${SSL_DIR}/postgres"
NGINX_SSL_DIR="${SSL_DIR}/nginx"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
ENVIRONMENT=${1:-development}
VALID_DAYS=365

case $ENVIRONMENT in
  "development")
    VALID_DAYS=30
    echo -e "${BLUE}Setting up SSL certificates for DEVELOPMENT environment${NC}"
    ;;
  "production")
    VALID_DAYS=365
    echo -e "${BLUE}Setting up SSL certificates for PRODUCTION environment${NC}"
    ;;
  *)
    echo -e "${RED}Error: Invalid environment '$ENVIRONMENT'. Use 'development' or 'production'${NC}"
    exit 1
    ;;
esac

echo -e "${GREEN}SSL Certificate Configuration:${NC}"
echo "  Organization: $CERT_ORG"
echo "  Country: $CERT_COUNTRY"
echo "  State: $CERT_STATE"
echo "  Locality: $CERT_LOCALITY"
echo "  Domain: $CERT_DOMAIN"
echo "  Email: $CERT_EMAIL"
echo "  Valid days: $VALID_DAYS"
echo ""

# Create directories
echo -e "${YELLOW}Creating SSL directories...${NC}"
mkdir -p "$POSTGRES_SSL_DIR"
mkdir -p "$NGINX_SSL_DIR"
chmod 700 "$SSL_DIR"

# Generate PostgreSQL SSL certificates
echo -e "${YELLOW}Generating PostgreSQL SSL certificates...${NC}"

# 1. Generate Certificate Authority (CA)
if [ ! -f "${POSTGRES_SSL_DIR}/ca.key" ]; then
  openssl genrsa -out "${POSTGRES_SSL_DIR}/ca.key" 4096
  chmod 600 "${POSTGRES_SSL_DIR}/ca.key"

  openssl req -new -x509 -days $VALID_DAYS -key "${POSTGRES_SSL_DIR}/ca.key" -out "${POSTGRES_SSL_DIR}/ca.crt" \
    -subj "/C=$CERT_COUNTRY/ST=$CERT_STATE/L=$CERT_LOCALITY/O=$CERT_ORG/CN=NetManager-CA/emailAddress=$CERT_EMAIL"

  echo -e "${GREEN}✓ CA certificate generated${NC}"
else
  echo -e "${YELLOW}⚠ CA certificate already exists, skipping generation${NC}"
fi

# 2. Generate server private key
if [ ! -f "${POSTGRES_SSL_DIR}/server.key" ]; then
  openssl genrsa -out "${POSTGRES_SSL_DIR}/server.key" 2048
  chmod 600 "${POSTGRES_SSL_DIR}/server.key"
  echo -e "${GREEN}✓ Server private key generated${NC}"
else
  echo -e "${YELLOW}⚠ Server private key already exists, skipping generation${NC}"
fi

# 3. Generate server certificate signing request (CSR)
if [ ! -f "${POSTGRES_SSL_DIR}/server.csr" ]; then
  openssl req -new -key "${POSTGRES_SSL_DIR}/server.key" -out "${POSTGRES_SSL_DIR}/server.csr" \
    -subj "/C=$CERT_COUNTRY/ST=$CERT_STATE/L=$CERT_LOCALITY/O=$CERT_ORG/CN=$CERT_DOMAIN/emailAddress=$CERT_EMAIL"

  echo -e "${GREEN}✓ Server CSR generated${NC}"
else
  echo -e "${YELLOW}⚠ Server CSR already exists, skipping generation${NC}"
fi

# 4. Sign server certificate with CA
if [ ! -f "${POSTGRES_SSL_DIR}/server.crt" ]; then
  openssl x509 -req -days $VALID_DAYS -in "${POSTGRES_SSL_DIR}/server.csr" -CA "${POSTGRES_SSL_DIR}/ca.crt" \
    -CAkey "${POSTGRES_SSL_DIR}/ca.key" -CAcreateserial -out "${POSTGRES_SSL_DIR}/server.crt" \
    -extensions v3_req -extfile <(cat <<EOF
[v3_req]
subjectAltName = @alt_names
[alt_names]
DNS.1 = $CERT_DOMAIN
DNS.2 = localhost
DNS.3 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF
  )

  echo -e "${GREEN}✓ Server certificate signed${NC}"
else
  echo -e "${YELLOW}⚠ Server certificate already exists, skipping generation${NC}"
fi

# 5. Generate client certificate for application
if [ ! -f "${POSTGRES_SSL_DIR}/client.key" ]; then
  openssl genrsa -out "${POSTGRES_SSL_DIR}/client.key" 2048
  chmod 600 "${POSTGRES_SSL_DIR}/client.key"

  openssl req -new -key "${POSTGRES_SSL_DIR}/client.key" -out "${POSTGRES_SSL_DIR}/client.csr" \
    -subj "/C=$CERT_COUNTRY/ST=$CERT_STATE/L=$CERT_LOCALITY/O=$CERT_ORG/CN=netmanager-app/emailAddress=$CERT_EMAIL"

  openssl x509 -req -days $VALID_DAYS -in "${POSTGRES_SSL_DIR}/client.csr" -CA "${POSTGRES_SSL_DIR}/ca.crt" \
    -CAkey "${POSTGRES_SSL_DIR}/ca.key" -CAcreateserial -out "${POSTGRES_SSL_DIR}/client.crt"

  echo -e "${GREEN}✓ Client certificate generated${NC}"
else
  echo -e "${YELLOW}⚠ Client certificate already exists, skipping generation${NC}"
fi

# Generate certificates for Nginx (if using web server)
echo -e "${YELLOW}Generating Nginx SSL certificates...${NC}"

if [ ! -f "${NGINX_SSL_DIR}/netmanager.key" ]; then
  openssl genrsa -out "${NGINX_SSL_DIR}/netmanager.key" 2048
  chmod 600 "${NGINX_SSL_DIR}/netmanager.key"

  openssl req -new -key "${NGINX_SSL_DIR}/netmanager.key" -out "${NGINX_SSL_DIR}/netmanager.csr" \
    -subj "/C=$CERT_COUNTRY/ST=$CERT_STATE/L=$CERT_LOCALITY/O=$CERT_ORG/CN=$CERT_DOMAIN/emailAddress=$CERT_EMAIL"

  # For development, create self-signed certificate
  if [ "$ENVIRONMENT" = "development" ]; then
    openssl x509 -req -days $VALID_DAYS -in "${NGINX_SSL_DIR}/netmanager.csr" \
      -signkey "${NGINX_SSL_DIR}/netmanager.key" -out "${NGINX_SSL_DIR}/netmanager.crt" \
      -extensions v3_req -extfile <(cat <<EOF
[v3_req]
subjectAltName = @alt_names
[alt_names]
DNS.1 = $CERT_DOMAIN
DNS.2 = localhost
DNS.3 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF
    )
    echo -e "${GREEN}✓ Nginx self-signed certificate generated${NC}"
  else
    echo -e "${YELLOW}⚠ For production, use a certificate from a trusted CA (Let's Encrypt, etc.)${NC}"
    echo -e "${YELLOW}  CSR saved to ${NGINX_SSL_DIR}/netmanager.csr${NC}"
  fi
else
  echo -e "${YELLOW}⚠ Nginx certificate already exists, skipping generation${NC}"
fi

# Create PostgreSQL configuration file
echo -e "${YELLOW}Creating PostgreSQL SSL configuration...${NC}"

cat > "${POSTGRES_SSL_DIR}/postgresql.conf" <<EOF
# PostgreSQL SSL Configuration
ssl = on
ssl_ca_file = '/var/lib/postgresql/ca.crt'
ssl_cert_file = '/var/lib/postgresql/server.crt'
ssl_key_file = '/var/lib/postgresql/server.key'

# SSL settings for enhanced security
ssl_ciphers = 'HIGH:MEDIUM:+3DES:!aNULL:!SSLv2:!SSLv3'
ssl_prefer_server_ciphers = on
ssl_ecdh_curve = 'prime256v1'
ssl_min_protocol_version = 'TLSv1.2'
ssl_max_protocol_version = 'TLSv1.3'

# Require SSL for all connections
ssl_renegotiation_limit = 0
EOF

# Create client authentication configuration
cat > "${POSTGRES_SSL_DIR}/pg_hba.conf" <<EOF
# PostgreSQL Client Authentication Configuration
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# Require SSL for all connections
hostssl all             all             0.0.0.0/0               scram-sha-256
hostssl all             all             ::/0                    scram-sha-256

# Local connections
local   all             all                                     scram-sha-256

# Docker network (adjust subnet as needed)
hostssl all             all             172.20.0.0/16           scram-sha-256
EOF

echo -e "${GREEN}✓ PostgreSQL SSL configuration created${NC}"

# Set proper permissions
echo -e "${YELLOW}Setting secure permissions...${NC}"
find "$SSL_DIR" -type f -name "*.key" -exec chmod 600 {} \;
find "$SSL_DIR" -type f -name "*.csr" -exec chmod 600 {} \;
find "$SSL_DIR" -type f -name "*.crt" -exec chmod 644 {} \;
find "$SSL_DIR" -type f -name "*.srl" -exec chmod 600 {} \;

chmod 700 "$POSTGRES_SSL_DIR"
chmod 700 "$NGINX_SSL_DIR"

# Verify certificates
echo -e "${YELLOW}Verifying certificates...${NC}"

echo -e "${BLUE}PostgreSQL Server Certificate:${NC}"
openssl x509 -in "${POSTGRES_SSL_DIR}/server.crt" -text -noout | grep -E "(Subject:|Issuer:|Not Before:|Not After:|DNS:|IP Address:)"

echo -e "${BLUE}Nginx Certificate:${NC}"
if [ -f "${NGINX_SSL_DIR}/netmanager.crt" ]; then
  openssl x509 -in "${NGINX_SSL_DIR}/netmanager.crt" -text -noout | grep -E "(Subject:|Issuer:|Not Before:|Not After:|DNS:|IP Address:)"
fi

# Create certificate information file
cat > "${SSL_DIR}/certificate-info.txt" <<EOF
NetManager SSL Certificate Information
=====================================

Generated: $(date)
Environment: $ENVIRONMENT
Valid Until: $(date -d "+$VALID_DAYS days" +%Y-%m-%d)

Organization: $CERT_ORG
Country: $CERT_COUNTRY
State: $CERT_STATE
Locality: $CERT_LOCALITY
Domain: $CERT_DOMAIN
Email: $CERT_EMAIL

Certificate Files:
- PostgreSQL CA: ${POSTGRES_SSL_DIR}/ca.crt
- PostgreSQL Server Cert: ${POSTGRES_SSL_DIR}/server.crt
- PostgreSQL Server Key: ${POSTGRES_SSL_DIR}/server.key
- PostgreSQL Client Cert: ${POSTGRES_SSL_DIR}/client.crt
- PostgreSQL Client Key: ${POSTGRES_SSL_DIR}/client.key
- Nginx Cert: ${NGINX_SSL_DIR}/netmanager.crt
- Nginx Key: ${NGINX_SSL_DIR}/netmanager.key

Configuration Files:
- PostgreSQL Config: ${POSTGRES_SSL_DIR}/postgresql.conf
- PostgreSQL HBA: ${POSTGRES_SSL_DIR}/pg_hba.conf

Next Steps:
1. Update docker-compose.yml to mount the SSL certificates
2. Update DATABASE_URL to use sslmode=require
3. Restart PostgreSQL service
4. Test SSL connection

For Production:
1. Use certificates from a trusted CA for Nginx
2. Consider using a certificate management solution
3. Set up certificate rotation and renewal
4. Monitor certificate expiration
EOF

echo ""
echo -e "${GREEN}✅ SSL certificate setup completed successfully!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Update your docker-compose.yml to mount the SSL certificates:"
echo "   volumes:"
echo "     - ./ssl/postgres/server.crt:/var/lib/postgresql/server.crt:ro"
echo "     - ./ssl/postgres/server.key:/var/lib/postgresql/server.key:ro"
echo "     - ./ssl/postgres/ca.crt:/var/lib/postgresql/ca.crt:ro"
echo ""
echo "2. Update your DATABASE_URL to use sslmode=require"
echo "3. Restart your PostgreSQL service"
echo "4. Test the SSL connection"
echo ""
echo -e "${YELLOW}⚠ IMPORTANT: Store the certificate information securely and monitor expiration dates${NC}"