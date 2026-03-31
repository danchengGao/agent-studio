# PowerShell Script: Check and Install Python 3.11 (Windows Version)
$ErrorActionPreference = "Stop"
$ProgressPreference = 'SilentlyContinue'
$PythonVersion = "3.11"
$PythonFullVersion = "3.11.4"

# Load utility functions from utils.ps1
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$UtilsScript = Join-Path $ScriptDir "utils.ps1"
. $UtilsScript

function Compare-Version {
    param(
        [string]$Version1,
        [string]$Version2
    )
    
    # Extract version numbers (e.g., "3.11.4" from "Python 3.11.4")
    $V1Match = $Version1 -match "(\d+)\.(\d+)\.(\d+)"
    $V2Match = $Version2 -match "(\d+)\.(\d+)\.(\d+)"
    
    if (-not $V1Match -or -not $V2Match) {
        return $null
    }
    
    $V1Major = [int]$Matches[1]
    $V1Minor = [int]$Matches[2]
    $V1Patch = [int]$Matches[3]
    
    # Reset $Matches for second match
    $null = $Version2 -match "(\d+)\.(\d+)\.(\d+)"
    $V2Major = [int]$Matches[1]
    $V2Minor = [int]$Matches[2]
    $V2Patch = [int]$Matches[3]
    
    # Compare versions
    if ($V1Major -gt $V2Major) { return 1 }
    if ($V1Major -lt $V2Major) { return -1 }
    if ($V1Minor -gt $V2Minor) { return 1 }
    if ($V1Minor -lt $V2Minor) { return -1 }
    if ($V1Patch -gt $V2Patch) { return 1 }
    if ($V1Patch -lt $V2Patch) { return -1 }
    return 0
}

function Test-PythonInstalled {
    param(
        [string]$RequiredFullVersion = $PythonFullVersion,
        [ref]$PythonPath = $null
    )
    
    # Search for Python executable
    $FoundPath = Search-PythonExecutable
    
    if ($FoundPath) {
        try {
            $InstalledVersion = & $FoundPath --version 2>&1
            # Check if it's at least Python 3.11
            if ($InstalledVersion -match "Python 3\.11") {
                # Compare versions: installed version must be >= required version
                $Comparison = Compare-Version -Version1 $InstalledVersion -Version2 "Python $RequiredFullVersion"
                if ($null -ne $Comparison -and $Comparison -ge 0) {
                    if ($PythonPath) {
                        $PythonPath.Value = $FoundPath
                    }
                    return $true
                } else {
                    Write-Log "WARN" "Found Python $InstalledVersion but required version is >= $RequiredFullVersion"
                }
            } elseif ($InstalledVersion -match "Python 3\.(\d+)") {
                # Check if it's Python 3.12 or higher (which is also acceptable)
                $MinorVersion = [int]$Matches[1]
                if ($MinorVersion -gt 11) {
                    if ($PythonPath) {
                        $PythonPath.Value = $FoundPath
                    }
                    Write-Log "INFO" "Found Python $InstalledVersion (>= 3.11.4), using it"
                    return $true
                }
            }
        } catch {
            # Failed to check version
        }
    }
    
    return $false
}

