# PowerShell Script: Check and Install MySQL 8.0+ (Windows Version)
$ErrorActionPreference = "Stop"
$ProgressPreference = 'SilentlyContinue'
$RequiredMajorVersion = 8
$RequiredMinorVersion = 0

# Offline installation package (download URL, version, Chocolatey version, ZIP filename)
$MYSQL_OFFLINE_PACKAGE_URL = "https://openjiuwen-ci.obs.cn-north-4.myhuaweicloud.com/agentstudio/depends/mysql-v8.4.6-win64.zip"
$MYSQL_OFFLINE_VERSION = "8.4.6"
$MYSQL_CHOCO_PACKAGE_VERSION = "8.4.6"
$MYSQL_OFFLINE_ZIP_FILENAME = "mysql-v8.4.6-win64.zip"

# ===================== Load Utility Functions =====================
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$UtilsScript = Join-Path $ScriptDir "utils.ps1"
. $UtilsScript

$DbConnCfg = Get-DbHostPortFromUserConfig -WorkHome $ScriptDir -DefaultHost "127.0.0.1" -DefaultPort 3306
$DB_HOST = $DbConnCfg.Host
$DB_PORT = [int]$DbConnCfg.Port
Write-Log "INFO" "Database connection from user_config.ps1 => host: $DB_HOST, port: $DB_PORT"


function Search-MySQLExecutable {
    # Common MySQL installation paths
    $SearchPaths = @(
        "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe",
        "C:\Program Files\MySQL\MySQL Server 8.1\bin\mysql.exe",
        "C:\Program Files\MySQL\MySQL Server 8.2\bin\mysql.exe",
        "C:\Program Files\MySQL\MySQL Server 8.3\bin\mysql.exe",
        "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe",
        "C:\Program Files (x86)\MySQL\MySQL Server 8.0\bin\mysql.exe",
        "C:\Program Files (x86)\MySQL\MySQL Server 8.1\bin\mysql.exe",
        "C:\Program Files (x86)\MySQL\MySQL Server 8.2\bin\mysql.exe",
        "C:\Program Files (x86)\MySQL\MySQL Server 8.3\bin\mysql.exe",
        "C:\Program Files (x86)\MySQL\MySQL Server 8.4\bin\mysql.exe"
    )
    
    # Search for MySQL executable in standard paths
    foreach ($Path in $SearchPaths) {
        if (Test-Path $Path) {
            Write-Log "INFO" "Found MySQL executable at: $Path"
            return $Path
        }
    }
    
    # Try to find MySQL Server directories dynamically (for any 8.x version)
    $MySQLBasePaths = @(
        "C:\Program Files\MySQL",
        "C:\Program Files (x86)\MySQL"
    )
    
    foreach ($BasePath in $MySQLBasePaths) {
        if (Test-Path $BasePath) {
            try {
                $ServerDirs = Get-ChildItem -Path $BasePath -Directory -Filter "MySQL Server 8.*" -ErrorAction SilentlyContinue
                foreach ($ServerDir in $ServerDirs) {
                    $MySQLExe = Join-Path $ServerDir.FullName "bin\mysql.exe"
                    if (Test-Path $MySQLExe) {
                        Write-Log "INFO" "Found MySQL executable at: $MySQLExe"
                        return $MySQLExe
                    }
                }
            } catch {
                # Failed to search directories
            }
        }
    }
    
    # Try to find MySQL in PATH
    $null = Get-Command mysql -ErrorAction SilentlyContinue
    if ($?) {
        try {
            $MySQLPath = (Get-Command mysql).Source
            if (Test-Path $MySQLPath) {
                Write-Log "INFO" "Found MySQL executable in PATH: $MySQLPath"
                return $MySQLPath
            }
        } catch {
            # Failed to get MySQL path from PATH
        }
    }
    
    # Try to find MySQL in registry
    try {
        $MySQLKeys = @(
            "HKLM:\SOFTWARE\MySQL AB\MySQL Server 8.0",
            "HKLM:\SOFTWARE\MySQL AB\MySQL Server 8.1",
            "HKLM:\SOFTWARE\MySQL AB\MySQL Server 8.2",
            "HKLM:\SOFTWARE\MySQL AB\MySQL Server 8.3",
            "HKLM:\SOFTWARE\MySQL AB\MySQL Server 8.4",
            "HKLM:\SOFTWARE\WOW6432Node\MySQL AB\MySQL Server 8.0",
            "HKLM:\SOFTWARE\WOW6432Node\MySQL AB\MySQL Server 8.1",
            "HKLM:\SOFTWARE\WOW6432Node\MySQL AB\MySQL Server 8.2",
            "HKLM:\SOFTWARE\WOW6432Node\MySQL AB\MySQL Server 8.3",
            "HKLM:\SOFTWARE\WOW6432Node\MySQL AB\MySQL Server 8.4"
        )
        
        foreach ($Key in $MySQLKeys) {
            if (Test-Path $Key) {
                $Location = (Get-ItemProperty -Path $Key -Name "Location" -ErrorAction SilentlyContinue).Location
                if ($Location) {
                    $MySQLExe = Join-Path $Location "bin\mysql.exe"
                    if (Test-Path $MySQLExe) {
                        Write-Log "INFO" "Found MySQL executable from registry: $MySQLExe"
                        return $MySQLExe
                    }
                }
            }
        }
    } catch {
        # Failed to check registry
    }
    
    Write-Log "INFO" "Searched all common MySQL installation paths but none found"
    return $null
}

function Get-MySQLVersion {
    param([string]$MySQLExePath)
    
    if (-not $MySQLExePath -or -not (Test-Path $MySQLExePath)) {
        return $null
    }
    
    try {
        # Try to get version using mysql --version
        $VersionOutput = & $MySQLExePath --version 2>&1
        if ($VersionOutput -match "Ver\s+(\d+)\.(\d+)\.(\d+)") {
            $MajorVersion = [int]$Matches[1]
            $MinorVersion = [int]$Matches[2]
            $PatchVersion = [int]$Matches[3]
            return @{
                Major = $MajorVersion
                Minor = $MinorVersion
                Patch = $PatchVersion
                Full = "$MajorVersion.$MinorVersion.$PatchVersion"
                Output = $VersionOutput
            }
        }
    } catch {
        # Failed to get version
    }
    
    return $null
}

