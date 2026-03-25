# PowerShell Script: One-click Deployment for Agent-Studio (Windows Version)
# Requirements: Windows 10+, PowerShell 5.1+

[CmdletBinding()]
param(
    [ValidateSet("mysql", "sqlite")]
    [string]$DbType = "mysql",
    
    [ValidateNotNullOrEmpty()]
    [string]$Branch = "main",
    
    [int]$FrontendPort = 3000,
    [int]$BackendPort = 8000,
    
    [switch]$Help,
    [switch]$Status,
    [switch]$Stop,
    [switch]$Start,
    [switch]$Restart
)

# ===================== Basic Configuration =====================
$ErrorActionPreference = "Stop"
$WORK_HOME = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKEND_DIR = Join-Path $WORK_HOME "agent-studio\backend"
$FRONTEND_DIR = Join-Path $WORK_HOME "agent-studio\frontend"
$TARGET_ENV_FILE = Join-Path $WORK_HOME "agent-studio\.env"
$ENV_EXAMPLE_FILE = Join-Path $WORK_HOME "agent-studio\.env.example"
$PROGRESS_FILE = Join-Path $WORK_HOME ".setup_progress"
$global:LOG_FILE = Join-Path $WORK_HOME "setup.log"

# Install steps (in order)
$INSTALL_STEPS = @(
    "check_tools",
    "fetch_code",
    "config_aes",
    "config_env",
    "config_mysql",
    "deploy_backend",
    "deploy_frontend",
    "start_services"
)

# ===================== Load Utility Functions =====================
$UtilsScript = Join-Path $WORK_HOME "utils.ps1"
. $UtilsScript
Apply-HttpProxy -WorkHome $WORK_HOME

function Show-Help {
    Write-Host @"
Usage: .\setup.ps1 [Options]
Function: One-click deployment of Agent-Studio (Windows version), supports specifying database type

Supported Parameters:
  -DbType type    Specify database type, optional values: mysql (default), sqlite
                  -DbType mysql: Set DB_TYPE to mysql in .env
                  -DbType sqlite: Set DB_TYPE to sqlite in .env
  -Branch branch  Specify git branch to download code, default: main
  -FrontendPort port  Frontend service port (default: 3000), written to .env FRONTEND_PORT
  -BackendPort port   Backend service port (default: 8000), written to .env BACKEND_PORT
  -Status         Show frontend and backend service status and access URLs
  -Stop           Gracefully stop frontend and backend services
  -Start          Start frontend and backend services (without reinstalling dependencies)
  -Restart        Restart frontend and backend services (without reinstalling dependencies)
  -Help           Show this help message and exit

Examples:
  .\setup.ps1                    # Default: Set DB_TYPE to mysql, use main branch, ports 3000/8000
  .\setup.ps1 -DbType sqlite      # Set DB_TYPE to sqlite, use main branch
  .\setup.ps1 -Branch develop        # Use develop branch for code download
  .\setup.ps1 -FrontendPort 3001 -BackendPort 8001  # Custom frontend/backend ports
  .\setup.ps1 -DbType sqlite -Branch develop  # Set DB_TYPE to sqlite, use develop branch
  .\setup.ps1 -Status             # Show service status and access URLs
  .\setup.ps1 -Stop                # Gracefully stop frontend and backend services
  .\setup.ps1 -Start               # Start frontend and backend services
  .\setup.ps1 -Restart             # Restart frontend and backend services
  .\setup.ps1 -Help                # View help

Working Directory: $WORK_HOME
"@
    exit 0
}

# ===================== Progress Management Functions =====================
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

function Get-BackendPort {
    param(
        [string]$LogFile,
        [string]$PidFile = $null,
        [int]$DefaultPort = 8000
    )
    $Port = $null
    
    # Priority 1: Try to get port from running process by PID
    if ($PidFile -and (Test-Path $PidFile)) {
        try {
            $PidFromFile = Get-Content $PidFile -ErrorAction SilentlyContinue | Where-Object { $_ -match "^\d+$" }
            if ($PidFromFile) {
                $PidValue = [int]$PidFromFile
                $Process = Get-Process -Id $PidValue -ErrorAction SilentlyContinue
                if ($Process) {
                    # Check if it's a Python process (backend)
                    $ProcessPath = $Process.Path
                    $CommandLine = ""
                    $WmiProcess = Get-WmiObject Win32_Process -Filter "ProcessId = $PidValue" -ErrorAction SilentlyContinue
                    if ($WmiProcess) {
                        $CommandLine = $WmiProcess.CommandLine
                    }
                    if ($ProcessPath -like "*python*" -or $CommandLine -like "*main.py*") {
                        # Find port by PID using netstat
                        # netstat -ano output format: TCP    0.0.0.0:8000           0.0.0.0:0              LISTENING       12345
                        $NetStatLines = netstat -ano | Where-Object { $_ -match "LISTENING" -and $_ -match "\s+$PidValue\s*$" }
                        foreach ($Line in $NetStatLines) {
                            # Match pattern: TCP/UDP    0.0.0.0:8000   ...   LISTENING   12345
                            # Extract port from local address (first address:port pair)
                            if ($Line -match "^\s*(?:TCP|UDP)\s+(?:0\.0\.0\.0|\[::\]|\*|127\.0\.0\.1|localhost):(\d+)\s+") {
                                $FoundPort = [int]$Matches[1]
                                if ($FoundPort -ge 1000 -and $FoundPort -le 65535) {
                                    $Port = $FoundPort
                                    break
                                }
                            }
                        }
                    }
                }
            }
        } catch {
            # Ignore errors
        }
    }
    
    # Priority 2: Read from .env (matches config_env BACKEND_PORT so Show-Status shows correct port right after start)
    if (-not $Port -and (Test-Path $TARGET_ENV_FILE)) {
        try {
            $PortLine = Select-String -Path $TARGET_ENV_FILE -Pattern "^(BACKEND_PORT|SERVER_PORT|PORT)=" -ErrorAction SilentlyContinue
            if ($PortLine) {
                $PortValue = ($PortLine.Line -replace "^(BACKEND_PORT|SERVER_PORT|PORT)=", "").Trim() -replace '"', "" -replace "'", ""
                if (-not [string]::IsNullOrEmpty($PortValue) -and $PortValue -match "^\d+$") {
                    $Port = [int]$PortValue
                }
            }
        } catch {
            # Ignore errors
        }
    }
    
    # Fallback to default port
    if (-not $Port) {
        $Port = $DefaultPort
    }
    
    return $Port
}

function Get-FrontendPort {
    param(
        [string]$LogFile,
        [int]$DefaultPort = 3000
    )
    $Port = $DefaultPort
    
    # Try to read from .env file
    if (Test-Path $TARGET_ENV_FILE) {
        try {
            $FrontendPortLine = Select-String -Path $TARGET_ENV_FILE -Pattern "^FRONTEND_PORT=" -ErrorAction SilentlyContinue
            if ($FrontendPortLine) {
                $PortValue = ($FrontendPortLine.Line -replace "FRONTEND_PORT=", "").Trim() -replace '"', "" -replace "'", ""
                if (-not [string]::IsNullOrEmpty($PortValue) -and $PortValue -match "^\d+$") {
                    $Port = [int]$PortValue
                }
            }
        } catch {
            # Ignore errors
        }
    }
    
    # Try to extract from log file
    if (Test-Path $LogFile) {
        try {
            $LogContent = Get-Content $LogFile -Tail 50 -ErrorAction SilentlyContinue
            foreach ($Line in $LogContent) {
                # Match patterns like "Local: http://localhost:3000/" or "Network: http://192.168.1.1:3000/"
                if ($Line -match "(?:Local|Network).*?http://[^:]+:(\d+)/?") {
                    $LogPort = [int]$Matches[1]
                    if ($LogPort -ge 1000 -and $LogPort -le 65535) {
                        $Port = $LogPort
                        break
                    }
                }
                # Alternative pattern: just match port number after colon
                elseif ($Line -match ":(\d{4,5})/") {
                    $LogPort = [int]$Matches[1]
                    if ($LogPort -ge 1000 -and $LogPort -le 65535) {
                        $Port = $LogPort
                        break
                    }
                }
            }
        } catch {
            # Ignore errors
        }
    }
    
    return $Port
}

