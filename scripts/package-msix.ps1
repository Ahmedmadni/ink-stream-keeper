$ErrorActionPreference = 'Stop'
$identity = Get-Content electron/store-identity.json -Encoding utf8 | ConvertFrom-Json
$version = (Get-Content electron/package.json -Encoding utf8 | ConvertFrom-Json).version
$stage = Join-Path (Get-Location) 'desktop-dist/msix-stage'
$output = Join-Path (Get-Location) 'desktop-dist/store'
if (Test-Path $stage) { throw 'Use a fresh MSIX staging directory' }
New-Item $stage, $output, "$stage/Assets" -ItemType Directory -Force | Out-Null
Copy-Item desktop-dist/MemoFlow-win32-x64 "$stage/app" -Recurse
node scripts/msix-manifest.mjs "$stage/AppxManifest.xml"
if ($LASTEXITCODE -ne 0) { throw 'MSIX manifest generation failed' }

Add-Type -AssemblyName System.Drawing
$source = [Drawing.Image]::FromFile((Resolve-Path 'electron/app.png'))
try {
  foreach ($asset in @(@('StoreLogo', 50), @('Square44x44Logo', 44), @('Square150x150Logo', 150))) {
    $size = [int]$asset[1]
    $bitmap = [Drawing.Bitmap]::new($size, $size)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.Clear([Drawing.Color]::Transparent)
      $graphics.DrawImage($source, 0, 0, $size, $size)
      $bitmap.Save((Join-Path $stage "Assets/$($asset[0]).png"), [Drawing.Imaging.ImageFormat]::Png)
    } finally { $graphics.Dispose(); $bitmap.Dispose() }
  }
} finally { $source.Dispose() }

$sdk = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits/10/bin'
$makeAppx = Get-ChildItem "$sdk/*/x64/makeappx.exe" | Sort-Object FullName -Descending | Select-Object -First 1
if (!$makeAppx) { throw 'Windows SDK MakeAppx is required' }
$package = Join-Path $output "MemoFlow-Store-$version-x64.msix"
& $makeAppx.FullName pack /d $stage /p $package /o /v
if ($LASTEXITCODE -ne 0) { throw 'MakeAppx validation or packaging failed' }
& $makeAppx.FullName unpack /p $package /d (Join-Path $output 'verified') /o
if ($LASTEXITCODE -ne 0) { throw 'MSIX unpack verification failed' }
[xml]$manifest = Get-Content (Join-Path $output 'verified/AppxManifest.xml') -Encoding utf8
if ($manifest.Package.Identity.Name -ne $identity.name -or
    $manifest.Package.Identity.Publisher -ne $identity.publisher -or
    $manifest.Package.Properties.PublisherDisplayName -ne $identity.publisherDisplayName -or
    $manifest.Package.Identity.Version -ne "$version.0") { throw 'MSIX identity mismatch' }
$packagedAsar = Join-Path $output 'verified/app/resources/app.asar'
$sourceAsar = Join-Path $stage 'app/resources/app.asar'
if ((Get-FileHash $packagedAsar).Hash -ne (Get-FileHash $sourceAsar).Hash) { throw 'MSIX UI content mismatch' }
$digest = (Get-FileHash $package -Algorithm SHA256).Hash.ToLowerInvariant()
"$digest  $([IO.Path]::GetFileName($package))" | Set-Content "$package.sha256" -Encoding ascii
Copy-Item "$stage/AppxManifest.xml" $output
Copy-Item electron/store-identity.json $output
Write-Host "Validated unsigned Store submission package: $([IO.Path]::GetFileName($package))"