function Test-MySQLInstalled {
    $MySQLExePath = Search-MySQLExecutable
    
    if (-not $MySQLExePath) {
        return $false
    }
    
    $Version = Get-MySQLVersion -MySQLExePath $MySQLExePath
    if (-not $Version) {
        return $false
    }
    
    # Check if version is 8.0 or higher
    if ($Version.Major -gt $RequiredMajorVersion -or 
        ($Version.Major -eq $RequiredMajorVersion -and $Version.Minor -ge $RequiredMinorVersion)) {
        return $true
    }
    
    return $false
}

function Test-MySQLService {
    try {
        $Service = Get-Service -Name "MySQL*" -ErrorAction SilentlyContinue
        if ($Service) {
            return $true
        }
    } catch {
        # Service check failed
    }
    return $false
}

function Test-ChocolateyInstalled {
    try {
        $null = Get-Command choco -ErrorAction SilentlyContinue
        if ($?) {
            # Verify Chocolatey is working
            $ChocoVersion = choco --version 2>&1
            if ($ChocoVersion -match "^\d+\.\d+") {
                Write-Log "INFO" "Chocolatey is installed, version: $ChocoVersion"
                return $true
            }
        }
    } catch {
        # Chocolatey not available
    }
    return $false
}

function Install-Chocolatey {
    Write-Log "INFO" "Chocolatey is not installed. Installing Chocolatey..."
    
    # Check if running as administrator
    $IsAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $IsAdmin) {
        Write-Log "ERROR" "Chocolatey installation requires administrator privileges."
        Write-Log "INFO" "Please run this script as administrator, or install Chocolatey manually:"
        Write-Log "INFO" "Visit: https://chocolatey.org/install"
        Write-Log "INFO" "Or run PowerShell as administrator and execute:"
        Write-Log "INFO" "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
        return $false
    }
    
    Write-Log "INFO" "Installing Chocolatey package manager..."
    try {
        # Set execution policy for this process
        Set-ExecutionPolicy Bypass -Scope Process -Force -ErrorAction SilentlyContinue
        
        # Set TLS 1.2 for secure download
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        
        # Download and execute Chocolatey installation script
        $ChocoInstallScript = "https://community.chocolatey.org/install.ps1"
        Write-Log "INFO" "Downloading Chocolatey installation script..."
        
        $InstallScript = Invoke-WebRequest -Uri $ChocoInstallScript -UseBasicParsing
        $ScriptContent = $InstallScript.Content
        
        # Execute the installation script
        Write-Log "INFO" "Executing Chocolatey installation script..."
        Invoke-Expression $ScriptContent
        
        # Wait a bit for installation to complete
        Start-Sleep -Seconds 5
        
        # Refresh PATH environment variable
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::Machine) + ";" + [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::User)
        
        # Verify installation
        if (Test-ChocolateyInstalled) {
            Write-Log "SUCCESS" "Chocolatey installed successfully"
            return $true
        } else {
            Write-Log "ERROR" "Chocolatey installation completed but verification failed"
            Write-Log "INFO" "Please try restarting PowerShell and running this script again"
            return $false
        }
    } catch {
        Write-Log "ERROR" "Failed to install Chocolatey: $($_.Exception.Message)"
        Write-Log "INFO" "You can install Chocolatey manually by visiting: https://chocolatey.org/install"
        Write-Log "INFO" "Or run PowerShell as administrator and execute:"
        Write-Log "INFO" "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
        return $false
    }
}

function Test-InternationalNetworkAccess {
    Write-Log "INFO" "Checking international network access..."
    
    # Test Google access (blocked in China, so if accessible, international access is available)
    $TestUrl = "https://www.google.com"
    $TestDescription = "Google (test site)"
    
    try {
        Write-Log "INFO" "Testing access to: $TestDescription ($TestUrl)"
        
        # Try HTTP request
        $null = Invoke-WebRequest -Uri $TestUrl -Method Head -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
        Write-Log "SUCCESS" "Successfully accessed: $TestDescription"
        Write-Log "SUCCESS" "International network access is available"
        return $true
    } catch {
        Write-Log "WARN" "Failed to access: $TestDescription - $($_.Exception.Message)"
        Write-Log "WARN" "International network access appears to be unavailable"
        Write-Log "INFO" "Will use offline installation method"
        return $false
    }
}

function Test-ZipFileIntegrity {
    param(
        [string]$ZipFilePath
    )
    
    if (-not (Test-Path $ZipFilePath)) {
        return $false
    }
    
    try {
        # Try to open the ZIP file to verify integrity
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $zip = [System.IO.Compression.ZipFile]::OpenRead($ZipFilePath)
        $null = $zip.Entries  # Access entries to trigger validation
        $zip.Dispose()
        return $true
    } catch {
        Write-Log "WARN" "ZIP file integrity check failed: $($_.Exception.Message)"
        return $false
    }
}

