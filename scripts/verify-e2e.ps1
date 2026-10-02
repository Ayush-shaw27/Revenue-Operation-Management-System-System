# scripts/verify-e2e.ps1 — Verify end-to-end functionality
# Run from repository root. Assumes backend on 8000.

$API_BASE = "http://127.0.0.1:8000"
$ADMIN_EMAIL = "admin@revops.pro"
$ADMIN_PASS = "adminpass"
$REP_EMAIL = "rep@revops.pro"
$REP_PASS = "reppass"

function Login($email, $password) {
    $body = @{
        username = $email
        password = $password
    }
    $resp = Invoke-RestMethod -Method Post -Uri "$API_BASE/api/auth/login" -ContentType "application/x-www-form-urlencoded" -Body $body
    return $resp.access_token
}

function Verify-Endpoint($token, $path, $expectedStatus) {
    Write-Host -NoNewline "Verifying $path (expecting $expectedStatus)... "
    try {
        $headers = @{ Authorization = "Bearer $token" }
        Invoke-RestMethod -Method Get -Uri "$API_BASE$path" -Headers $headers -ErrorAction Stop | Out-Null
        $status = 200
    }
    catch {
        $status = $_.Exception.Response.StatusCode.value__
    }

    if ($status -eq $expectedStatus) {
        Write-Host "OK"
    }
    else {
        Write-Host "FAIL (Got $status)"
        exit 1
    }
}

# --- Checks ---
Write-Host "--- Starting E2E verification ---"

# Health
try {
    Invoke-RestMethod -Method Get -Uri "$API_BASE/health" | Out-Null
} catch {
    Write-Host "Health check failed!"
    exit 1
}
Write-Host "Health check OK"

# Login
$adminToken = Login $ADMIN_EMAIL $ADMIN_PASS
$repToken = Login $REP_EMAIL $REP_PASS

# Admin endpoints (Admin)
Verify-Endpoint $adminToken "/api/users" 200
Verify-Endpoint $adminToken "/api/admin/stats" 200

# Rep endpoints (Rep)
Verify-Endpoint $repToken "/api/deals" 200

# Access control
Verify-Endpoint $repToken "/api/users" 403
Verify-Endpoint $repToken "/api/admin/stats" 403

Write-Host "--- E2E verification passed ---"
