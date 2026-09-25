param([switch]$Preview, [switch]$Worker, [string]$ProjectPath)
$ErrorActionPreference = 'Stop'
function Get-RemovalTarget([string]$Path) {
    $resolved = (Resolve-Path -LiteralPath $Path).Path.TrimEnd('\')
    $driveRoot = [IO.Path]::GetPathRoot($resolved).TrimEnd('\')
    $forbidden = @($driveRoot, $env:USERPROFILE, $env:WINDIR, $env:ProgramFiles, ${env:ProgramFiles(x86)}, [Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('MyDocuments'))
    if ($forbidden -contains $resolved) { throw 'Refusing to remove a system or personal root folder.' }
    $manifest = Join-Path $resolved 'package.json'
    if (-not (Test-Path -LiteralPath $manifest)) { throw 'Careflow package.json was not found.' }
    if ((Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json).name -ne 'careflow-hospital') { throw 'This is not the Careflow project.' }
    foreach ($required in @('server\index.js', 'Start-Careflow.cmd')) {
        if (-not (Test-Path -LiteralPath (Join-Path $resolved $required))) { throw 'The Careflow folder is incomplete; automatic deletion is disabled.' }
    }
    $ancestor = Get-Item -LiteralPath $resolved
    while ($ancestor) {
        if ($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Refusing deletion through a linked folder.' }
        $ancestor = $ancestor.Parent
    }
    return $resolved
}
function Get-RuntimeInstallations {
    $keys = @('HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*')
    @(Get-ItemProperty $keys -ErrorAction SilentlyContinue | Where-Object {
        $_.DisplayName -eq 'Node.js' -or $_.DisplayName -match '^MongoDB (\d|Server\b|Community\b|Enterprise\b)'
    } | Sort-Object PSChildName -Unique)
}
try {
    if (-not $Worker) { $ProjectPath = Split-Path -Parent $PSScriptRoot }
    $target = Get-RemovalTarget $ProjectPath
    $installations = @(Get-RuntimeInstallations)
    Write-Host ''
    Write-Host 'PERMANENT CAREFLOW REMOVAL' -ForegroundColor Yellow
    Write-Host "Folder: $target"
    Write-Host 'Includes ALL source code, records, accounts, photos, backups, and private runtimes.'
    Write-Host 'React and Express packages are removed with the project.'
    Write-Host 'System-wide runtime removal affects other projects using those runtimes.'
    foreach ($item in $installations) { Write-Host ('Uninstall: ' + $item.DisplayName) }
    Write-Host 'Cloud accounts, GitHub repositories, and other project folders are not deleted.'
    if ($Preview) { Write-Host 'PREVIEW ONLY: nothing changed.'; exit 0 }
    if (-not $Worker) {
        # Run from a unique temporary folder so the worker can delete its original project.
        $workerDirectory = Join-Path ([IO.Path]::GetTempPath()) ('Careflow-removal-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $workerDirectory | Out-Null
        $workerFile = Join-Path $workerDirectory 'remove.ps1'
        Copy-Item -LiteralPath $PSCommandPath -Destination $workerFile
        $arguments = '-NoLogo -NoProfile -ExecutionPolicy Bypass -File "' + $workerFile + '" -Worker -ProjectPath "' + $target + '"'
        Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -Verb RunAs -WorkingDirectory $workerDirectory -Wait
        Remove-Item -LiteralPath $workerFile -Force
        return
    }
    # Reject unsupported installers BEFORE removing any software or files.
    foreach ($item in $installations) {
        if ($item.UninstallString -notmatch '(?i)msiexec' -or $item.PSChildName -notmatch '^\{[0-9A-Fa-f-]{36}\}$') {
            throw ('Please uninstall ' + $item.DisplayName + ' from Windows Installed apps, then run this launcher again. Its installer is not supported for automatic removal.')
        }
    }
    Write-Host ''
    Write-Host 'Close Careflow with Ctrl+C in its launcher before continuing.'
    Write-Host 'This cannot be undone. Copy any backup you want to KEEP outside the folder first.' -ForegroundColor Red
    if ((Read-Host 'Type DELETE CAREFLOW AND DATA to permanently erase it') -cne 'DELETE CAREFLOW AND DATA') {
        Write-Host 'Cancelled. Nothing removed.'; return
    }
    # Do not kill unrelated Node applications or force-delete an open database.
    foreach ($port in @(4000, 5173)) {
        $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Parse('127.0.0.1'), $port)
        try { $listener.Start() } catch { throw "Port $port is still in use. Close Careflow and retry. Nothing removed." } finally { $listener.Stop() }
    }
    $active = @(Get-CimInstance Win32_Process | Where-Object {
        ($_.Name -like 'mongod*' -or $_.Name -eq 'node.exe') -and $_.CommandLine -and $_.CommandLine.IndexOf($target, [StringComparison]::OrdinalIgnoreCase) -ge 0
    })
    if ($active.Count) { throw 'Careflow processes are still running. Close them cleanly and retry. Nothing removed.' }
    # Refuse nested links instead of risking deletion outside the named project.
    $pending = New-Object 'Collections.Generic.Stack[string]'
    $pending.Push($target)
    while ($pending.Count) {
        foreach ($entry in Get-ChildItem -LiteralPath $pending.Pop() -Force) {
            if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw ('Linked file or folder found; automatic removal stopped: ' + $entry.FullName) }
            if ($entry.PSIsContainer) { $pending.Push($entry.FullName) }
        }
    }
    $logDirectory = Split-Path -Parent $PSCommandPath
    foreach ($item in $installations) {
        Write-Host ('Uninstalling ' + $item.DisplayName + '...')
        $log = Join-Path $logDirectory ($item.PSChildName + '.log')
        $arguments = '/x ' + $item.PSChildName + ' /qn /norestart /L*v "' + $log + '"'
        $process = Start-Process msiexec.exe -ArgumentList $arguments -WindowStyle Hidden -Wait -PassThru
        if ($process.ExitCode -notin @(0, 1605, 3010)) { throw ('Uninstall failed. Project kept. Log: ' + $log) }
        if ($process.ExitCode -eq 3010) { Write-Host 'Windows needs a restart to finish runtime removal.' }
    }
    $target = Get-RemovalTarget $target
    Set-Location -LiteralPath $logDirectory
    Remove-Item -LiteralPath $target -Recurse -Force
    if (Test-Path -LiteralPath $target) { throw 'Some files remain. Close applications using them and inspect the folder.' }
    Write-Host 'Careflow and its data have been permanently removed.' -ForegroundColor Green
} catch {
    Write-Host ('Removal stopped: ' + $_.Exception.Message) -ForegroundColor Red
    if ($Preview) { exit 1 }
} finally {
    if ($Worker) { Read-Host 'Press Enter to close' | Out-Null }
}