function Download-OfflineMySQLPackages {
    param(
        [string]$DownloadUrl,
        [string]$OutputDir
    )
    
    Write-Log "INFO" "Downloading MySQL offline installation package..."
    Write-Log "INFO" "Source URL: $DownloadUrl"
    Write-Log "INFO" "Output directory: $OutputDir"
    
    # Create output directory
    if (-not (Test-Path $OutputDir)) {
        New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    }
    
    $DownloadedFiles = @()
    
    # Download MySQL ZIP package directly
    $OutputPath = Join-Path $OutputDir $MYSQL_OFFLINE_ZIP_FILENAME
    
    # Check if the package already exists
    if (Test-Path $OutputPath) {
        $ExistingFileSize = (Get-Item $OutputPath).Length / 1MB
        $MinFileSizeMB = 10  # Minimum expected file size in MB
        
        if ($ExistingFileSize -ge $MinFileSizeMB) {
            Write-Log "INFO" "MySQL installation package already exists: $OutputPath"
            Write-Log "INFO" "File size: $([math]::Round($ExistingFileSize, 2)) MB"
            
            # Verify ZIP file integrity
            Write-Log "INFO" "Verifying ZIP file integrity..."
            $IsValid = Test-ZipFileIntegrity -ZipFilePath $OutputPath
            if ($IsValid) {
                Write-Log "SUCCESS" "ZIP file integrity verified, using existing package"
                $DownloadedFiles += $OutputPath
                Write-Output -NoEnumerate $DownloadedFiles
                return
            } else {
                Write-Log "WARN" "ZIP file is corrupted, will re-download"
                Remove-Item $OutputPath -Force -ErrorAction SilentlyContinue
            }
        } else {
            Write-Log "WARN" "Existing package file is too small ($([math]::Round($ExistingFileSize, 2)) MB), will re-download"
            Remove-Item $OutputPath -Force -ErrorAction SilentlyContinue
        }
    }
    
    Write-Log "INFO" "Downloading MySQL installation package..."
    $DownloadSucceeded = $false
    try {
        # Prefer BITS for download (much faster than Invoke-WebRequest for large files)
        try {
            Write-Log "INFO" "Using BITS for faster download..."
            Start-BitsTransfer -Source $DownloadUrl -Destination $OutputPath -Description "MySQL offline package" -DisplayName "MySQL" -ErrorAction Stop
            $DownloadSucceeded = $true
        } catch {
            Write-Log "WARN" "BITS download failed, trying curl: $($_.Exception.Message)"
            # Fall back to curl.exe (built-in on Windows 10+)
            $curlExe = Get-Command curl.exe -ErrorAction SilentlyContinue
            if ($curlExe) {
                & curl.exe -L -o "$OutputPath" "$DownloadUrl" 2>&1 | Out-Null
                if (Test-Path $OutputPath -PathType Leaf) {
                    $size = (Get-Item $OutputPath).Length
                    if ($size -gt 10MB) { $DownloadSucceeded = $true }
                }
            }
        }
        if (-not $DownloadSucceeded) {
            Write-Log "INFO" "Using Invoke-WebRequest..."
            $ProgressPreference = 'Continue'
            Invoke-WebRequest -Uri $DownloadUrl -OutFile $OutputPath -UseBasicParsing -ErrorAction Stop
            $ProgressPreference = 'SilentlyContinue'
            $DownloadSucceeded = $true
        }
    } catch {
        Write-Log "ERROR" "Failed to download MySQL installation package: $($_.Exception.Message)"
        return $null
    }
    
    try {
        if (Test-Path $OutputPath) {
            $FileSize = (Get-Item $OutputPath).Length / 1MB
            Write-Log "SUCCESS" "Downloaded MySQL installation package ($([math]::Round($FileSize, 2)) MB)"
            
            # Verify downloaded ZIP file integrity
            Write-Log "INFO" "Verifying downloaded ZIP file integrity..."
            $IsValid = Test-ZipFileIntegrity -ZipFilePath $OutputPath
            if ($IsValid) {
                Write-Log "SUCCESS" "Downloaded ZIP file integrity verified"
                $DownloadedFiles += $OutputPath
                Write-Output -NoEnumerate $DownloadedFiles
                return
            } else {
                Write-Log "ERROR" "Downloaded ZIP file is corrupted, please check your network connection and try again"
                Remove-Item $OutputPath -Force -ErrorAction SilentlyContinue
                return $null
            }
        } else {
            Write-Log "ERROR" "Download failed: File not found after download"
            return $null
        }
    } catch {
        Write-Log "ERROR" "Failed to download MySQL installation package: $($_.Exception.Message)"
        return $null
    }
}