function Search-PythonExecutable {
    # Common Python installation paths
    $SearchPaths = @(
        "C:\Program Files\Python$PythonVersion\python.exe",
        "C:\Program Files (x86)\Python$PythonVersion\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python$PythonVersion\python.exe",
        "C:\Python$PythonVersion\python.exe",
        "C:\Program Files\Python$($PythonVersion.Replace('.', ''))\python.exe",
        "C:\Program Files (x86)\Python$($PythonVersion.Replace('.', ''))\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python$($PythonVersion.Replace('.', ''))\python.exe"
    )
    
    # Search for Python executable and verify it's >= Python 3.11.4
    foreach ($Path in $SearchPaths) {
        if (Test-Path $Path) {
            # Test if this is a real Python executable and check version
            try {
                $Version = & $Path --version 2>&1
                if ($Version -match "Python 3\.11") {
                    # Check if version is >= 3.11.4
                    $Comparison = Compare-Version -Version1 $Version -Version2 "Python $PythonFullVersion"
                    if ($null -ne $Comparison -and $Comparison -ge 0) {
                        Write-Log "INFO" "Found Python executable at: $Path (Version: $Version, >= $PythonFullVersion)"
                        return $Path
                    } else {
                        Write-Log "INFO" "Found Python at $Path but version is $Version, required: >= $PythonFullVersion"
                    }
                } elseif ($Version -match "Python 3\.(\d+)") {
                    # Check if it's Python 3.12 or higher (which is also acceptable)
                    $MinorVersion = [int]$Matches[1]
                    if ($MinorVersion -gt 11) {
                        Write-Log "INFO" "Found Python executable at: $Path (Version: $Version, >= $PythonFullVersion)"
                        return $Path
                    } else {
                        Write-Log "INFO" "Found Python at $Path but version is $Version, required: >= $PythonFullVersion"
                    }
                } elseif ($Version -match "Python") {
                    Write-Log "INFO" "Found Python at $Path but version is $Version, required: >= $PythonFullVersion"
                }
            } catch {
                # Not a real Python executable
            }
        }
    }
    
    # Try to find Python in PATH (excluding Microsoft Store)
    $null = Get-Command python -ErrorAction SilentlyContinue
    if ($?) {
        try {
            $PythonPath = (Get-Command python).Source
            if (Test-Path $PythonPath) {
                # Skip Microsoft Store aliases
                if ($PythonPath -like "*WindowsApps*\python.exe") {
                    Write-Log "INFO" "Skipping Microsoft Store Python alias at: $PythonPath"
                    # Continue searching other paths
                } else {
                    # Test if this is a real Python executable and check version
                    try {
                        $Version = & $PythonPath --version 2>&1
                        if ($Version -match "Python 3\.11") {
                            # Check if version is >= 3.11.4
                            $Comparison = Compare-Version -Version1 $Version -Version2 "Python $PythonFullVersion"
                            if ($null -ne $Comparison -and $Comparison -ge 0) {
                                Write-Log "INFO" "Found Python executable in PATH: $PythonPath (Version: $Version, >= $PythonFullVersion)"
                                return $PythonPath
                            } else {
                                Write-Log "INFO" "Found Python in PATH at $PythonPath but version is $Version, required: >= $PythonFullVersion"
                            }
                        } elseif ($Version -match "Python 3\.(\d+)") {
                            # Check if it's Python 3.12 or higher (which is also acceptable)
                            $MinorVersion = [int]$Matches[1]
                            if ($MinorVersion -gt 11) {
                                Write-Log "INFO" "Found Python executable in PATH: $PythonPath (Version: $Version, >= $PythonFullVersion)"
                                return $PythonPath
                            } else {
                                Write-Log "INFO" "Found Python in PATH at $PythonPath but version is $Version, required: >= $PythonFullVersion"
                            }
                        } elseif ($Version -match "Python") {
                            Write-Log "INFO" "Found Python in PATH at $PythonPath but version is $Version, required: >= $PythonFullVersion"
                        }
                    } catch {
                        # Not a real Python executable
                    }
                }
            }
        } catch {
            # Failed to get Python path from PATH
        }
    }
    
    # Try to find python3.exe as well
    $null = Get-Command python3 -ErrorAction SilentlyContinue
    if ($?) {
        try {
            $PythonPath = (Get-Command python3).Source
            if (Test-Path $PythonPath) {
                # Skip Microsoft Store aliases
                if ($PythonPath -like "*WindowsApps*\python3.exe") {
                    Write-Log "INFO" "Skipping Microsoft Store Python3 alias at: $PythonPath"
                    # Continue searching other paths
                } else {
                    # Test if this is a real Python executable and check version
                    try {
                        $Version = & $PythonPath --version 2>&1
                        if ($Version -match "Python 3\.11") {
                            # Check if version is >= 3.11.4
                            $Comparison = Compare-Version -Version1 $Version -Version2 "Python $PythonFullVersion"
                            if ($null -ne $Comparison -and $Comparison -ge 0) {
                                Write-Log "INFO" "Found Python3 executable in PATH: $PythonPath (Version: $Version, >= $PythonFullVersion)"
                                return $PythonPath
                            } else {
                                Write-Log "INFO" "Found Python3 in PATH at $PythonPath but version is $Version, required: >= $PythonFullVersion"
                            }
                        } elseif ($Version -match "Python 3\.(\d+)") {
                            # Check if it's Python 3.12 or higher (which is also acceptable)
                            $MinorVersion = [int]$Matches[1]
                            if ($MinorVersion -gt 11) {
                                Write-Log "INFO" "Found Python3 executable in PATH: $PythonPath (Version: $Version, >= $PythonFullVersion)"
                                return $PythonPath
                            } else {
                                Write-Log "INFO" "Found Python3 in PATH at $PythonPath but version is $Version, required: >= $PythonFullVersion"
                            }
                        } elseif ($Version -match "Python") {
                            Write-Log "INFO" "Found Python3 in PATH at $PythonPath but version is $Version, required: >= $PythonFullVersion"
                        }
                    } catch {
                        # Not a real Python executable
                    }
                }
            }
        } catch {
            # Failed to get Python3 path from PATH
        }
    }
    
    Write-Log "INFO" "Searched all common Python installation paths but Python 3.11 not found"
    return $null
}

