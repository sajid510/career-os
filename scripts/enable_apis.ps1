$ErrorActionPreference = 'Continue'
$dir = "C:\Users\hp\AppData\Local\Temp\opencode\career-os-hub\scripts"
$t = Get-Content "$dir\firebase_token.json" | ConvertFrom-Json
$body = @{
    client_id     = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com"
    client_secret = "j9iVZfS8kkCEFUPaAeJV0sAi"
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
