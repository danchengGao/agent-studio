# PowerShell Script: Clone agent-studio Repository (Windows Version)
param(
    [string]$Branch = "develop"
)

$ErrorActionPreference = "Stop"

# Get the script directory to load utils.ps1
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$UtilsScript = Join-Path $ScriptDir "utils.ps1"
. $UtilsScript

$RepoUrl = "https://gitcode.com/openJiuwen/agent-studio.git"
$TargetDir = "agent-studio"

function Test-Git {
    $null = Get-Command git -ErrorAction SilentlyContinue
    if (-not $?) {
        Write-Log "ERROR" "git not installed, please install git first"
        exit 1
    }
}

function Test-AndHandleDir {
    Write-Log "INFO" "Checking if target directory [$TargetDir] exists..."
    
    if (Test-Path $TargetDir) {
        Write-Log "WARN" "Directory $TargetDir already exists!"
        $Option = Read-Host "Choose action: 1=Delete and re-clone 2=Keep and skip (default: 2)"
        
        switch ($Option) {
            "1" {
                Write-Log "WARN" "Deleting existing directory $TargetDir..."
                $FullPathToDelete = if (Test-Path $TargetDir) {
                    (Get-Item $TargetDir -Force).FullName
                } else {
                    (Join-Path (Get-Location) $TargetDir)
                }
                
                if (Remove-DirectoryRobust -Path $TargetDir) {
                    Write-Log "SUCCESS" "Directory deleted, preparing to clone repository..."
                } else {
                    # Deletion failed, show error message
                    Write-Log "ERROR" "Failed to delete directory after trying multiple methods."
                    Write-Log "ERROR" "The directory cannot be deleted, likely because it is in use by running processes or the path is too long."
                    $FullPath = $FullPathToDelete
                    Write-Host ""
                    Write-Host "Solution 1 (Recommended): Stop all services first" -ForegroundColor Yellow
                    Write-Host "  Run: .\setup.ps1 -Stop" -ForegroundColor Green
                    Write-Host "  Then retry the deployment: .\setup.ps1" -ForegroundColor Green
                    Write-Host ""
                    Write-Host "Solution 2: Manually delete the directory" -ForegroundColor Yellow
                    Write-Host "  1. Close all applications that might be using the directory" -ForegroundColor White
                    Write-Host "  2. Stop any running services (backend/frontend)" -ForegroundColor White
                    Write-Host "  3. Manually delete the directory:" -ForegroundColor White
                    Write-Host "     $FullPath" -ForegroundColor Cyan
                    Write-Host "  4. Then retry the deployment: .\setup.ps1" -ForegroundColor Green
                    Write-Host ""
                    exit 1
                }
            }
            default {
                Write-Log "INFO" "Keeping existing directory, skipping clone operation"
                exit 0
            }
        }
    } else {
        Write-Log "SUCCESS" "Target directory doesn't exist, can clone normally"
    }
}

function Clone-Repo {
    Write-Log "INFO" "Starting to clone repository: $RepoUrl"
    Write-Log "INFO" "Using branch: $Branch"
    git clone -b $Branch $RepoUrl $TargetDir
    
    if ($LASTEXITCODE -eq 0) {
        $FullPath = (Resolve-Path $TargetDir).Path
        Write-Log "SUCCESS" "✅ Repository cloned successfully! Target directory: $FullPath"
    } else {
        Write-Log "ERROR" "❌ Repository clone failed, please check network or repository address"
        exit 1
    }
}

Write-Log "INFO" "=== Starting agent-studio Repository Clone Process ==="

Test-Git
Test-AndHandleDir
Clone-Repo

Write-Log "SUCCESS" "=== Operation Completed ==="
exit 0