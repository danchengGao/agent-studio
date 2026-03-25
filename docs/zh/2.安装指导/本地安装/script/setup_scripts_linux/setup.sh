#!/bin/bash
# Note: do not use set -e, for better control of error handling and retry
set -uo pipefail  # undefined var check and pipefail, but do not auto-exit

# ===================== Basic config =====================
WORK_HOME=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)  # script dir (not cwd), more stable
BACKEND_DIR="${WORK_HOME}/agent-studio/backend"
FRONTEND_DIR="${WORK_HOME}/agent-studio/frontend"
TARGET_ENV_FILE="${WORK_HOME}/agent-studio/.env"
ENV_EXAMPLE_FILE="${WORK_HOME}/agent-studio/.env.example"
LOG_FILE="${WORK_HOME}/setup.log"
PROGRESS_FILE="${WORK_HOME}/.setup_progress"

# Load user config (proxy, mirrors, registries, etc.) and export proxies
if [ -f "${WORK_HOME}/utils.sh" ]; then
    # shellcheck source=utils.sh
    . "${WORK_HOME}/utils.sh"
    apply_http_proxy
fi

INSTALL_STEPS=(
    "check_tools"
    "fetch_code"
    "config_aes"
    "config_env"
    "check_database"
    "deploy_backend"
    "start_backend"
    "deploy_frontend"
    "start_frontend"
)


# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'  # reset

# ===================== Helper functions =====================
# Log: print to console and append to log file
log() {
    local LEVEL=$1
    shift
    local MSG="$*"
    local TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
    local LOG_MSG="[${TIMESTAMP}] [${LEVEL}] ${MSG}"
    
    # Print to console with color
    case "$LEVEL" in
        ERROR)
            echo -e "${RED}${LOG_MSG}${NC}" >&2
            ;;
        WARN)
            echo -e "${YELLOW}${LOG_MSG}${NC}"
            ;;
        SUCCESS)
            echo -e "${GREEN}${LOG_MSG}${NC}"
            ;;
        INFO)
            echo -e "${BLUE}${LOG_MSG}${NC}"
            ;;
        *)
            echo "${LOG_MSG}"
            ;;
    esac
    
    # Append to log file
    echo "${LOG_MSG}" >> "$LOG_FILE" 2>/dev/null || true
}

# Save progress
save_progress() {
    local STEP=$1
    echo "$STEP" > "$PROGRESS_FILE" 2>/dev/null || true
    log "INFO" "Progress saved: $STEP"
}

# Read progress
read_progress() {
    if [ -f "$PROGRESS_FILE" ]; then
        cat "$PROGRESS_FILE" 2>/dev/null || echo ""
    else
        echo ""
    fi
}

# Clear progress
clear_progress() {
    rm -f "$PROGRESS_FILE" 2>/dev/null || true
}

# Decide whether to skip current step (resume from last progress)
should_skip_step() {
    # Args: $1 current step name (e.g. "deploy_backend"), $2 last progress
    # Return: 0 = skip, 1 = run
    local current_step="$1"
    local last_progress="$2"

    if [[ -z "$last_progress" ]]; then
        return 1
    fi

    local current_index=-1
    local last_index=-1
    local i

    # Find index of current step and last progress in list
    for i in "${!INSTALL_STEPS[@]}"; do
        if [[ "${INSTALL_STEPS[$i]}" == "$current_step" ]]; then
            current_index=$i
        fi
        if [[ "${INSTALL_STEPS[$i]}" == "$last_progress" ]]; then
            last_index=$i
        fi
    done

    if [[ $current_index -eq -1 ]] || [[ $last_index -eq -1 ]]; then
        return 1
    fi

    # Skip if last completed step index >= current step index
    if [[ $last_index -ge $current_index ]]; then
        return 0
    else
        return 1
    fi
}

# Execute with retry
retry_execute() {
    local MAX_RETRIES=${1:-3}
    local RETRY_DELAY=${2:-5}
    local STEP_NAME="$3"
    shift 3
    local COMMAND="$*"
    
    local ATTEMPT=1
    local LAST_ERROR=""
    
    while [ $ATTEMPT -le $MAX_RETRIES ]; do
        log "INFO" "[Attempt $ATTEMPT/$MAX_RETRIES] Executing: $STEP_NAME"
        
        if eval "$COMMAND" 2>&1; then
            log "SUCCESS" "$STEP_NAME completed successfully"
            return 0
        else
            LAST_ERROR=$?
            log "WARN" "$STEP_NAME failed (exit code: $LAST_ERROR), retrying in ${RETRY_DELAY}s..."
            if [ $ATTEMPT -lt $MAX_RETRIES ]; then
                sleep $RETRY_DELAY
            fi
            ATTEMPT=$((ATTEMPT + 1))
        fi
    done
    
    log "ERROR" "$STEP_NAME failed after $MAX_RETRIES attempts"
    return $LAST_ERROR
}

# Error exit with recovery hint
error_exit() {
    local MSG="$1"
    local RECOVERY_HINT="${2:-}"
    
    log "ERROR" "========================================="
    log "ERROR" "Deployment failed: $MSG"
    if [ -n "$RECOVERY_HINT" ]; then
        log "ERROR" ""
        log "ERROR" "Recovery suggestion:"
        echo -e "${YELLOW}$RECOVERY_HINT${NC}" >&2
    fi
    log "ERROR" "========================================="
    log "ERROR" "See log for details: $LOG_FILE"
    log "ERROR" "Progress saved; re-run the script to resume deployment"
    exit 1
}

# Load NVM, Conda, user PATH, etc.
load_environments() {
    # NVM (if Node.js was installed via NVM)
    if [ -s "$HOME/.nvm/nvm.sh" ]; then
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" 2>/dev/null || true
        [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion" 2>/dev/null || true
    fi
    
    # Conda (if Python was installed via Conda)
    if [ -s "$HOME/miniconda3/etc/profile.d/conda.sh" ]; then
        source "$HOME/miniconda3/etc/profile.d/conda.sh" 2>/dev/null || true
    elif [ -s "$HOME/anaconda3/etc/profile.d/conda.sh" ]; then
        source "$HOME/anaconda3/etc/profile.d/conda.sh" 2>/dev/null || true
    elif [ -s "/opt/conda/etc/profile.d/conda.sh" ]; then
        source "/opt/conda/etc/profile.d/conda.sh" 2>/dev/null || true
    fi
    
    # Ensure user local bin is in PATH (uv, pip, etc.)
    if [ -d "$HOME/.local/bin" ] && [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
        export PATH="$HOME/.local/bin:$PATH"
    fi
    if [ -d "/root/.local/bin" ] && [[ ":$PATH:" != *":/root/.local/bin:"* ]]; then
        export PATH="/root/.local/bin:$PATH"
    fi
}

# Check if command exists (load env first)
check_command() {
    local CMD="$1"
    
    load_environments
    
    if ! command -v "$CMD" &> /dev/null; then
        case "$CMD" in
            node|npm)
                # Try loading NVM again
                if [ -s "$HOME/.nvm/nvm.sh" ]; then
                    export NVM_DIR="$HOME/.nvm"
                    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" 2>/dev/null || true
                fi
                ;;
            uv)
                # Check user install path
                if [ -f "$HOME/.local/bin/uv" ] && [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
                    export PATH="$HOME/.local/bin:$PATH"
                elif [ -f "/root/.local/bin/uv" ] && [[ ":$PATH:" != *":/root/.local/bin:"* ]]; then
                    export PATH="/root/.local/bin:$PATH"
                fi
                ;;
            python3.11)
                # Check conda env
                if [ -s "$HOME/miniconda3/envs/py311/bin/python3.11" ]; then
                    load_environments
                    if [ ! -f "/usr/local/bin/python3.11" ] && [ -f "$HOME/miniconda3/envs/py311/bin/python3.11" ]; then
                        log "WARN" "python3.11 is in conda env but symlink not found"
                    fi
                fi
                ;;
        esac
        
        if ! command -v "$CMD" &> /dev/null; then
            error_exit "Required command '$CMD' not found, please install it first" \
                "Install $CMD manually and re-run the script"
        fi
    fi
}

