param(
  [Parameter(Mandatory)]
  [ValidatePattern('^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$')]
  [string]$Version,
  [string]$SourcePath = (Split-Path $PSScriptRoot -Parent),
  [string]$OutputPath = (Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'paquetes')
)

$ErrorActionPreference = 'Stop'
$source = (Resolve-Path $SourcePath).Path
$output = New-Item -ItemType Directory -Force -Path $OutputPath
$temporary = Join-Path $env:TEMP "CostaGrande-package-$([guid]::NewGuid())"
$stage = Join-Path $temporary "CostaGrande-v$Version"

try {
  New-Item -ItemType Directory -Force -Path $stage | Out-Null
  & robocopy $source $stage /E /XD .git node_modules uploads /XF .env *.db *.db-shm *.db-wal | Out-Null
  if ($LASTEXITCODE -gt 7) { throw "Robocopy terminó con código $LASTEXITCODE." }
  Set-Content -Path (Join-Path $stage 'VERSION') -Value $Version -NoNewline -Encoding utf8
  $package = Join-Path $output.FullName "CostaGrande-v$Version.zip"
  if (Test-Path $package) { Remove-Item -LiteralPath $package -Force }
  Compress-Archive -Path $stage -DestinationPath $package -CompressionLevel Optimal
  Write-Host "Paquete creado: $package"
} finally {
  if (Test-Path $temporary) { Remove-Item -LiteralPath $temporary -Recurse -Force }
}