function Install-MySQLOffline {
    # Offline package is downloaded to script directory
    $PackageDir = $PSScriptRoot
    
    Write-Log "INFO" "Starting offline installation of MySQL..."
    Write-Log "INFO" "Package directory: $PackageDir"
    
    # Create package directory if it doesn't exist (script dir usually exists)
    if (-not (Test-Path $PackageDir)) {
        New-Item -ItemType Directory -Path $PackageDir -Force | Out-Null
    }
    
    # Check if ZIP file exists, download if not
    $ZipFile = Join-Path $PackageDir $MYSQL_OFFLINE_ZIP_FILENAME
    
    if (-not (Test-Path $ZipFile)) {
        Write-Log "INFO" "MySQL installation package not found, downloading..."
        $DownloadedFiles = Download-OfflineMySQLPackages -DownloadUrl $MYSQL_OFFLINE_PACKAGE_URL -OutputDir $PackageDir
        if ($DownloadedFiles -and @($DownloadedFiles).Count -gt 0) {
            $ZipFile = @($DownloadedFiles)[0]
            Write-Log "SUCCESS" "MySQL installation package downloaded successfully"
        } else {
            Write-Log "ERROR" "Failed to download MySQL installation package"
            return $false
        }
    }
    
    try {
        Write-Log "INFO" "Extracting MySQL offline installation package..."
        
        # Verify ZIP file integrity before extraction
        Write-Log "INFO" "Verifying ZIP file integrity before extraction..."
        $IsValid = Test-ZipFileIntegrity -ZipFilePath $ZipFile
        if (-not $IsValid) {
            Write-Log "ERROR" "ZIP file is corrupted: $ZipFile"
            Write-Log "INFO" "The ZIP file may be incomplete or damaged. Attempting to delete and re-download..."
            
            # Delete corrupted file
            try {
                Remove-Item $ZipFile -Force -ErrorAction Stop
                Write-Log "INFO" "Corrupted ZIP file deleted: $ZipFile"
            } catch {
                Write-Log "WARN" "Failed to delete corrupted file: $($_.Exception.Message)"
            }
            
            # Try to re-download
            Write-Log "INFO" "Attempting to re-download the package..."
            $DownloadedFiles = Download-OfflineMySQLPackages -DownloadUrl $MYSQL_OFFLINE_PACKAGE_URL -OutputDir $PackageDir
            if ($DownloadedFiles -and @($DownloadedFiles).Count -gt 0) {
                $ZipFile = @($DownloadedFiles)[0]
                Write-Log "SUCCESS" "Package re-downloaded successfully, retrying extraction..."
            } else {
                Write-Log "ERROR" "Failed to re-download the package. Please check your network connection."
                return $false
            }
        }
        
        # Extract ZIP file to a temporary directory
        $ExtractDir = Join-Path $env:TEMP "mysql_extract_$(Get-Date -Format 'yyyyMMddHHmmss')"
        if (-not (Test-Path $ExtractDir)) {
            New-Item -ItemType Directory -Path $ExtractDir -Force | Out-Null
        }
        
        # Extract ZIP file with error handling
        try {
            Expand-Archive -Path $ZipFile -DestinationPath $ExtractDir -Force -ErrorAction Stop
        } catch {
            Write-Log "ERROR" "Failed to extract ZIP file: $($_.Exception.Message)"
            Write-Log "ERROR" "The ZIP file may be corrupted. Error details: $($_.Exception.GetType().FullName)"
            if ($_.Exception.Message -match "中央目录结尾记录|找不到中央目录|corrupted|损坏|End of central directory|central directory") {
                Write-Log "ERROR" "ZIP file is corrupted. Please delete the file and try again:"
                Write-Log "INFO" "  File location: $ZipFile"
                Write-Log "INFO" "  You can delete it manually or the script will attempt to re-download it on next run"
            }
            return $false
        }
        
        Write-Log "INFO" "MySQL package extracted to: $ExtractDir"
        
        # Find mysql_choco_package directory
        $OfflinePackagesDir = Join-Path $ExtractDir "mysql_choco_package"
        if (-not (Test-Path $OfflinePackagesDir)) {
            Write-Log "ERROR" "Could not find mysql_choco_package directory in extracted files"
            Write-Log "INFO" "Extract directory contents:"
            Get-ChildItem -Path $ExtractDir | ForEach-Object {
                $ItemType = if ($_.PSIsContainer) { "Directory" } else { "File" }
                Write-Log "INFO" "  - $($_.Name) ($ItemType)"
            }
            return $false
        }
        
        Write-Log "INFO" "Found offline packages directory: $OfflinePackagesDir"
        
        # Check for .nupkg file
        $NupkgFile = Join-Path $OfflinePackagesDir "mysql.$MYSQL_CHOCO_PACKAGE_VERSION.nupkg"
        if (-not (Test-Path $NupkgFile)) {
            Write-Log "ERROR" "Chocolatey package file not found: $NupkgFile"
            Write-Log "INFO" "Available files in offline packages directory:"
            Get-ChildItem -Path $OfflinePackagesDir | ForEach-Object {
                Write-Log "INFO" "  - $($_.Name)"
            }
            return $false
        }
        
        Write-Log "INFO" "Found Chocolatey package file: $NupkgFile"
        
        # Install MySQL using Chocolatey from local source
        Write-Log "INFO" "Installing MySQL using Chocolatey from local source..."
        Write-Log "INFO" "This may take several minutes, please wait..."
        Write-Log "INFO" "Chocolatey command: choco install mysql --version=$MYSQL_CHOCO_PACKAGE_VERSION --yes --force --source $OfflinePackagesDir"
        
        # Install from local directory using Chocolatey - output directly to console
        Write-Log "INFO" "Starting Chocolatey installation process..."
        $ChocoOutput = ""
        
        try {
            # Execute choco install with version specified and capture output while displaying it in real-time
            & choco install mysql --version=$MYSQL_CHOCO_PACKAGE_VERSION --yes --force --source $OfflinePackagesDir 2>&1 | ForEach-Object {
                $line = $_.ToString()
                if ($line -and $line.Trim() -ne "") {
                    Write-Log "INFO" "  > $($line.Trim())"
                    $ChocoOutput += $line + "`n"
                    
                    # Check if Chocolatey is attempting to download from network
                    if ($line -match "Downloading.*from 'https?://" -or $line -match "Attempt to get headers for https?://") {
                        Write-Log "WARN" "Chocolatey is attempting to download from network"
                    }
                }
            }
            
            Write-Log "INFO" "Chocolatey installation process completed"
            
        } catch {
            Write-Log "ERROR" "Installation failed: $($_.Exception.Message)"
            if ($_.Exception.Message) {
                Write-Log "ERROR" "Error details: $($_.Exception.Message)"
            }
            $ChocoOutput = $_.Exception.ToString()
        }
        
        # Check if installation was successful - need to verify both success and no failures
        $InstallSuccess = $false
        $HasFailure = $false
        
        # Check for failure indicators first
        if ($ChocoOutput -match "packages failed|not installed\.|The package was not found|1 packages failed") {
            $HasFailure = $true
            Write-Log "WARN" "Chocolatey installation detected failures in output"
        }
        
        # Check for success indicators
        if ($ChocoOutput -match "Chocolatey installed \d+/\d+ packages") {
            $Match = $ChocoOutput | Select-String "Chocolatey installed (\d+)/(\d+) packages"
            if ($Match) {
                $Installed = [int]$Match.Matches[0].Groups[1].Value
                $Total = [int]$Match.Matches[0].Groups[2].Value
                if ($Installed -gt 0 -and $Installed -eq $Total -and -not $HasFailure) {
                    $InstallSuccess = $true
                    Write-Log "INFO" "Chocolatey installed $Installed/$Total packages successfully"
                } else {
                    Write-Log "WARN" "Chocolatey installed $Installed/$Total packages (expected $Total)"
                    if ($Installed -eq 0) {
                        $HasFailure = $true
                    }
                }
            }
        }
        
        # Also check for other success messages
        if (-not $InstallSuccess -and -not $HasFailure) {
            if ($ChocoOutput -match "mysql has been (installed|successfully installed)" -or
                $ChocoOutput -match "The install of mysql was successful") {
                $InstallSuccess = $true
            }
        }
        
        if ($HasFailure) {
            $InstallSuccess = $false
            Write-Log "ERROR" "Chocolatey installation failed - packages were not installed successfully"
        }
        
        # Refresh environment variables
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::Machine) + ";" + [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::User)
        Start-Sleep -Seconds 10
        
        # Search for MySQL executable first - this is the most reliable check
        $MySQLExePath = Search-MySQLExecutable
        if ($MySQLExePath) {
            Write-Log "SUCCESS" "MySQL installed successfully via offline installation at: $MySQLExePath"
            # Clean up extracted files only after successful installation
            Remove-Item -Path $ExtractDir -Recurse -Force -ErrorAction SilentlyContinue
            return $true
        }
        
        # If executable not found, check installation status
        if ($InstallSuccess) {
            Write-Log "WARN" "Chocolatey reported success but MySQL executable not found"
            Write-Log "INFO" "This may indicate the package was installed but MySQL needs additional configuration"
            Write-Log "INFO" "Waiting a bit longer and checking again..."
            Start-Sleep -Seconds 5
            $MySQLExePath = Search-MySQLExecutable
            if ($MySQLExePath) {
                Write-Log "SUCCESS" "MySQL found after additional wait: $MySQLExePath"
                Remove-Item -Path $ExtractDir -Recurse -Force -ErrorAction SilentlyContinue
                return $true
            } else {
                Write-Log "ERROR" "MySQL executable still not found after installation"
                Write-Log "INFO" "Please check if MySQL was installed correctly"
                # Don't clean up on failure - keep files for debugging
                return $false
            }
        } else {
            Write-Log "ERROR" "Offline installation failed - Chocolatey did not install packages successfully"
            Write-Log "INFO" "Please check the Chocolatey output above for error details"
            # Don't clean up on failure - keep files for debugging
            return $false
        }
    } catch {
        Write-Log "ERROR" "Offline installation failed: $($_.Exception.Message)"
        return $false
    }
}