function Install-Python {
    Write-Log "INFO" "Starting automatic installation of Python $PythonVersion"
    
    # Create a temporary directory for the installer
    $TempDir = Join-Path $env:TEMP "PythonInstall"
    if (-not (Test-Path $TempDir)) {
        New-Item -ItemType Directory -Path $TempDir | Out-Null
    }
    
    # Set the download URL and installer path
    $InstallerUrl = "https://www.python.org/ftp/python/$PythonFullVersion/python-$PythonFullVersion-amd64.exe"
    $InstallerPath = Join-Path $TempDir "python-$PythonFullVersion-amd64.exe"
    
    # Download the installer
    Write-Log "INFO" "Downloading Python installer from: $InstallerUrl"
    try {
        Invoke-WebRequest -Uri $InstallerUrl -OutFile $InstallerPath -UseBasicParsing
        Write-Log "SUCCESS" "Python installer downloaded successfully"
    } catch {
        Write-Log "ERROR" "Failed to download Python installer: $($_.Exception.Message)"
        exit 1
    }
    
    # Install Python silently with add to PATH option
    Write-Log "INFO" "Installing Python silently..."
    try {
        Start-Process -FilePath $InstallerPath -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1 Include_test=0" -Wait
        Write-Log "SUCCESS" "Python installed successfully"
    } catch {
        Write-Log "ERROR" "Failed to install Python: $($_.Exception.Message)"
        exit 1
    }
    
    # Clean up the temporary directory
    Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue
    
    # Wait for a moment to ensure installation is complete
    Write-Log "INFO" "Waiting for Python installation to complete..."
    Start-Sleep -Seconds 10
    
    # Refresh environment variables
    Write-Log "INFO" "Refreshing environment variables..."
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::Machine) + ";" + [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::User)
    
    # Search for Python executable multiple times
    $Retries = 3
    $PythonExePath = $null
    
    for ($i = 1; $i -le $Retries; $i++) {
        Write-Log "INFO" "Searching for Python executable (attempt $i/$Retries)..."
        $PythonExePath = Search-PythonExecutable
        if ($PythonExePath) {
            break
        }
        Write-Log "INFO" "Python executable not found, waiting 5 seconds and trying again..."
        Start-Sleep -Seconds 5
    }
    
    if ($PythonExePath) {
        # Add Python path to current session PATH
        $PythonDir = Split-Path -Parent $PythonExePath
        $ScriptsDir = Join-Path $PythonDir "Scripts"
        if ($env:PATH -notlike "*$PythonDir*") {
            $env:PATH = "$PythonDir;$ScriptsDir;" + $env:PATH
        }
        # Test the direct path
        try {
            $Version = & $PythonExePath --version 2>&1
            Write-Log "INFO" "Python version check: $Version"
        } catch {
            Write-Log "WARN" "Failed to check Python version via direct path: $($_.Exception.Message)"
        }
    } else {
        Write-Log "ERROR" "Python executable not found after installation"
        Write-Log "INFO" "Please check if Python was installed correctly and try again"
        Write-Log "INFO" "Common Python installation paths:"
        Write-Log "INFO" "- C:\Program Files\Python$PythonVersion\python.exe"
        Write-Log "INFO" "- C:\Program Files (x86)\Python$PythonVersion\python.exe"
        Write-Log "INFO" "- $env:LOCALAPPDATA\Programs\Python\Python$PythonVersion\python.exe"
        exit 1
    }
}

