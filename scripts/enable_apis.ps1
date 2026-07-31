$ErrorActionPreference = 'Continue'
$dir = $PSScriptRoot
$t = Get-Content (Join-Path $dir 'firebase_token.json') | ConvertFrom-Json

# OAuth client credentials are loaded from a git-ignored file
# (scripts/firebase_secrets.json) or environment variables - never hardcoded.
# schema: { "client_id": "...", "client_secret": "..." }
$clientId = $env:FIREBASE_OAUTH_CLIENT_ID
$clientSecret = $env:FIREBASE_OAUTH_CLIENT_SECRET
$secretsPath = Join-Path $dir 'firebase_secrets.json'
if (Test-Path $secretsPath) {
    $s = Get-Content $secretsPath | ConvertFrom-Json
    if (-not $clientId) { $clientId = $s.client_id }
    if (-not $clientSecret) { $clientSecret = $s.client_secret }
}
if (-not $clientId -or -not $clientSecret) {
    Write-Error "Missing OAuth credentials. Set FIREBASE_OAUTH_CLIENT_ID / FIREBASE_OAUTH_CLIENT_SECRET or create scripts/firebase_secrets.json"
    exit 1
}

$body = @{
    client_id     = $clientId
    client_secret = $clientSecret
    refresh_token = $t.refresh_token
    grant_type    = "refresh_token"
}
$r = Invoke-RestMethod -Uri "https://oauth2.googleapis.com/token" -Method Post -Body $body -ContentType "application/x-www-form-urlencoded" -TimeoutSec 30
$at = $r.access_token
$headers = @{ Authorization = "Bearer $at"; "Content-Type" = "application/json" }

foreach ($svc in @("firestore.googleapis.com", "cloudfunctions.googleapis.com", "firebasehosting.googleapis.com", "identitytoolkit.googleapis.com", "messaging.googleapis.com", "cloudbuild.googleapis.com", "run.googleapis.com", "eventarc.googleapis.com", "pubsub.googleapis.com", "cloudscheduler.googleapis.com")) {
    $url = "https://serviceusage.googleapis.com/v1/projects/career-os-hub/services/${svc}:enable"
    Write-Output "== $svc =="
    try {
        $resp = Invoke-WebRequest -Uri $url -Method Post -Headers $headers -Body "{}" -ContentType "application/json" -UseBasicParsing -TimeoutSec 60
        Write-Output ("  STATUS " + $resp.StatusCode + " " + $resp.Content)
    }
    catch {
        $code = $_.Exception.Response.StatusCode.value__
        Write-Output ("  EXCEPTION code=" + $code + " msg=" + $_.Exception.Message)
        try {
            $sr = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
            Write-Output ("  BODY " + $sr.ReadToEnd())
        } catch { Write-Output ("  NOSTREAM " + $_.Exception.Message) }
    }
}
