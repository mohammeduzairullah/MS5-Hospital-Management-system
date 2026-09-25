param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$setupMutex = $null
$ownsMutex = $false
try {
    if (-not [Environment]::Is64BitOperatingSystem) { throw 'Careflow requires 64-bit Windows 10 or newer.' }
    $localRoot = Join-Path $projectRoot '.local'
    $runtimeRoot = Join-Path $localRoot 'runtime'
    $privateNode = Join-Path $runtimeRoot 'node.exe'
    $nodePath = $null
    foreach ($candidate in @($privateNode, (Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source))) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) {
            $version = & $candidate -p 'process.versions.node' 2>$null
            if ($LASTEXITCODE -eq 0 -and $version -match '^24\.' -and (Test-Path -LiteralPath (Join-Path (Split-Path -Parent $candidate) 'node_modules/npm/bin/npm-cli.js'))) { $nodePath = $candidate; break }
        }
    }
    if ($CheckOnly) {
        Write-Host ('Compatible Node.js found: ' + [bool]$nodePath)
        Write-Host ('Dependency lockfile found: ' + (Test-Path -LiteralPath 'package-lock.json'))
        Write-Host 'Check complete. Nothing installed or started.'
        exit 0
    }
    $hashProvider = [Security.Cryptography.SHA256]::Create()
    $projectHash = [BitConverter]::ToString($hashProvider.ComputeHash([Text.Encoding]::UTF8.GetBytes($projectRoot.ToLowerInvariant()))).Replace('-', '')
    $hashProvider.Dispose()
    $setupMutex = New-Object Threading.Mutex($false, "Local\Careflow-$projectHash")
    try { $ownsMutex = $setupMutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $ownsMutex = $true }
    if (-not $ownsMutex) { throw 'Careflow is already starting or running from this folder. Use its existing window.' }
    foreach ($port in @(4000, 5173)) {
        $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Parse('127.0.0.1'), $port)
        try { $listener.Start() } catch { throw "Port $port is already in use. If Careflow is open, use http://127.0.0.1:5173. Otherwise close the conflicting application and try again." } finally { $listener.Stop() }
    }
    New-Item -ItemType Directory -Force -Path $localRoot | Out-Null
    if (-not $nodePath) {
        Write-Host 'Installing a private Node.js runtime for Careflow (no administrator rights needed)...'
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $releaseUrl = 'https://nodejs.org/dist/latest-v24.x'
        $checksums = (Invoke-WebRequest -UseBasicParsing -Uri "$releaseUrl/SHASUMS256.txt").Content
        $match = [regex]::Match($checksums, '(?m)^([a-f0-9]{64})\s+(node-v24\.\d+\.\d+-win-x64\.zip)\s*$')
        if (-not $match.Success) { throw 'Could not identify the official Node.js Windows download. Please try again later.' }
        $archiveName = $match.Groups[2].Value
        $stage = Join-Path $localRoot ('setup-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $stage | Out-Null
        $archivePath = Join-Path $stage $archiveName
        Invoke-WebRequest -UseBasicParsing -Uri "$releaseUrl/$archiveName" -OutFile $archivePath
        if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash -ne $match.Groups[1].Value) { throw 'Node.js download verification failed. Nothing from this download was run. Try again.' }
        Expand-Archive -LiteralPath $archivePath -DestinationPath $stage
        $extracted = Join-Path $stage ($archiveName -replace '\.zip$', '')
        New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
        Copy-Item -Path (Join-Path $extracted '*') -Destination $runtimeRoot -Recurse -Force
        $nodePath = $privateNode
        & $nodePath --version
        if ($LASTEXITCODE -ne 0) { throw 'The private Node.js runtime could not start on this computer.' }
    }
    $env:PATH = (Split-Path -Parent $nodePath) + ';' + $env:PATH
    $npmCli = Join-Path (Split-Path -Parent $nodePath) 'node_modules/npm/bin/npm-cli.js'
    if (-not (Test-Path -LiteralPath $npmCli)) { throw 'Node.js is missing npm. Repair your Node.js installation or use the official Node.js 24 Windows package.' }
    $stampPath = Join-Path $localRoot 'dependencies-stamp'
    $lockHash = (Get-FileHash -LiteralPath 'package-lock.json' -Algorithm SHA256).Hash
    $runtimeIdentity = & $nodePath -p 'process.platform + "/" + process.arch + "/" + process.versions.modules'
    $signature = "$lockHash|$runtimeIdentity"
    $oldSignature = if (Test-Path -LiteralPath $stampPath) { (Get-Content -LiteralPath $stampPath -Raw).Trim() } else { '' }
    & $nodePath -e 'try { for (const p of ["vite", "express", "mongoose", "react", "mongodb-memory-server"]) require.resolve(p); require("esbuild").transformSync("const ready = true"); } catch { process.exit(1); }'
    $dependenciesPresent = $LASTEXITCODE -eq 0
    if ($signature -ne $oldSignature -or -not $dependenciesPresent) {
        Write-Host 'Installing project packages. This can take a few minutes on the first run...'
        $env:MONGOMS_DISABLE_POSTINSTALL = '1'
        & $nodePath $npmCli ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'Package installation failed. Check your internet connection and reopen Start-Careflow.cmd to retry.' }
        Set-Content -LiteralPath $stampPath -Value $signature
    }
    $env:NODE_ENV = 'development'
    Write-Host ''
    Write-Host 'Open http://127.0.0.1:5173 once the servers are ready.'
    Write-Host 'MongoDB is downloaded automatically if needed. Keep this window open.'
    Write-Host 'Your existing records and passwords are preserved.'
    & $nodePath 'scripts/dev.js'
    if ($LASTEXITCODE -ne 0) { throw 'Careflow stopped with an error. See the message above.' }
} catch {
    Write-Host ''
    Write-Host ('Setup could not finish: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
} finally {
    if ($ownsMutex) { $setupMutex.ReleaseMutex() }
    if ($setupMutex) { $setupMutex.Dispose() }
}


