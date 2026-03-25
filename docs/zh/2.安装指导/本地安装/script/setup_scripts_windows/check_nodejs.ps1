# PowerShell Script: Check and Install Node.js (Windows Version)
$ErrorActionPreference = "Stop"
$ProgressPreference = 'SilentlyContinue'
# Node.js 20.0+ required; version to auto-install when missing or too old
$NodeJsMinMajor = 20
$NodeJsInstallVersion = "22"
$NodeJsInstallFullVersion = "22.11.0"

# Load utility functions from utils.ps1
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$UtilsScript = Join-Path $ScriptDir "utils.ps1"
. $UtilsScript

function Test-NodeInstalled {
    $null = Get-Command node -ErrorAction SilentlyContinue
    if ($?) {
        $VersionStr = (node -v) -replace "v", ""
        $InstalledMajor = [int]($VersionStr -split "\." | Select-Object -First 1)
        if ($InstalledMajor -ge $NodeJsMinMajor) {
            return $true
        } else {
            Write-Log "WARN" "Node.js detected but version $(node -v), requires Node.js $NodeJsMinMajor.0 or above"
            return $false
        }
    }
    return $false
}

function Install-NodeJs {
    Write-Log "INFO" "Starting automatic installation of Node.js v$NodeJsInstallVersion (meets $NodeJsMinMajor.0+ requirement)"
    
    # Create a temporary directory for the installer
    $TempDir = Join-Path $env:TEMP "NodeJsInstall"
    if (-not (Test-Path $TempDir)) {
        New-Item -ItemType Directory -Path $TempDir | Out-Null
    }
    
    # Set the installer path
    $InstallerPath = Join-Path $TempDir "node-v$NodeJsInstallFullVersion-x64.msi"
    
    # Download URLs (priority order)
    $DownloadUrls = @(
        "https://openjiuwen-ci.obs.cn-north-4.myhuaweicloud.com/agentstudio/depends/node-v$NodeJsInstallFullVersion-x64.msi",
        "https://nodejs.org/dist/v$NodeJsInstallFullVersion/node-v$NodeJsInstallFullVersion-x64.msi"
    )
    
    # Download the installer (try each URL in order)
    $DownloadSuccess = $false
    foreach ($InstallerUrl in $DownloadUrls) {
        Write-Log "INFO" "Attempting to download Node.js installer from: $InstallerUrl"
        try {
            Invoke-WebRequest -Uri $InstallerUrl -OutFile $InstallerPath -UseBasicParsing
            Write-Log "SUCCESS" "Node.js installer downloaded successfully from: $InstallerUrl"
            $DownloadSuccess = $true
            break
        } catch {
            Write-Log "WARN" "Failed to download from $InstallerUrl : $($_.Exception.Message)"
            if ($InstallerUrl -eq $DownloadUrls[-1]) {
                # This was the last URL, all attempts failed
                Write-Log "ERROR" "Failed to download Node.js installer from all sources"
                exit 1
            }
            Write-Log "INFO" "Trying next download source..."
        }
    }
    
    if (-not $DownloadSuccess) {
        Write-Log "ERROR" "Failed to download Node.js installer from all available sources"
        exit 1
    }
    
    # Install Node.js silently
    Write-Log "INFO" "Installing Node.js silently..."
    try {
        Start-Process -FilePath "msiexec.exe" -ArgumentList "/i $InstallerPath /quiet /qn /norestart" -Wait
        Write-Log "SUCCESS" "Node.js installed successfully"
    } catch {
        Write-Log "ERROR" "Failed to install Node.js: $($_.Exception.Message)"
        exit 1
    }
    
    # Clean up the temporary directory
    Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue
    
    # Wait a moment for the installation to complete and registry to update
    Start-Sleep -Seconds 2
    
    # Node.js default installation path
    $NodeJsPath = "C:\Program Files\nodejs"
    
    # Verify the installation path exists
    if (Test-Path $NodeJsPath) {
        Write-Log "INFO" "Found Node.js installation at: $NodeJsPath"
        
        # Get current system PATH
        $MachinePath = [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::Machine)
        $UserPath = [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::User)
        
        # Remove the Node.js path if it already exists (to avoid duplicates)
        $MachinePathParts = $MachinePath -split ";" | Where-Object { $_ -ne $NodeJsPath -and $_ -ne "" }
        $UserPathParts = $UserPath -split ";" | Where-Object { $_ -ne $NodeJsPath -and $_ -ne "" }
        
        # Add Node.js path to the front of system PATH
        $NewMachinePath = "$NodeJsPath;" + ($MachinePathParts -join ";")
        [System.Environment]::SetEnvironmentVariable("PATH", $NewMachinePath, [System.EnvironmentVariableTarget]::Machine)
        Write-Log "SUCCESS" "Added Node.js path to system PATH (priority)"
        
        # Update current session PATH to prioritize new Node.js version
        $env:PATH = "$NodeJsPath;" + $NewMachinePath + ";" + ($UserPathParts -join ";")
        Write-Log "INFO" "Updated current session PATH"
    } else {
        Write-Log "WARN" "Node.js installation path not found at expected location: $NodeJsPath"
        # Fallback: refresh PATH normally
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::Machine) + ";" + [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::User)
    }
}

