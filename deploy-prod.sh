#!/usr/bin/env bash

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

cd "$(git rev-parse --show-toplevel)"

require_clean_worktree() {
  if [[ -n "$(git status --porcelain)" ]]; then
    echo -e "${RED}Working tree tidak clean. Commit atau stash dulu sebelum deploy prod.${NC}" >&2
    exit 1
  fi
}

echo -e "${GREEN}Starting Production Deployment...${NC}"

require_clean_worktree

echo "Fetching latest remote refs..."
git fetch origin

echo "Syncing staging branch..."
git switch staging
git pull --ff-only origin staging

echo -e "${YELLOW}Pastikan pipeline staging untuk origin/staging sudah hijau sebelum promosi ke production.${NC}"

echo "Switching to main branch..."
git switch main
git pull --ff-only origin main

echo "Promoting origin/staging into main..."
git merge --ff-only origin/staging

echo "Pushing to main branch..."
git push origin main

echo "Returning to staging branch..."
git switch staging

echo -e "${GREEN}Promotion to main selesai. Check Jenkins production pipeline for progress.${NC}"
