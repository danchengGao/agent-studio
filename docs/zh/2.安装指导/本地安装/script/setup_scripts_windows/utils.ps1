# PowerShell Utility Functions for Agent-Studio Deployment Scripts
# This file contains shared utility functions used by setup scripts

# Load optional user_config.ps1 and apply session environment variables (proxy, uv index, etc.)
function Apply-UserEnvironmentConfig {
    param(
        [string]$WorkHome
    )

    if ([string]::IsNullOrEmpty($WorkHome)) {
        return
    }

    $UserConfig = Join-Path $WorkHome "user_config.ps1"
    if (-not (Test-Path $UserConfig)) {
        return
    }

    try {
        $UserConfigContent = Get-Content -Path $UserConfig -Raw -Encoding UTF8
    } catch {
        Write-Log "WARN" "Failed to read user_config.ps1: $($_.Exception.Message)"
        return
    }

    $HTTP_PROXY = ""
    $HTTPS_PROXY = ""
    $ENABLE_SESSION_ENV_PROXY = "true"
    if ($UserConfigContent -match '(?m)^\s*\$HTTP_PROXY\s*=\s*["''](.*?)["'']\s*$') { $HTTP_PROXY = $Matches[1] }
    if ($UserConfigContent -match '(?m)^\s*\$HTTPS_PROXY\s*=\s*["''](.*?)["'']\s*$') { $HTTPS_PROXY = $Matches[1] }
    if ($UserConfigContent -match '(?m)^\s*\$ENABLE_SESSION_ENV_PROXY\s*=\s*["''](.*?)["'']\s*$') { $ENABLE_SESSION_ENV_PROXY = $Matches[1] }

    $EnableSessionEnvProxy = $true
    if (-not [string]::IsNullOrWhiteSpace($ENABLE_SESSION_ENV_PROXY) -and "$ENABLE_SESSION_ENV_PROXY".Trim() -match '^(?i:false|0|no)$') {
        $EnableSessionEnvProxy = $false
    }

    if ($EnableSessionEnvProxy) {
        if (-not [string]::IsNullOrEmpty($HTTP_PROXY)) {
            $env:HTTP_PROXY = $HTTP_PROXY
            $env:http_proxy = $HTTP_PROXY
            Write-Log "INFO" "HTTP proxy applied for this session: $HTTP_PROXY"
        }

        if (-not [string]::IsNullOrEmpty($HTTPS_PROXY)) {
            $env:HTTPS_PROXY = $HTTPS_PROXY
            $env:https_proxy = $HTTPS_PROXY
            Write-Log "INFO" "HTTPS proxy applied for this session: $HTTPS_PROXY"
        }
    } else {
        Write-Log "INFO" "Skip applying session proxy environment variables (ENABLE_SESSION_ENV_PROXY=$ENABLE_SESSION_ENV_PROXY)"
    }

}

# Max length for a single log line; longer messages are truncated to avoid Write-Host "index out of array" errors
$SCRIPT:MaxLogMessageLength = 4000

function Write-Log {
    <#
    .SYNOPSIS
    Writes a log message with timestamp and color coding.
    
    .DESCRIPTION
    Outputs a formatted log message with timestamp, level, and color-coded output.
    Also writes to log file if $LOG_FILE is defined.
    Messages longer than $MaxLogMessageLength are truncated to avoid console errors.
    
    .PARAMETER Level
    The log level: INFO, SUCCESS, WARN, ERROR
    
    .PARAMETER Message
    The message to log
    
    .EXAMPLE
    Write-Log "INFO" "Starting installation..."
    Write-Log "ERROR" "Installation failed"
    #>
    param(
        [string]$Level,
        [string]$Message
    )
    $Message = if ($null -eq $Message) { "" } else { [string]$Message }
    if ($Message.Length -gt $SCRIPT:MaxLogMessageLength) {
        $Message = $Message.Substring(0, $SCRIPT:MaxLogMessageLength) + " ... [truncated, original length $($Message.Length) chars]"
    }
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMsg = "[$Timestamp] [$Level] $Message"
    $Color = switch ($Level) {
        "ERROR" { "Red" }
        "SUCCESS" { "Green" }
        "WARN" { "Yellow" }
        default { "White" }
    }
    Write-Host $LogMsg -ForegroundColor $Color
    
    if ($null -ne $global:LOG_FILE) {
        try {
            $LogMsg | Out-File -FilePath $global:LOG_FILE -Append -Encoding UTF8 -ErrorAction SilentlyContinue
        } catch {
            # Ignore log file write errors so main flow is not affected
        }
    }
}