function Get-LocalIP {
    try {
        # Try to get local IP address
        $LocalIP = $null
        $Interfaces = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue
        foreach ($Interface in $Interfaces) {
            if ($Interface.IPAddress -notlike "127.*" -and $Interface.IPAddress -notlike "169.254.*") {
                $LocalIP = $Interface.IPAddress
                break
            }
        }
        
        if ([string]::IsNullOrEmpty($LocalIP)) {
            $LocalIP = "localhost"
        }
    } catch {
        $LocalIP = "localhost"
    }
    
    return $LocalIP
}

function Show-Status {
    param(
        [switch]$NoExit  # When called from Start-Services/Restart/completion block do not exit; exit only when -Status is used alone
    )
    $BackendPidFile = Join-Path $WORK_HOME "backend.pid"
    $FrontendPidFile = Join-Path $WORK_HOME "frontend.pid"
    $BackendLog = Join-Path $WORK_HOME "backend.log"
    $FrontendLog = Join-Path $WORK_HOME "frontend.log"
    
    $LocalIP = Get-LocalIP
    
    Write-Host "Frontend Service:" -ForegroundColor Yellow
    $FrontendPid = $null
    $FrontendPort = Get-FrontendPort -LogFile $FrontendLog -DefaultPort 3000
    
    if (Test-Path $FrontendPidFile) {
        $PidFromFile = Get-Content $FrontendPidFile -ErrorAction SilentlyContinue | Where-Object { $_ -match "^\d+$" }
        if ($PidFromFile) {
            $PidValue = [int]$PidFromFile
            $Process = Get-Process -Id $PidValue -ErrorAction SilentlyContinue
            if ($Process) {
                $ProcessName = $Process.ProcessName
                $CommandLine = ""
                $WmiProcess = Get-WmiObject Win32_Process -Filter "ProcessId = $PidValue" -ErrorAction SilentlyContinue
                if ($WmiProcess) {
                    $CommandLine = $WmiProcess.CommandLine
                }
                if ($ProcessName -eq "node" -or $CommandLine -like "*vite*" -or $CommandLine -like "*npm*dev*") {
                    $FrontendPid = $PidValue
                    Write-Host "  Status: Running" -ForegroundColor Green
                    Write-Host "  PID: $FrontendPid"
                }
            }
        }
    }
    
    if (-not $FrontendPid) {
        $NetStat = netstat -ano | Select-String ":$FrontendPort\s" -ErrorAction SilentlyContinue
        if ($NetStat) {
            $PortPid = ($NetStat -split '\s+')[-1]
            if ($PortPid -match "^\d+$") {
                $PidValue = [int]$PortPid
                $Process = Get-Process -Id $PidValue -ErrorAction SilentlyContinue
                if ($Process -and $Process.ProcessName -eq "node") {
                    $FrontendPid = $PidValue
                    Write-Host "  Status: Running (detected by port)" -ForegroundColor Green
                    Write-Host "  PID: $FrontendPid"
                    Write-Host "  Warning: PID file not found or expired" -ForegroundColor Yellow
                }
            }
        }
    }
    
    if ($FrontendPid) {
        Write-Host "  Local: http://localhost:${FrontendPort}" -ForegroundColor Blue
        Write-Host "  Network: http://${LocalIP}:${FrontendPort}" -ForegroundColor Blue
    }
    else {
        Write-Host "  Status: Not Running" -ForegroundColor Red
        if (Test-Path $FrontendPidFile) {
            $OldPid = Get-Content $FrontendPidFile -ErrorAction SilentlyContinue
            if ($OldPid) {
                Write-Host "  Note: PID file exists but process not found (PID: $OldPid)"
            }
        }
        else {
            Write-Host "  Note: PID file not found"
        }
    }
    
    $FrontendLog = Join-Path $WORK_HOME "frontend.log"
    Write-Host "  Log File: $FrontendLog" -ForegroundColor Green
    
    Write-Host ""
    
    Write-Host "Backend Service:" -ForegroundColor Yellow
    $BackendPid = $null
    $BackendPort = Get-BackendPort -LogFile $BackendLog -PidFile $BackendPidFile -DefaultPort 8000
    
    if (Test-Path $BackendPidFile) {
        $PidFromFile = Get-Content $BackendPidFile -ErrorAction SilentlyContinue | Where-Object { $_ -match "^\d+$" }
        if ($PidFromFile) {
            $PidValue = [int]$PidFromFile
            $Process = Get-Process -Id $PidValue -ErrorAction SilentlyContinue
            if ($Process) {
                $ProcessPath = $Process.Path
                $CommandLine = ""
                $WmiProcess = Get-WmiObject Win32_Process -Filter "ProcessId = $PidValue" -ErrorAction SilentlyContinue
                if ($WmiProcess) {
                    $CommandLine = $WmiProcess.CommandLine
                }
                if ($ProcessPath -like "*python*" -or $CommandLine -like "*main.py*") {
                    $BackendPid = $PidValue
                    Write-Host "  Status: Running" -ForegroundColor Green
                    Write-Host "  PID: $BackendPid"
                }
            }
        }
    }
    
    if (-not $BackendPid) {
        $NetStat = netstat -ano | Select-String ":$BackendPort\s" -ErrorAction SilentlyContinue
        if ($NetStat) {
            $PortPid = ($NetStat -split '\s+')[-1]
            if ($PortPid -match "^\d+$") {
                $PidValue = [int]$PortPid
                $Process = Get-Process -Id $PidValue -ErrorAction SilentlyContinue
                if ($Process) {
                    $ProcessPath = $Process.Path
                    $CommandLine = ""
                    $WmiProcess = Get-WmiObject Win32_Process -Filter "ProcessId = $PidValue" -ErrorAction SilentlyContinue
                    if ($WmiProcess) {
                        $CommandLine = $WmiProcess.CommandLine
                    }
                    if ($ProcessPath -like "*python*" -or $CommandLine -like "*main.py*") {
                        $BackendPid = $PidValue
                        Write-Host "  Status: Running (detected by port)" -ForegroundColor Green
                        Write-Host "  PID: $BackendPid"
                        Write-Host "  Warning: PID file not found or expired" -ForegroundColor Yellow
                    }
                }
            }
        }
    }
    
    if ($BackendPid) {
        Write-Host "  Local: http://localhost:${BackendPort}" -ForegroundColor Green
        Write-Host "  Network: http://${LocalIP}:${BackendPort}" -ForegroundColor Green
        Write-Host "  API Docs: http://localhost:${BackendPort}/api/docs" -ForegroundColor Green
        Write-Host "  Health: http://localhost:${BackendPort}/api/health" -ForegroundColor Green
    }
    else {
        Write-Host "  Status: Not Running" -ForegroundColor Red
        if (Test-Path $BackendPidFile) {
            $OldPid = Get-Content $BackendPidFile -ErrorAction SilentlyContinue
            if ($OldPid) {
                Write-Host "  Note: PID file exists but process not found (PID: $OldPid)"
            }
        }
        else {
            Write-Host "  Note: PID file not found"
        }
    }
    
    $BackendLog = Join-Path $WORK_HOME "backend.log"
    Write-Host "  Log File: $BackendLog" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "Manage Service:" -ForegroundColor Yellow
    Write-Host "  Stop Services: .\setup.ps1 -Stop" -ForegroundColor Green
    Write-Host "  Start Services: .\setup.ps1 -Start" -ForegroundColor Green
    Write-Host "  Restart Services: .\setup.ps1 -Restart" -ForegroundColor Green
    Write-Host "  Check Status: .\setup.ps1 -Status" -ForegroundColor Green
    
    if (-not $NoExit) {
        exit 0
    }
}

