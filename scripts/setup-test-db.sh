#!/bin/bash

# Script untuk setup test database
# Usage: ./scripts/setup-test-db.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up test database...${NC}"
echo ""

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
else
  echo -e "${RED}Error: .env file not found!${NC}"
  exit 1
fi

# Extract database info from DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}Error: DATABASE_URL not found in .env${NC}"
  exit 1
fi

# Parse DATABASE_URL
# Format: postgresql://user:password@host:port/database?schema=public
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Test database name
TEST_DB_NAME="${DB_NAME}_test"

echo "Database Configuration:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  User: $DB_USER"
echo "  Main DB: $DB_NAME"
echo "  Test DB: $TEST_DB_NAME"
echo ""

# Check if test database already exists
if PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $TEST_DB_NAME; then
  echo -e "${YELLOW}Test database '$TEST_DB_NAME' already exists.${NC}"
  read -p "Do you want to recreate it? (y/N): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Dropping existing test database..."
    PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS $TEST_DB_NAME;"
    echo -e "${GREEN}✓ Test database dropped${NC}"
  else
    echo "Skipping database creation."
  fi
fi

# Create test database if it doesn't exist
if ! PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $TEST_DB_NAME; then
  echo "Creating test database..."
  PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $TEST_DB_NAME;"
  echo -e "${GREEN}✓ Test database created${NC}"
else
  echo -e "${GREEN}✓ Test database already exists${NC}"
fi

# Update .env file with TEST_DATABASE_URL
TEST_DB_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${TEST_DB_NAME}?schema=public"

if grep -q "TEST_DATABASE_URL" .env; then
  # Update existing TEST_DATABASE_URL
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|TEST_DATABASE_URL=.*|TEST_DATABASE_URL=$TEST_DB_URL|" .env
  else
    # Linux
    sed -i "s|TEST_DATABASE_URL=.*|TEST_DATABASE_URL=$TEST_DB_URL|" .env
  fi
  echo -e "${GREEN}✓ Updated TEST_DATABASE_URL in .env${NC}"
else
  # Add TEST_DATABASE_URL
  echo "" >> .env
  echo "# Test Database" >> .env
  echo "TEST_DATABASE_URL=$TEST_DB_URL" >> .env
  echo -e "${GREEN}✓ Added TEST_DATABASE_URL to .env${NC}"
fi

echo ""
echo -e "${GREEN}Running migrations on test database...${NC}"
TEST_DATABASE_URL=$TEST_DB_URL npx prisma migrate deploy

echo ""
echo -e "${GREEN}✓ Test database setup complete!${NC}"
echo ""
echo "You can now run tests safely:"
echo "  npm test"
echo ""
echo "Tests will use: $TEST_DB_NAME"
echo "Development will use: $DB_NAME"

