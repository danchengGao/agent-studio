# PowerShell Script: Check and Install Git (Windows Version)
$ErrorActionPreference = "Stop"
$ProgressPreference = 'SilentlyContinue'

# Load utility functions from utils.ps1
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$UtilsScript = Join-Path $ScriptDir "utils.ps1"
. $UtilsScript

function Test-GitInstalled {
    $null = Get-Command git -ErrorAction SilentlyContinue
    return $?
}

function Install-Git {
    Write-Log "INFO" "Starting automatic installation of Git"

    # Create a temporary directory for the installer
    $TempDir = Join-Path $env:TEMP "GitInstall"
    if (-not (Test-Path $TempDir)) {
        New-Item -ItemType Directory -Path $TempDir | Out-Null
    }

    # Set the download URL and installer path
    $InstallerUrl = "https://mirrors.huaweicloud.com/git-for-windows/v2.51.0.windows.1/Git-2.51.0-64-bit.exe"
    $InstallerPath = Join-Path $TempDir "Git-2.51.0-64-bit.exe"

    # Download the installer
    Write-Log "INFO" "Downloading Git installer from: $InstallerUrl"
    try {
        Invoke-WebRequest -Uri $InstallerUrl -OutFile $InstallerPath -UseBasicParsing
        Write-Log "SUCCESS" "Git installer downloaded successfully"
    } catch {
        Write-Log "ERROR" "Failed to download Git installer: $($_.Exception.Message)"
        exit 1
    }

    # Install Git silently
    Write-Log "INFO" "Installing Git silently..."
    try {
        $Arguments = '/VERYSILENT /NORESTART /NOCANCEL /SP- /SUPPRESSMSGBOXES /COMPONENTS="gitlfs" /DIR="C:\Program Files\Git"'
        Start-Process -FilePath $InstallerPath -ArgumentList $Arguments -Wait
        Write-Log "SUCCESS" "Git installed successfully"
    } catch {
        Write-Log "ERROR" "Failed to install Git: $($_.Exception.Message)"
        exit 1
    }
    
    # Add Git to PATH environment variable
    $GitPath = "C:\Program Files\Git\bin"
    $MachinePath = [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::Machine)
    if ($MachinePath -notlike "*$GitPath*") {
        $NewMachinePath = "$MachinePath;$GitPath"
        [System.Environment]::SetEnvironmentVariable("PATH", $NewMachinePath, [System.EnvironmentVariableTarget]::Machine)
        Write-Log "SUCCESS" "Added Git to system PATH"
    }
    
    # Add Git cmd to PATH environment variable
    $GitCmdPath = "C:\Program Files\Git\cmd"
    if ($MachinePath -notlike "*$GitCmdPath*") {
        $NewMachinePath = "$MachinePath;$GitCmdPath"
        [System.Environment]::SetEnvironmentVariable("PATH", $NewMachinePath, [System.EnvironmentVariableTarget]::Machine)
        Write-Log "SUCCESS" "Added Git cmd to system PATH"
    }

    # Clean up the temporary directory
    Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue

    # Refresh PATH environment variable
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::Machine) + ";" + [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::User)
}

function Verify-Git {
    if (Test-GitInstalled) {
        $GitVersion = git --version
        Write-Log "SUCCESS" "Git is installed, version: $GitVersion"
    } else {
        Write-Log "ERROR" "Git installation failed, please check manually"
        exit 1
    }
}

function Apply-ProxyConfig-ForGit {
    $ProxyConfigPath = Join-Path $PSScriptRoot "user_config.ps1"
    if (-not (Test-Path $ProxyConfigPath)) {
        return
    }

    try {
        $ProxyConfigContent = Get-Content -Path $ProxyConfigPath -Raw -Encoding UTF8
    } catch {
        Write-Log "WARN" "Failed to read proxy config file: $ProxyConfigPath, Error: $($_.Exception.Message)"
        return
    }

    $HTTP_PROXY = ""
    $HTTPS_PROXY = ""
    $SSL_VERIFY = ""
    $ENABLE_GIT_PROXY_CONFIG = "true"

    if ($ProxyConfigContent -match '(?m)^\s*\$HTTP_PROXY\s*=\s*["''](.*?)["'']\s*$') { $HTTP_PROXY = $Matches[1] }
    if ($ProxyConfigContent -match '(?m)^\s*\$HTTPS_PROXY\s*=\s*["''](.*?)["'']\s*$') { $HTTPS_PROXY = $Matches[1] }
    if ($ProxyConfigContent -match '(?m)^\s*\$SSL_VERIFY\s*=\s*["''](.*?)["'']\s*$') { $SSL_VERIFY = $Matches[1] }
    if ($ProxyConfigContent -match '(?m)^\s*\$ENABLE_GIT_PROXY_CONFIG\s*=\s*["''](.*?)["'']\s*$') { $ENABLE_GIT_PROXY_CONFIG = $Matches[1] }

    $EnableGitProxyConfig = $true
    if (-not [string]::IsNullOrWhiteSpace($ENABLE_GIT_PROXY_CONFIG) -and "$ENABLE_GIT_PROXY_CONFIG".Trim() -match '^(?i:false|0|no)$') {
        $EnableGitProxyConfig = $false
    }
    if (-not $EnableGitProxyConfig) {
        Write-Log "INFO" "Skip configuring git proxy (ENABLE_GIT_PROXY_CONFIG=$ENABLE_GIT_PROXY_CONFIG)"
        return
    }

    if ($HTTP_PROXY) {
        Write-Log "INFO" "Configuring git http.proxy"
        & git config --global http.proxy "$HTTP_PROXY"
    }
    if ($HTTPS_PROXY) {
        Write-Log "INFO" "Configuring git https.proxy"
        & git config --global https.proxy "$HTTPS_PROXY"
    }
    if ($SSL_VERIFY -ne $null -and "$SSL_VERIFY".Trim() -ne "") {
        Write-Log "INFO" "Configuring git http.sslVerify"
        & git config --global http.sslVerify "$SSL_VERIFY"
    }
}

Write-Log "INFO" "=== Starting Git Installation Check ==="

if (Test-GitInstalled) {
    $GitVersion = git --version
    Write-Log "SUCCESS" "Git is installed, version: $GitVersion"
} else {
    Write-Log "WARN" "Git is not installed"
    Install-Git
    Verify-Git
}

Apply-ProxyConfig-ForGit

Write-Log "SUCCESS" "=== Operation Completed ==="
exit 0