# Check file exists (optionally create)
check_file() {
    local FILE=$1
    local CREATE_IF_NOT_EXIST=${2:-false}
    if [ ! -f "$FILE" ]; then
        if [ "$CREATE_IF_NOT_EXIST" = true ]; then
            log "WARN" "File $FILE not found, creating empty file"
            mkdir -p "$(dirname "$FILE")" && touch "$FILE" || {
                error_exit "Failed to create $FILE" \
                    "Check directory permissions: $(dirname "$FILE")"
            }
        else
            error_exit "File $FILE not found, cannot continue" \
                "Ensure code is fetched or create the file manually"
        fi
    fi
}

# Check directory exists
check_dir() {
    local DIR=$1
    if [ ! -d "$DIR" ]; then
        error_exit "Directory $DIR not found, cannot continue" \
            "Check code fetch or create directory: mkdir -p $DIR"
    fi
}

# Check and fix script execute permission
check_script_permission() {
    local SCRIPT=$1
    if [ -f "$SCRIPT" ] && [ ! -x "$SCRIPT" ]; then
        log "WARN" "Script $SCRIPT missing execute permission, fixing..."
        chmod +x "$SCRIPT" || {
            log "WARN" "Cannot add execute permission for $SCRIPT, will run with bash"
            return 1
        }
        log "SUCCESS" "Execute permission added for $SCRIPT"
    fi
}

# Wait for service to listen on port (by port, not PID)
wait_port_ready() {
    local PORT=$1
    local NAME=$2
    local TIMEOUT=${3:-3}
    local COUNT=0
    local PID=""

    log "INFO" "Waiting for $NAME to listen on port $PORT..."
    while [ $COUNT -lt $TIMEOUT ]; do
        PID=$(find_pid_by_port "$PORT")
        if [ -n "$PID" ]; then
            log "SUCCESS" "$NAME is listening on port $PORT (PID: $PID)"
            return 0
        fi
        sleep 1
        COUNT=$((COUNT + 1))
    done

    log "WARN" "$NAME startup timeout (port $PORT not listening within ${TIMEOUT}s)"
    return 1
}

# Get PID and all child PIDs
get_process_tree() {
    local PID=$1
    local PIDS="$PID"
    
    if [ -z "$PID" ] || ! ps -p "$PID" > /dev/null 2>&1; then
        echo ""
        return 0
    fi
    
    local CHILDREN=$(pgrep -P "$PID" 2>/dev/null || echo "")
    if [ -n "$CHILDREN" ]; then
        for CHILD in $CHILDREN; do
            GRANDCHILDREN=$(get_process_tree "$CHILD")
            if [ -n "$GRANDCHILDREN" ]; then
                PIDS="$PIDS $GRANDCHILDREN"
        fi
    done
    fi
    
    echo "$PIDS"
}

