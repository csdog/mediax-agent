# MediaX CLI + Skill installer. Downloads GitHub Release binaries — Bun not required.
# Layout: %USERPROFILE%\.mediax\agent\{bin,skills,backups,control.json}.
# Windows PowerShell 5.1 or PowerShell 7+.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$SkillsDir,
    [string]$MediaxRoot = $(if ($env:MEDIAX_HOME) { $env:MEDIAX_HOME } else { Join-Path $env:USERPROFILE '.mediax' }),
    [string]$BinDir = '',
    [string]$Ref = 'latest',
    [switch]$SkillOnly,
    [switch]$AddToPath
)

$ErrorActionPreference = 'Stop'
$RepoSlug = 'csdog/mediax-agent'
$DownloadBase = "https://github.com/$RepoSlug/releases"
$RawBase = "https://raw.githubusercontent.com/$RepoSlug/main"
$BackupKeep = 3
$MediaxHome = Join-Path $MediaxRoot 'agent'
$HomeBin = Join-Path $MediaxHome 'bin'
$HomeSkills = Join-Path $MediaxHome 'skills\mediax'
$HomeAliasSkills = Join-Path $MediaxHome 'skills\mx'
$BackupsRoot = Join-Path $MediaxHome 'backups'
if ($BinDir -and ([IO.Path]::GetFullPath($BinDir).TrimEnd('\') -ne [IO.Path]::GetFullPath($HomeBin).TrimEnd('\'))) {
    Write-Output "Note: -BinDir is ignored; CLI always installs to $HomeBin. Use -AddToPath for PATH."
}

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

function Write-MxcShortcut([string]$Directory, [string]$MediaxExe) {
    $cmd = Join-Path $Directory 'mxc.cmd'
    $lines = @(
        '@echo off'
        "`"$MediaxExe`" %*"
    )
    Set-Content -LiteralPath $cmd -Value $lines -Encoding ASCII
}

function Get-SanitizedVersion([string]$Raw) {
    if (-not $Raw) { return 'unknown' }
    $trimmed = $Raw.Trim().TrimStart('v', 'V')
    if ($trimmed -match '^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$') { return $trimmed }
    return 'unknown'
}

function Get-OutgoingVersion {
    foreach ($name in @('mediax-cli.exe', 'mediax.exe')) {
        $exe = Join-Path $HomeBin $name
        if (Test-Path -LiteralPath $exe) {
            try {
                $out = & $exe --version 2>$null
                $ver = Get-SanitizedVersion ("$out")
                if ($ver -ne 'unknown') { return $ver }
            }
            catch { }
        }
    }
    $skillMd = Join-Path $HomeSkills 'SKILL.md'
    if (Test-Path -LiteralPath $skillMd) {
        foreach ($line in Get-Content -LiteralPath $skillMd) {
            if ($line -match '^version:\s*(.+)$') {
                return (Get-SanitizedVersion $Matches[1].Trim().Trim('"', "'"))
            }
        }
    }
    return 'unknown'
}

function Backup-ExistingInstall {
    $binNames = @('mediax-cli.exe', 'mediax.exe', 'mxc.cmd', 'mx.cmd')
    $hasBin = $false
    foreach ($name in $binNames) {
        if (Test-Path -LiteralPath (Join-Path $HomeBin $name)) { $hasBin = $true; break }
    }
    $hasSkill = (Test-Path -LiteralPath $HomeSkills) -or (Test-Path -LiteralPath $HomeAliasSkills)
    if (-not $hasBin -and -not $hasSkill) { return }

    $ver = Get-OutgoingVersion
    $backup = Join-Path $BackupsRoot $ver
    if (Test-Path -LiteralPath $backup) {
        Remove-Item -LiteralPath $backup -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path (Join-Path $backup 'bin') | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $backup 'skills') | Out-Null
    if ($hasBin) {
        foreach ($name in $binNames) {
            $path = Join-Path $HomeBin $name
            if (Test-Path -LiteralPath $path) {
                Move-Item -LiteralPath $path -Destination (Join-Path $backup "bin\$name") -Force
            }
        }
    }
    if (Test-Path -LiteralPath $HomeSkills) {
        Move-Item -LiteralPath $HomeSkills -Destination (Join-Path $backup 'skills\mediax') -Force
    }
    if (Test-Path -LiteralPath $HomeAliasSkills) {
        Move-Item -LiteralPath $HomeAliasSkills -Destination (Join-Path $backup 'skills\mx') -Force
    }
    Write-Output "Backed up previous install to $backup"
}

function Prune-Backups {
    if (-not (Test-Path -LiteralPath $BackupsRoot)) { return }
    $dirs = Get-ChildItem -LiteralPath $BackupsRoot -Directory | Sort-Object LastWriteTime -Descending
    if ($dirs.Count -le $BackupKeep) { return }
    $dirs | Select-Object -Skip $BackupKeep | ForEach-Object {
        Remove-Item -LiteralPath $_.FullName -Recurse -Force
    }
}

function Ensure-SkillLink([string]$LinkPath, [string]$Canonical) {
    $parent = Split-Path -Parent $LinkPath
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    if (Test-Path -LiteralPath $LinkPath) {
        $item = Get-Item -LiteralPath $LinkPath -Force
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            $target = $item.Target
            if ($target -is [array]) { $target = $target[0] }
            $resolvedLink = if ($target) { [IO.Path]::GetFullPath((Join-Path $parent $target)) } else { '' }
            if ($resolvedLink -and $resolvedLink.Equals([IO.Path]::GetFullPath($Canonical), [StringComparison]::OrdinalIgnoreCase)) {
                return
            }
        }
        Remove-Item -LiteralPath $LinkPath -Recurse -Force
    }
    try {
        New-Item -ItemType Junction -Path $LinkPath -Target $Canonical | Out-Null
    }
    catch {
        Write-Output "WARN: could not create junction at $LinkPath ($($_.Exception.Message)); copying Skill instead."
        New-Item -ItemType Directory -Force -Path $LinkPath | Out-Null
        Copy-Item -Path (Join-Path $Canonical '*') -Destination $LinkPath -Recurse -Force
    }
    Write-Output "Skill link: $LinkPath → $Canonical"
}

function Install-OneSkill([string]$Source, [string]$Name) {
    $canonical = Join-Path $MediaxHome "skills\$Name"
    $parent = Split-Path -Parent $canonical
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    if (Test-Path -LiteralPath $canonical) {
        Remove-Item -LiteralPath $canonical -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $canonical | Out-Null
    Copy-Item -Path (Join-Path $Source '*') -Destination $canonical -Recurse -Force
    if (-not (Test-Path -LiteralPath (Join-Path $canonical 'SKILL.md'))) {
        throw "Skill $Name missing SKILL.md after install"
    }
    Write-Output "Skill installed: $canonical"
    Ensure-SkillLink (Join-Path $SkillsDir $Name) $canonical
    Ensure-SkillLink (Join-Path $env:USERPROFILE ".agents\skills\$Name") $canonical
}

function Install-SkillsPackage([string]$PackageRoot) {
    $mediaxSource = Join-Path $PackageRoot 'mediax'
    if (-not (Test-Path -LiteralPath (Join-Path $mediaxSource 'SKILL.md'))) {
        throw 'Package missing mediax/SKILL.md'
    }
    Install-OneSkill $mediaxSource 'mediax'
    $mxSource = Join-Path $PackageRoot 'mx'
    if (Test-Path -LiteralPath (Join-Path $mxSource 'SKILL.md')) {
        Install-OneSkill $mxSource 'mx'
    }
    else {
        Write-Output 'Note: package has no mx/ alias Skill; skipping short name.'
    }
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
    'AMD64' { $Asset = 'mediax-windows-x64.zip'; $BinName = 'mediax-cli.exe' }
    'ARM64' { $Asset = 'mediax-windows-arm64.zip'; $BinName = 'mediax-cli.exe' }
    default { throw "Unsupported Windows architecture: $architecture" }
}

$TemporaryDir = Join-Path ([IO.Path]::GetTempPath()) ('mediax-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $TemporaryDir | Out-Null
try {
    New-Item -ItemType Directory -Force -Path $MediaxRoot | Out-Null
    New-Item -ItemType Directory -Force -Path $MediaxHome | Out-Null
    Backup-ExistingInstall

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
        Install-SkillsPackage (Join-Path $TemporaryDir 'skills')
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
        $skillsRoot = Join-Path $sourceRoot.FullName 'skills'
        if (-not (Test-Path -LiteralPath (Join-Path $skillsRoot 'mediax\SKILL.md'))) {
            throw 'Archive missing skills/mediax/SKILL.md'
        }
        Install-SkillsPackage $skillsRoot
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
                Write-Output 'Native ARM64 asset missing; falling back to mediax-windows-x64.zip …'
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
            $legacy = Join-Path $clientDir 'mediax.exe'
            if (Test-Path -LiteralPath $legacy) { $newBinary = $legacy }
            else { throw "Zip missing mediax-cli.exe (or legacy mediax.exe)" }
        }

        New-Item -ItemType Directory -Force -Path $HomeBin | Out-Null
        $installed = Join-Path $HomeBin 'mediax-cli.exe'
        Copy-Item -LiteralPath $newBinary -Destination $installed -Force
        Write-MxcShortcut -Directory $HomeBin -MediaxExe $installed
        foreach ($legacy in @('mediax.exe', 'mx.cmd')) {
            $p = Join-Path $HomeBin $legacy
            if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Force }
        }
        Write-Output "CLI installed: $installed (shortcut mxc.cmd)"

        if ($AddToPath) {
            Add-DirectoryToUserPath $HomeBin
        }
        else {
            $onPath = $false
            foreach ($entry in $env:Path.Split(';')) {
                $expanded = [Environment]::ExpandEnvironmentVariables($entry.Trim().Trim('"')).TrimEnd('\')
                if ($expanded.Equals([IO.Path]::GetFullPath($HomeBin).TrimEnd('\'), [StringComparison]::OrdinalIgnoreCase)) {
                    $onPath = $true
                    break
                }
            }
            if (-not $onPath) {
                Write-Output "Note: $HomeBin is not on PATH; re-run with -AddToPath or use the absolute path."
            }
        }

        & $installed --version
    }
    else {
        Write-Output 'Skill-only install finished (CLI skipped).'
    }

    Prune-Backups

    Write-Output ''
    Write-Output 'Done. Refresh the Agent skill list (or restart the Agent), then run: mediax-cli doctor'
    Write-Output "Root: $MediaxRoot"
    Write-Output "Agent home: $MediaxHome (control.json under this tree)"
    Write-Output "Install doc: $RawBase/skills/install.md"
}
finally {
    if (Test-Path -LiteralPath $TemporaryDir) {
        Remove-Item -LiteralPath $TemporaryDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
