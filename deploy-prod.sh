#!/usr/bin/env bash

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

cd "$(git rev-parse --show-toplevel)"

JENKINS_STAGING_POLL_INTERVAL_SECONDS=15
JENKINS_STAGING_MAX_ATTEMPTS=80

require_clean_worktree() {
  if [[ -n "$(git status --porcelain)" ]]; then
    echo -e "${RED}Working tree tidak clean. Commit atau stash dulu sebelum deploy prod.${NC}" >&2
    exit 1
  fi
}

read_staging_build_result() {
  local checkout_marker="$1"

  ssh radpro@radpro.id "CHECKOUT_MARKER='$checkout_marker' python3 - <<'PY'
import os, re
from pathlib import Path
checkout_marker = os.environ['CHECKOUT_MARKER']
base = Path('/var/lib/jenkins/jobs/netmanager-staging/builds')
matches = []
for log_path in base.glob('*/log'):
    try:
        if checkout_marker in log_path.read_text(errors='ignore'):
            matches.append(log_path)
    except OSError:
        continue
if not matches:
    print('PENDING', end='')
    raise SystemExit
build_dir = max(matches, key=lambda path: int(path.parent.name)).parent
build_xml = build_dir / 'build.xml'
try:
    text = build_xml.read_text(errors='ignore')
except OSError:
    print('PENDING', end='')
    raise SystemExit
match = re.search(r'<result>([^<]+)</result>', text)
print(match.group(1) if match else 'PENDING', end='')
PY"
}

wait_for_staging_success() {
  local promotion_sha="$1"
  local checkout_marker="Checking out Revision ${promotion_sha} (refs/remotes/origin/staging)"
  local build_result=""
  local build_state=""
  local attempt=1

  while [ "$attempt" -le "$JENKINS_STAGING_MAX_ATTEMPTS" ]; do
    echo "Menunggu Jenkins staging menyelesaikan commit ${promotion_sha}..."
    build_state="$(read_staging_build_result "$checkout_marker")"

    if [ "$build_state" = "SUCCESS" ]; then
      build_result="SUCCESS"
      echo "Jenkins staging sudah hijau untuk ${promotion_sha}."
      return 0
    fi

    if [ "$build_state" != "PENDING" ]; then
      echo -e "${RED}Jenkins staging selesai dengan status ${build_state} untuk ${promotion_sha}.${NC}" >&2
      exit 1
    fi

    sleep "$JENKINS_STAGING_POLL_INTERVAL_SECONDS"
    attempt=$((attempt + 1))
  done

  echo -e "${RED}Timeout menunggu Jenkins staging untuk ${promotion_sha}.${NC}" >&2
  exit 1
}

echo -e "${GREEN}Starting Production Deployment...${NC}"

require_clean_worktree

echo "Fetching latest remote refs..."
git fetch origin

echo "Syncing staging branch..."
git switch staging
git pull --ff-only origin staging

echo -e "${YELLOW}Pastikan pipeline staging untuk origin/staging sudah hijau sebelum promosi ke production.${NC}"

PROMOTION_SHA="$(git rev-parse origin/staging)"
echo "Promoting commit ${PROMOTION_SHA} from origin/staging to main..."
wait_for_staging_success "${PROMOTION_SHA}"

echo "Switching to main branch..."
git switch main
git pull --ff-only origin main

# Pakai --no-ff karena history main selalu divergen dari staging setelah
# promotion sebelumnya (tiap promotion bikin merge commit di main yang
# tidak ada di staging). --ff-only akan PASTI gagal di promotion ke-2+.
# --no-ff konsisten dengan pola commit "chore: merge staging to main..."
# yang sudah ada di history project.
git merge --no-ff origin/staging \
  -m "chore: merge staging to main for production deployment"

echo "Pushing to main branch..."
git push origin main

echo "Returning to staging branch..."
git switch staging

echo -e "${GREEN}Git promotion selesai.${NC}"
echo -e "${YELLOW}Deploy production resmi berjalan di Jenkins job branch main.${NC}"
echo -e "${YELLOW}Pantau hasil akhir deploy di Jenkins production sebelum menganggap production sehat.${NC}"