# Stop process and all children
stop_process_tree() {
    local PID=$1
    local NAME=$2
    
    if [ -z "$PID" ] || ! ps -p "$PID" > /dev/null 2>&1; then
        return 0
    fi
    
    local ALL_PIDS=$(get_process_tree "$PID")
    
    # Stop children first (leaf to root)
    for P in $ALL_PIDS; do
        if [ "$P" != "$PID" ] && ps -p "$P" > /dev/null 2>&1; then
            kill "$P" 2>/dev/null || true
        fi
    done
    sleep 1
    
    kill "$PID" 2>/dev/null || true
    sleep 2
    
    if ps -p "$PID" > /dev/null 2>&1; then
        log "WARN" "$NAME did not respond to SIGTERM, forcing stop in 3s..."
        sleep 3
        if ps -p "$PID" > /dev/null 2>&1; then
            log "WARN" "Force stopping $NAME and child processes..."
            for P in $ALL_PIDS; do
                if ps -p "$P" > /dev/null 2>&1; then
                    kill -9 "$P" 2>/dev/null || true
                fi
            done
        fi
    fi
    
    sleep 1
    if ! ps -p "$PID" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Find process PID by port
find_pid_by_port() {
    local PORT=$1
    local PID=""
    
    if command -v lsof &> /dev/null; then
        PID=$(lsof -ti:$PORT 2>/dev/null | head -n 1 || echo "")
    fi
    
    if [ -z "$PID" ] && command -v ss &> /dev/null; then
        PID=$(ss -tlnp 2>/dev/null | grep ":$PORT " | grep -oP "pid=\K\d+" | head -n 1 || echo "")
    fi
    
    if [ -z "$PID" ] && command -v netstat &> /dev/null; then
        PID=$(netstat -tlnp 2>/dev/null | grep ":$PORT " | awk '{print $7}' | cut -d'/' -f1 | head -n 1 || echo "")
        if [ -z "$PID" ]; then
            PID=$(netstat -tunlp 2>/dev/null | grep ":$PORT " | awk '{print $7}' | cut -d'/' -f1 | head -n 1 || echo "")
        fi
    fi
    
    echo "$PID"
}

# Get backend port from log or .env
get_backend_port() {
    local LOG_FILE=$1
    local DEFAULT_PORT=${2:-8000}
    local PORT="$DEFAULT_PORT"
    
    if [ -f "$LOG_FILE" ]; then
        PORT_FROM_LOG=$(grep -oP "(0\.0\.0\.0|localhost|127\.0\.0\.1):\K\d+" "$LOG_FILE" 2>/dev/null | tail -n 1 || echo "")
        if [ -n "$PORT_FROM_LOG" ] && [ "$PORT_FROM_LOG" -ge 1 ] && [ "$PORT_FROM_LOG" -le 65535 ]; then
            PORT="$PORT_FROM_LOG"
        fi
    fi
    
    if [ -f "${WORK_HOME}/agent-studio/.env" ]; then
        ENV_PORT=$(grep -E "^BACKEND_PORT=|^SERVER_PORT=|^PORT=" "${WORK_HOME}/agent-studio/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | head -n 1 || echo "")
        if [ -n "$ENV_PORT" ] && [ "$ENV_PORT" -ge 1 ] && [ "$ENV_PORT" -le 65535 ]; then
            PORT="$ENV_PORT"
        fi
    fi
    
    echo "$PORT"
}

# Get frontend port from log (Vite output) or default
get_frontend_port() {
    local LOG_FILE=$1
    local DEFAULT_PORT=${2:-3000}
    local PORT="$DEFAULT_PORT"
    
    if [ -f "$LOG_FILE" ]; then
        PORT_FROM_LOG=$(grep -E "(Local:|Network:)" "$LOG_FILE" 2>/dev/null | grep -oP "http://[^:]+:\K\d+" | tail -n 1 || echo "")
        if [ -n "$PORT_FROM_LOG" ] && [ "$PORT_FROM_LOG" -ge 1000 ] && [ "$PORT_FROM_LOG" -le 65535 ]; then
            PORT="$PORT_FROM_LOG"
        fi
    fi
    
    echo "$PORT"
}

# Check service status (output format aligned with Windows)
check_status() {
    BACKEND_PID_FILE="${WORK_HOME}/backend.pid"
    FRONTEND_PID_FILE="${WORK_HOME}/frontend.pid"
    BACKEND_LOG="${WORK_HOME}/backend.log"
    FRONTEND_LOG="${WORK_HOME}/frontend.log"
    
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
    if [ -z "$LOCAL_IP" ] || [ "$LOCAL_IP" = "127.0.0.1" ]; then
        LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}' || echo "localhost")
    fi
    
    echo -e "${YELLOW}Frontend Service:${NC}"
    FRONTEND_PID=""
    FRONTEND_PORT=$(get_frontend_port "$FRONTEND_LOG" "3000")
    PID_FROM_FILE=""
    if [ -f "$FRONTEND_PID_FILE" ]; then
        PID_FROM_FILE=$(cat "$FRONTEND_PID_FILE" 2>/dev/null || echo "")
    fi
    
    PORT_PID=$(find_pid_by_port "$FRONTEND_PORT")
    if [ -n "$PORT_PID" ] && ps -p "$PORT_PID" > /dev/null 2>&1; then
        if ps -p "$PORT_PID" -o cmd= 2>/dev/null | grep -qE "(node|vite|npm.*dev)" 2>/dev/null; then
            FRONTEND_PID="$PORT_PID"
            echo -e "  Status: ${GREEN}Running${NC}"
            echo -e "  PID: $FRONTEND_PID"
            if [ -n "$PID_FROM_FILE" ] && [ "$PID_FROM_FILE" != "$FRONTEND_PID" ]; then
                echo -e "  ${YELLOW}Warning: PID file does not match port process${NC}"
            fi
        fi
    fi
    
    if [ -z "$FRONTEND_PID" ] && [ -n "$PID_FROM_FILE" ]; then
        if ps -p "$PID_FROM_FILE" > /dev/null 2>&1; then
            if ps -p "$PID_FROM_FILE" -o cmd= 2>/dev/null | grep -qE "(node|vite|npm.*dev)" 2>/dev/null; then
                FRONTEND_PID="$PID_FROM_FILE"
                echo -e "  Status: ${GREEN}Running${NC}"
                echo -e "  PID: $FRONTEND_PID"
                echo -e "  ${YELLOW}Warning: Could not detect by port, port config may be incorrect${NC}"
            fi
        fi
    fi
    
    if [ -z "$FRONTEND_PID" ] && command -v pgrep &> /dev/null; then
        NODE_PIDS=$(pgrep -f "npm.*dev|vite|node.*frontend" 2>/dev/null | grep -v "^$$" || echo "")
        for NODE_PID in $NODE_PIDS; do
            if ps -p "$NODE_PID" -o cmd= 2>/dev/null | grep -qE "(frontend|vite|npm.*dev)" 2>/dev/null; then
                FRONTEND_PID="$NODE_PID"
                echo -e "  Status: ${GREEN}Running${NC}"
                echo -e "  PID: $FRONTEND_PID"
                echo -e "  ${YELLOW}Warning: Could not detect by port${NC}"
                break
            fi
        done
    fi
    
    if [ -n "$FRONTEND_PID" ] && ps -p "$FRONTEND_PID" > /dev/null 2>&1; then
        echo -e "  Local: ${GREEN}http://localhost:${FRONTEND_PORT}${NC}"
        echo -e "  Network: ${GREEN}http://${LOCAL_IP}:${FRONTEND_PORT}${NC}"
    else
        echo -e "  Status: ${RED}Not Running${NC}"
        if [ -f "$FRONTEND_PID_FILE" ]; then
            OLD_PID=$(cat "$FRONTEND_PID_FILE" 2>/dev/null || echo "")
            if [ -n "$OLD_PID" ]; then
                echo -e "  Note: PID file exists but process not found (PID: $OLD_PID)"
            fi
        else
            echo -e "  Note: PID file not found"
        fi
    fi
    echo -e "  Log File: ${GREEN}${FRONTEND_LOG}${NC}"
    echo ""
    
    echo -e "${YELLOW}Backend Service:${NC}"
    BACKEND_PID=""
    BACKEND_PORT=$(get_backend_port "$BACKEND_LOG" "8000")
    
    if [ -f "$BACKEND_PID_FILE" ]; then
        BACKEND_PID=$(cat "$BACKEND_PID_FILE" 2>/dev/null || echo "")
        if [ -n "$BACKEND_PID" ] && ps -p "$BACKEND_PID" > /dev/null 2>&1; then
            if ps -p "$BACKEND_PID" -o cmd= 2>/dev/null | grep -qE "(python.*main\.py|uvicorn|fastapi)" 2>/dev/null; then
                echo -e "  Status: ${GREEN}Running${NC}"
                echo -e "  PID: $BACKEND_PID"
            else
                BACKEND_PID=""
            fi
        else
            BACKEND_PID=""
        fi
    fi
    
    if [ -z "$BACKEND_PID" ]; then
        PORT_PID=$(find_pid_by_port "$BACKEND_PORT")
        if [ -n "$PORT_PID" ] && ps -p "$PORT_PID" > /dev/null 2>&1; then
            if ps -p "$PORT_PID" -o cmd= 2>/dev/null | grep -qE "(python.*main\.py|uvicorn|fastapi)" 2>/dev/null; then
                echo -e "  Status: ${GREEN}Running (detected by port)${NC}"
                echo -e "  PID: $PORT_PID"
                echo -e "  ${YELLOW}Warning: PID file not found or expired${NC}"
                BACKEND_PID="$PORT_PID"
            fi
        fi
    fi
    
    if [ -n "$BACKEND_PID" ] && ps -p "$BACKEND_PID" > /dev/null 2>&1; then
        echo -e "  Local: ${GREEN}http://localhost:${BACKEND_PORT}${NC}"
        echo -e "  Network: ${GREEN}http://${LOCAL_IP}:${BACKEND_PORT}${NC}"
        echo -e "  API Docs: ${GREEN}http://localhost:${BACKEND_PORT}/api/docs${NC}"
        echo -e "  Health: ${GREEN}http://localhost:${BACKEND_PORT}/api/health${NC}"
    else
        echo -e "  Status: ${RED}Not Running${NC}"
        if [ -f "$BACKEND_PID_FILE" ]; then
            OLD_PID=$(cat "$BACKEND_PID_FILE" 2>/dev/null || echo "")
            if [ -n "$OLD_PID" ]; then
                echo -e "  Note: PID file exists but process not found (PID: $OLD_PID)"
            fi
        else
            echo -e "  Note: PID file not found"
        fi
    fi
    echo -e "  Log File: ${GREEN}${BACKEND_LOG}${NC}"
    echo ""
    
    echo -e "${YELLOW}Manage Service:${NC}"
    echo -e "  Stop Services: ${GREEN}./setup.sh --stop${NC}"
    echo -e "  Start Services: ${GREEN}./setup.sh --start${NC}"
    echo -e "  Restart Services: ${GREEN}./setup.sh --restart${NC}"
    echo -e "  Check Status: ${GREEN}./setup.sh --status${NC}"
    
    return 0
}

# Gracefully stop services
stop_services() {
    log "INFO" "===== Stopping services ====="
    
    BACKEND_PID_FILE="${WORK_HOME}/backend.pid"
    FRONTEND_PID_FILE="${WORK_HOME}/frontend.pid"
    
    local STOPPED=0
    
    BACKEND_PID=""
    if [ -f "$BACKEND_PID_FILE" ]; then
        BACKEND_PID=$(cat "$BACKEND_PID_FILE" 2>/dev/null || echo "")
        if [ -n "$BACKEND_PID" ] && ps -p "$BACKEND_PID" > /dev/null 2>&1; then
            log "INFO" "Stopping backend service (PID: $BACKEND_PID)..."
            if stop_process_tree "$BACKEND_PID" "Backend service"; then
                log "SUCCESS" "Backend service stopped (PID: $BACKEND_PID)"
                rm -f "$BACKEND_PID_FILE"
                STOPPED=$((STOPPED + 1))
            else
                log "ERROR" "Failed to stop backend service (PID: $BACKEND_PID)"
            fi
        else
            log "WARN" "Backend not running (PID file exists but process not found)"
            rm -f "$BACKEND_PID_FILE"
        fi
    fi
    
    BACKEND_PORT=$(get_backend_port "${WORK_HOME}/backend.log" "8000")
    PORT_PID=$(find_pid_by_port "$BACKEND_PORT")
    if [ -n "$PORT_PID" ] && [ "$PORT_PID" != "$BACKEND_PID" ] && ps -p "$PORT_PID" > /dev/null 2>&1; then
        if ps -p "$PORT_PID" -o cmd= 2>/dev/null | grep -qE "(python.*main\.py|uvicorn|fastapi)" 2>/dev/null; then
            log "WARN" "Port $BACKEND_PORT still in use by backend (PID: $PORT_PID), stopping..."
            if stop_process_tree "$PORT_PID" "Backend (port $BACKEND_PORT)"; then
                log "SUCCESS" "Stopped backend process on port $BACKEND_PORT"
                STOPPED=$((STOPPED + 1))
            fi
        fi
    fi
    
    FRONTEND_PID=""
    if [ -f "$FRONTEND_PID_FILE" ]; then
        FRONTEND_PID=$(cat "$FRONTEND_PID_FILE" 2>/dev/null || echo "")
        if [ -n "$FRONTEND_PID" ] && ps -p "$FRONTEND_PID" > /dev/null 2>&1; then
            log "INFO" "Stopping frontend service (PID: $FRONTEND_PID)..."
            if stop_process_tree "$FRONTEND_PID" "Frontend service"; then
                log "SUCCESS" "Frontend service stopped (PID: $FRONTEND_PID)"
                rm -f "$FRONTEND_PID_FILE"
                STOPPED=$((STOPPED + 1))
            else
                log "ERROR" "Failed to stop frontend service (PID: $FRONTEND_PID)"
            fi
        else
            log "WARN" "Frontend not running (PID file exists but process not found)"
            rm -f "$FRONTEND_PID_FILE"
        fi
    fi
    
    FRONTEND_PORT=$(get_frontend_port "${WORK_HOME}/frontend.log" "3000")
    PORT_PID=$(find_pid_by_port "$FRONTEND_PORT")
    if [ -n "$PORT_PID" ] && [ "$PORT_PID" != "$FRONTEND_PID" ] && ps -p "$PORT_PID" > /dev/null 2>&1; then
        if ps -p "$PORT_PID" -o cmd= 2>/dev/null | grep -qE "(node|vite|npm.*dev)" 2>/dev/null; then
            log "WARN" "Port $FRONTEND_PORT still in use by frontend (PID: $PORT_PID), stopping..."
            if stop_process_tree "$PORT_PID" "Frontend (port $FRONTEND_PORT)"; then
                log "SUCCESS" "Stopped frontend process on port $FRONTEND_PORT"
                STOPPED=$((STOPPED + 1))
            fi
        fi
    fi
    
    if command -v pgrep &> /dev/null; then
        NODE_PIDS=$(pgrep -f "npm.*dev|vite|node.*frontend" 2>/dev/null | grep -v "^$$" || echo "")
        if [ -n "$NODE_PIDS" ]; then
            for NODE_PID in $NODE_PIDS; do
                if ps -p "$NODE_PID" -o cmd= 2>/dev/null | grep -qE "(frontend|vite|npm.*dev)" 2>/dev/null; then
                    if [ "$NODE_PID" != "$FRONTEND_PID" ] && [ "$NODE_PID" != "$PORT_PID" ]; then
                        log "WARN" "Possible frontend process detected (PID: $NODE_PID), stopping..."
                        if stop_process_tree "$NODE_PID" "Frontend (orphan)"; then
                            log "SUCCESS" "Stopped orphan frontend process (PID: $NODE_PID)"
                            STOPPED=$((STOPPED + 1))
                        fi
                    fi
                fi
            done
        fi
    fi
    
    if [ $STOPPED -gt 0 ]; then
        log "SUCCESS" "Stopped $STOPPED service(s)"
    else
        log "INFO" "No running services to stop"
    fi
    
    return 0
}

# Start backend (check dir/.env, read AES key)
start_backend() {
    local BACKEND_LOG="${WORK_HOME}/backend.log"
    local BACKEND_PID_FILE="${WORK_HOME}/backend.pid"

    if [ ! -d "$BACKEND_DIR" ]; then
        log "ERROR" "Backend directory not found: $BACKEND_DIR"
        error_exit "Backend directory not found, cannot start service" \
            "Run full install first: ./setup.sh"
    fi

    if [ ! -f "$TARGET_ENV_FILE" ]; then
        log "ERROR" ".env file not found: $TARGET_ENV_FILE"
        error_exit ".env file not found, cannot start service" \
            "Run full install first: ./setup.sh"
    fi

    if [ -z "${SERVER_AES_MASTER_KEY_ENV:-}" ] && [ -f "$TARGET_ENV_FILE" ]; then
        local AES_KEY_LINE
        AES_KEY_LINE=$(grep '^SERVER_AES_MASTER_KEY=' "$TARGET_ENV_FILE" 2>/dev/null | head -n 1)
        if [ -n "$AES_KEY_LINE" ]; then
            SERVER_AES_MASTER_KEY_ENV=$(echo "$AES_KEY_LINE" | cut -d'=' -f2 | tr -d '"' | tr -d "'")
            log "INFO" "Reading AES key from .env file"
        fi
    fi

    if [ -z "${SERVER_AES_MASTER_KEY_ENV:-}" ]; then
        log "WARN" "AES key not found, generating temporary key (recommend running full install)"
        if command -v python3.11 &> /dev/null; then
            local AES_SCRIPT="${WORK_HOME}/agent-studio/scripts/build_AES_master_key.sh"
            if [ -f "$AES_SCRIPT" ]; then
                SERVER_AES_MASTER_KEY_ENV=$(bash "$AES_SCRIPT" 2>/dev/null || echo "")
            fi
        fi
        if [ -z "${SERVER_AES_MASTER_KEY_ENV:-}" ]; then
            SERVER_AES_MASTER_KEY_ENV=$(openssl rand -base64 32 2>/dev/null || echo "")
        fi
    fi

    export SERVER_AES_MASTER_KEY_ENV
    log "INFO" "AES key set: ${SERVER_AES_MASTER_KEY_ENV:0:8}**** (partially hidden)"

    local BACKEND_PORT_START
    BACKEND_PORT_START=$(get_backend_port "$BACKEND_LOG" "8000")
    if [ -f "$BACKEND_PID_FILE" ]; then
        local OLD_PID
        OLD_PID=$(cat "$BACKEND_PID_FILE" 2>/dev/null || echo "")
        local PORT_PID_NOW
        PORT_PID_NOW=$(find_pid_by_port "$BACKEND_PORT_START")
        if [ -n "$OLD_PID" ] && [ -n "$PORT_PID_NOW" ] && [ "$OLD_PID" = "$PORT_PID_NOW" ]; then
            if ps -p "$OLD_PID" > /dev/null 2>&1 && ps -p "$OLD_PID" -o cmd= 2>/dev/null | grep -qE "(python.*main\.py|uvicorn|fastapi)" 2>/dev/null; then
                log "WARN" "Backend already running (PID: $OLD_PID, port: $BACKEND_PORT_START), skipping start"
                return 0
            fi
        fi
        log "INFO" "Cleaning old PID file"
        rm -f "$BACKEND_PID_FILE"
    fi

    log "INFO" "Starting backend service, log file: $BACKEND_LOG"
    cd "$BACKEND_DIR" || error_exit "Cannot cd to backend directory"

    if [ ! -f ".venv/bin/activate" ]; then
        error_exit "Virtual environment not found" \
            "Run full install first: ./setup.sh"
    fi

    source .venv/bin/activate || error_exit "Failed to activate virtual environment"

    if [ -n "${SERVER_AES_MASTER_KEY_ENV:-}" ]; then
        export SERVER_AES_MASTER_KEY_ENV
    fi

    local CONFIG_BACKEND_PORT
    CONFIG_BACKEND_PORT=$(grep '^BACKEND_PORT=' "$TARGET_ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" || echo "8000")
    if [ -n "$CONFIG_BACKEND_PORT" ] && [ "$CONFIG_BACKEND_PORT" -ge 1 ] && [ "$CONFIG_BACKEND_PORT" -le 65535 ]; then
        export BACKEND_PORT="$CONFIG_BACKEND_PORT"
        log "INFO" "Using backend port from .env: $BACKEND_PORT"
    fi

    python main.py > "$BACKEND_LOG" 2>&1 &
    local LAUNCH_PID=$!
    echo "$LAUNCH_PID" > "$BACKEND_PID_FILE"

    sleep 2
    sleep 3

    local BACKEND_PORT
    BACKEND_PORT=$(get_backend_port "$BACKEND_LOG" "8000")
    if ! wait_port_ready "$BACKEND_PORT" "Backend service" 3; then
        log "WARN" "Backend startup abnormal, see log: $BACKEND_LOG"
        log "WARN" "Last 20 lines of log:"
        tail -n 20 "$BACKEND_LOG" 2>/dev/null || true
    else
        local PORT_PID
        PORT_PID=$(find_pid_by_port "$BACKEND_PORT")
        if [ -n "$PORT_PID" ]; then
            echo "$PORT_PID" > "$BACKEND_PID_FILE"
            log "SUCCESS" "Backend started (PID: $PORT_PID, port: $BACKEND_PORT)"
        fi
    fi
}

# Start frontend (check dir and deps)
start_frontend() {
    local FRONTEND_LOG="${WORK_HOME}/frontend.log"
    local FRONTEND_PID_FILE="${WORK_HOME}/frontend.pid"

    if [ ! -d "$FRONTEND_DIR" ]; then
        log "ERROR" "Frontend directory not found: $FRONTEND_DIR"
        error_exit "Frontend directory not found, cannot start service" \
            "Run full install first: ./setup.sh"
    fi

    if [ -f "$FRONTEND_PID_FILE" ]; then
        local OLD_PID
        OLD_PID=$(cat "$FRONTEND_PID_FILE" 2>/dev/null || echo "")
        if [ -n "$OLD_PID" ] && ps -p "$OLD_PID" > /dev/null 2>&1; then
            log "WARN" "Frontend already running (PID: $OLD_PID), skipping start"
            return 0
        fi
        log "INFO" "Cleaning old PID file"
        rm -f "$FRONTEND_PID_FILE"
    fi

    log "INFO" "Starting frontend service, log file: $FRONTEND_LOG"
    cd "$FRONTEND_DIR" || error_exit "Cannot cd to frontend directory"

    if [ ! -d "node_modules" ]; then
        error_exit "Frontend dependencies not installed, cannot start service" \
            "Run full install first: ./setup.sh"
    fi

    load_environments
    check_command "node"
    check_command "npm"

    npm run dev > "$FRONTEND_LOG" 2>&1 &
    local NPM_PID=$!
    echo "$NPM_PID" > "$FRONTEND_PID_FILE"

    sleep 3

    local FRONTEND_PORT
    FRONTEND_PORT=$(get_frontend_port "$FRONTEND_LOG" "3000")
    if ! wait_port_ready "$FRONTEND_PORT" "Frontend service" 3; then
        log "WARN" "Frontend startup abnormal, see log: $FRONTEND_LOG"
        log "WARN" "Last 10 lines of log:"
        tail -n 10 "$FRONTEND_LOG" 2>/dev/null || true
    else
        local PORT_PID
        PORT_PID=$(find_pid_by_port "$FRONTEND_PORT")
        if [ -n "$PORT_PID" ]; then
            echo "$PORT_PID" > "$FRONTEND_PID_FILE"
            log "SUCCESS" "Frontend started (PID: $PORT_PID, port: $FRONTEND_PORT)"
        fi
    fi
}

# Start services (no reinstall of deps)
start_services() {
    log "INFO" "===== Starting services ====="
    start_backend
    start_frontend
    log "SUCCESS" "Services started"
    check_status
    return 0
}

# Restart services (stop then start)
restart_services() {
    log "INFO" "===== Restarting services ====="
    
    # Stop first
    log "INFO" "Stopping services..."
    stop_services
    
    # Wait for processes to stop
    log "INFO" "Waiting 2s before starting..."
    sleep 2
    
    # Start
    log "INFO" "Starting services..."
    start_services
    
    log "SUCCESS" "Services restarted"
    return 0
}

# ===================== Help =====================
show_help() {
    cat << EOF
Usage: ${0} [options]
One-shot deploy Agent-Studio with configurable DB type and code branch.

Options:
  --db_type=<type>    Database type: mysql (default), sqlite
  --branch=<name>     Git branch to fetch (default: main)
  --frontend_port=<port>  Frontend port (default: 3000), written to .env FRONTEND_PORT
  --backend_port=<port>   Backend port (default: 8000), written to .env BACKEND_PORT
  --stop              Gracefully stop frontend and backend services
  --start             Start frontend and backend (no reinstall of deps/keys)
  --restart           Restart frontend and backend
  --status            Show service status and access URLs
  --help              Show this help and exit

Examples:
  ${0}                           # Default: DB_TYPE=mysql, branch=main, ports 3000/8000
  ${0} --db_type=sqlite           # Use sqlite, main branch
  ${0} --branch=develop          # Use mysql, develop branch
  ${0} --frontend_port=3001 --backend_port=8001
  ${0} --stop                     # Stop services
  ${0} --start                    # Start services
  ${0} --restart                  # Restart services
  ${0} --status                   # Show status
  ${0} --help                     # Show help

Work directory: ${WORK_HOME}
EOF
    exit 0
}

# ===================== Parse args =====================
DB_TYPE="mysql"
GIT_BRANCH="main"
FRONTEND_PORT="3000"
BACKEND_PORT="8000"
ACTION="install"

# Validate port 1-65535
check_port() {
    local name="$1"
    local val="$2"
    if ! [[ "$val" =~ ^[0-9]+$ ]] || [ "$val" -lt 1 ] || [ "$val" -gt 65535 ]; then
        error_exit "Option --${name} must be an integer 1-65535, got: $val"
    fi
}

for arg in "$@"; do
    case "$arg" in
        --help)
            show_help
            ;;
        --stop)
            ACTION="stop"
            ;;
        --start)
            ACTION="start"
            ;;
        --restart)
            ACTION="restart"
            ;;
        --status)
            ACTION="status"
            ;;
        --db_type=*)
            DB_TYPE="${arg#*=}"
            if [[ $DB_TYPE != "mysql" && $DB_TYPE != "sqlite" ]]; then
                error_exit "Option --db_type must be mysql or sqlite, got: $DB_TYPE"
            fi
            log "INFO" "Database type: $DB_TYPE"
            ;;
        --branch=*)
            GIT_BRANCH="${arg#*=}"
            if [ -z "$GIT_BRANCH" ]; then
                error_exit "Option --branch: branch name cannot be empty"
            fi
            log "INFO" "Git branch: $GIT_BRANCH"
            ;;
        --frontend_port=*)
            FRONTEND_PORT="${arg#*=}"
            check_port "frontend_port" "$FRONTEND_PORT"
            log "INFO" "Frontend port: $FRONTEND_PORT"
            ;;
        --backend_port=*)
            BACKEND_PORT="${arg#*=}"
            check_port "backend_port" "$BACKEND_PORT"
            log "INFO" "Backend port: $BACKEND_PORT"
            ;;
        *)
            error_exit "Invalid option '$arg', use --help for usage"
            ;;
    esac