function Install-UvIfNeeded {
    try {
        $UvCmd = Get-Command uv -ErrorAction Stop
        Write-Log "INFO" "uv already installed: $($UvCmd.Source)"
    } catch {
        Write-Log "INFO" "uv not found, installing via official installer script..."
        $UvInstallScriptUrl = "https://astral.sh/uv/install.ps1"
        $UvInstallScriptPath = Join-Path $env:TEMP "install-uv.ps1"
        try {
            Invoke-WebRequest -Uri $UvInstallScriptUrl -OutFile $UvInstallScriptPath -UseBasicParsing
            powershell -NoProfile -ExecutionPolicy Bypass -File $UvInstallScriptPath
            if ($LASTEXITCODE -ne 0) {
                Write-Log "ERROR" "uv installer exited with code: $LASTEXITCODE"
                exit 1
            }
        } catch {
            Write-Log "ERROR" "Failed to install uv: $($_.Exception.Message)"
            exit 1
        } finally {
            Remove-Item -Path $UvInstallScriptPath -Force -ErrorAction SilentlyContinue
        }
    }

    $UvPathCandidates = @(
        (Join-Path $env:USERPROFILE ".local\bin"),
        (Join-Path $env:USERPROFILE ".cargo\bin")
    )
    foreach ($UvCandidate in $UvPathCandidates) {
        if ((Test-Path $UvCandidate) -and ($env:PATH -notlike "*$UvCandidate*")) {
            $env:PATH = "$UvCandidate;$env:PATH"
        }
    }

    Test-Command "uv"
    Write-Log "SUCCESS" "uv is available ($(uv --version 2>&1))"
}

# Load optional user config
$ProxyConfigPath = Join-Path $PSScriptRoot "user_config.ps1"
if (Test-Path $ProxyConfigPath) {
    try {
        . $ProxyConfigPath
    } catch {
        Write-Log "WARN" "Failed to load proxy config file: $ProxyConfigPath, Error: $($_.Exception.Message)"
    }
}

Write-Log "INFO" "=== Checking Python $PythonFullVersion and uv Installation Status ==="

# First search for Python executable
$PythonExePath = Search-PythonExecutable
$PythonInstalled = $false

if ($PythonExePath) {
    try {
        $Version = & $PythonExePath --version 2>&1
        # Check if version is >= required version (3.11.4)
        if ($Version -match "Python 3\.11") {
            $Comparison = Compare-Version -Version1 $Version -Version2 "Python $PythonFullVersion"
            if ($null -ne $Comparison -and $Comparison -ge 0) {
                Write-Log "SUCCESS" "Python >= $PythonFullVersion found, Version: $Version"
                $PythonInstalled = $true
            } else {
                Write-Log "WARN" "Python 3.11 found but version is $Version, required: >= $PythonFullVersion"
                $PythonInstalled = $false
            }
        } elseif ($Version -match "Python 3\.(\d+)") {
            # Check if it's Python 3.12 or higher (which is also acceptable)
            $MinorVersion = [int]$Matches[1]
            if ($MinorVersion -gt 11) {
                Write-Log "SUCCESS" "Python >= $PythonFullVersion found, Version: $Version"
                $PythonInstalled = $true
            } else {
                Write-Log "WARN" "Python found but version is $Version, required: >= $PythonFullVersion"
                $PythonInstalled = $false
            }
        } else {
            Write-Log "WARN" "Python found but version is $Version, required: >= $PythonFullVersion"
            $PythonInstalled = $false
        }
    } catch {
        Write-Log "WARN" "Python found but failed to check version: $($_.Exception.Message)"
        $PythonInstalled = $false
    }
}

