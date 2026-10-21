param([string]$PackagePath = 'desktop-dist/MemoFlow-win32-x64')
$ErrorActionPreference = 'Stop'
$package = (Resolve-Path $PackagePath).Path
$thumbprint = $env:MEMOFLOW_WINDOWS_CERTIFICATE_SHA1
$signTool = $null
if ($thumbprint) {
  if ($thumbprint -notmatch '^[a-fA-F0-9]{40}$') { throw 'Invalid signing certificate thumbprint' }
  $certificate = Get-Item "Cert:\CurrentUser\My\$thumbprint"
  if (!$certificate.HasPrivateKey -or $certificate.NotAfter -lt (Get-Date) -or
      $certificate.Subject -eq $certificate.Issuer) {
    throw 'A current trusted code-signing certificate with its private key is required'
  }
  $sdk = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits/10/bin'
  $signTool = Get-ChildItem "$sdk/*/x64/signtool.exe" | Sort-Object FullName -Descending | Select-Object -First 1
  if (!$signTool) { throw 'Windows SDK SignTool is required' }
}
$results = @(Get-ChildItem $package -Recurse -File | Where-Object {
  $_.Extension -in '.exe', '.dll', '.node'
} | ForEach-Object {
  $file = $_
  $signature = Get-AuthenticodeSignature -LiteralPath $file.FullName
  if ($thumbprint -and ($file.Name -eq 'MemoFlow.exe' -or $signature.Status -eq 'NotSigned')) {
    & $signTool.FullName sign /sha1 $thumbprint /fd SHA256 /tr 'https://timestamp.digicert.com' /td SHA256 /d MemoFlow /du 'https://ahmedelmadni.com' $file.FullName
    if ($LASTEXITCODE -ne 0) { throw "Signing failed: $($file.Name)" }
    & $signTool.FullName verify /pa /all $file.FullName
    if ($LASTEXITCODE -ne 0) { throw "Signature verification failed: $($file.Name)" }
    $signature = Get-AuthenticodeSignature -LiteralPath $file.FullName
    if ($signature.Status -ne 'Valid' -or !$signature.TimeStamperCertificate) {
      throw "A trusted, timestamped signature is required: $($file.Name)"
    }
  }
  if ($signature.Status -eq 'HashMismatch') { throw "Damaged signature: $($file.Name)" }
  [ordered]@{
    file = [IO.Path]::GetRelativePath($package, $file.FullName).Replace('\', '/')
    sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    status = $signature.Status.ToString()
    signer = if ($signature.SignerCertificate) { $signature.SignerCertificate.Subject } else { $null }
    timestamped = [bool]$signature.TimeStamperCertificate
  }
})
$app = $results | Where-Object { $_.file -eq 'MemoFlow.exe' }
if (!$app) { throw 'MemoFlow.exe is missing' }
if ($thumbprint -and @($results | Where-Object { $_.status -ne 'Valid' }).Count) {
  throw 'The signed distribution contains a binary without a valid signature'
}
[ordered]@{
  application = 'MemoFlow'
  version = (Get-Content electron/package.json -Encoding utf8 | ConvertFrom-Json).version
  publisherSignature = $app.status
  smartScreenWarningMayAppear = $true
  binaries = $results
} | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $package 'WINDOWS-SIGNATURE.json') -Encoding utf8
Write-Host "MemoFlow Authenticode status: $($app.status)"
if (!$thumbprint) { Write-Host 'No publisher certificate configured. SmartScreen warnings remain possible.' }