done

# Handle stop/start/restart/status
if [ "$ACTION" = "stop" ]; then
    stop_services
    exit 0
fi

if [ "$ACTION" = "status" ]; then
    check_status
    exit 0
fi

if [ "$ACTION" = "start" ]; then
    start_services
    exit 0
fi

if [ "$ACTION" = "restart" ]; then
    restart_services
    exit 0
fi

# ===================== Pre-checks =====================
log "INFO" "===== Starting Agent-Studio deployment ====="
log "INFO" "Work directory: ${WORK_HOME}"
log "INFO" "Log file: ${LOG_FILE}"

# Init log file
echo "=========================================" >> "$LOG_FILE"
echo "Deployment started: $(date)" >> "$LOG_FILE"
echo "=========================================" >> "$LOG_FILE"

load_environments
log "INFO" "Environment loaded (NVM, Conda, user PATH)"

check_command "bash"
check_command "sed"
check_command "grep"
check_command "mkdir"

log "INFO" "Checking script permissions..."
for script in "check_curl.sh" "check_git.sh" "check_nodejs.sh" "check_python.sh" "fetch_codes.sh" "check_mysql.sh"; do
    if [ -f "${WORK_HOME}/${script}" ]; then
        check_script_permission "${WORK_HOME}/${script}"
    fi