# Check if Python 3.11.4 is installed using Test-PythonInstalled
if (-not $PythonInstalled) {
    $TestPath = $null
    $PythonInstalled = Test-PythonInstalled -RequiredFullVersion $PythonFullVersion -PythonPath ([ref]$TestPath)
    if ($PythonInstalled -and $TestPath) {
        $PythonExePath = $TestPath
        Write-Log "INFO" "Python found via Test-PythonInstalled at: $PythonExePath"
    }
}

if (-not $PythonInstalled) {
    Write-Log "WARN" "Python $PythonFullVersion not installed"
    Install-Python
    # After installation, search for Python again
    $PythonExePath = Search-PythonExecutable
    if ($PythonExePath) {
        try {
            $Version = & $PythonExePath --version 2>&1
            if ($Version -match "Python 3\.11") {
                # Check if version is >= 3.11.4
                $Comparison = Compare-Version -Version1 $Version -Version2 "Python $PythonFullVersion"
                if ($null -ne $Comparison -and $Comparison -ge 0) {
                    Write-Log "SUCCESS" "Python installed successfully, Version: $Version (>= $PythonFullVersion)"
                    $PythonInstalled = $true
                } else {
                    Write-Log "ERROR" "Python installed but version is $Version, required: >= $PythonFullVersion"
                    exit 1
                }
            } elseif ($Version -match "Python 3\.(\d+)") {
                # Check if it's Python 3.12 or higher (which is also acceptable)
                $MinorVersion = [int]$Matches[1]
                if ($MinorVersion -gt 11) {
                    Write-Log "SUCCESS" "Python installed successfully, Version: $Version (>= $PythonFullVersion)"
                    $PythonInstalled = $true
                } else {
                    Write-Log "ERROR" "Python installed but version is $Version, required: >= $PythonFullVersion"
                    exit 1
                }
            } else {
                Write-Log "ERROR" "Python installed but version is $Version, required: >= $PythonFullVersion"
                exit 1
            }
        } catch {
            Write-Log "ERROR" "Python installation failed - cannot verify version"
            exit 1
        }
    } else {
        Write-Log "ERROR" "Python installation failed - executable not found"
        exit 1
    }
}

# Verify using direct path
if ($PythonInstalled) {
    try {
        $PythonVersionOutput = & $PythonExePath --version 2>&1
        Write-Log "SUCCESS" "Python installed successfully! Version: $PythonVersionOutput"
    } catch {
        Write-Log "ERROR" "Failed to verify Python installation: $($_.Exception.Message)"
        exit 1
    }
}

Install-UvIfNeeded

# Ensure PythonExePath is set before output
if (-not $PythonExePath) {
    Write-Log "ERROR" "Python executable path not found after installation check"
    exit 1
}

# Verify the path exists
if (-not (Test-Path $PythonExePath)) {
    Write-Log "ERROR" "Python executable path does not exist: $PythonExePath"
    exit 1
}

# Set environment variable for other scripts to use
$env:PYTHON_EXE_PATH = $PythonExePath

# Output Python executable path for other scripts to use
# Use Write-Output instead of Write-Host so it can be captured by calling scripts
Write-Output "PYTHON_EXE_PATH=$PythonExePath"

Write-Log "SUCCESS" "=== Operation Completed ==="
exit 0