function Stop-ProcessTree {
    param(
        [int]$ProcessId,
        [int]$MaxWait = 10
    )
    
    $Stopped = $false
    $Process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if (-not $Process) {
        return $false
    }
    
    try {
        # Get all child processes
        $ChildProcesses = @()
        $AllProcesses = Get-WmiObject Win32_Process | Where-Object { $_.ParentProcessId -eq $ProcessId }
        foreach ($ChildProc in $AllProcesses) {
            $ChildProcesses += $ChildProc.ProcessId
            # Recursively get grandchildren
            $GrandChildren = Get-WmiObject Win32_Process | Where-Object { $_.ParentProcessId -eq $ChildProc.ProcessId }
            foreach ($GrandChild in $GrandChildren) {
                $ChildProcesses += $GrandChild.ProcessId
            }
        }
        
        # Stop child processes first
        foreach ($ChildPid in $ChildProcesses) {
            try {
                $ChildProcess = Get-Process -Id $ChildPid -ErrorAction SilentlyContinue
                if ($ChildProcess) {
                    Stop-Process -Id $ChildPid -Force -ErrorAction SilentlyContinue
                }
            } catch {
                # Ignore errors for child processes
            }
        }
        
        # Wait a bit for child processes to exit
        Start-Sleep -Milliseconds 500
        
        # Stop the main process gracefully first
        Stop-Process -Id $ProcessId -ErrorAction Stop
        $WaitCount = 0
        while ($WaitCount -lt $MaxWait) {
            Start-Sleep -Seconds 1
            $Process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
            if (-not $Process) {
                $Stopped = $true
                break
            }
            $WaitCount++
        }
        
        # If still running, force stop
        $Process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
        if ($Process) {
            Stop-Process -Id $ProcessId -Force -ErrorAction Stop
            $Stopped = $true
        }
    } catch {
        # If graceful stop failed, try force stop
        try {
            Stop-Process -Id $ProcessId -Force -ErrorAction Stop
            $Stopped = $true
        } catch {
            # Process may have already exited
        }
    }
    
    return $Stopped
}

function Stop-ProcessesByPort {
    param(
        [int]$Port
    )
    
    $Stopped = $false
    try {
        $NetStat = netstat -ano | Select-String ":$Port\s" -ErrorAction SilentlyContinue
        if ($NetStat) {
            $Pids = @()
            foreach ($Line in $NetStat) {
                $PortPid = ($Line -split '\s+')[-1]
                if ($PortPid -match "^\d+$") {
                    $PidValue = [int]$PortPid
                    if ($Pids -notcontains $PidValue) {
                        $Pids += $PidValue
                    }
                }
            }
            
            foreach ($ProcessId in $Pids) {
                $Process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
                if ($Process) {
                    Write-Host "  Stopping process on port $Port (PID: $ProcessId)..." -ForegroundColor Yellow
                    $null = Stop-ProcessTree -ProcessId $ProcessId
                    $Stopped = $true
                }
            }
        }
    } catch {
        # Ignore errors
    }
    
    return $Stopped
}

