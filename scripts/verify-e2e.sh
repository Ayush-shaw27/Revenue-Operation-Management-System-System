#!/bin/bash
# scripts/verify-e2e.sh — Verify end-to-end functionality
# Run from repository root. Assumes backend on 8000.

set -e

# --- Configuration ---
API_BASE="http://127.0.0.1:8000"
ADMIN_EMAIL="admin@revops.pro"
ADMIN_PASS="adminpass"
MANAGER_EMAIL="manager@revops.pro"
MANAGER_PASS="managerpass"
REP_EMAIL="rep@revops.pro"
REP_PASS="reppass"

# --- Helpers ---
login() {
    local email=$1
    local password=$2
    curl -s -X POST "${API_BASE}/api/auth/login" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=${email}&password=${password}" \
        | jq -r '.access_token'
}

verify_endpoint() {
    local token=$1
    local path=$2
    local expected_status=$3
    echo -n "Verifying ${path} (expecting ${expected_status})... "
    
    status=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer ${token}" \
        "${API_BASE}${path}")
        
    if [ "$status" != "$expected_status" ]; then
        echo "FAIL (Got ${status})"
        exit 1
    fi
    echo "OK"
}

# --- Checks ---
echo "--- Starting E2E verification ---"

# Health check
status=$(curl -s -o /dev/null -w "%{http_code}" "${API_BASE}/health")
if [ "$status" != "200" ]; then
    echo "Health check failed!"
    exit 1
fi
echo "Health check OK"

# Login
ADMIN_TOKEN=$(login $ADMIN_EMAIL $ADMIN_PASS)
REP_TOKEN=$(login $REP_EMAIL $REP_PASS)

# Admin endpoints (Admin)
verify_endpoint "$ADMIN_TOKEN" "/api/users" "200"
verify_endpoint "$ADMIN_TOKEN" "/api/admin/stats" "200"

# Rep endpoints (Rep)
verify_endpoint "$REP_TOKEN" "/api/deals" "200"

# Access control (Rep should not access Admin)
verify_endpoint "$REP_TOKEN" "/api/users" "403"
verify_endpoint "$REP_TOKEN" "/api/admin/stats" "403"

echo "--- E2E verification passed ---"