function Install-MySQL {
    Write-Log "INFO" "Starting automatic installation of MySQL 8.0+"
    
    # Check if Chocolatey is available (preferred method)
    $ChocoAvailable = Test-ChocolateyInstalled
    
    # If Chocolatey is not available, try to install it
    if (-not $ChocoAvailable) {
        Write-Log "INFO" "Chocolatey is not installed. Attempting to install Chocolatey..."
        $ChocoInstalled = Install-Chocolatey
        if ($ChocoInstalled) {
            $ChocoAvailable = $true
            Write-Log "INFO" "Chocolatey installed successfully, will use it to install MySQL"
        } else {
            Write-Log "WARN" "Chocolatey installation failed or was skipped. Will use manual installation method."
        }
    }
    
    # Try automatic installation if Chocolatey is available
    if ($ChocoAvailable) {
        # Check if running as administrator (required for Chocolatey package installation)
        $IsAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
        if (-not $IsAdmin) {
            Write-Log "WARN" "Chocolatey package installation requires administrator privileges."
            Write-Log "INFO" "Please run this script as administrator to install MySQL via Chocolatey."
            Write-Log "INFO" "Falling back to manual installation method..."
        } else {
            # Priority 1: Try offline installation first (offline package is in script directory)
            Write-Log "INFO" "Attempting offline installation method first..."
            $OfflineInstalled = Install-MySQLOffline
            if ($OfflineInstalled) {
                $MySQLExePath = Search-MySQLExecutable
                if ($MySQLExePath) {
                    Write-Log "SUCCESS" "MySQL installed successfully via offline installation"
                    return
                } else {
                    Write-Log "WARN" "Offline installation reported success but MySQL executable not found"
                    Write-Log "INFO" "Falling back to online installation method..."
                }
            } else {
                Write-Log "WARN" "Offline installation failed, falling back to online installation method..."
            }
            
            # Priority 2: Fallback to online installation if offline installation failed
            Write-Log "INFO" "Attempting online installation via Chocolatey..."
            Write-Log "INFO" "Note: This may take several minutes and requires administrator privileges"
            try {
                # Try to install MySQL using Chocolatey with --force to ensure clean installation
                Write-Log "INFO" "Attempting to install MySQL via Chocolatey (using --force to reinstall if needed)..."
                Write-Log "INFO" "This may take several minutes. Please wait..."
                Write-Host ""
                
                # Execute choco install with filtered output
                $TempOutputFile = Join-Path $env:TEMP "choco_mysql_output_$(Get-Date -Format 'yyyyMMddHHmmss').txt"
                
                try {
                    $LastProgressPercent = -1
                    & choco install mysql --yes --force --no-progress 2>&1 | ForEach-Object {
                        $Line = $_
                        Add-Content -Path $TempOutputFile -Value $Line -ErrorAction SilentlyContinue
                        
                        if ($Line -and $Line.Trim() -ne "") {
                            if ($Line -match "Progress:\s*Downloading.*?\.\.\.\s*(\d+)%") {
                                $ProgressPercent = [int]$Matches[1]
                                if ($ProgressPercent -eq 0 -or $ProgressPercent -eq 25 -or $ProgressPercent -eq 50 -or $ProgressPercent -eq 75 -or $ProgressPercent -eq 100) {
                                    if ($LastProgressPercent -ne $ProgressPercent) {
                                        Write-Host $Line
                                        $LastProgressPercent = $ProgressPercent
                                    }
                                }
                            } elseif ($Line -notmatch "^\s*Progress:\s*") {
                                Write-Host $Line
                            }
                        }
                    }
                    
                    if (Test-Path $TempOutputFile) {
                        $ChocoOutput = Get-Content $TempOutputFile -Raw
                    } else {
                        $ChocoOutput = ""
                    }
                } catch {
                    Write-Log "ERROR" "Failed to execute Chocolatey command: $($_.Exception.Message)"
                    if (Test-Path $TempOutputFile) {
                        $FileContent = Get-Content $TempOutputFile -Raw -ErrorAction SilentlyContinue
                        if ($FileContent) {
                            $ChocoOutput = $FileContent
                        } else {
                            $ChocoOutput = $_.Exception.Message
                        }
                    } else {
                        $ChocoOutput = $_.Exception.Message
                    }
                } finally {
                    if (Test-Path $TempOutputFile) {
                        Remove-Item $TempOutputFile -ErrorAction SilentlyContinue
                    }
                }
                
                Write-Host ""
                Write-Log "INFO" "Chocolatey installation command completed."
                
                # Check if installation was successful
                $InstallSuccess = $false
                $HasError = $false
                
                if ($ChocoOutput -match "Chocolatey installed \d+/\d+ packages") {
                    $Match = $ChocoOutput | Select-String "Chocolatey installed (\d+)/(\d+) packages"
                    if ($Match) {
                        $Installed = [int]$Match.Matches[0].Groups[1].Value
                        $Total = [int]$Match.Matches[0].Groups[2].Value
                        if ($Installed -gt 0 -and $Installed -eq $Total) {
                            $InstallSuccess = $true
                        } elseif ($Total -gt 0 -and $Installed -lt $Total) {
                            $HasError = $true
                        }
                    }
                }
                
                if ($ChocoOutput -match "mysql has been (installed|successfully installed)" -or 
                    $ChocoOutput -match "The install of mysql was successful" -or
                    $ChocoOutput -match "mysql \d+\.\d+.*installed") {
                    $InstallSuccess = $true
                }
                
                if ($ChocoOutput -match "not installed|failed|error|timeout|not found") {
                    $HasError = $true
                }
                
                if ($ChocoOutput -match "timeout|unable to connect|failed to fetch") {
                    $HasError = $true
                    Write-Log "ERROR" "Chocolatey installation failed due to network issues"
                    Write-Log "INFO" "Please check your internet connection and try again"
                }
                
                # Refresh environment variables
                $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::Machine) + ";" + [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::User)
                Start-Sleep -Seconds 10
                
                # Search for MySQL executable
                $MySQLExePath = Search-MySQLExecutable
                
                if ($MySQLExePath) {
                    Write-Log "SUCCESS" "MySQL installed successfully at: $MySQLExePath"
                    return
                } elseif ($InstallSuccess) {
                    Write-Log "SUCCESS" "MySQL installation via Chocolatey completed"
                    Write-Log "INFO" "Checking for MySQL executable..."
                    $MySQLExePath = Search-MySQLExecutable
                    if ($MySQLExePath) {
                        Write-Log "SUCCESS" "MySQL found at: $MySQLExePath"
                        return
                    } else {
                        Write-Log "WARN" "MySQL executable not found after Chocolatey installation"
                        Write-Log "INFO" "The package may have been installed but MySQL may need to be configured"
                    }
                } elseif ($HasError) {
                    Write-Log "WARN" "MySQL installation via Chocolatey failed"
                    Write-Log "INFO" "Chocolatey may not have the MySQL package, or there was a network issue"
                } else {
                    Write-Log "WARN" "MySQL executable not found after Chocolatey installation"
                    Write-Log "INFO" "The package may have been installed but MySQL may need to be configured"
                }
            } catch {
                Write-Log "WARN" "Chocolatey installation failed: $($_.Exception.Message)"
            }
        }
    }
    
    # Fallback: Manual installation guide
    Write-Log "INFO" "Automatic installation requires manual steps"
    Write-Log "INFO" "Please install MySQL 8.0+ using one of the following methods:"
    Write-Log "INFO" ""
    Write-Log "INFO" "Method 1: Download MySQL Installer"
    Write-Log "INFO" "  1. Visit: https://dev.mysql.com/downloads/installer/"
    Write-Log "INFO" "  2. Download 'MySQL Installer for Windows'"
    Write-Log "INFO" "  3. Run the installer and select 'MySQL Server 8.0+'"
    Write-Log "INFO" "  4. Complete the installation wizard"
    Write-Log "INFO" ""
    Write-Log "INFO" "Method 2: Use Chocolatey (if available)"
    Write-Log "INFO" "  Run: choco install mysql --version=8.4.6 -y"
    Write-Log "INFO" ""
    Write-Log "INFO" "Method 3: Download MySQL Server MSI directly"
    Write-Log "INFO" "  Visit: https://dev.mysql.com/downloads/mysql/"
    Write-Log "INFO" "  Download MySQL Server 8.0+ Windows (x86, 64-bit), MSI Installer"
    Write-Log "INFO" ""
    
    # Ask user if they want to proceed with manual installation
    $UserInput = Read-Host -Prompt "Have you installed MySQL 8.0+? (Y/N)"
    if ($UserInput -notmatch "^[Yy]") {
        Write-Log "ERROR" "MySQL 8.0+ installation is required. Please install MySQL and run this script again."
        exit 1
    }
    
    # Wait a bit for user to complete installation
    Write-Log "INFO" "Waiting 5 seconds for MySQL installation to complete..."
    Start-Sleep -Seconds 5
    
    # Refresh environment variables
    Write-Log "INFO" "Refreshing environment variables..."
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::Machine) + ";" + [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::User)
    
    # Search for MySQL executable multiple times
    $Retries = 5
    $MySQLExePath = $null
    
    for ($i = 1; $i -le $Retries; $i++) {
        Write-Log "INFO" "Searching for MySQL executable (attempt $i/$Retries)..."
        $MySQLExePath = Search-MySQLExecutable
        if ($MySQLExePath) {
            break
        }
        Write-Log "INFO" "MySQL executable not found, waiting 5 seconds and trying again..."
        Start-Sleep -Seconds 5
    }
    
    if ($MySQLExePath) {
        # Add MySQL path to current session PATH
        $MySQLDir = Split-Path -Parent $MySQLExePath
        $MySQLBinDir = Split-Path -Parent $MySQLDir
        if ($env:PATH -notlike "*$MySQLBinDir*") {
            $env:PATH = "$MySQLBinDir;$env:PATH"
        }
        
        # Test the direct path
        try {
            $Version = Get-MySQLVersion -MySQLExePath $MySQLExePath
            if ($Version) {
                Write-Log "INFO" "MySQL version check: $($Version.Output)"
            }
        } catch {
            Write-Log "WARN" "Failed to check MySQL version via direct path: $($_.Exception.Message)"
        }
    } else {
        Write-Log "ERROR" "MySQL executable not found after installation"
        Write-Log "INFO" "Please check if MySQL was installed correctly and try again"
        Write-Log "INFO" "Common MySQL installation paths:"
        Write-Log "INFO" "- C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
        Write-Log "INFO" "- C:\Program Files (x86)\MySQL\MySQL Server 8.0\bin\mysql.exe"
        exit 1
    }
}

