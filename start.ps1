# Start Gang Pack locally
Write-Host "Building client..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\client"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed" -ForegroundColor Red; exit 1 }

Write-Host "Starting server on 0.0.0.0:3000..." -ForegroundColor Green
Set-Location "$PSScriptRoot\server"
node index.js