function Stop-Services {
    param(
        [switch]$NoExit
    )
    
    $BackendPidFile = Join-Path $WORK_HOME "backend.pid"
    $FrontendPidFile = Join-Path $WORK_HOME "frontend.pid"
    $BackendLog = Join-Path $WORK_HOME "backend.log"
    $FrontendLog = Join-Path $WORK_HOME "frontend.log"
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Stopping Services" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    $StoppedBackend = $false
    $StoppedFrontend = $false
    
    # Stop Backend Service
    Write-Host "Backend Service:" -ForegroundColor Yellow
    $BackendPid = $null
    $BackendPort = Get-BackendPort -LogFile $BackendLog -PidFile $BackendPidFile -DefaultPort 8000
    
    # Try to get PID from file
    if (Test-Path $BackendPidFile) {
        $PidFromFile = Get-Content $BackendPidFile -ErrorAction SilentlyContinue | Where-Object { $_ -match "^\d+$" }
        if ($PidFromFile) {
            $PidValue = [int]$PidFromFile
            $Process = Get-Process -Id $PidValue -ErrorAction SilentlyContinue
            if ($Process) {
                $ProcessPath = $Process.Path
                $CommandLine = ""
                $WmiProcess = Get-WmiObject Win32_Process -Filter "ProcessId = $PidValue" -ErrorAction SilentlyContinue
                if ($WmiProcess) {
                    $CommandLine = $WmiProcess.CommandLine
                }
                if ($ProcessPath -like "*python*" -or $CommandLine -like "*main.py*") {
                    $BackendPid = $PidValue
                }
            }
        }
    }
    
    # If not found in PID file, try to find by port
    if (-not $BackendPid) {
        $NetStat = netstat -ano | Select-String ":$BackendPort\s" -ErrorAction SilentlyContinue
        if ($NetStat) {
            $PortPid = ($NetStat -split '\s+')[-1]
            if ($PortPid -match "^\d+$") {
                $PidValue = [int]$PortPid
                $Process = Get-Process -Id $PidValue -ErrorAction SilentlyContinue
                if ($Process) {
                    $ProcessPath = $Process.Path
                    $CommandLine = ""
                    $WmiProcess = Get-WmiObject Win32_Process -Filter "ProcessId = $PidValue" -ErrorAction SilentlyContinue
                    if ($WmiProcess) {
                        $CommandLine = $WmiProcess.CommandLine
                    }
                    if ($ProcessPath -like "*python*" -or $CommandLine -like "*main.py*") {
                        $BackendPid = $PidValue
                    }
                }
            }
        }
    }
    
    if ($BackendPid) {
        Write-Host "  Found backend process (PID: $BackendPid)" -ForegroundColor Green
        Write-Host "  Stopping gracefully..." -ForegroundColor Yellow
        try {
            $Stopped = Stop-ProcessTree -ProcessId $BackendPid -MaxWait 10
            if ($Stopped) {
                $StoppedBackend = $true
                Write-Host "  Backend service stopped successfully" -ForegroundColor Green
            } else {
                Write-Host "  Backend service may not have stopped completely" -ForegroundColor Yellow
            }
            
            # Remove PID file
            if (Test-Path $BackendPidFile) {
                Remove-Item $BackendPidFile -Force -ErrorAction SilentlyContinue
                Write-Host "  Removed PID file: $BackendPidFile" -ForegroundColor Green
            }
        } catch {
            Write-Host "  Error stopping backend service: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "  Backend service is not running" -ForegroundColor Yellow
        # Clean up PID file if it exists
        if (Test-Path $BackendPidFile) {
            Remove-Item $BackendPidFile -Force -ErrorAction SilentlyContinue
            Write-Host "  Removed stale PID file: $BackendPidFile" -ForegroundColor Yellow
        }
    }
    
    # Also check and stop any processes on backend port
    $PortStopped = Stop-ProcessesByPort -Port $BackendPort
    if ($PortStopped -and -not $StoppedBackend) {
        $StoppedBackend = $true
    }
    
    Write-Host ""
    
    # Stop Frontend Service
    Write-Host "Frontend Service:" -ForegroundColor Yellow
    $FrontendPort = Get-FrontendPort -LogFile $FrontendLog -DefaultPort 3000
    
    # Collect all frontend-related PIDs
    $FrontendPids = @()
    
    # Try to get PID from file
    if (Test-Path $FrontendPidFile) {
        $PidFromFile = Get-Content $FrontendPidFile -ErrorAction SilentlyContinue | Where-Object { $_ -match "^\d+$" }
        if ($PidFromFile) {
            $PidValue = [int]$PidFromFile
            $Process = Get-Process -Id $PidValue -ErrorAction SilentlyContinue
            if ($Process) {
                $ProcessName = $Process.ProcessName
                $CommandLine = ""
                $WmiProcess = Get-WmiObject Win32_Process -Filter "ProcessId = $PidValue" -ErrorAction SilentlyContinue
                if ($WmiProcess) {
                    $CommandLine = $WmiProcess.CommandLine
                }
                if ($ProcessName -eq "node" -or $ProcessName -eq "cmd" -or $CommandLine -like "*vite*" -or $CommandLine -like "*npm*dev*") {
                    $FrontendPids += $PidValue
                }
            }
        }
    }
    
    # Find all node processes that might be related to frontend
    $AllNodeProcesses = Get-WmiObject Win32_Process -Filter "Name = 'node.exe'" | Where-Object {
        $Proc = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue
        if ($Proc) {
            $CommandLine = $_.CommandLine
            # Check if it's a vite or npm dev process
            if ($CommandLine -like "*vite*" -or $CommandLine -like "*npm*dev*" -or $CommandLine -like "*frontend*") {
                return $true
            }
            # Check if parent is cmd.exe (likely started by npm)
            $Parent = Get-WmiObject Win32_Process -Filter "ProcessId = $($_.ParentProcessId)" -ErrorAction SilentlyContinue
            if ($Parent -and $Parent.Name -eq "cmd.exe") {
                return $true
            }
        }
        return $false
    }
    
    foreach ($NodeProc in $AllNodeProcesses) {
        if ($FrontendPids -notcontains $NodeProc.ProcessId) {
            $FrontendPids += $NodeProc.ProcessId
        }
    }
    
    # Find cmd.exe processes that might be running npm
    $AllCmdProcesses = Get-WmiObject Win32_Process -Filter "Name = 'cmd.exe'" | Where-Object {
        $CommandLine = $_.CommandLine
        if ($CommandLine -like "*npm*dev*" -or $CommandLine -like "*vite*") {
            return $true
        }
        return $false
    }
    
    foreach ($CmdProc in $AllCmdProcesses) {
        if ($FrontendPids -notcontains $CmdProc.ProcessId) {
            $FrontendPids += $CmdProc.ProcessId
        }
    }
    
    # Also find processes by port
    $NetStat = netstat -ano | Select-String ":$FrontendPort\s" -ErrorAction SilentlyContinue
    if ($NetStat) {
        foreach ($Line in $NetStat) {
            $PortPid = ($Line -split '\s+')[-1]
            if ($PortPid -match "^\d+$") {
                $PidValue = [int]$PortPid
                $Process = Get-Process -Id $PidValue -ErrorAction SilentlyContinue
                if ($Process -and ($Process.ProcessName -eq "node" -or $Process.ProcessName -eq "cmd")) {
                    if ($FrontendPids -notcontains $PidValue) {
                        $FrontendPids += $PidValue
                    }
                }
            }
        }
    }
    
    if ($FrontendPids.Count -gt 0) {
        Write-Host "  Found $($FrontendPids.Count) frontend-related process(es)" -ForegroundColor Green
        Write-Host "  Stopping all frontend processes and their children..." -ForegroundColor Yellow
        
        # Stop all processes, starting with the main one
        foreach ($ProcessId in $FrontendPids) {
            try {
                $Process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
                if ($Process) {
                    Write-Host "    Stopping process (PID: $ProcessId, Name: $($Process.ProcessName))..." -ForegroundColor Yellow
                    $null = Stop-ProcessTree -ProcessId $ProcessId -MaxWait 5
                }
            } catch {
                # Process may have already been stopped
            }
        }
        
        # Wait a bit for all processes to exit
        Start-Sleep -Seconds 2
        
        # Also stop any processes still on the port
        $PortStopped = Stop-ProcessesByPort -Port $FrontendPort
        
        $StoppedFrontend = $true
        Write-Host "  Frontend service stopped successfully" -ForegroundColor Green
        
        # Remove PID file
        if (Test-Path $FrontendPidFile) {
            Remove-Item $FrontendPidFile -Force -ErrorAction SilentlyContinue
            Write-Host "  Removed PID file: $FrontendPidFile" -ForegroundColor Green
        }
    } else {
        Write-Host "  Frontend service is not running" -ForegroundColor Yellow
        # Clean up PID file if it exists
        if (Test-Path $FrontendPidFile) {
            Remove-Item $FrontendPidFile -Force -ErrorAction SilentlyContinue
            Write-Host "  Removed stale PID file: $FrontendPidFile" -ForegroundColor Yellow
        }
    }
    
    # Final check: stop any remaining processes on frontend port
    $PortStopped = Stop-ProcessesByPort -Port $FrontendPort
    if ($PortStopped -and -not $StoppedFrontend) {
        $StoppedFrontend = $true
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    if ($StoppedBackend -or $StoppedFrontend) {
        Write-Host "Services stopped successfully" -ForegroundColor Green
    } else {
        Write-Host "No running services found" -ForegroundColor Yellow
    }
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    if (-not $NoExit) {
        exit 0
    }
}

# Start backend service (used by Start-Services or main flow)
function Start-BackendService {
    # Check if backend directory and .env exist
    if (-not (Test-Path $BACKEND_DIR)) {
        Write-Log "ERROR" "Backend directory not found: $BACKEND_DIR"
        Write-Log "ERROR" "Please run full installation first: .\setup.ps1"
        exit 1
    }
    if (-not (Test-Path $TARGET_ENV_FILE)) {
        Write-Log "ERROR" ".env file not found: $TARGET_ENV_FILE"
        Write-Log "ERROR" "Please run full installation first: .\setup.ps1"
        exit 1
    }
    
    # Read AES key from .env file if exists
    $AESKey = $null
    if (Test-Path $TARGET_ENV_FILE) {
        try {
            $AESKeyLine = Select-String -Path $TARGET_ENV_FILE -Pattern "^SERVER_AES_MASTER_KEY=" -ErrorAction SilentlyContinue
            if ($AESKeyLine) {
                $AESKey = ($AESKeyLine.Line -replace "SERVER_AES_MASTER_KEY=", "").Trim() -replace '"', "" -replace "'", ""
            }
        } catch {
            # Ignore errors
        }
    }
    
    # If AES key not found in .env, try to generate or use existing environment variable
    if ([string]::IsNullOrEmpty($AESKey)) {
        if ($env:SERVER_AES_MASTER_KEY_ENV) {
            $AESKey = $env:SERVER_AES_MASTER_KEY_ENV
            Write-Log "INFO" "Using existing AES key from environment variable"
        } else {
            Write-Log "WARN" "AES key not found in .env file or environment, generating new one"
            $RandomBytes = New-Object byte[] 32
            $Rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
            $Rng.GetBytes($RandomBytes)
            $Rng.Dispose()
            $AESKey = [Convert]::ToBase64String($RandomBytes)
        }
    }
    
    $env:SERVER_AES_MASTER_KEY_ENV = $AESKey
    Write-Log "INFO" "AES key set: $($AESKey.Substring(0, [Math]::Min(8, $AESKey.Length)))**** (partially hidden)"
    
    # Find Python executable
    $PythonExePath = $null
    $PythonCheckScript = Join-Path $WORK_HOME "check_python.ps1"
    if (Test-Path $PythonCheckScript) {
        try {
            $PythonOutput = & $PythonCheckScript 2>&1 | Out-String
            if ($PythonOutput -match "PYTHON_EXE_PATH=(.+)") {
                $PythonExePath = $Matches[1].Trim() -replace "[\r\n]+.*$", ""
            }
        } catch {
            # Try to find Python in PATH
            $PythonExePath = (Get-Command python -ErrorAction SilentlyContinue).Source
            if (-not $PythonExePath) {
                $PythonExePath = (Get-Command python3 -ErrorAction SilentlyContinue).Source
            }
        }
    } else {
        # Try to find Python in PATH
        $PythonExePath = (Get-Command python -ErrorAction SilentlyContinue).Source
        if (-not $PythonExePath) {
            $PythonExePath = (Get-Command python3 -ErrorAction SilentlyContinue).Source
        }
    }
    
    if (-not $PythonExePath -or -not (Test-Path $PythonExePath)) {
        Write-Log "ERROR" "Python executable not found. Please ensure Python is installed."
        exit 1
    }
    
    Write-Log "INFO" "Using Python executable at: $PythonExePath"
    
    # ===================== Start Backend =====================
    Write-Log "INFO" "===== Starting Backend Service ====="
    $PrevLocation = Get-Location
    Set-Location $BACKEND_DIR
    
    # Check if virtual environment exists
    $BackendVenv = Join-Path $BACKEND_DIR ".venv\Scripts\python.exe"
    if (-not (Test-Path $BackendVenv)) {
        Write-Log "ERROR" "Backend virtual environment not found: $BackendVenv"
        Write-Log "ERROR" "Please run full installation first: .\setup.ps1"
        exit 1
    }
    
    # Create log directory
    $LogDir = Join-Path $BACKEND_DIR "logs\run"
    if (-not (Test-Path $LogDir)) {
        New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    }
    
    # Start backend (background)
    $BackendLog = Join-Path $WORK_HOME "backend.log"
    $BackendPidFile = Join-Path $WORK_HOME "backend.pid"
    
    # Check if backend is already running
    $BackendStarted = $true
    if (Test-Path $BackendPidFile) {
        $ExistingPid = Get-Content $BackendPidFile -ErrorAction SilentlyContinue | Where-Object { $_ -match "^\d+$" }
        if ($ExistingPid) {
            $Process = Get-Process -Id $ExistingPid -ErrorAction SilentlyContinue
            if ($Process) {
                Write-Log "WARN" "Backend service is already running (PID: $ExistingPid)"
                Write-Log "INFO" "Skipping backend start"
                $BackendStarted = $false
            } else {
                Write-Log "INFO" "Removing stale PID file"
                Remove-Item $BackendPidFile -Force -ErrorAction SilentlyContinue
            }
        }
    }
    
    if ($BackendStarted) {
        Write-Log "INFO" "Starting backend service, log file: $BackendLog"
        
        # Clear existing log file to ensure UTF-8 encoding
        if (Test-Path $BackendLog) {
            Remove-Item $BackendLog -Force -ErrorAction SilentlyContinue
        }
        "" | Out-File -FilePath $BackendLog -Encoding utf8 -NoNewline
        
        $BackendExe = $BackendVenv
        if (-not (Test-Path $BackendExe)) {
            $BackendExe = $PythonExePath
        }
        Write-Log "INFO" "Using backend executable: $BackendExe"
        $BackendArgs = "$BACKEND_DIR\main.py"
        
        $null = Start-Job -ScriptBlock {
            param($ExePath, $Arguments, $WorkDir, $LogFile)
            Set-Location $WorkDir
            $OutputEncoding = [System.Text.Encoding]::UTF8
            [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
            & $ExePath $Arguments 2>&1 | Out-File -FilePath $LogFile -Encoding utf8 -Append
        } -ArgumentList $BackendExe, $BackendArgs, $BACKEND_DIR, $BackendLog
        
        Start-Sleep -Seconds 2
        $BackendProcesses = Get-WmiObject Win32_Process | Where-Object { 
            $_.CommandLine -like "*$BackendArgs*" -and $_.ProcessName -eq "python.exe" 
        } | Sort-Object CreationDate -Descending | Select-Object -First 1
        
        if ($BackendProcesses) {
            $BackendPid = $BackendProcesses.ProcessId
            $BackendPid | Out-File -FilePath $BackendPidFile -Encoding ascii
            Write-Log "INFO" "Backend service started (PID: $BackendPid)"
            $BackendProcess = @{ Id = $BackendPid }
        } else {
            Write-Log "ERROR" "Failed to find backend process"
            exit 1
        }
        
        Start-Sleep -Seconds 5
        if ($BackendProcess -and $BackendProcess.Id -and (Get-Process -Id $BackendProcess.Id -ErrorAction SilentlyContinue)) {
            Write-Log "SUCCESS" "Backend service is running successfully"
            Get-Content $BackendLog -Tail 10 -ErrorAction SilentlyContinue
        } else {
            Write-Log "ERROR" "Backend service failed to start. Check log for details: $BackendLog"
            Get-Content $BackendLog -Tail 30 -ErrorAction SilentlyContinue
            exit 1
        }
    }
    
    Set-Location $PrevLocation
}

# Start frontend service (used by Start-Services or main flow)
function Start-FrontendService {
    if (-not (Test-Path $FRONTEND_DIR)) {
        Write-Log "ERROR" "Frontend directory not found: $FRONTEND_DIR"
        Write-Log "ERROR" "Please run full installation first: .\setup.ps1"
        exit 1
    }
    
    Write-Log "INFO" "===== Starting Frontend Service ====="
    $PrevLocation = Get-Location
    Set-Location $FRONTEND_DIR
    
    $NodeModules = Join-Path $FRONTEND_DIR "node_modules"
    if (-not (Test-Path $NodeModules)) {
        Write-Log "ERROR" "Frontend dependencies not found: $NodeModules"
        Write-Log "ERROR" "Please run full installation first: .\setup.ps1"
        Set-Location $PrevLocation
        exit 1
    }
    
    $FrontendLog = Join-Path $WORK_HOME "frontend.log"
    $FrontendPidFile = Join-Path $WORK_HOME "frontend.pid"
    
    $FrontendStarted = $true
    if (Test-Path $FrontendPidFile) {
        $ExistingPid = Get-Content $FrontendPidFile -ErrorAction SilentlyContinue | Where-Object { $_ -match "^\d+$" }
        if ($ExistingPid) {
            $Process = Get-Process -Id $ExistingPid -ErrorAction SilentlyContinue
            if ($Process) {
                Write-Log "WARN" "Frontend service is already running (PID: $ExistingPid)"
                Write-Log "INFO" "Skipping frontend start"
                $FrontendStarted = $false
            } else {
                Write-Log "INFO" "Removing stale PID file"
                Remove-Item $FrontendPidFile -Force -ErrorAction SilentlyContinue
            }
        }
    }
    
    if ($FrontendStarted) {
        Write-Log "INFO" "Starting frontend service, log file: $FrontendLog"
        
        if (Test-Path $FrontendLog) {
            Remove-Item $FrontendLog -Force -ErrorAction SilentlyContinue
        }
        "" | Out-File -FilePath $FrontendLog -Encoding utf8 -NoNewline
        
        $FrontendJob = Start-Job -ScriptBlock {
            param($WorkDir, $LogFile)
            Set-Location $WorkDir
            $OutputEncoding = [System.Text.Encoding]::UTF8
            [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
            # Use 2>&1 in cmd to merge stderr so npm/vite warnings don't trigger NativeCommandError and exit under ErrorActionPreference=Stop
            cmd /c "chcp 65001 >nul && npm run dev 2>&1" | Out-File -FilePath $LogFile -Encoding utf8 -Append
        } -ArgumentList $FRONTEND_DIR, $FrontendLog
        
        Start-Sleep -Seconds 5
        $NodeProcesses = Get-WmiObject Win32_Process | Where-Object { 
            $_.ProcessName -eq "node.exe" -and $_.CommandLine -like "*vite*" 
        } | Sort-Object CreationDate -Descending | Select-Object -First 1
        
        $ActualFrontendPid = $null
        if ($NodeProcesses) {
            $ActualFrontendPid = $NodeProcesses.ProcessId
            $ActualFrontendPid | Out-File -FilePath $FrontendPidFile -Encoding ascii
            Write-Log "INFO" "Frontend service started (Node PID: $ActualFrontendPid)"
        } else {
            Write-Log "WARN" "Could not find Node.js process, frontend may still be starting"
            $FrontendJob.Id | Out-File -FilePath $FrontendPidFile -Encoding ascii
            Write-Log "INFO" "Frontend job started (Job ID: $($FrontendJob.Id))"
        }
        
        Start-Sleep -Seconds 5
        Write-Log "INFO" "Latest frontend logs:"
        if (Test-Path $FrontendLog) {
            try {
                $logLines = Get-Content $FrontendLog -Tail 20 -ErrorAction SilentlyContinue
                if ($logLines) {
                    $logLines | ForEach-Object { Write-Host $_ }
                }
            } catch {
                Write-Log "WARN" "Could not read frontend log: $_"
            }
        }
    }
    
    Set-Location $PrevLocation
}

function Start-Services {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Starting Services" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Check if directories exist
    if (-not (Test-Path $BACKEND_DIR)) {
        Write-Log "ERROR" "Backend directory not found: $BACKEND_DIR"
        Write-Log "ERROR" "Please run full installation first: .\setup.ps1"
        exit 1
    }
    
    if (-not (Test-Path $FRONTEND_DIR)) {
        Write-Log "ERROR" "Frontend directory not found: $FRONTEND_DIR"
        Write-Log "ERROR" "Please run full installation first: .\setup.ps1"
        exit 1
    }
    
    # Check if .env file exists
    if (-not (Test-Path $TARGET_ENV_FILE)) {
        Write-Log "ERROR" ".env file not found: $TARGET_ENV_FILE"
        Write-Log "ERROR" "Please run full installation first: .\setup.ps1"
        exit 1
    }
    
    Start-BackendService
    Start-FrontendService
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Services Started Successfully" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    Show-Status -NoExit
    return
}

function Restart-Services {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Restarting Services" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # First, stop services
    Write-Log "INFO" "Stopping services..."
    Stop-Services -NoExit
    
    # Wait a bit before restarting
    Write-Log "INFO" "Waiting 2 seconds before restarting services..."
    Start-Sleep -Seconds 2
    
    # Now start services
    Write-Log "INFO" "Starting services..."
    Start-Services
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Services Restarted Successfully" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    return
}

# ===================== Parameter Parsing =====================
# Parameter validation is done via PowerShell attributes: [ValidateSet] (DbType), [ValidateNotNullOrEmpty] (Branch), [CmdletBinding()] (reject unknown params)

if ($Help) {
    Show-Help
}

if ($Status) {
    Show-Status
}

if ($Stop) {
    Stop-Services
}

if ($Start) {
    Start-Services
    exit 0
}

if ($Restart) {
    Restart-Services
    exit 0
}

# ===================== Resume from Checkpoint =====================
# Check if we should continue from last checkpoint
$LAST_PROGRESS = ""
$LAST_PROGRESS = Read-Progress
if (-not [string]::IsNullOrEmpty($LAST_PROGRESS)) {
    Write-Log "WARN" "Detected previous deployment progress: $LAST_PROGRESS"
    $Continue = Read-Host "Continue from last checkpoint? (y/n, default y)"
    if ($Continue -ne "n" -and $Continue -ne "N") {
        Write-Log "INFO" "Will continue from checkpoint: $LAST_PROGRESS"
    } else {
        Clear-Progress
        $LAST_PROGRESS = ""
        Write-Log "INFO" "Progress cleared, starting fresh deployment"
    }
}

# ===================== Pre-check =====================
Write-Log "INFO" "===== Starting Agent-Studio Deployment (Windows Version) ====="
Write-Log "INFO" "Working Directory: $WORK_HOME"

# Check Windows version
$OSVersion = [System.Environment]::OSVersion.Version
if ($OSVersion.Major -lt 10) {
    Write-Log "ERROR" "This script requires Windows 10 or later, current version: $($OSVersion.Major).$($OSVersion.Minor)"
    exit 1
}

# Check PowerShell version
$PSVersion = $PSVersionTable.PSVersion
if ($PSVersion.Major -lt 5) {
    Write-Log "ERROR" "This script requires PowerShell 5.1 or later, current version: $($PSVersion.Major).$($PSVersion.Minor)"
    exit 1
}

# Check execution policy
$ExecutionPolicy = Get-ExecutionPolicy
if ($ExecutionPolicy -eq "Restricted") {
    Write-Log "WARN" "Current execution policy is Restricted, need to modify execution policy"
    Write-Log "INFO" "Please run as administrator: Set-ExecutionPolicy RemoteSigned"
    exit 1
}

# Unblock all scripts to avoid security warnings
Unblock-AllScripts -WorkHome $WORK_HOME

# ===================== Install Basic Tools =====================
$STEP = "check_tools"
if (Test-SkipStep -CurrentStep $STEP -LastProgress $LAST_PROGRESS) {
    Write-Log "INFO" "Skipping: Basic tools check (already completed)"
} else {
    Write-Log "INFO" "===== Checking Basic Tools ===="
    $Scripts = @("check_git.ps1", "check_nodejs.ps1", "check_python.ps1")

    # Add MySQL check if database type is MySQL
    if ($DbType -eq "mysql") {
        $Scripts += "check_mysql.ps1"
    }

    $PythonExePath = $null

    foreach ($Script in $Scripts) {
        $ScriptPath = Join-Path $WORK_HOME $Script
        Test-File $ScriptPath
        Write-Log "INFO" "Executing script: $ScriptPath"
        & $ScriptPath
        
        if ($LASTEXITCODE -ne 0) {
            Write-Log "ERROR" "Execution of $Script failed"
            exit 1
        }
    }
    Save-Progress -Step $STEP
}

# Get Python executable path from environment variable set by check_python.ps1
if ($env:PYTHON_EXE_PATH) {
    $PythonExePath = $env:PYTHON_EXE_PATH.Trim()
    Write-Log "INFO" "Found Python executable from environment variable: $PythonExePath"
} else {
    Write-Log "ERROR" "PYTHON_EXE_PATH environment variable not found"
    Write-Log "ERROR" "Please ensure Python is installed and check_python.ps1 completed successfully"
    exit 1
}

# Verify Python executable path exists (version already checked in check_python.ps1)
if (-not (Test-Path $PythonExePath)) {
    Write-Log "ERROR" "Python executable path not found or invalid: $PythonExePath"
    Write-Log "ERROR" "Please ensure Python is installed and check_python.ps1 completed successfully"
    exit 1
}

# Refresh PATH environment variable to include newly installed tools
Write-Log "INFO" "Refreshing PATH environment variable..."
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::Machine) + ";" + [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::User)

# Add Python path to current session PATH
$PythonDir = Split-Path -Parent $PythonExePath
$ScriptsDir = Join-Path $PythonDir "Scripts"
if ($env:PATH -notlike "*$PythonDir*") {
    $env:PATH = "$PythonDir;$ScriptsDir;" + $env:PATH
}

# Check basic commands
Test-Command "git"
Test-Command "node"
Test-Command "npm"

Write-Log "INFO" "Will use Python executable at: $PythonExePath"

# ===================== Fetching Code =====================
$STEP = "fetch_code"
if (Test-SkipStep -CurrentStep $STEP -LastProgress $LAST_PROGRESS) {
    Write-Log "INFO" "Skipping: Code fetch (already completed)"
    if (-not (Test-Path (Join-Path $WORK_HOME "agent-studio"))) {
        Write-Log "WARN" "Code directory not found, re-fetching..."
        $LAST_PROGRESS = ""
    }
} else {
    Write-Log "INFO" "===== Fetching Code ====="
    Write-Log "INFO" "Using branch: $Branch"
    $FetchScript = Join-Path $WORK_HOME "fetch_codes.ps1"
    Test-File $FetchScript
    & $FetchScript -Branch $Branch
    if ($LASTEXITCODE -ne 0) {
        Write-Log "ERROR" "Code fetching failed"
        exit 1
    }

    # Check code directories
    Test-Directory (Join-Path $WORK_HOME "agent-studio")
    Test-Directory $BACKEND_DIR
    Test-Directory $FRONTEND_DIR
    Save-Progress -Step $STEP
}

# ===================== Configure AES Key =====================
$STEP = "config_aes"
if (Test-SkipStep -CurrentStep $STEP -LastProgress $LAST_PROGRESS) {
    Write-Log "INFO" "Skipping: AES key configuration (already completed)"
    if ([string]::IsNullOrEmpty($env:SERVER_AES_MASTER_KEY_ENV) -and (Test-Path $TARGET_ENV_FILE)) {
        Write-Log "WARN" "AES key not set, will read from .env file (if exists)"
    }
} else {
    Write-Log "INFO" "===== Configuring AES Key ======"
    $AESKey = $null

    # Try to use existing build_AES_master_key.ps1 script
    $AESScript = Join-Path $BACKEND_DIR "build_AES_master_key.ps1"
    if (Test-Path $AESScript) {
        Write-Log "INFO" "Executing AES key generation script: $AESScript"
        $AESKey = & $AESScript
        if ([string]::IsNullOrEmpty($AESKey)) {
            Write-Log "WARN" "AES key generation script returned empty result, generating key dynamically"
            $AESKey = $null
        }
    } else {
        Write-Log "INFO" "AES key generation script not found, generating key dynamically"
    }

    # Generate AES key dynamically if script not found or failed
    if ([string]::IsNullOrEmpty($AESKey)) {
        Write-Log "INFO" "Generating AES key dynamically..."
        # Generate a random 32-byte key (256 bits) and convert to base64
        $RandomBytes = New-Object byte[] 32
        $Rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        $Rng.GetBytes($RandomBytes)
        $Rng.Dispose()
        $AESKey = [Convert]::ToBase64String($RandomBytes)
    }

    $env:SERVER_AES_MASTER_KEY_ENV = $AESKey
    Write-Log "INFO" "AES key set: $($AESKey.Substring(0, [Math]::Min(8, $AESKey.Length)))**** (partially hidden)"
    Save-Progress -Step $STEP
}

# ===================== Configure .env File =====================
$STEP = "config_env"
if (Test-SkipStep -CurrentStep $STEP -LastProgress $LAST_PROGRESS) {
    Write-Log "INFO" "Skipping: .env file configuration (already completed)"
} else {
    Write-Log "INFO" "===== Configuring .env File ====="
    Test-File $ENV_EXAMPLE_FILE
    if (Test-Path $TARGET_ENV_FILE) {
        $BackupEnv = "$TARGET_ENV_FILE.bak.$(Get-Date -Format 'yyyyMMddHHmmss')"
        Copy-Item $TARGET_ENV_FILE $BackupEnv
        Write-Log "INFO" "Backed up existing .env file: $BackupEnv"
    }
    # 按字节复制，避免 Copy-Item 在 Windows 上把 LF 转成 CRLF 导致 UTF-8 中文乱码
    [System.IO.File]::WriteAllBytes($TARGET_ENV_FILE, [System.IO.File]::ReadAllBytes($ENV_EXAMPLE_FILE))
    Test-File $TARGET_ENV_FILE

    # Replace DB_TYPE and ports
    Write-Log "INFO" "Setting database type to: $DbType"
    Write-Log "INFO" "Setting FRONTEND_PORT to: $FrontendPort, BACKEND_PORT to: $BackendPort"
    $Content = Get-Content $TARGET_ENV_FILE -Raw -Encoding UTF8
    if ($DbType -eq "sqlite") {
        $Content = $Content -replace "DB_TYPE=mysql", "DB_TYPE=sqlite"
    } else {
        $Content = $Content -replace "DB_TYPE=sqlite", "DB_TYPE=mysql"
    }
    $Content = $Content -replace "FRONTEND_PORT=\d+", "FRONTEND_PORT=$FrontendPort"
    $Content = $Content -replace "BACKEND_PORT=\d+", "BACKEND_PORT=$BackendPort"
    $Content = $Content -replace "VITE_API_PROXY_TARGET=http://localhost:\d+/", "VITE_API_PROXY_TARGET=http://localhost:${BackendPort}/"
    $Content = $Content -replace 'ALLOWED_ORIGINS=\["http://localhost:\d+","http://127\.0\.0\.1:\d+"\]', "ALLOWED_ORIGINS=[`"http://localhost:${FrontendPort}`",`"http://127.0.0.1:${FrontendPort}`"]"
    # 统一为 LF 换行并用 UTF-8 无 BOM 写回，避免 CRLF 导致配置解析/编码错误
    $Content = $Content -replace "`r`n", "`n" -replace "`r", "`n"
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($TARGET_ENV_FILE, $Content, $utf8NoBom)

    # Verify replacement result
    $DBTypeActual = (Select-String -Path $TARGET_ENV_FILE -Pattern "^DB_TYPE=").Line -replace "DB_TYPE=", ""
    if ($DBTypeActual -ne $DbType) {
        Write-Log "WARN" "DB_TYPE configuration may not have taken effect, current value: $DBTypeActual (expected: $DbType)"
    } else {
        Write-Log "INFO" "DB_TYPE configured successfully: $DbType"
    }
    $FrontendPortActual = (Select-String -Path $TARGET_ENV_FILE -Pattern "^FRONTEND_PORT=").Line -replace "FRONTEND_PORT=", ""
    $BackendPortActual = (Select-String -Path $TARGET_ENV_FILE -Pattern "^BACKEND_PORT=").Line -replace "BACKEND_PORT=", ""
    Write-Log "INFO" "FRONTEND_PORT configured: $FrontendPortActual, BACKEND_PORT configured: $BackendPortActual"

    Save-Progress -Step $STEP
}



# ===================== MySQL Database Configuration =====================
if ($DbType -eq "mysql") {
    $STEP = "config_mysql"
    if (Test-SkipStep -CurrentStep $STEP -LastProgress $LAST_PROGRESS) {
        Write-Log "INFO" "Skipping: MySQL database configuration (already completed)"
    } else {
        Write-Log "INFO" "===== MySQL Database Configuration ====="
        
        # Call config_mysql.ps1 to create databases
        $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
        $ConfigMySQLPath = Join-Path $ScriptDir "config_mysql.ps1"
        Write-Log "INFO" "Calling config_mysql.ps1 to create MySQL databases..."
        # Set WORK_HOME environment variable so config_mysql.ps1 can find .env file
        $env:WORK_HOME = $WORK_HOME
        & $ConfigMySQLPath
        if ($LASTEXITCODE -eq 0) {
            Write-Log "SUCCESS" "MySQL databases configured successfully"
        } else {
            Write-Log "WARN" "MySQL database configuration may have failed (exit code: $LASTEXITCODE)"
            Write-Log "INFO" "Please verify that databases are created correctly"
        }
        
        Write-Log "INFO" "Continuing with deployment..."
        Save-Progress -Step $STEP
    }
}

# ===================== Deploy Backend =====================
$STEP = "deploy_backend"
if (Test-SkipStep -CurrentStep $STEP -LastProgress $LAST_PROGRESS) {
    Write-Log "INFO" "Skipping: Backend deployment (already completed)"
    Set-Location $BACKEND_DIR
} else {
    Write-Log "INFO" "===== Deploying Backend ====="
    Set-Location $BACKEND_DIR

    # Install uv
    Write-Log "INFO" "Installing uv tool"
    if ($PythonExePath) {
        Write-Log "INFO" "Using Python executable at: $PythonExePath"
        & $PythonExePath -m pip install --user uv
    } else {
        Write-Log "INFO" "Using python command from PATH"
        python -m pip install --user uv
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Log "ERROR" "Failed to install uv"
        exit 1
    }

    # Ensure uv is in PATH
    $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $UvPath = Join-Path $env:USERPROFILE "AppData\Roaming\Python\Python311\Scripts"
    if ($UserPath -notlike "*$UvPath*") {
        [Environment]::SetEnvironmentVariable("Path", "$UserPath;$UvPath", "User")
        $env:Path += ";$UvPath"
    }
    Test-Command "uv"

    Write-Log "INFO" "Creating/resetting uv virtual environment"

    # Ensure the virtual environment directory is clean before creating
    $VenvPath = ".venv"

    if (Test-Path $VenvPath) {
        Write-Log "INFO" "Removing existing virtual environment directory: .venv"
        if (Remove-DirectoryRobust -Path $VenvPath) {
            Write-Log "INFO" "Existing virtual environment directory removed successfully"
        } else {
            Write-Log "WARN" "Failed to remove existing virtual environment directory using robust methods"
            Write-Log "INFO" "Attempting to use uv venv --clear to recreate virtual environment..."
        }
    }

    # Use the found Python executable path (version already verified in check_python.ps1)
    if (-not $PythonExePath -or -not (Test-Path $PythonExePath)) {
        Write-Log "ERROR" "Python executable path not found or invalid: $PythonExePath"
        Write-Log "ERROR" "Please ensure Python is installed and check_python.ps1 completed successfully"
        exit 1
    }

    Write-Log "INFO" "Using Python executable at: $PythonExePath for virtual environment"
    uv venv --clear --python $PythonExePath
    if ($LASTEXITCODE -ne 0) {
        # Check if .venv directory still exists (both manual removal and uv --clear failed)
        if (Test-Path $VenvPath) {
            Write-Log "ERROR" "Failed to create virtual environment"
            Write-Log "ERROR" "The .venv directory cannot be removed, likely because it is in use by running processes."
            Write-Host ""
            Write-Host "Solution 1 (Recommended): Stop all services first" -ForegroundColor Yellow
            Write-Host "  Run: .\setup.ps1 -Stop" -ForegroundColor Green
            Write-Host "  Then retry the deployment: .\setup.ps1" -ForegroundColor Green
            Write-Host ""
            Write-Host "Solution 2: Manually delete the directory" -ForegroundColor Yellow
            Write-Host "  1. Close all applications that might be using the .venv directory" -ForegroundColor White
            Write-Host "  2. Stop any running backend services" -ForegroundColor White
            Write-Host "  3. Manually delete the directory:" -ForegroundColor White
            Write-Host "     $BACKEND_DIR\.venv" -ForegroundColor Cyan
            Write-Host "  4. Then retry the deployment: .\setup.ps1" -ForegroundColor Green
            Write-Host ""
            exit 1
        } else {
            Write-Log "ERROR" "Failed to create virtual environment"
            exit 1
        }
    }

    Write-Log "INFO" "Installing pip in virtual environment"
    & "$BACKEND_DIR\.venv\Scripts\python.exe" -m ensurepip --upgrade
    if ($LASTEXITCODE -ne 0) {
        Write-Log "ERROR" "Failed to install pip in virtual environment"
        exit 1
    }

    Write-Log "INFO" "Syncing dependencies using pip"
    & "$BACKEND_DIR\.venv\Scripts\pip3.exe" install -e .[dev]
    if ($LASTEXITCODE -ne 0) {
        Write-Log "ERROR" "Failed to sync dependencies"
        exit 1
    }

    # Create log directory
    $LogDir = Join-Path $BACKEND_DIR "logs\run"
    if (-not (Test-Path $LogDir)) {
        New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    }
    Save-Progress -Step $STEP
}


# ===================== Deploy Frontend =====================
$STEP = "deploy_frontend"
if (Test-SkipStep -CurrentStep $STEP -LastProgress $LAST_PROGRESS) {
    Write-Log "INFO" "Skipping: Frontend deployment (already completed)"
    Set-Location $FRONTEND_DIR
} else {
    Write-Log "INFO" "===== Deploying Frontend ===="
    Set-Location $FRONTEND_DIR

    Write-Log "INFO" "Installing frontend dependencies"
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Log "ERROR" "Failed to install frontend dependencies"
        exit 1
    }
    Save-Progress -Step $STEP
}


# ===================== Start Services =====================
$STEP = "start_services"
if (Test-SkipStep -CurrentStep $STEP -LastProgress $LAST_PROGRESS) {
    Write-Log "INFO" "Skipping: Service startup (already completed)"
} else {
    Write-Log "INFO" "===== Starting Services ====="
    try {
        Start-Services
        Save-Progress -Step $STEP
    } catch {
        Write-Log "WARN" "Service startup reported an error (services may still be running): $_"
        try { Save-Progress -Step $STEP } catch { }
    }
}

# Return to installation directory (failure does not affect completion message)
try {
    Set-Location $WORK_HOME
} catch {
    Write-Log "WARN" "Could not change to working directory: $($_.Exception.Message)"
}

# ===================== Completion =====================
try {
    Write-Log "SUCCESS" "========================================="
    Write-Log "SUCCESS" "========= Deployment Completed ========="
    Write-Log "SUCCESS" "========================================="

    # Clear progress file on successful completion
    Clear-Progress

} catch {
    Write-Log "WARN" "Post-completion step failed: $($_.Exception.Message)"
    Write-Log "SUCCESS" "========= Deployment Completed ========="
    Show-Status
}

exit 0