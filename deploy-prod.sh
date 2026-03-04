#!/bin/bash

# Script to merge staging to main and push to production
# Ensure we are in the root directory
# Set colors for output
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Production Deployment...${NC}"

# 1. Ensure staging is committed and pushed
echo "Checking staging status..."
git checkout staging
git add .
git commit -m "chore: Prepare for production deployment" || echo "Nothing to commit on staging"
git push origin staging

# 2. Checkout main
echo "Switching to main branch..."
git checkout main
git pull origin main

# 3. Merge staging to main
echo "Merging staging into main..."
git merge staging --no-edit

# 4. Push to main (Triggers Jenkins Production Pipeline)
echo "Pushing to main branch..."
git push origin main

# 5. Switch back to staging
echo "Returning to staging branch..."
git checkout staging

echo -e "${GREEN}Merge and Push to Main Successful! Check Jenkins for progress.${NC}"
