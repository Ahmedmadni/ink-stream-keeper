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
  # Directly starting the loose executable does not grant package identity.
  # Run the test harness and its Electron child in the registered app context.
  $env:MEMOFLOW_MSIX_SMOKE_ROOT = (Get-Location).Path
  $qa = Join-Path $env:MEMOFLOW_MSIX_SMOKE_ROOT '.qa-results'
  New-Item $qa -ItemType Directory -Force | Out-Null
  $runner = Join-Path $qa 'msix-smoke-runner.cjs'
  $result = Join-Path $qa 'msix-smoke-exit.txt'
  $log = Join-Path $qa 'msix-smoke.log'
  Remove-Item $result -ErrorAction SilentlyContinue
  @'
const { spawnSync } = require("node:child_process");
const { openSync, closeSync, writeSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const root = process.env.MEMOFLOW_MSIX_SMOKE_ROOT;
const log = openSync(join(root, ".qa-results/msix-smoke.log"), "w");
let status = 1;
try {
  const run = spawnSync(process.execPath, [join(root, "tests/desktop-smoke.cjs")], {
    cwd: root,
    env: process.env,
    stdio: ["ignore", log, log],
    timeout: 300000,
  });
  if (run.error) writeSync(log, run.error.stack + "\n");
  status = Number.isInteger(run.status) ? run.status : 1;
} catch (error) {
  writeSync(log, error.stack + "\n");
} finally {
  closeSync(log);
  writeFileSync(join(root, ".qa-results/msix-smoke-exit.txt"), String(status));
}
process.exitCode = status;
'@ | Set-Content $runner -Encoding utf8
  Invoke-CommandInDesktopPackage -PackageFamilyName $package.PackageFamilyName `
    -AppId $identity.applicationId -Command (Get-Command node.exe).Source `
    -Args ('"{0}"' -f $runner) -PreventBreakaway
  $deadline = (Get-Date).AddMinutes(6)
  while (!(Test-Path $result) -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 1 }
  if (Test-Path $log) { Get-Content $log -Encoding utf8 }
  if (!(Test-Path $result)) { throw 'Registered MSIX application smoke test timed out' }
  if ((Get-Content $result -Raw).Trim() -ne '0') { throw 'Registered MSIX application smoke test failed' }
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
