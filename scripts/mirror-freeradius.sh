#!/usr/bin/env bash
# Mirror freeradius/freeradius-server:3.2.5 to GHCR to avoid Docker Hub rate limits/timeouts
# Usage: ./scripts/mirror-freeradius.sh
# Requires: docker CLI with GHCR login (docker login ghcr.io)

set -euo pipefail

SOURCE="freeradius/freeradius-server:3.2.5"
TARGET="ghcr.io/hadiahterlupakan/freeradius-server:3.2.5"

echo "🔍 Checking if mirror already exists..."
if docker pull "$TARGET" >/dev/null 2>&1; then
  echo "✅ Mirror already exists: $TARGET"
  exit 0
fi

echo "⬇️  Pulling from Docker Hub: $SOURCE"
docker pull "$SOURCE"

echo "🏷️  Tagging for GHCR: $TARGET"
docker tag "$SOURCE" "$TARGET"

echo "⬆️  Pushing to GHCR: $TARGET"
docker push "$TARGET"

echo "✅ Done! Base image mirrored to GHCR successfully."
