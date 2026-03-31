# PowerShell Script: Configure MySQL Databases (Windows Version)
# Save this file as UTF-8 with BOM when editing to avoid encoding issues.
[CmdletBinding()]
param(
    [string]$AppDbUser = "openjiuwen",
    [string]$AppDbPassword = "openjiuwen"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = 'SilentlyContinue'

# ===================== Load Utility Functions =====================
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$UtilsScript = Join-Path $ScriptDir "utils.ps1"
. $UtilsScript

# ===================== MySQL Configuration =====================
# Read MySQL configuration from .env file, use defaults if not found
# WORK_HOME should be set by the calling script (setup.ps1), otherwise use current script directory
$WORK_HOME = if ($env:WORK_HOME) { 
    $env:WORK_HOME 
} else { 
    # Fallback: use the directory containing this script (should be setup_scripts_windows)
    $PSScriptRoot 
}
$ENV_FILE = Join-Path $WORK_HOME "agent-studio\.env"

# Default MySQL configuration values 
$MYSQL_HOST = "localhost"
$MYSQL_PORT = 3306
$MYSQL_OPS_DB_NAME = "openjiuwen_ops"
$MYSQL_AGENT_DB_NAME = "openjiuwen_agent"
$MYSQL_RUNTIME_DB_NAME = "jiuwen_runtime"

$APP_DB_USER = $AppDbUser
$APP_DB_PASSWORD = $AppDbPassword

# Try to read configuration from .env file
if (Test-Path $ENV_FILE) {
    try {
        # Read DB_HOST
        $DB_HOST_LINE = Select-String -Path $ENV_FILE -Pattern "^DB_HOST=" -ErrorAction SilentlyContinue
        if ($DB_HOST_LINE) {
            $HostValue = ($DB_HOST_LINE.Line -replace "DB_HOST=", "").Trim() -replace "`"", "" -replace "'", ""
            if (-not [string]::IsNullOrEmpty($HostValue)) {
                $MYSQL_HOST = $HostValue
            }
        }
        
        # Read DB_PORT
        $DB_PORT_LINE = Select-String -Path $ENV_FILE -Pattern "^DB_PORT=" -ErrorAction SilentlyContinue
        if ($DB_PORT_LINE) {
            $PortValue = ($DB_PORT_LINE.Line -replace "DB_PORT=", "").Trim() -replace "`"", "" -replace "'", ""
            if (-not [string]::IsNullOrEmpty($PortValue) -and $PortValue -match "^\d+$") {
                $MYSQL_PORT = [int]$PortValue
            }
        }
        
        # Read OPS_DB_NAME
        $OPS_DB_NAME_LINE = Select-String -Path $ENV_FILE -Pattern "^OPS_DB_NAME=" -ErrorAction SilentlyContinue
        if ($OPS_DB_NAME_LINE) {
            $OpsDbValue = ($OPS_DB_NAME_LINE.Line -replace "OPS_DB_NAME=", "").Trim() -replace "`"", "" -replace "'", ""
            if (-not [string]::IsNullOrEmpty($OpsDbValue)) {
                $MYSQL_OPS_DB_NAME = $OpsDbValue
            }
        }
        
        # Read AGENT_DB_NAME
        $AGENT_DB_NAME_LINE = Select-String -Path $ENV_FILE -Pattern "^AGENT_DB_NAME=" -ErrorAction SilentlyContinue
        if ($AGENT_DB_NAME_LINE) {
            $AgentDbValue = ($AGENT_DB_NAME_LINE.Line -replace "AGENT_DB_NAME=", "").Trim() -replace "`"", "" -replace "'", ""
            if (-not [string]::IsNullOrEmpty($AgentDbValue)) {
                $MYSQL_AGENT_DB_NAME = $AgentDbValue
            }
        }

        # Read RUNTIME_DB_NAME (fallback to DB_NAME for compatibility)
        $RUNTIME_DB_NAME_LINE = Select-String -Path $ENV_FILE -Pattern "^RUNTIME_DB_NAME=" -ErrorAction SilentlyContinue
        if ($RUNTIME_DB_NAME_LINE) {
            $RuntimeDbValue = ($RUNTIME_DB_NAME_LINE.Line -replace "RUNTIME_DB_NAME=", "").Trim() -replace "`"", "" -replace "'", ""
            if (-not [string]::IsNullOrEmpty($RuntimeDbValue)) {
                $MYSQL_RUNTIME_DB_NAME = $RuntimeDbValue
            }
        } else {
            $DB_NAME_LINE = Select-String -Path $ENV_FILE -Pattern "^DB_NAME=" -ErrorAction SilentlyContinue
            if ($DB_NAME_LINE) {
                $DbNameValue = ($DB_NAME_LINE.Line -replace "DB_NAME=", "").Trim() -replace "`"", "" -replace "'", ""
                if (-not [string]::IsNullOrEmpty($DbNameValue)) {
                    $MYSQL_RUNTIME_DB_NAME = $DbNameValue
                }
            }
        }
        
        Write-Log 'INFO' ('MySQL configuration loaded from .env file')
        Write-Log 'INFO' ('  Host: ' + $MYSQL_HOST)
        Write-Log 'INFO' ('  Port: ' + $MYSQL_PORT)
        Write-Log 'INFO' ('  OPS Database: ' + $MYSQL_OPS_DB_NAME)
        Write-Log 'INFO' ('  AGENT Database: ' + $MYSQL_AGENT_DB_NAME)
        Write-Log 'INFO' ('  RUNTIME Database: ' + $MYSQL_RUNTIME_DB_NAME)
    } catch {
        Write-Log 'WARN' ('Failed to read MySQL configuration from .env file, using defaults: ' + $_.Exception.Message)
    }
} else {
    Write-Log 'INFO' ('.env file not found at ' + $ENV_FILE + ', using default MySQL configuration')
}

function Invoke-MySQLCommand {
    param(
        [string]$MySQLExePath,
        [string]$User,
        [string]$MySQLHost,
        [int]$Port,
        [string]$Password = $null,
        [string]$SqlCommand
    )
    
    # Try different authentication methods for MySQL 8.0+ compatibility
    $AuthMethods = @(
        @{ Name = "caching_sha2_password"; Args = @("--default-auth=caching_sha2_password") },
        @{ Name = "auto"; Args = @() },
        @{ Name = "mysql_native_password"; Args = @("--default-auth=mysql_native_password") }
    )
    
    foreach ($AuthMethod in $AuthMethods) {
        try {
            $MySQLArgs = @("-u", $User, "-h", $MySQLHost, "-P", $Port.ToString())
            $MySQLArgs += $AuthMethod.Args
            
            if ($Password) {
                $env:MYSQL_PWD = $Password
            }
            
            $Result = $SqlCommand | & $MySQLExePath $MySQLArgs 2>&1 | Out-String
            $ExitCode = $LASTEXITCODE
            
            if ($Password) {
                Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
            }
            
            # Check if it's an authentication plugin error
            if ($Result -match "Plugin 'mysql_native_password' is not loaded" -or 
                $Result -match "Plugin 'caching_sha2_password' is not loaded") {
                # Try next authentication method
                continue
            }
            
            # Return result and exit code
            return @{
                Result = $Result
                ExitCode = $ExitCode
                AuthMethod = $AuthMethod.Name
            }
        } catch {
            # Try next authentication method
            if ($Password) {
                Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
            }
            continue
        }
    }
    
    # If all methods failed, return the last error
    return @{
        Result = "All authentication methods failed"
        ExitCode = 1
        AuthMethod = "none"
    }
}

function Create-MySQLDatabases {
    param(
        [string]$MySQLExePath,
        [string]$RootPassword = $null,
        [string]$OPS_DB_NAME = $null,
        [string]$AGENT_DB_NAME = $null,
        [string]$RUNTIME_DB_NAME = $null
    )
    
    if ([string]::IsNullOrEmpty($OPS_DB_NAME)) { $OPS_DB_NAME = $MYSQL_OPS_DB_NAME }
    if ([string]::IsNullOrEmpty($AGENT_DB_NAME)) { $AGENT_DB_NAME = $MYSQL_AGENT_DB_NAME }
    if ([string]::IsNullOrEmpty($RUNTIME_DB_NAME)) { $RUNTIME_DB_NAME = $MYSQL_RUNTIME_DB_NAME }
    
    # Root password: MYSQL_ROOT_PWD or MYSQL_PWD (set by check_mysql.ps1), then param
    $RootPwd = if ($env:MYSQL_ROOT_PWD) { $env:MYSQL_ROOT_PWD } elseif ($env:MYSQL_PWD) { $env:MYSQL_PWD } elseif (-not [string]::IsNullOrEmpty($RootPassword)) { $RootPassword } else { $null }
    
    Write-Log 'INFO' ('Creating MySQL databases and app account')
    Write-Log 'INFO' ('OPS Database: ' + $OPS_DB_NAME + ', AGENT Database: ' + $AGENT_DB_NAME + ', RUNTIME Database: ' + $RUNTIME_DB_NAME)
    Write-Log 'INFO' ('App account: ' + $APP_DB_USER )
    
    # Ensure MySQL service is running
    $Service = Get-Service -Name "MySQL*" -ErrorAction SilentlyContinue
    if ($Service -and $Service.Status -ne "Running") {
        Write-Log 'INFO' ('Starting MySQL service...')
        try {
            Start-Service -Name $Service.Name -ErrorAction Stop
            Start-Sleep -Seconds 5
            $Service.Refresh()
            if ($Service.Status -eq "Running") {
                Write-Log 'SUCCESS' ('MySQL service started')
            } else {
                throw ('Service started but status is still ' + $Service.Status)
            }
        } catch {
            Write-Log 'ERROR' ('Failed to start MySQL service: ' + $_.Exception.Message)
            return $false
        }
    } elseif ($Service) {
        Write-Log 'INFO' ('MySQL service is running')
    } else {
        Write-Log 'WARN' ('MySQL service not found, but continuing...')
    }

    Write-Log 'INFO' ('Waiting for MySQL to be ready...')
    Start-Sleep -Seconds 5
    
    $CreateOPSDB = 'CREATE DATABASE IF NOT EXISTS ' + $OPS_DB_NAME + ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;'
    $CreateAGENTDB = 'CREATE DATABASE IF NOT EXISTS ' + $AGENT_DB_NAME + ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;'
    $CreateRUNTIMEDB = 'CREATE DATABASE IF NOT EXISTS ' + $RUNTIME_DB_NAME + ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;'
    $SqlCreateDbs = $CreateOPSDB + "`n" + $CreateAGENTDB + "`n" + $CreateRUNTIMEDB

    $CheckUserSql = "SELECT COUNT(*) FROM mysql.user WHERE user='$APP_DB_USER' AND host='localhost';"
    $GrantSql = 'GRANT ALL PRIVILEGES ON ' + $OPS_DB_NAME + '.* TO ''' + $APP_DB_USER + '''@''localhost''; GRANT ALL PRIVILEGES ON ' + $AGENT_DB_NAME + '.* TO ''' + $APP_DB_USER + '''@''localhost''; GRANT ALL PRIVILEGES ON ' + $RUNTIME_DB_NAME + '.* TO ''' + $APP_DB_USER + '''@''localhost''; FLUSH PRIVILEGES;'
    
    $RootConnected = $false
    $RootPwdUsed = $null
    
    foreach ($TryPwd in @($RootPwd, $null)) {
        $R = Invoke-MySQLCommand -MySQLExePath $MySQLExePath -User 'root' -MySQLHost $MYSQL_HOST -Port $MYSQL_PORT -Password $TryPwd -SqlCommand $SqlCreateDbs
        if ($R.ExitCode -eq 0 -and $R.Result -notmatch 'Access denied|1045|ERROR') {
            $RootConnected = $true
            $RootPwdUsed = $TryPwd
            Write-Log 'SUCCESS' ('Connected as root, creating databases...')
            break
        }
    }
    
    if (-not $RootConnected) {
        Write-Log 'ERROR' ('Cannot connect as root, check root password or use empty password')
        return $false
    }
    
    # Create databases (run as root)
    $R1 = Invoke-MySQLCommand -MySQLExePath $MySQLExePath -User 'root' -MySQLHost $MYSQL_HOST -Port $MYSQL_PORT -Password $RootPwdUsed -SqlCommand $SqlCreateDbs
    if ($R1.ExitCode -ne 0 -or ($R1.Result -match 'Access denied|1045|ERROR' -and $R1.Result -notmatch '\[Warning\]')) {
        Write-Log 'ERROR' ('Create database failed: ' + $R1.Result)
        return $false
    }
    Write-Log 'SUCCESS' ('Databases ' + $OPS_DB_NAME + ', ' + $AGENT_DB_NAME + ', ' + $RUNTIME_DB_NAME + ' created or already exist')
    
    # Check if app user exists
    $R2 = Invoke-MySQLCommand -MySQLExePath $MySQLExePath -User 'root' -MySQLHost $MYSQL_HOST -Port $MYSQL_PORT -Password $RootPwdUsed -SqlCommand $CheckUserSql
    $CountLine = ($R2.Result -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -match "^\d+$" }) | Select-Object -Last 1
    $UserExists = $false
    if ($R2.ExitCode -eq 0 -and $CountLine -match "^\d+$") {
        $UserExists = [int]$CountLine -gt 0
    }
    
    if ($UserExists) {
        $AlterSql = "ALTER USER '${APP_DB_USER}'@'localhost' IDENTIFIED BY '$APP_DB_PASSWORD';"
        $R3 = Invoke-MySQLCommand -MySQLExePath $MySQLExePath -User 'root' -MySQLHost $MYSQL_HOST -Port $MYSQL_PORT -Password $RootPwdUsed -SqlCommand $AlterSql
        if ($R3.ExitCode -ne 0 -and $R3.Result -match 'Access denied|1045|ERROR' -and $R3.Result -notmatch '\[Warning\]') {
            Write-Log 'WARN' ('Update user ' + $APP_DB_USER + ' password failed, continue grant: ' + $R3.Result)
        } else {
            Write-Log 'SUCCESS' ('User ' + $APP_DB_USER + ' password updated')
        }
    } else {
        $CreateUserSql = "CREATE USER '${APP_DB_USER}'@'localhost' IDENTIFIED BY '$APP_DB_PASSWORD';"
        $R3 = Invoke-MySQLCommand -MySQLExePath $MySQLExePath -User 'root' -MySQLHost $MYSQL_HOST -Port $MYSQL_PORT -Password $RootPwdUsed -SqlCommand $CreateUserSql
        if ($R3.ExitCode -ne 0 -or ($R3.Result -match 'Access denied|1045|ERROR' -and $R3.Result -notmatch '\[Warning\]')) {
            Write-Log 'ERROR' ('Create user ' + $APP_DB_USER + ' failed: ' + $R3.Result)
            return $false
        }
        Write-Log 'SUCCESS' ('User ' + $APP_DB_USER + ' created')
    }
    
    # Grant privileges to app account (DBs visible/usable under this account)
    $R4 = Invoke-MySQLCommand -MySQLExePath $MySQLExePath -User 'root' -MySQLHost $MYSQL_HOST -Port $MYSQL_PORT -Password $RootPwdUsed -SqlCommand $GrantSql
    if ($R4.ExitCode -ne 0 -or ($R4.Result -match 'Access denied|1045|ERROR' -and $R4.Result -notmatch '\[Warning\]')) {
        Write-Log 'ERROR' ('Grant failed: ' + $R4.Result)
        return $false
    }
    Write-Log 'SUCCESS' ('Granted ' + $APP_DB_USER + ' on ' + $OPS_DB_NAME + ', ' + $AGENT_DB_NAME + ', ' + $RUNTIME_DB_NAME)
    
    # Verify DB with app account (DBs visible under this account)
    Write-Log 'INFO' ('Verify DB with app account: ' + $APP_DB_USER)
    $VerifySQL = "SHOW DATABASES;"
    $VerifyR = Invoke-MySQLCommand -MySQLExePath $MySQLExePath -User $APP_DB_USER -MySQLHost $MYSQL_HOST -Port $MYSQL_PORT -Password $APP_DB_PASSWORD -SqlCommand $VerifySQL
    if ($VerifyR.ExitCode -eq 0 -and $VerifyR.Result -match $OPS_DB_NAME -and $VerifyR.Result -match $AGENT_DB_NAME -and $VerifyR.Result -match $RUNTIME_DB_NAME) {
        Write-Log 'SUCCESS' ('App account can access DB: ' + $OPS_DB_NAME + ', ' + $AGENT_DB_NAME + ', ' + $RUNTIME_DB_NAME)
        return $true
    }
    Write-Log 'WARN' ('Verify failed or DB missing, check grant. Output: ' + $VerifyR.Result)
    return $false
}

function Start-MySQLDatabaseConfig {
    # Get MySQL executable path from environment variable and validate
    $MySQLExePath = $env:MYSQL_EXE_PATH
    if (-not $MySQLExePath -or -not (Test-Path -LiteralPath $MySQLExePath)) {
        $ErrMsg = if (-not $MySQLExePath) { 'MySQL executable path not found in environment variable MYSQL_EXE_PATH' } else { 'MySQL executable path not found: ' + $MySQLExePath }
        Write-Log 'ERROR' ($ErrMsg)
        Write-Log 'INFO' ('Please ensure check_mysql.ps1 has been executed and MySQL is installed')
        Write-Log 'INFO' ('Connection details: ' + $APP_DB_USER + '@' + $MYSQL_HOST + ':' + $MYSQL_PORT)
        Write-Log 'INFO' ('Please create the following databases manually:')
        Write-Log 'INFO' ('1. Database: ' + $MYSQL_OPS_DB_NAME)
        Write-Log 'INFO' ('2. Database: ' + $MYSQL_AGENT_DB_NAME)
        Write-Log 'INFO' ('3. Database: ' + $MYSQL_RUNTIME_DB_NAME)
        Write-Log 'INFO' ('CREATE DATABASE IF NOT EXISTS ' + $MYSQL_OPS_DB_NAME + ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;')
        Write-Log 'INFO' ('CREATE DATABASE IF NOT EXISTS ' + $MYSQL_AGENT_DB_NAME + ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;')
        Write-Log 'INFO' ('CREATE DATABASE IF NOT EXISTS ' + $MYSQL_RUNTIME_DB_NAME + ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;')
        return $false
    }

    Write-Log 'INFO' ('Using MySQL executable from environment variable: ' + $MySQLExePath)
    Write-Log 'INFO' ('Creating databases: ' + $MYSQL_OPS_DB_NAME + ', ' + $MYSQL_AGENT_DB_NAME + ' and ' + $MYSQL_RUNTIME_DB_NAME)
    Write-Log 'INFO' ('Connection details: ' + $APP_DB_USER + '@' + $MYSQL_HOST + ':' + $MYSQL_PORT)

    # Create databases
    $Result = Create-MySQLDatabases -MySQLExePath $MySQLExePath

    if ($Result) {
        return $true
    } else {
        Write-Log 'WARN' ('MySQL database configuration may have failed')
        Write-Log 'INFO' ('Please verify that databases ' + $MYSQL_OPS_DB_NAME + ', ' + $MYSQL_AGENT_DB_NAME + ' and ' + $MYSQL_RUNTIME_DB_NAME + ' exist')
        return $false
    }
}

# Script entry point
if ($MyInvocation.InvocationName -ne '.') {
    $Result = Start-MySQLDatabaseConfig
    if (-not $Result) {
        exit 1
    }
    exit 0
}

