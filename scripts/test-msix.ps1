# Development registration is scoped to the disposable Windows CI runner.
# The submitted MSIX remains unsigned for Microsoft Store signing.
$ErrorActionPreference = 'Stop'
$identity = Get-Content electron/store-identity.json -Encoding utf8 | ConvertFrom-Json
$manifest = (Resolve-Path 'desktop-dist/msix-stage/AppxManifest.xml').Path
$policy = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock'
$previous = (Get-ItemProperty $policy -ErrorAction SilentlyContinue).AllowDevelopmentWithoutDevLicense
$registered = $false
try {
  if (Get-AppxPackage -Name $identity.name) { throw 'MSIX test identity is already installed' }
  if (!(Test-Path $policy)) { New-Item $policy -Force | Out-Null }
  Set-ItemProperty $policy AllowDevelopmentWithoutDevLicense 1 -Type DWord
  Add-AppxPackage -Register $manifest
  $registered = $true
  $package = Get-AppxPackage -Name $identity.name
  if (!$package -or $package.PackageFamilyName -ne $identity.packageFamilyName) {
    throw 'Registered MSIX identity does not match Partner Center'
  }
  # The earlier portable smoke test registered these two CI-only handlers.
  # Remove them so protocol activation exercises the MSIX manifest registration.
  foreach ($scheme in @('lovable', 'app.lovable.c357f296dbad4d33991e76d86c92e6d0')) {
    $key = "HKCU:\Software\Classes\$scheme"
    if (Test-Path $key) { Remove-Item $key -Recurse -Force }
  }
  $env:MEMOFLOW_ELECTRON_PATH = Join-Path $package.InstallLocation 'app/MemoFlow.exe'
  $env:MEMOFLOW_DESKTOP_PACKAGED = '1'
  $env:MEMOFLOW_MSIX_TEST = '1'
  node tests/desktop-smoke.cjs
  if ($LASTEXITCODE -ne 0) { throw 'Registered MSIX application smoke test failed' }
  Write-Host 'PASS: registered MSIX identity, real protocol activation and desktop feature flows.'
} finally {
  if ($registered) {
    Get-AppxPackage -Name $identity.name | Remove-AppxPackage
  }
  if ($null -eq $previous) {
    Remove-ItemProperty $policy AllowDevelopmentWithoutDevLicense -ErrorAction SilentlyContinue
  } else {
    Set-ItemProperty $policy AllowDevelopmentWithoutDevLicense $previous -Type DWord
  }
}
