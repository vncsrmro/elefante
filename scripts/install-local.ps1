param([Parameter(Mandatory=$true)][string]$Candidate, [Parameter(Mandatory=$true)][string]$InstallDirectory)
$ErrorActionPreference = 'Stop'
$targetDirectory = (Resolve-Path -LiteralPath $InstallDirectory).Path
$candidatePath = (Resolve-Path -LiteralPath $Candidate).Path
$exe = Join-Path $targetDirectory 'Elefante.exe'
if (!(Test-Path -LiteralPath $exe)) { throw 'Elefante.exe not found in installation directory.' }
if (Get-Process Elefante -ErrorAction SilentlyContinue) { throw 'Close Elefante, including its tray icon, before installing. No files were changed.' }
$target = Join-Path $targetDirectory 'resources/app.asar'
$backup = "$target.backup-$(Get-Date -Format yyyyMMdd-HHmmss)"
Copy-Item -LiteralPath $target -Destination $backup
Copy-Item -LiteralPath $candidatePath -Destination $target
if ((Get-FileHash -LiteralPath $candidatePath).Hash -ne (Get-FileHash -LiteralPath $target).Hash) {
  Copy-Item -LiteralPath $backup -Destination $target -Force
  throw 'Verification failed; previous package restored.'
}
Write-Output "Installed and verified. Backup: $backup"