function Set-MySQLRootPassword {
    param(
        [string]$MySQLExePath,
        [bool]$IsNewlyInstalled = $false
    )
    
    Write-Log "INFO" "Configuring MySQL root password..."
    
    # Ensure MySQL service is running
    $Service = Get-Service -Name "MySQL*" -ErrorAction SilentlyContinue
    if ($Service -and $Service.Status -ne "Running") {
        Write-Log "INFO" "Starting MySQL service..."
        try {
            Start-Service -Name $Service.Name -ErrorAction Stop
            Start-Sleep -Seconds 5
            Write-Log "SUCCESS" "MySQL service started"
        } catch {
            Write-Log "WARN" "Failed to start MySQL service: $($_.Exception.Message)"
            Write-Log "INFO" "Please start MySQL service manually and try again"
            return $false
        }
    }
    
    # Wait a bit for MySQL to be ready
    Write-Log "INFO" "Waiting for MySQL to be ready..."
    Start-Sleep -Seconds 5
    
    # Use the IsNewlyInstalled parameter directly (passed from caller)
    $IsNewInstallation = $IsNewlyInstalled
    
    $RootPassword = $null
    
    if ($IsNewInstallation) {
        # New installation: ask user to set MySQL root password
        Write-Log "INFO" "Detected newly installed MySQL, please set root password"
        
        $PasswordConfirmed = $false
        while (-not $PasswordConfirmed) {
            $SecurePassword = Read-Host -Prompt "Please enter MySQL root password" -AsSecureString
            $Password1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword))
            
            if ([string]::IsNullOrWhiteSpace($Password1)) {
                Write-Log "WARN" "Password cannot be empty, please try again"
                continue
            }
            
            $SecurePassword2 = Read-Host -Prompt "Please confirm MySQL root password" -AsSecureString
            $Password2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword2))
            
            if ($Password1 -eq $Password2) {
                $RootPassword = $Password1
                $PasswordConfirmed = $true
                Write-Log "SUCCESS" "Password confirmed"
            } else {
                Write-Log "WARN" "Passwords do not match, please try again"
            }
        }
    } else {
        # Existing installation: ask user to enter MySQL root password
        Write-Log "INFO" "Detected existing MySQL installation, please enter root password"
        
        $PasswordEntered = $false
        $MaxAttempts = 3
        $Attempts = 0
        
        while (-not $PasswordEntered -and $Attempts -lt $MaxAttempts) {
            $SecurePassword = Read-Host -Prompt "Please enter MySQL root password" -AsSecureString
            $RootPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword))
            
            if ([string]::IsNullOrWhiteSpace($RootPassword)) {
                Write-Log "WARN" "Password cannot be empty, please try again"
                $Attempts++
                continue
            }
            
            # Verify the password by trying to connect
            try {
                $TestSQL = "SELECT 1;"
                $env:MYSQL_PWD = $RootPassword
                $TestResult = $TestSQL | & $MySQLExePath -u root -h $DB_HOST -P $DB_PORT 2>&1 | Out-String
                Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
                
                if ($LASTEXITCODE -eq 0 -and $TestResult -notmatch "Access denied|error|1045") {
                    $PasswordEntered = $true
                    Write-Log "SUCCESS" "MySQL root password verified"
                } else {
                    $Attempts++
                    if ($Attempts -lt $MaxAttempts) {
                        Write-Log "WARN" "Password verification failed, please try again [$Attempts/$MaxAttempts]"
                    } else {
                        Write-Log "ERROR" "Too many failed password attempts"
                        return $false
                    }
                }
            } catch {
                Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
                $Attempts++
                if ($Attempts -lt $MaxAttempts) {
                    Write-Log "WARN" "Password verification failed, please try again [$Attempts/$MaxAttempts]"
                } else {
                    Write-Log "ERROR" "Too many failed password attempts"
                    return $false
                }
            }
        }
        
        if (-not $PasswordEntered) {
            Write-Log "ERROR" "Unable to verify MySQL root password"
            return $false
        }
    }
    
    # If this is a new installation, set the password
    if ($IsNewInstallation) {
        Write-Log "INFO" "Setting MySQL root password..."
        
        # Escape the password for SQL
        $EscapedPassword = $RootPassword -replace "'", "''"
        $SetPasswordSQL = "ALTER USER 'root'@'localhost' IDENTIFIED BY '$EscapedPassword'; FLUSH PRIVILEGES;"
        
        try {
            # Try connecting without password to set the new password
            $Result = $SetPasswordSQL | & $MySQLExePath -u root -h $DB_HOST -P $DB_PORT 2>&1 | Out-String
            if ($LASTEXITCODE -eq 0 -and $Result -notmatch "Access denied|error|1045") {
                Write-Log "SUCCESS" "MySQL root password set successfully"
            } else {
                # Try using mysqladmin
                $MySQLAdminPath = Join-Path (Split-Path -Parent $MySQLExePath) "mysqladmin.exe"
                if (Test-Path $MySQLAdminPath) {
                    Write-Log "INFO" "Trying to set password using mysqladmin..."
                    $AdminResult = & $MySQLAdminPath -u root -h $DB_HOST -P $DB_PORT password $RootPassword 2>&1 | Out-String
                    if ($LASTEXITCODE -eq 0) {
                        Write-Log "SUCCESS" "MySQL root password set using mysqladmin"
                    } else {
                        Write-Log "WARN" "Could not automatically set MySQL root password"
                        Write-Log "INFO" "Please set password manually"
                        return $false
                    }
                } else {
                    Write-Log "WARN" "Could not automatically set MySQL root password"
                    return $false
                }
            }
        } catch {
            Write-Log "WARN" "Error setting password: $($_.Exception.Message)"
            return $false
        }
        
        # Verify the password was set correctly
        Start-Sleep -Seconds 2
        try {
            $VerifySQL = "SELECT 1;"
            $env:MYSQL_PWD = $RootPassword
            $VerifyResult = $VerifySQL | & $MySQLExePath -u root -h $DB_HOST -P $DB_PORT 2>&1 | Out-String
            Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
            if ($LASTEXITCODE -eq 0) {
                Write-Log "SUCCESS" "MySQL root password verified"
            } else {
                Write-Log "WARN" "Password verification failed after setting"
                return $false
            }
        } catch {
            Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
            Write-Log "WARN" "Password verification failed after setting"
            return $false
        }
    }
    
    # Set MYSQL_PWD environment variable
    if ($RootPassword) {
        $env:MYSQL_PWD = $RootPassword
        Write-Log "SUCCESS" "MySQL root password set to MYSQL_PWD environment variable"
        return $true
    } else {
        Write-Log "ERROR" "Unable to get MySQL root password"
        return $false
    }
}