function Verify-NodeJs {
    # Refresh PATH to ensure we're using the latest Node.js
    $NodeJsPath = "C:\Program Files\nodejs"
    if (Test-Path $NodeJsPath) {
        $env:PATH = "$NodeJsPath;" + $env:PATH
    }
    
    # Wait a moment for PATH to take effect
    Start-Sleep -Seconds 1
    
    # Try to find node.exe
    $NodeExe = Get-Command node -ErrorAction SilentlyContinue
    if (-not $NodeExe) {
        # Fallback: try direct path
        $NodeExePath = Join-Path $NodeJsPath "node.exe"
        if (Test-Path $NodeExePath) {
            $env:PATH = "$NodeJsPath;" + $env:PATH
            $NodeExe = Get-Command node -ErrorAction SilentlyContinue
        }
    }
    
    if ($NodeExe) {
        $NodeExePath = $NodeExe.Source
        Write-Log "INFO" "Using Node.js from: $NodeExePath"
    }
    
    if (Test-NodeInstalled) {
        $NodeVersion = node -v
        $NpmVersion = npm -v
        Write-Log "SUCCESS" "Node.js installed successfully! Version: $NodeVersion"
        Write-Log "SUCCESS" "NPM installed successfully! Version: $NpmVersion"
    } else {
        Write-Log "ERROR" "Node.js installation failed, please check manually"
        exit 1
    }
}

function Apply-Config-ForNpm {
    $ProxyConfigPath = Join-Path $PSScriptRoot "user_config.ps1"
    if (-not (Test-Path $ProxyConfigPath)) {
        return
    }

    try {
        . $ProxyConfigPath
    } catch {
        Write-Log "WARN" "Failed to load proxy config file: $ProxyConfigPath, Error: $($_.Exception.Message)"
        return
    }
    
    # Configure npm registry if NPM_REGISTRY is set
    if (-not [string]::IsNullOrWhiteSpace($NPM_REGISTRY)) {
        Write-Log "INFO" "Configuring npm registry: $NPM_REGISTRY"
        try {
            & npm config set registry "$NPM_REGISTRY" | Out-Null
            Write-Log "SUCCESS" "npm registry configured successfully"
        } catch {
            Write-Log "WARN" "Failed to configure npm registry: $($_.Exception.Message)"
        }
    }
}

Write-Log "INFO" "=== Starting Node.js ($NodeJsMinMajor.0+) Installation Check ==="

if (Test-NodeInstalled) {
    $NodeVersion = node -v
    Write-Log "SUCCESS" "Node.js already installed and meets requirement, current version: $NodeVersion"
    Verify-NodeJs
} else {
    Write-Log "WARN" "Node.js not installed or version below $NodeJsMinMajor.0"
    Install-NodeJs
    Verify-NodeJs
}

Apply-Config-ForNpm

Write-Log "SUCCESS" "=== Operation Completed ==="
exit 0