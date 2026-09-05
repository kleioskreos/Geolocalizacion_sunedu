$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot '.env'
if (Test-Path -LiteralPath $envFile) {
    $configLines = Get-Content -LiteralPath $envFile
    foreach ($line in $configLines) {
        if ($line -match '^\s*\w*PORT\s*=\s*(80|4001|5173|5432)\s*$') {
            throw 'La configuración usa un puerto reservado por el otro proyecto. Use los puertos del mapa: 8090, 8091, 5544, 5190 o 5191.'
        }
    }
    Write-Host 'El archivo .env ya existe; se conserva su configuración.'
    exit 0
}
function New-LocalSecret {
    $bytes = New-Object byte[] 24
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    return -join ($bytes | ForEach-Object { $_.ToString('x2') })
}
$dbSecret = New-LocalSecret
$adminSecret = New-LocalSecret
@"
WEB_PORT=8090
FRONTEND_URL=https://mapa.vmbperu.com
BACKEND_URL=https://mapabackend.vmbperu.com
FRONTEND_DOMAIN=mapa.vmbperu.com
BACKEND_DOMAIN=mapabackend.vmbperu.com
STACK_NAME=mapa-prod
POSTGRES_PASSWORD=$dbSecret
ADMIN_USER=admin
ADMIN_PASSWORD=$adminSecret
"@ | Set-Content -LiteralPath $envFile -Encoding ascii
Write-Host 'Configuración generada en .env. Consulte allí las credenciales de importación.'
