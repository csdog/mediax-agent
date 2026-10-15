# MediaX CLI + Skill installer. Downloads GitHub Release binaries — Bun not required.
# Windows PowerShell 5.1 or PowerShell 7+.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$SkillsDir,
    [string]$BinDir = (Join-Path $env:LOCALAPPDATA 'mediax-agent\bin'),
    [string]$Ref = 'latest',
    [switch]$SkillOnly,
    [switch]$AddToPath
)

$ErrorActionPreference = 'Stop'
$RepoSlug = 'csdog/mediax-agent'
$DownloadBase = "https://github.com/$RepoSlug/releases"
$RawBase = "https://raw.githubusercontent.com/$RepoSlug/main"

function Get-AssetUrl([string]$File) {
    if ($Ref -eq 'latest') {
        return "$DownloadBase/latest/download/$File"
    }
    return "$DownloadBase/download/$Ref/$File"
}

function Add-DirectoryToUserPath([string]$Directory) {
    $directory = [IO.Path]::GetFullPath($Directory).TrimEnd('\')
    $current = [Environment]::GetEnvironmentVariable('Path', 'User')
    if (-not $current) { $current = '' }
    foreach ($entry in $current.Split(';')) {
        $expanded = [Environment]::ExpandEnvironmentVariables($entry.Trim().Trim('"')).TrimEnd('\')
        if ($expanded -and $expanded.Equals($directory, [StringComparison]::OrdinalIgnoreCase)) {
            return
        }
    }
    $next = if ($current -and -not $current.EndsWith(';')) { "$current;$directory" } else { "$current$directory" }
    [Environment]::SetEnvironmentVariable('Path', $next, 'User')
    if ($env:Path -notlike "*$directory*") {
        $env:Path = "$env:Path;$directory"
    }
    Write-Output "Added to user PATH: $directory (restart terminals / Agent to pick up)"
}

function Sync-Skill([string]$Source, [string]$Target) {
    $parent = Split-Path -Parent $Target
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    if (Test-Path -LiteralPath $Target) {
        Remove-Item -LiteralPath $Target -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $Target | Out-Null
    Copy-Item -Path (Join-Path $Source '*') -Destination $Target -Recurse -Force
    Write-Output "Skill synced to $Target"
}

function Write-MxShortcut([string]$Directory, [string]$MediaxExe) {
    $cmd = Join-Path $Directory 'mx.cmd'
    $lines = @(
        '@echo off'
        "`"$MediaxExe`" %*"
    )
    Set-Content -LiteralPath $cmd -Value $lines -Encoding ASCII
}

if ($env:OS -ne 'Windows_NT') {
    throw 'Use install.sh on macOS/Linux'
}

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

if (-not $SkillsDir.Trim()) {
    throw 'Specify the current Agent skill directory with -SkillsDir'
}

$architecture = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
switch ($architecture.ToUpperInvariant()) {
    'AMD64' { $Asset = 'mediax-windows-x64.zip'; $BinName = 'mediax.exe' }
    'ARM64' {
        # Prefer native build when present; fall back to x64 under emulation.
        $Asset = 'mediax-windows-arm64.zip'
        $BinName = 'mediax.exe'
        $script:PreferArm64 = $true
    }
    default { throw "Unsupported Windows architecture: $architecture" }
}

$TemporaryDir = Join-Path ([IO.Path]::GetTempPath()) ('mediax-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $TemporaryDir | Out-Null
try {
    $skillTarget = Join-Path $SkillsDir 'mediax'
    $skillsZip = Join-Path $TemporaryDir 'mediax-skills.zip'
    $skillsUrl = Get-AssetUrl 'mediax-skills.zip'
    Write-Output "Downloading Skill ($Ref) …"
    try {
        Invoke-WebRequest -Uri $skillsUrl -OutFile $skillsZip -UseBasicParsing -TimeoutSec 180 -MaximumRedirection 0
        Expand-Archive -LiteralPath $skillsZip -DestinationPath (Join-Path $TemporaryDir 'skills') -Force
        $skillSource = Join-Path $TemporaryDir 'skills\mediax'
        if (-not (Test-Path -LiteralPath (Join-Path $skillSource 'SKILL.md'))) {
            throw 'mediax-skills.zip missing mediax/SKILL.md'
        }
        Sync-Skill $skillSource $skillTarget
    }
    catch {
        Write-Output 'No mediax-skills.zip (or download failed); syncing Skill from repository archive …'
        $archiveRef = if ($Ref -eq 'latest') { 'main' } else { $Ref }
        $archiveUrl = if ($archiveRef -match '^v') {
            "https://github.com/$RepoSlug/archive/refs/tags/$archiveRef.zip"
        } else {
            "https://github.com/$RepoSlug/archive/refs/heads/$archiveRef.zip"
        }
        $archiveZip = Join-Path $TemporaryDir 'src.zip'
        Invoke-WebRequest -Uri $archiveUrl -OutFile $archiveZip -UseBasicParsing -TimeoutSec 180
        Expand-Archive -LiteralPath $archiveZip -DestinationPath $TemporaryDir -Force
        $sourceRoot = Get-ChildItem -Directory -Path $TemporaryDir | Where-Object { $_.Name -like 'mediax-agent-*' } | Select-Object -First 1
        if (-not $sourceRoot) { throw 'Archive missing mediax-agent-* directory' }
        $skillSource = Join-Path $sourceRoot.FullName 'skills\mediax'
        if (-not (Test-Path -LiteralPath (Join-Path $skillSource 'SKILL.md'))) {
            throw 'Archive missing skills/mediax/SKILL.md'
        }
        Sync-Skill $skillSource $skillTarget
    }

    if (-not $SkillOnly) {
        $binZip = Join-Path $TemporaryDir $Asset
        $binUrl = Get-AssetUrl $Asset
        Write-Output "Downloading $Asset …"
        try {
            Invoke-WebRequest -Uri $binUrl -OutFile $binZip -UseBasicParsing -TimeoutSec 180 -MaximumRedirection 0
        }
        catch {
            if ($architecture.ToUpperInvariant() -eq 'ARM64') {
                Write-Output 'Native ARM64 asset missing; trying mediax-windows-x64.zip …'
                $Asset = 'mediax-windows-x64.zip'
                $binZip = Join-Path $TemporaryDir $Asset
                $binUrl = Get-AssetUrl $Asset
                Invoke-WebRequest -Uri $binUrl -OutFile $binZip -UseBasicParsing -TimeoutSec 180 -MaximumRedirection 0
            }
            else {
                throw "Missing Release asset $Asset. Publish a v* tag (CI builds binaries)."
            }
        }

        $clientDir = Join-Path $TemporaryDir 'client'
        Expand-Archive -LiteralPath $binZip -DestinationPath $clientDir -Force
        $newBinary = Join-Path $clientDir $BinName
        if (-not (Test-Path -LiteralPath $newBinary)) {
            throw "Zip missing $BinName"
        }

        New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
        $installed = Join-Path $BinDir 'mediax.exe'
        Copy-Item -LiteralPath $newBinary -Destination $installed -Force
        Write-MxShortcut -Directory $BinDir -MediaxExe $installed
        Write-Output "CLI installed: $installed (shortcut mx.cmd)"

        if ($AddToPath) {
            Add-DirectoryToUserPath $BinDir
        }
        else {
            $onPath = $false
            foreach ($entry in $env:Path.Split(';')) {
                $expanded = [Environment]::ExpandEnvironmentVariables($entry.Trim().Trim('"')).TrimEnd('\')
                if ($expanded.Equals([IO.Path]::GetFullPath($BinDir).TrimEnd('\'), [StringComparison]::OrdinalIgnoreCase)) {
                    $onPath = $true
                    break
                }
            }
            if (-not $onPath) {
                Write-Output "Note: $BinDir is not on PATH; re-run with -AddToPath or use the absolute path."
            }
        }

        & $installed --version
    }
    else {
        Write-Output 'Skill-only install finished (CLI skipped).'
    }

    Write-Output ''
    Write-Output 'Done. Refresh the Agent skill list (or restart the Agent), then run: mediax doctor'
    Write-Output "Install doc: $RawBase/install.md"
}
finally {
    if (Test-Path -LiteralPath $TemporaryDir) {
        Remove-Item -LiteralPath $TemporaryDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