function Verify-MySQL {
    param(
        [bool]$IsNewlyInstalled = $false
    )
    
    $MySQLExePath = Search-MySQLExecutable
    
    if (-not $MySQLExePath) {
        Write-Log "ERROR" "MySQL executable not found after installation"
        exit 1
    }
    
    # Set MySQL executable path to environment variable for other scripts to use
    $env:MYSQL_EXE_PATH = $MySQLExePath
    Write-Log "INFO" "MySQL executable path set to environment variable: $MySQLExePath"
    
    $Version = Get-MySQLVersion -MySQLExePath $MySQLExePath
    if (-not $Version) {
        Write-Log "ERROR" "Failed to get MySQL version"
        exit 1
    }
    
    # Check if version meets requirements
    if ($Version.Major -gt $RequiredMajorVersion -or 
        ($Version.Major -eq $RequiredMajorVersion -and $Version.Minor -ge $RequiredMinorVersion)) {
        Write-Log "SUCCESS" "MySQL installed successfully! Version: $($Version.Full)"
        Write-Log "INFO" "MySQL executable path: $MySQLExePath"
        
        # Check MySQL service
        if (Test-MySQLService) {
            Write-Log "INFO" "MySQL service is installed"
            $Service = Get-Service -Name "MySQL*" -ErrorAction SilentlyContinue
            if ($Service) {
                Write-Log "INFO" "MySQL service status: $($Service.Status)"
                if ($Service.Status -ne "Running") {
                    Write-Log "INFO" "Starting MySQL service..."
                    try {
                        Start-Service -Name $Service.Name -ErrorAction Stop
                        Start-Sleep -Seconds 5
                        $Service.Refresh()
                        if ($Service.Status -eq "Running") {
                            Write-Log "SUCCESS" "MySQL service started"
                        } else {
                            throw "Service started but status is still $($Service.Status)"
                        }
                    } catch {
                        Write-Log "WARN" "Failed to start MySQL service: $($_.Exception.Message)"
                        Write-Log "INFO" "You may need to start it manually: Start-Service -Name `"$($Service.Name)`""
                    }
                }
            }
        } else {
            Write-Log "WARN" "MySQL service not found. You may need to configure MySQL service manually."
        }
        
        # Set root password (will prompt user for input or to set password)
        $PasswordSet = Set-MySQLRootPassword -MySQLExePath $MySQLExePath -IsNewlyInstalled $IsNewlyInstalled
        
        # Note: Database creation is handled by config_mysql.ps1, which will be called later in the setup process
    } else {
        Write-Log "ERROR" "MySQL version $($Version.Full) does not meet requirement (8.0+)"
        exit 1
    }
}

function Start-MySQLCheck {
    Write-Log "INFO" "=== Checking MySQL 8.0+ Installation Status ==="
    
    # First search for MySQL executable
    $MySQLExePath = Search-MySQLExecutable
    $MySQLInstalled = $false
    $MySQLWasNewlyInstalled = $false
    
    if ($MySQLExePath) {
        $Version = Get-MySQLVersion -MySQLExePath $MySQLExePath
        if ($Version) {
            # Check if version meets requirements
            if ($Version.Major -gt $RequiredMajorVersion -or 
                ($Version.Major -eq $RequiredMajorVersion -and $Version.Minor -ge $RequiredMinorVersion)) {
                Write-Log "SUCCESS" "MySQL $($Version.Full) already installed, Version: $($Version.Output)"
                $MySQLInstalled = $true
            } else {
                Write-Log "WARN" "MySQL found but version is $($Version.Full), required: 8.0+"
                $MySQLInstalled = $false
            }
        } else {
            Write-Log "WARN" "MySQL found but failed to get version"
            $MySQLInstalled = $false
        }
    }
    
    # Check if MySQL is installed using Test-MySQLInstalled
    if (-not $MySQLInstalled) {
        $MySQLInstalled = Test-MySQLInstalled
    }
    
    if (-not $MySQLInstalled) {
        Write-Log "WARN" "MySQL 8.0+ not installed"
        Install-MySQL
        # After installation, search for MySQL again
        $MySQLExePath = Search-MySQLExecutable
        if ($MySQLExePath) {
            $Version = Get-MySQLVersion -MySQLExePath $MySQLExePath
            if ($Version) {
                if ($Version.Major -gt $RequiredMajorVersion -or 
                    ($Version.Major -eq $RequiredMajorVersion -and $Version.Minor -ge $RequiredMinorVersion)) {
                    Write-Log "SUCCESS" "MySQL installed successfully, Version: $($Version.Full)"
                    $MySQLInstalled = $true
                    $MySQLWasNewlyInstalled = $true
                } else {
                    Write-Log "ERROR" "MySQL installed but version is $($Version.Full), required: 8.0+"
                    return $false
                }
            } else {
                Write-Log "ERROR" "MySQL installation failed - cannot verify version"
                return $false
            }
        } else {
            Write-Log "ERROR" "MySQL installation failed - executable not found"
            return $false
        }
    }
    
    # Verify MySQL installation and ensure MySQL executable path is set
    if (-not $MySQLExePath) {
        $MySQLExePath = Search-MySQLExecutable
    }
    
    if ($MySQLExePath) {
        Verify-MySQL -IsNewlyInstalled $MySQLWasNewlyInstalled
        
        # Output MySQL executable path for other scripts to use
        Write-Output "MYSQL_EXE_PATH=$MySQLExePath"
        
        # Also output MySQL bin directory
        $MySQLBinDir = Split-Path -Parent $MySQLExePath
        Write-Output "MYSQL_BIN_DIR=$MySQLBinDir"
    } else {
        Write-Log "ERROR" "MySQL executable path not found"
        return $false
    }
    
    Write-Log "SUCCESS" "=== Operation Completed ==="
    return $true
}

# Script entry point
$Result = Start-MySQLCheck
if (-not $Result) {
    exit 1
}
exit 0