done

LAST_PROGRESS=$(read_progress)
if [ -n "$LAST_PROGRESS" ]; then
    log "WARN" "Previous deployment progress found: $LAST_PROGRESS"
    read -p "Resume from last step? (y/n, default y): " CONTINUE
    if [[ "${CONTINUE:-y}" != "y" ]]; then
        clear_progress
        LAST_PROGRESS=""
        log "INFO" "Progress cleared, starting from beginning"
    fi
else
    LAST_PROGRESS=""
fi

# ===================== Install base tools =====================
STEP="check_tools"
if should_skip_step "$STEP" "$LAST_PROGRESS"; then
    log "INFO" "Skipping: base tools check (already done)"
else
    log "INFO" "===== Installing base tools ====="
    SCRIPTS=("check_curl.sh" "check_git.sh" "check_nodejs.sh" "check_python.sh")
    
    if [ "$DB_TYPE" = "mysql" ]; then
        SCRIPTS+=("check_mysql.sh")
        log "INFO" "DB type is MySQL, will run MySQL check script"
    fi
    
    for script in "${SCRIPTS[@]}"; do
        SCRIPT_PATH="${WORK_HOME}/${script}"
        check_file "$SCRIPT_PATH"
        log "INFO" "Running script: $SCRIPT_PATH"
        echo -e "${GREEN}[Progress] Running: ${script}${NC}"
        
        if ! retry_execute 3 5 "Run $script" "bash '$SCRIPT_PATH'"; then
            error_exit "Running $script failed" \
                "1. Check script permission: chmod +x $SCRIPT_PATH\n\
2. Inspect script content\n\
3. Run manually: bash $SCRIPT_PATH"
        fi
        echo -e "${GREEN}[Progress] ${script} done${NC}\n"
    done
    save_progress "$STEP"
