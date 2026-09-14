param(
  [Parameter(Mandatory)]
  [string]$PackagePath,
  [string]$RootPath = 'C:\CostaGrande',
  [string]$ServiceName = 'CostaGrandeApp',
  [string]$NodePath = 'C:\Program Files\nodejs\node.exe'
)

$ErrorActionPreference = 'Stop'
$package = (Resolve-Path $PackagePath).Path
$root = (New-Item -ItemType Directory -Force -Path $RootPath).FullName
$releases = New-Item -ItemType Directory -Force -Path (Join-Path $root 'releases')
$backups = New-Item -ItemType Directory -Force -Path (Join-Path $root 'backups')
$data = New-Item -ItemType Directory -Force -Path (Join-Path $root 'data')
$config = New-Item -ItemType Directory -Force -Path (Join-Path $root 'config')
$environmentFile = Join-Path $config 'costa-grande.env'
$current = Join-Path $root 'current'
$temporary = Join-Path $root "temporary-update-$([guid]::NewGuid())"
$previousTarget = $null
$switched = $false

if (!(Test-Path $NodePath)) { throw "No se encontró Node.js en: $NodePath" }
if (!(Test-Path $environmentFile)) { throw "No se encontró la configuración de producción: $environmentFile" }

try {
  Expand-Archive -Path $package -DestinationPath $temporary -Force
  $releaseSource = @(Get-ChildItem -Path $temporary -Directory)
  if ($releaseSource.Count -ne 1) { throw 'El paquete debe contener una única carpeta de versión.' }
  $releaseSource = $releaseSource[0]
  $versionFile = Join-Path $releaseSource.FullName 'VERSION'
  if (!(Test-Path $versionFile)) { throw 'El paquete no contiene el archivo VERSION.' }
  $version = (Get-Content $versionFile -Raw).Trim()
  if ($version -notmatch '^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$') { throw "La versión '$version' no es válida." }
  if (!(Test-Path (Join-Path $releaseSource.FullName 'backend\server.js'))) { throw 'El paquete no contiene la aplicación esperada.' }
  $destination = Join-Path $releases.FullName "v$version"
  if (Test-Path $destination) { throw "La versión v$version ya existe en el servidor." }

  $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if ($service -and $service.Status -ne 'Stopped') { Stop-Service -Name $ServiceName -Force }

  $stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
  $backupItems = @((Join-Path $data.FullName 'mvp_catalogo.db'), (Join-Path $data.FullName 'analitica.db'), (Join-Path $data.FullName 'uploads'), $environmentFile) | Where-Object { Test-Path $_ }
  if ($backupItems.Count -gt 0) { Compress-Archive -Path $backupItems -DestinationPath (Join-Path $backups.FullName "costa-grande_$stamp.zip") -CompressionLevel Optimal }

  Move-Item -LiteralPath $releaseSource.FullName -Destination $destination
  & $NodePath "--env-file=$environmentFile" (Join-Path $destination 'base_de_datos\ejecutar_migraciones.js')
  if ($LASTEXITCODE -ne 0) { throw 'No se pudieron ejecutar las migraciones de base de datos.' }

  if (Test-Path $current) {
    $previousTarget = (Get-Item -LiteralPath $current).Target
    Remove-Item -LiteralPath $current -Force
  }
  New-Item -ItemType Junction -Path $current -Target $destination | Out-Null
  $switched = $true
  if (!$service) { Write-Warning "La versión v$version fue preparada, pero el servicio $ServiceName aún no existe. Créalo y ejecútalo antes de publicar."; return }
  Start-Service -Name $ServiceName

  $healthy = $false
  foreach ($attempt in 1..10) {
    Start-Sleep -Seconds 2
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3000/api/products' -TimeoutSec 5
      if ($response.StatusCode -eq 200) { $healthy = $true; break }
    } catch { }
  }
  if (!$healthy) { throw 'La validación local de la nueva versión no respondió correctamente.' }
  Write-Host "Actualización completada: v$version"
} catch {
  if ($switched -and $previousTarget) {
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    if (Test-Path $current) { Remove-Item -LiteralPath $current -Force }
    New-Item -ItemType Junction -Path $current -Target $previousTarget | Out-Null
    Start-Service -Name $ServiceName -ErrorAction SilentlyContinue
  }
  throw
} finally {
  if (Test-Path $temporary) { Remove-Item -LiteralPath $temporary -Recurse -Force }
}