function Get-UvDefaultIndexArgsFromUserConfig {
    <#
    .SYNOPSIS
    Reads $UV_INDEX / $UV_TRUSTED_HOST from user_config.ps1 under WorkHome and returns uv CLI args.
    Uses --index to prioritize the configured mirror over project-level [[tool.uv.index]],
    and --allow-insecure-host for trusted hosts.
    #>
    param(
        [string]$WorkHome
    )

    if ([string]::IsNullOrWhiteSpace($WorkHome)) {
        return @()
    }

    $UserCfgForUv = Join-Path $WorkHome "user_config.ps1"
    if (-not (Test-Path $UserCfgForUv)) {
        return @()
    }

    try {
        . $UserCfgForUv
        $UvArgs = @()
        if (-not [string]::IsNullOrWhiteSpace($UV_INDEX)) {
            $UvIdx = $UV_INDEX.Trim()
            Write-Log "INFO" "uv uses --index from user_config.ps1: $UvIdx"
            $UvArgs += @('--index', $UvIdx)
        }
        if (-not [string]::IsNullOrWhiteSpace($UV_TRUSTED_HOST)) {
            $TrustedHosts = $UV_TRUSTED_HOST -split ',' | ForEach-Object { $_.Trim() } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
            foreach ($TrustedHost in $TrustedHosts) {
                $UvArgs += @('--allow-insecure-host', $TrustedHost)
            }
            if ($TrustedHosts.Count -gt 0) {
                Write-Log "INFO" "uv uses --allow-insecure-host from user_config.ps1: $($TrustedHosts -join ',')"
            }
        }
        if ($UvArgs.Count -gt 0) {
            return $UvArgs
        }
    } catch {
        Write-Log "WARN" "Failed to read user_config.ps1 for uv args: $($_.Exception.Message)"
    }

    return @()
}

function Remove-DirectoryRobust {
    <#
    .SYNOPSIS
    Robustly removes a directory, handling long paths and special characters.
    
    .DESCRIPTION
    Attempts to delete a directory using multiple methods:
    1. Long path prefix (\\?\) for paths exceeding 260 characters
    2. Standard Remove-Item with -LiteralPath
    3. Robocopy mirror method as fallback
    
    .PARAMETER Path
    The path to the directory to remove (can be relative or absolute)
    
    .EXAMPLE
    Remove-DirectoryRobust -Path "C:\Long Path\With (Special) Characters"
    #>
    param([string]$Path)
    
    # Get the full path first
    $FullPath = if (Test-Path $Path) {
        (Get-Item $Path -Force).FullName
    } else {
        if ([System.IO.Path]::IsPathRooted($Path)) {
            $Path
        } else {
            (Join-Path (Get-Location) $Path)
        }
    }
    
    # Method 1: Try using long path prefix (\\?\) for paths longer than 260 characters
    if ($FullPath.Length -gt 260) {
        $LongPath = "\\?\$FullPath"
        try {
            Remove-Item -LiteralPath $LongPath -Recurse -Force -ErrorAction Stop
            return $true
        } catch {
            # Silently continue to next method
        }
    }
    
    # Method 2: Try standard Remove-Item with -LiteralPath
    try {
        Remove-Item -LiteralPath $FullPath -Recurse -Force -ErrorAction Stop
        return $true
    } catch {
        # Silently continue to next method
    }
    
    # Method 3: Use robocopy to delete (robocopy can handle long paths better)
    try {
        # Create an empty temp directory
        $TempDir = Join-Path $env:TEMP ([System.Guid]::NewGuid().ToString())
        New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
        
        # Use robocopy to mirror empty dir to target (effectively deleting it)
        # Add all quiet flags to suppress output
        $RobocopyArgs = @(
            "`"$TempDir`"",
            "`"$FullPath`"",
            "/MIR",
            "/NFL",      # No File List
            "/NDL",      # No Directory List
            "/NJH",      # No Job Header
            "/NJS",      # No Job Summary
            "/NP",       # No Progress
            "/NS",       # No Size
            "/NC",       # No Class
            "/BYTES"     # Show sizes in bytes (reduces output)
        )
        # Create a null output file to redirect all output
        $NullOutput = Join-Path $env:TEMP "robocopy_null_$([System.Guid]::NewGuid().ToString()).txt"
        # Redirect output to completely silence robocopy
        $RobocopyProcess = Start-Process -FilePath "robocopy.exe" -ArgumentList $RobocopyArgs -Wait -NoNewWindow -PassThru -RedirectStandardOutput $NullOutput -RedirectStandardError $NullOutput
        # Clean up the null output file
        Remove-Item -Path $NullOutput -Force -ErrorAction SilentlyContinue
        
        # Remove temp directory
        Remove-Item -Path $TempDir -Force -ErrorAction SilentlyContinue
        
        if ($RobocopyProcess.ExitCode -le 1) {
            # Robocopy exit codes: 0 = success, 1 = files copied (also success for our purpose)
            # Try to remove the now-empty directory
            if (Test-Path $FullPath) {
                Remove-Item -LiteralPath $FullPath -Force -ErrorAction SilentlyContinue
            }
            return $true
        }
    } catch {
        # Silently fail
    }
    
    return $false
}