fi

# ===================== Fetch code =====================
STEP="fetch_code"
if should_skip_step "$STEP" "$LAST_PROGRESS"; then
    log "INFO" "Skipping: code fetch (already done)"
    if [ ! -d "${WORK_HOME}/agent-studio" ]; then
        log "WARN" "Code directory missing, re-fetching..."
        LAST_PROGRESS=""
    fi
else
log "INFO" "===== Fetching code ====="
    echo -e "${GREEN}[Progress] Base tools done, fetching code (branch: ${GIT_BRANCH})...${NC}"
FETCH_SCRIPT="${WORK_HOME}/fetch_codes.sh"
check_file "$FETCH_SCRIPT"
    
    if ! retry_execute 3 10 "Fetch code" "bash '$FETCH_SCRIPT' '$GIT_BRANCH'"; then
        error_exit "Fetch code failed" \
            "1. Check network: ping -c 3 gitcode.com\n\
2. Check git config: git config --list\n\
3. Fetch manually: cd $WORK_HOME && bash $FETCH_SCRIPT"
    fi

check_dir "${WORK_HOME}/agent-studio"
check_dir "$BACKEND_DIR"
check_dir "$FRONTEND_DIR"
    echo -e "${GREEN}[Progress] Code fetch done${NC}\n"
    save_progress "$STEP"
fi

