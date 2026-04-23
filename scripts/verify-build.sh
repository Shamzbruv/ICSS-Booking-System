#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/verify-build.sh
#
# Local pre-launch build verification.
# Run this before any deployment to confirm the app builds cleanly
# from a fresh state on the current machine.
#
# Usage:
#   chmod +x scripts/verify-build.sh
#   ./scripts/verify-build.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e   # Exit immediately on any error

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✅ PASS${NC}: $1"; }
fail() { echo -e "${RED}❌ FAIL${NC}: $1"; exit 1; }
info() { echo -e "${YELLOW}──${NC} $1"; }

echo ""
echo "═══════════════════════════════════════════════"
echo "  ICSS Booking System — Build Verification"
echo "═══════════════════════════════════════════════"
echo ""

# ── 1. Check Node version ────────────────────────────────────────────────────
info "Checking Node.js version..."
NODE_VER=$(node --version 2>/dev/null || echo "not found")
if [[ "$NODE_VER" == "not found" ]]; then
    fail "Node.js is not installed or not in PATH"
fi
MAJOR=$(echo "$NODE_VER" | cut -d. -f1 | tr -d 'v')
if [ "$MAJOR" -lt 18 ]; then
    fail "Node.js >= 18 required (found $NODE_VER)"
fi
pass "Node.js $NODE_VER"

# ── 2. Check required env vars ───────────────────────────────────────────────
info "Checking required environment variables..."
MISSING=()
for VAR in DATABASE_URL JWT_SECRET RESEND_API_KEY PUBLIC_APP_URL; do
    [ -z "${!VAR}" ] && MISSING+=("$VAR")
done
if [ ${#MISSING[@]} -gt 0 ]; then
    fail "Missing required env vars: ${MISSING[*]}"
fi
pass "All required env vars present"

# ── 3. Backend install ───────────────────────────────────────────────────────
info "Installing backend dependencies (npm ci)..."
npm ci --silent
pass "Backend dependencies installed"

# ── 4. Frontend clean install ────────────────────────────────────────────────
info "Installing frontend dependencies from scratch..."
cd frontend
rm -rf node_modules
npm install --silent
pass "Frontend dependencies installed"

# ── 5. Frontend build ────────────────────────────────────────────────────────
info "Building frontend..."
npm run build
if [ -f "dist/index.html" ]; then
    pass "Frontend build succeeded (dist/index.html present)"
else
    fail "Frontend build completed but dist/index.html not found"
fi
cd ..

# ── 6. No committed secrets check ────────────────────────────────────────────
info "Checking for committed .env files..."
if git ls-files | grep -q "^\.env$\|^frontend\/\.env$"; then
    fail ".env files are committed to git — remove them immediately"
fi
pass "No .env files committed"

# ── 7. No committed node_modules ─────────────────────────────────────────────
info "Checking for committed node_modules..."
if git ls-files | grep -q "node_modules"; then
    fail "node_modules are committed — remove from git tracking"
fi
pass "No node_modules committed"

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════"
echo -e "  ${GREEN}ALL CHECKS PASSED — safe to deploy${NC}"
echo "═══════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Push to GitHub"
echo "  2. Railway / Render will run: npm ci && npm start"
echo "  3. Verify public booking at https://your-app.com/book/your-slug"
echo "  4. Run smoke tests per DEPLOYMENT.md"
echo ""