function Test-Command {
    <#
    .SYNOPSIS
    Tests if a command is available in the system PATH.
    
    .DESCRIPTION
    Checks if a command exists and is executable. Exits the script if not found.
    
    .PARAMETER Command
    The command name to test (e.g., "git", "node", "python")
    
    .EXAMPLE
    Test-Command "git"
    #>
    param([string]$Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    if (-not $?) {
        Write-Log "ERROR" "Dependency command '$Command' not found, please install first"
        exit 1
    }
}

function Test-File {
    <#
    .SYNOPSIS
    Tests if a file exists, optionally creating it if it doesn't.
    
    .DESCRIPTION
    Checks if a file exists. If not found and CreateIfNotExist is true, creates an empty file.
    Otherwise, exits the script with an error.
    
    .PARAMETER File
    The file path to test
    
    .PARAMETER CreateIfNotExist
    If true, creates an empty file if it doesn't exist. Default is false.
    
    .EXAMPLE
    Test-File "C:\path\to\file.txt"
    Test-File "C:\path\to\file.txt" -CreateIfNotExist $true
    #>
    param(
        [string]$File,
        [bool]$CreateIfNotExist = $false
    )
    if (-not (Test-Path $File)) {
        if ($CreateIfNotExist) {
            Write-Log "WARN" "File $File not found, trying to create empty file"
            $null = New-Item -ItemType File -Path $File -Force
        } else {
            Write-Log "ERROR" "File $File not found, cannot continue"
            exit 1
        }
    }
}

function Test-Directory {
    <#
    .SYNOPSIS
    Tests if a directory exists.
    
    .DESCRIPTION
    Checks if a directory exists. Exits the script with an error if not found.
    
    .PARAMETER Dir
    The directory path to test
    
    .EXAMPLE
    Test-Directory "C:\path\to\directory"
    #>
    param([string]$Dir)
    if (-not (Test-Path $Dir)) {
        Write-Log "ERROR" "Directory $Dir not found, cannot continue"
        exit 1
    }
}

function Unblock-AllScripts {
    <#
    .SYNOPSIS
    Unblocks all PowerShell scripts in a directory to avoid security warnings.
    
    .DESCRIPTION
    Removes the "blocked" attribute from all .ps1 files in the specified directory and subdirectories.
    
    .PARAMETER WorkHome
    The working directory to search for PowerShell scripts. Defaults to current script directory.
    
    .EXAMPLE
    Unblock-AllScripts -WorkHome "C:\path\to\scripts"
    #>
    param(
        [string]$WorkHome = $null
    )
    
    # If WorkHome not provided, use the directory containing utils.ps1
    if ([string]::IsNullOrEmpty($WorkHome)) {
        $WorkHome = Split-Path -Parent $MyInvocation.PSCommandPath
    }
    
    Write-Log "INFO" "Unblocking all PowerShell scripts in current directory..."
    $ScriptFiles = Get-ChildItem -Path $WorkHome -Recurse -Filter "*.ps1" -ErrorAction SilentlyContinue
    $ScriptFiles | Unblock-File -ErrorAction SilentlyContinue | Out-Null
    $UnblockedCount = $ScriptFiles.Count
    if ($UnblockedCount -gt 0) {
        Write-Log "INFO" "Unblocked $UnblockedCount PowerShell script(s)"
    }
}

# Progress file path ($PROGRESS_FILE) and step order ($INSTALL_STEPS) are defined by the caller (e.g. setup.ps1) before dot-sourcing this file.
function Save-Progress {
    param(
        [string]$Step
    )
    try {
        $Step | Out-File -FilePath $PROGRESS_FILE -Encoding utf8 -Force
        Write-Log "INFO" "Progress saved: $Step"
    } catch {
        Write-Log "WARN" "Failed to save progress: $_"
    }
}

function Read-Progress {
    if (Test-Path $PROGRESS_FILE) {
        try {
            $Progress = Get-Content $PROGRESS_FILE -ErrorAction SilentlyContinue | Where-Object { $_ -match "^\S+" }
            if ($Progress) {
                return $Progress.Trim()
            }
        } catch {
            Write-Log "WARN" "Failed to read progress: $_"
        }
    }
    return ""
}

function Clear-Progress {
    if (Test-Path $PROGRESS_FILE) {
        try {
            Remove-Item $PROGRESS_FILE -Force -ErrorAction SilentlyContinue
            Write-Log "INFO" "Progress file cleared"
        } catch {
            Write-Log "WARN" "Failed to clear progress file: $_"
        }
    }
}

function Test-SkipStep {
    param(
        [string]$CurrentStep,
        [string]$LastProgress
    )

    if ([string]::IsNullOrEmpty($LastProgress)) {
        return $false
    }

    $CurrentIndex = -1
    $LastIndex = -1

    for ($i = 0; $i -lt $INSTALL_STEPS.Count; $i++) {
        if ($INSTALL_STEPS[$i] -eq $CurrentStep) {
            $CurrentIndex = $i
        }
        if ($INSTALL_STEPS[$i] -eq $LastProgress) {
            $LastIndex = $i
        }
    }

    if ($CurrentIndex -eq -1 -or $LastIndex -eq -1) {
        return $false
    }

    if ($LastIndex -ge $CurrentIndex) {
        return $true
    } else {
        return $false
    }
}

