#!/usr/bin/env bash
# =============================================================================
# FEAST — Backend Migration Script
# =============================================================================
# Moves your existing NestJS/Prisma backend source into the apps/api scaffold
# created by feast-setup.sh. Run this in Replit AFTER:
#   1. feast-setup.sh has been run at least once (apps/api exists)
#   2. You've exported your real backend from your dev environment into a
#      single folder or .zip and uploaded it into the Replit workspace
#
# Usage (from repo root in the Replit shell):
#   ./feast-migrate-backend.sh /path/to/exported-backend
#   ./feast-migrate-backend.sh /path/to/exported-backend.zip
#
# What it does:
#   - Backs up the current apps/api to apps/api.scaffold-backup/ (timestamped)
#   - Copies your src/, prisma/, and any package.json / tsconfig overrides in
#   - Leaves .env alone (never overwrites secrets)
#   - Re-runs pnpm install + prisma generate for apps/api only
#
# Safe to re-run. Does NOT touch apps/restaurant, apps/admin, apps/customer,
# or apps/courier.
# =============================================================================

set -euo pipefail

SOURCE="${1:-}"

if [ -z "$SOURCE" ]; then
  echo "Usage: ./feast-migrate-backend.sh /path/to/exported-backend[.zip]"
  exit 1
fi

if [ ! -d "apps/api" ]; then
  echo "apps/api not found. Run feast-setup.sh first."
  exit 1
fi

# -----------------------------------------------------------------------------
# 1. Unzip if needed
# -----------------------------------------------------------------------------
WORKDIR="$SOURCE"
CLEANUP_TMP=""

if [[ "$SOURCE" == *.zip ]]; then
  if [ ! -f "$SOURCE" ]; then
    echo "Zip file not found: $SOURCE"
    exit 1
  fi
  TMP_EXTRACT="$(mktemp -d)"
  echo "Extracting $SOURCE to $TMP_EXTRACT ..."
  unzip -q "$SOURCE" -d "$TMP_EXTRACT"
  WORKDIR="$TMP_EXTRACT"
  CLEANUP_TMP="$TMP_EXTRACT"
elif [ ! -d "$SOURCE" ]; then
  echo "Source directory not found: $SOURCE"
  exit 1
fi

# If the zip/folder has a single nested top-level dir, descend into it
ENTRY_COUNT=$(find "$WORKDIR" -mindepth 1 -maxdepth 1 | wc -l)
if [ "$ENTRY_COUNT" -eq 1 ] && [ -d "$(find "$WORKDIR" -mindepth 1 -maxdepth 1)" ]; then
  WORKDIR="$(find "$WORKDIR" -mindepth 1 -maxdepth 1)"
fi

echo "Using source: $WORKDIR"

# -----------------------------------------------------------------------------
# 2. Back up current scaffold
# -----------------------------------------------------------------------------
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="apps/api.scaffold-backup-${TIMESTAMP}"
echo "Backing up current apps/api to ${BACKUP_DIR} ..."
cp -r apps/api "$BACKUP_DIR"

# -----------------------------------------------------------------------------
# 3. Preserve secrets, then copy source in
# -----------------------------------------------------------------------------
PRESERVED_ENV=""
if [ -f "apps/api/.env" ]; then
  PRESERVED_ENV=$(mktemp)
  cp apps/api/.env "$PRESERVED_ENV"
  echo "Preserved existing apps/api/.env"
fi

echo "Copying src/ ..."
if [ -d "$WORKDIR/src" ]; then
  rm -rf apps/api/src
  cp -r "$WORKDIR/src" apps/api/src
else
  echo "  WARNING: no src/ found in source, skipping."
fi

echo "Copying prisma/ ..."
if [ -d "$WORKDIR/prisma" ]; then
  rm -rf apps/api/prisma
  cp -r "$WORKDIR/prisma" apps/api/prisma
else
  echo "  WARNING: no prisma/ found in source, skipping."
fi

# Copy config files if present, without clobbering things silently
for f in package.json tsconfig.json nest-cli.json .env.example; do
  if [ -f "$WORKDIR/$f" ]; then
    cp "$WORKDIR/$f" "apps/api/$f"
    echo "Copied $f"
  fi
done

# Restore preserved .env
if [ -n "$PRESERVED_ENV" ]; then
  cp "$PRESERVED_ENV" apps/api/.env
  rm "$PRESERVED_ENV"
  echo "Restored apps/api/.env (not overwritten by migration)"
fi

# -----------------------------------------------------------------------------
# 4. Reinstall + regenerate Prisma client for apps/api only
# -----------------------------------------------------------------------------
echo "Reinstalling dependencies for apps/api ..."
pnpm install

if [ -f "apps/api/prisma/schema.prisma" ]; then
  echo "Running prisma generate ..."
  pnpm --filter @feast/api prisma:generate || echo "  prisma:generate failed — check DATABASE_URL / schema.prisma manually."
fi

# -----------------------------------------------------------------------------
# 5. Cleanup
# -----------------------------------------------------------------------------
if [ -n "$CLEANUP_TMP" ]; then
  rm -rf "$CLEANUP_TMP"
fi

echo "=============================================="
echo " Backend migration complete."
echo ""
echo " apps/api now contains your real backend source."
echo " Previous scaffold backed up at: ${BACKUP_DIR}"
echo ""
echo " Next steps:"
echo "   1. Confirm apps/api/.env has correct DATABASE_URL / JWT_SECRET"
echo "   2. pnpm --filter @feast/api prisma:migrate   (if schema changed)"
echo "   3. pnpm dev:api   and curl a known route to verify"
echo "   4. Once confirmed working, you can delete the backup:"
echo "        rm -rf ${BACKUP_DIR}"
echo "=============================================="