# ===================== Configure AES key =====================
STEP="config_aes"
if should_skip_step "$STEP" "$LAST_PROGRESS"; then
    log "INFO" "Skipping: AES key config (already done)"
    if [ -z "${SERVER_AES_MASTER_KEY_ENV:-}" ] && [ -f "$TARGET_ENV_FILE" ]; then
        log "WARN" "AES key not set, will read from .env if present"
    fi
else
log "INFO" "===== Configuring AES key ====="
    echo -e "${GREEN}[Progress] Configuring AES key...${NC}"
AES_SCRIPT="${WORK_HOME}/agent-studio/scripts/build_AES_master_key.sh"
check_file "$AES_SCRIPT"
log "INFO" "Running AES key script: $AES_SCRIPT"
    
    your_aes_key=""
    ATTEMPT=1
    MAX_RETRIES=3
    
    while [ $ATTEMPT -le $MAX_RETRIES ]; do
        log "INFO" "[Attempt $ATTEMPT/$MAX_RETRIES] Generating AES key"
        your_aes_key=$(bash "$AES_SCRIPT" 2>/dev/null || echo "")
        
        if [ -n "$your_aes_key" ] && [ ${#your_aes_key} -gt 10 ]; then
            log "SUCCESS" "AES key generated"
            break
        else
            log "WARN" "AES key generation failed or invalid, retrying in 2s..."
            if [ $ATTEMPT -lt $MAX_RETRIES ]; then
                sleep 2
            fi
            ATTEMPT=$((ATTEMPT + 1))
        fi
    done
    
    if [ -z "$your_aes_key" ] || [ ${#your_aes_key} -le 10 ]; then
        error_exit "AES key generation failed after $MAX_RETRIES attempts" \
            "1. Check script permission: chmod +x $AES_SCRIPT\n\
2. Check Python: python3.11 --version\n\
3. Run manually: bash $AES_SCRIPT\n\
4. Inspect script: cat $AES_SCRIPT"
    fi
    
export SERVER_AES_MASTER_KEY_ENV="$your_aes_key"
    log "SUCCESS" "AES key set: ${your_aes_key:0:8}**** (partially hidden)"
    save_progress "$STEP"
fi

# ===================== Configure .env =====================
STEP="config_env"
if should_skip_step "$STEP" "$LAST_PROGRESS"; then
    log "INFO" "Skipping: .env config (already done)"
else
log "INFO" "===== Configuring .env ====="
    echo -e "${GREEN}[Progress] AES done, configuring .env...${NC}"
check_file "$ENV_EXAMPLE_FILE"
if [ -f "$TARGET_ENV_FILE" ]; then
    BACKUP_ENV="${TARGET_ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
        cp "$TARGET_ENV_FILE" "$BACKUP_ENV" || log "WARN" "Backup .env failed, continuing"
    log "INFO" "Backed up .env to: $BACKUP_ENV"
fi
    
    if ! cp "$ENV_EXAMPLE_FILE" "$TARGET_ENV_FILE" 2>/dev/null; then
        error_exit "Failed to copy .env.example" \
            "1. Check file permission: ls -l $ENV_EXAMPLE_FILE\n\
2. Check target dir: ls -ld $(dirname $TARGET_ENV_FILE)\n\
3. Copy manually: cp $ENV_EXAMPLE_FILE $TARGET_ENV_FILE"
    fi
check_file "$TARGET_ENV_FILE"

OLD_MYSQL="DB_TYPE=mysql"
NEW_SQLITE="DB_TYPE=sqlite"
log "INFO" "Setting DB type: $DB_TYPE"
if [ "$DB_TYPE" = "sqlite" ]; then
    if [[ "$(uname -s)" == "Darwin" ]]; then
        sed -i '' "s|${OLD_MYSQL}|${NEW_SQLITE}|g" "$TARGET_ENV_FILE"
    else
        sed -i "s|${OLD_MYSQL}|${NEW_SQLITE}|g" "$TARGET_ENV_FILE"
    fi
elif [ "$DB_TYPE" = "mysql" ]; then
    if [[ "$(uname -s)" == "Darwin" ]]; then
        sed -i '' "s|${NEW_SQLITE}|${OLD_MYSQL}|g" "$TARGET_ENV_FILE"
    else
        sed -i "s|${NEW_SQLITE}|${OLD_MYSQL}|g" "$TARGET_ENV_FILE"
    fi
fi

log "INFO" "Setting FRONTEND_PORT=$FRONTEND_PORT, BACKEND_PORT=$BACKEND_PORT"
if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "s|^FRONTEND_PORT=[0-9]*|FRONTEND_PORT=$FRONTEND_PORT|" "$TARGET_ENV_FILE"
    sed -i '' "s|^BACKEND_PORT=[0-9]*|BACKEND_PORT=$BACKEND_PORT|" "$TARGET_ENV_FILE"
    sed -i '' "s|VITE_API_PROXY_TARGET=http://localhost:[0-9]*/|VITE_API_PROXY_TARGET=http://localhost:${BACKEND_PORT}/|" "$TARGET_ENV_FILE"
    sed -i '' "s|ALLOWED_ORIGINS=\[\"http://localhost:[0-9]*\",\"http://127.0.0.1:[0-9]*\"\]|ALLOWED_ORIGINS=[\"http://localhost:${FRONTEND_PORT}\",\"http://127.0.0.1:${FRONTEND_PORT}\"]|" "$TARGET_ENV_FILE"
else
    sed -i "s|^FRONTEND_PORT=[0-9]*|FRONTEND_PORT=$FRONTEND_PORT|" "$TARGET_ENV_FILE"
    sed -i "s|^BACKEND_PORT=[0-9]*|BACKEND_PORT=$BACKEND_PORT|" "$TARGET_ENV_FILE"
    sed -i "s|VITE_API_PROXY_TARGET=http://localhost:[0-9]*/|VITE_API_PROXY_TARGET=http://localhost:${BACKEND_PORT}/|" "$TARGET_ENV_FILE"
    sed -i "s|ALLOWED_ORIGINS=\[\"http://localhost:[0-9]*\",\"http://127.0.0.1:[0-9]*\"\]|ALLOWED_ORIGINS=[\"http://localhost:${FRONTEND_PORT}\",\"http://127.0.0.1:${FRONTEND_PORT}\"]|" "$TARGET_ENV_FILE"
fi

DB_TYPE_ACTUAL=$(grep '^DB_TYPE=' "$TARGET_ENV_FILE" 2>/dev/null | cut -d'=' -f2 || echo "not found")
if [ "$DB_TYPE_ACTUAL" != "$DB_TYPE" ]; then
    log "WARN" "DB_TYPE may not have applied, current: $DB_TYPE_ACTUAL (expected: $DB_TYPE)"
else
    log "SUCCESS" "DB_TYPE set: $DB_TYPE"
fi
FRONTEND_PORT_ACTUAL=$(grep '^FRONTEND_PORT=' "$TARGET_ENV_FILE" 2>/dev/null | cut -d'=' -f2 || echo "not found")
BACKEND_PORT_ACTUAL=$(grep '^BACKEND_PORT=' "$TARGET_ENV_FILE" 2>/dev/null | cut -d'=' -f2 || echo "not found")
log "INFO" "FRONTEND_PORT: $FRONTEND_PORT_ACTUAL, BACKEND_PORT: $BACKEND_PORT_ACTUAL"
    save_progress "$STEP"
fi

# ===================== Configure database =====================
STEP="check_database"
if [ "$DB_TYPE" = "mysql" ]; then
    if should_skip_step "$STEP" "$LAST_PROGRESS"; then
        log "INFO" "Skipping: database config check (already done)"
    else
        log "INFO" "===== Configuring database ====="
        CONFIG_MYSQL_SH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/config_mysql.sh"
        if [ ! -f "$CONFIG_MYSQL_SH" ]; then
            log "ERROR" "config_mysql.sh not found: $CONFIG_MYSQL_SH"
            exit 1
        fi
        # shellcheck source=config_mysql.sh
        source "$CONFIG_MYSQL_SH"
        if ! type interactive_mysql_setup &>/dev/null; then
            log "ERROR" "Function interactive_mysql_setup not found in config_mysql.sh"
            exit 1
        fi
        interactive_mysql_setup
        save_progress "$STEP"
    fi
fi

# ===================== Deploy backend =====================
STEP="deploy_backend"
if should_skip_step "$STEP" "$LAST_PROGRESS"; then
    log "INFO" "Skipping: backend deploy (already done)"
    cd "$BACKEND_DIR" 2>/dev/null || log "WARN" "Cannot cd to backend dir, continuing"
else
    log "INFO" "===== Deploying backend ====="
    echo -e "${GREEN}[Progress] .env done, deploying backend...${NC}"
    
    if ! cd "$BACKEND_DIR" 2>/dev/null; then
        error_exit "Cannot cd to backend directory: $BACKEND_DIR" \
            "Check code fetch: ls -la $WORK_HOME/agent-studio"
    fi

    load_environments
    
    check_command "python3.11"
    
    log "INFO" "Installing uv (python3.11 -m pip)"
    if ! retry_execute 3 10 "Install uv" "python3.11 -m pip install uv --user"; then
        log "WARN" "User install failed, trying global (may need sudo)"
        if ! retry_execute 2 5 "Install uv globally" "python3.11 -m pip install uv"; then
            error_exit "Install uv failed" \
                "1. Check network\n\
2. Check pip: python3.11 -m pip --version\n\
3. Install manually: python3.11 -m pip install uv"
        fi
    fi
    
check_command "uv"

    log "INFO" "uv installed, version: $(uv --version 2>/dev/null || echo 'unknown')"
    
    log "INFO" "Creating/resetting uv venv (Python 3.11)"
    if ! retry_execute 2 5 "Create venv" "uv venv --clear --python python3.11"; then
        log "WARN" "Failed with --python python3.11, trying full path"
        PYTHON311_PATH=$(which python3.11 2>/dev/null || echo "")
        if [ -n "$PYTHON311_PATH" ]; then
            if ! retry_execute 2 5 "Create venv with full path" "uv venv --clear --python '$PYTHON311_PATH'"; then
                error_exit "Create venv failed" \
                    "1. Check Python3.11: python3.11 --version\n\
2. Check disk: df -h\n\
3. Create manually: cd $BACKEND_DIR && uv venv --python python3.11"
            fi
        else
            error_exit "python3.11 not found, cannot create venv" \
                "Ensure Python3.11 is installed: which python3.11"
        fi
    fi
    
    log "INFO" "Installing/upgrading pip in venv"
    if ! "${BACKEND_DIR}/.venv/bin/python" -m ensurepip --upgrade 2>/dev/null; then
        log "WARN" "ensurepip skipped or already present, using venv pip"
    fi

    if [ -f "${WORK_HOME}/user_config.sh" ]; then
        # shellcheck source=user_config.sh
        source "${WORK_HOME}/user_config.sh" 2>/dev/null || true
    fi
    PIP_INDEX_URL="${PIP_INDEX_URL:-https://mirrors.aliyun.com/pypi/simple/}"
    PIP_TRUSTED_HOST="${PIP_TRUSTED_HOST:-mirrors.aliyun.com}"
    log "INFO" "Using pip index: ${PIP_INDEX_URL} (--trusted-host ${PIP_TRUSTED_HOST})"

    log "INFO" "Syncing dependencies (pip install -e .[dev], may take a few minutes)..."
    PIP_INSTALL_OK=false
    for _ in 1 2 3; do
        if "${BACKEND_DIR}/.venv/bin/python" -m pip install --index-url "$PIP_INDEX_URL" --trusted-host "$PIP_TRUSTED_HOST" -e .[dev]; then
            PIP_INSTALL_OK=true
            log "SUCCESS" "Dependencies synced"
            break
        fi
        log "WARN" "Sync failed, retrying in 30s..."
        sleep 30
    done
    if [ "$PIP_INSTALL_OK" != "true" ]; then
        error_exit "Sync dependencies failed" \
            "1. Check network\n\
2. Check disk: df -h\n\
3. Retry manually: cd $BACKEND_DIR && .venv/bin/python -m pip install --index-url \"$PIP_INDEX_URL\" --trusted-host \"$PIP_TRUSTED_HOST\" -e .[dev]"
    fi

    if ! mkdir -p logs/run 2>/dev/null; then
        error_exit "Failed to create backend log directory" \
            "Check directory permission: ls -ld $BACKEND_DIR"
    fi
    save_progress "$STEP"
fi

STEP="start_backend"
if [[ "$LAST_PROGRESS" != "$STEP"* ]] || [[ -z "$LAST_PROGRESS" ]]; then
    start_backend
    save_progress "$STEP"
else
    log "INFO" "Skipping: backend start (already done)"
fi

# ===================== Deploy frontend =====================
STEP="deploy_frontend"
if should_skip_step "$STEP" "$LAST_PROGRESS"; then
    log "INFO" "Skipping: frontend deps install (already done)"
    cd "$FRONTEND_DIR" 2>/dev/null || log "WARN" "Cannot cd to frontend dir, continuing"
else
    log "INFO" "===== Deploying frontend ====="
    echo -e "${GREEN}[Progress] Backend done, deploying frontend...${NC}"
    
    if ! cd "$FRONTEND_DIR" 2>/dev/null; then
        error_exit "Cannot cd to frontend directory: $FRONTEND_DIR" \
            "Check code fetch: ls -la $WORK_HOME/agent-studio"
    fi

load_environments

check_command "node"
check_command "npm"

    log "INFO" "Installing frontend dependencies (may take a few minutes)..."
    if ! retry_execute 3 30 "Install frontend deps" "npm install"; then
        error_exit "Install frontend dependencies failed" \
            "1. Check network\n\
2. Clear npm cache and retry: npm cache clean --force && npm install\n\
3. Check disk: df -h\n\
4. Install manually: cd $FRONTEND_DIR && npm install"
    fi
    save_progress "$STEP"
fi

STEP="start_frontend"
if [[ "$LAST_PROGRESS" != "$STEP"* ]] || [[ -z "$LAST_PROGRESS" ]]; then
    start_frontend
    save_progress "$STEP"
else
    log "INFO" "Skipping: frontend start (already done)"
fi

# ===================== Done =====================
log "SUCCESS" "========================================="
log "SUCCESS" "===== Deployment complete ====="
log "SUCCESS" "========================================="

check_status

clear_progress
log "SUCCESS" "========================================="

exit 0
