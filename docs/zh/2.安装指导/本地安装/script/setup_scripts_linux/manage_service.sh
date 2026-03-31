#!/bin/bash
# Service lifecycle helpers for setup.sh
# Requires utils.sh: log, error_exit, load_environments, check_command, colors
# check_command/load_environments: ensure uv (e.g. ~/.local/bin) is on PATH for nohup
# Requires setup.sh globals before source: WORK_HOME, BACKEND_DIR, FRONTEND_DIR, TARGET_ENV_FILE, RUNTIME_DIR
#
# Single state file (aligned with Windows manage_service.ps1): WORK_HOME/services.state
# Lines: key:value — runtime_port, runtime_pid, backend_port, backend_pid, frontend_port, frontend_pid
# Legacy files runtime.pid, backend.pid, etc. are migrated on first write and then removed.

service_state_file() {
    printf '%s/services.state' "${WORK_HOME:?}"
}

_service_state_seed_legacy() {
    local out="$1"
    local key file v
    while IFS=: read -r key file; do
        [ -f "${WORK_HOME}/${file}" ] || continue
        v=$(grep -E '^[0-9]+$' "${WORK_HOME}/${file}" 2>/dev/null | head -1)
        [ -n "$v" ] && printf '%s:%s\n' "$key" "$v" >> "$out"
    done <<'EOF'
runtime_pid:runtime.pid
runtime_port:runtime.port
backend_pid:backend.pid
backend_port:backend.port
frontend_pid:frontend.pid
frontend_port:frontend.port
EOF
}

_service_state_remove_legacy_files() {
    rm -f "${WORK_HOME}/runtime.pid" "${WORK_HOME}/runtime.port" \
        "${WORK_HOME}/backend.pid" "${WORK_HOME}/backend.port" \
        "${WORK_HOME}/frontend.pid" "${WORK_HOME}/frontend.port"
}

_service_state_sort_and_write() {
    local src="$1"
    local dest="$2"
    local tmp="${dest}.new.$$"
    : > "$tmp"
    local k line
    for k in runtime_port runtime_pid backend_port backend_pid frontend_port frontend_pid; do
        line=$(grep "^${k}:" "$src" 2>/dev/null | head -1)
        if [ -n "$line" ]; then
            printf '%s\n' "$line" >> "$tmp"
        fi
    done
    if [ ! -s "$tmp" ]; then
        rm -f "$tmp" "$dest"
        return 0
    fi
    mv "$tmp" "$dest"
}

# Get one key from services.state; if file missing, read legacy *.pid / *.port only (no merge write)
service_state_get() {
    local key="$1"
    local f val
    f=$(service_state_file)
    if [ -f "$f" ]; then
        val=$(grep "^${key}:" "$f" 2>/dev/null | head -1)
        if [ -n "$val" ]; then
            val="${val#*:}"
            val="${val#"${val%%[![:space:]]*}"}"
            val="${val%"${val##*[![:space:]]}"}"
            printf '%s\n' "$val"
            return 0
        fi
        return 1
    fi
    case "$key" in
        runtime_pid|runtime_port|backend_pid|backend_port|frontend_pid|frontend_port)
            local leg
            leg=$(echo "$key" | tr '_' '.')
            if [ -f "${WORK_HOME}/${leg}" ]; then
                val=$(grep -E '^[0-9]+$' "${WORK_HOME}/${leg}" 2>/dev/null | head -1)
                if [ -n "$val" ]; then
                    printf '%s\n' "$val"
                    return 0
                fi
            fi
            ;;
    esac
    return 1
}

# Merge key=value pairs into services.state (empty value removes key). Removes legacy pid/port files after write.
service_state_set() {
    local f
    f=$(service_state_file)
    local tmp="${WORK_HOME}/.services.state.merge.$$"
    if [ -f "$f" ]; then
        cp "$f" "$tmp"
    else
        : > "$tmp"
        _service_state_seed_legacy "$tmp"
    fi
    local arg key val
    for arg in "$@"; do
        key="${arg%%=*}"
        val="${arg#*=}"
        [ "$key" = "$arg" ] && continue
        grep -v "^${key}:" "$tmp" > "${tmp}.n" && mv "${tmp}.n" "$tmp"
        if [ -n "$val" ]; then
            printf '%s:%s\n' "$key" "$val" >> "$tmp"
        fi
    done
    if [ ! -s "$tmp" ]; then
        rm -f "$tmp" "$f"
        _service_state_remove_legacy_files
        return 0
    fi
    _service_state_sort_and_write "$tmp" "$f"
    rm -f "$tmp" "${tmp}.n"
    _service_state_remove_legacy_files
}

# Remove keys from services.state (file removed if empty)
service_state_unset() {
    local f
    f=$(service_state_file)
    [ -f "$f" ] || return 0
    local tmp="${WORK_HOME}/.services.state.unset.$$"
    cp "$f" "$tmp"
    local k
    for k in "$@"; do
        grep -v "^${k}:" "$tmp" > "${tmp}.n" 2>/dev/null && mv "${tmp}.n" "$tmp"
    done
    if [ ! -s "$tmp" ]; then
        rm -f "$tmp" "$f"
        return 0
    fi
    _service_state_sort_and_write "$tmp" "$f"
    rm -f "$tmp" "${tmp}.n"
}

# Find process PID listening on TCP port
find_pid_by_port() {
    local PORT=$1
    local PID=""

    if command -v lsof &> /dev/null; then
        PID=$(lsof -ti:"$PORT" 2>/dev/null | head -n 1 || echo "")
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

    local CHILDREN
    CHILDREN=$(pgrep -P "$PID" 2>/dev/null || echo "")
    if [ -n "$CHILDREN" ]; then
        for CHILD in $CHILDREN; do
            local GRANDCHILDREN
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

    local ALL_PIDS
    ALL_PIDS=$(get_process_tree "$PID")

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

# Get backend port: services.state, then log, then .env (aligned with Windows)
get_backend_port() {
    local LOG_FILE=$1
    local DEFAULT_PORT=${2:-8000}
    local PORT="$DEFAULT_PORT"
    local ST_PORT

    ST_PORT=$(service_state_get backend_port || true)
    if [ -n "$ST_PORT" ] && [ "$ST_PORT" -ge 1 ] && [ "$ST_PORT" -le 65535 ] 2>/dev/null; then
        PORT="$ST_PORT"
    fi

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

# Get frontend port: services.state, then .env, then Vite log (aligned with Windows)
get_frontend_port() {
    local LOG_FILE=$1
    local DEFAULT_PORT=${2:-3000}
    local PORT="$DEFAULT_PORT"
    local ST_PORT ENV_FE

    ST_PORT=$(service_state_get frontend_port || true)
    if [ -n "$ST_PORT" ] && [ "$ST_PORT" -ge 1 ] && [ "$ST_PORT" -le 65535 ] 2>/dev/null; then
        PORT="$ST_PORT"
    fi

    if [ -f "${TARGET_ENV_FILE:-}" ]; then
        ENV_FE=$(grep -E "^FRONTEND_PORT=" "${TARGET_ENV_FILE}" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | head -n 1 || echo "")
        if [ -n "$ENV_FE" ] && [ "$ENV_FE" -ge 1 ] && [ "$ENV_FE" -le 65535 ]; then
            PORT="$ENV_FE"
        fi
    fi

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
    local BACKEND_LOG FRONTEND_LOG RUNTIME_LOG SERVICE_STATE_PATH
    BACKEND_LOG="${WORK_HOME}/backend.log"
    FRONTEND_LOG="${WORK_HOME}/frontend.log"
    RUNTIME_LOG="${WORK_HOME}/runtime.log"
    SERVICE_STATE_PATH=$(service_state_file)

    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
    if [ -z "$LOCAL_IP" ] || [ "$LOCAL_IP" = "127.0.0.1" ]; then
        LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}' || echo "localhost")
    fi

    echo -e "${YELLOW}Frontend Service:${NC}"
    FRONTEND_PID=""
    FRONTEND_PORT=$(get_frontend_port "$FRONTEND_LOG" "3000")
    PID_FROM_STATE=""
    PID_FROM_STATE=$(service_state_get frontend_pid || true)

    PORT_PID=$(find_pid_by_port "$FRONTEND_PORT")
    if [ -n "$PORT_PID" ] && ps -p "$PORT_PID" > /dev/null 2>&1; then
        if ps -p "$PORT_PID" -o cmd= 2>/dev/null | grep -qE "(node|vite|npm.*dev)" 2>/dev/null; then
            FRONTEND_PID="$PORT_PID"
            echo -e "  Status: ${GREEN}Running${NC}"
            echo -e "  PID: $FRONTEND_PID"
            if [ -n "$PID_FROM_STATE" ] && [ "$PID_FROM_STATE" != "$FRONTEND_PID" ]; then
                echo -e "  ${YELLOW}Warning: services.state frontend_pid does not match port process${NC}"
            fi
        fi
    fi

    if [ -z "$FRONTEND_PID" ] && [ -n "$PID_FROM_STATE" ]; then
        if ps -p "$PID_FROM_STATE" > /dev/null 2>&1; then
            if ps -p "$PID_FROM_STATE" -o cmd= 2>/dev/null | grep -qE "(node|vite|npm.*dev)" 2>/dev/null; then
                FRONTEND_PID="$PID_FROM_STATE"
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
        if [ -n "$PID_FROM_STATE" ]; then
            echo -e "  Note: services.state has frontend_pid but process not found (frontend_pid: $PID_FROM_STATE)"
        else
            echo -e "  Note: frontend_pid not recorded in services.state"
        fi
    fi
    echo -e "  Log File: ${GREEN}${FRONTEND_LOG}${NC}"
    echo ""

    echo -e "${YELLOW}Backend Service:${NC}"
    BACKEND_PID=""
    BACKEND_PORT=$(get_backend_port "$BACKEND_LOG" "8000")

    BACKEND_PID=$(service_state_get backend_pid || true)
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

    if [ -z "$BACKEND_PID" ]; then
        PORT_PID=$(find_pid_by_port "$BACKEND_PORT")
        if [ -n "$PORT_PID" ] && ps -p "$PORT_PID" > /dev/null 2>&1; then
            if ps -p "$PORT_PID" -o cmd= 2>/dev/null | grep -qE "(python.*main\.py|uvicorn|fastapi)" 2>/dev/null; then
                echo -e "  Status: ${GREEN}Running (detected by port)${NC}"
                echo -e "  PID: $PORT_PID"
                echo -e "  ${YELLOW}Warning: backend_pid not in services.state or stale${NC}"
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
        OLD_PID=$(service_state_get backend_pid || true)
        if [ -n "$OLD_PID" ]; then
            echo -e "  Note: services.state has backend_pid but process not found (backend_pid: $OLD_PID)"
        else
            echo -e "  Note: backend_pid not recorded in services.state"
        fi
    fi
    echo -e "  Log File: ${GREEN}${BACKEND_LOG}${NC}"
    echo ""

    echo -e "${YELLOW}Runtime Service:${NC}"
    RUNTIME_PID_VAL=""
    RUNTIME_PORT_VAL=""
    RUNTIME_PORT_VAL=$(service_state_get runtime_port || true)
    RUNTIME_PID_VAL=$(service_state_get runtime_pid || true)
    if [ -n "$RUNTIME_PID_VAL" ] && ps -p "$RUNTIME_PID_VAL" > /dev/null 2>&1; then
        echo -e "  Status: ${GREEN}Running${NC}"
        echo -e "  PID: $RUNTIME_PID_VAL"
        if [ -n "$RUNTIME_PORT_VAL" ]; then
            echo -e "  Local: ${GREEN}http://localhost:${RUNTIME_PORT_VAL}${NC}"
            echo -e "  Docs: ${GREEN}http://localhost:${RUNTIME_PORT_VAL}/docs${NC}"
        else
            echo -e "  ${YELLOW}Note: runtime_port not in services.state${NC}"
        fi
    elif [ -n "$RUNTIME_PORT_VAL" ]; then
        PORT_PID=$(find_pid_by_port "$RUNTIME_PORT_VAL")
        if [ -n "$PORT_PID" ] && ps -p "$PORT_PID" > /dev/null 2>&1; then
            echo -e "  Status: ${GREEN}Running (detected by port)${NC}"
            echo -e "  PID: $PORT_PID"
            echo -e "  Local: ${GREEN}http://localhost:${RUNTIME_PORT_VAL}${NC}"
        else
            echo -e "  Status: ${RED}Not Running${NC}"
            echo -e "  Note: runtime_port in state but nothing listening on port ${RUNTIME_PORT_VAL}"
        fi
    else
        echo -e "  Status: ${RED}Not Running${NC}"
        if [ -n "$RUNTIME_PID_VAL" ]; then
            echo -e "  Note: services.state has runtime_pid but process not found (runtime_pid: $RUNTIME_PID_VAL)"
        else
            echo -e "  Note: runtime_pid not recorded in services.state"
        fi
    fi
    echo -e "  Log File: ${GREEN}${RUNTIME_LOG}${NC}"
    echo ""

    echo -e "${YELLOW}Services state file:${NC}"
    echo -e "  ${GREEN}${SERVICE_STATE_PATH}${NC}"
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

    local STOPPED=0

    BACKEND_PID=""
    BACKEND_PID=$(service_state_get backend_pid || true)
    if [ -n "$BACKEND_PID" ] && ps -p "$BACKEND_PID" > /dev/null 2>&1; then
        log "INFO" "Stopping backend service (PID: $BACKEND_PID)..."
        if stop_process_tree "$BACKEND_PID" "Backend service"; then
            log "SUCCESS" "Backend service stopped (PID: $BACKEND_PID)"
            service_state_unset backend_pid backend_port
            BACKEND_PID=""
            STOPPED=$((STOPPED + 1))
        else
            log "ERROR" "Failed to stop backend service (PID: $BACKEND_PID)"
        fi
    elif [ -n "$BACKEND_PID" ]; then
        log "WARN" "Backend not running (services.state has backend_pid but process not found)"
        service_state_unset backend_pid backend_port
        BACKEND_PID=""
    fi

    BACKEND_PORT=$(get_backend_port "${WORK_HOME}/backend.log" "8000")
    PORT_PID=$(find_pid_by_port "$BACKEND_PORT")
    if [ -n "$PORT_PID" ] && [ "$PORT_PID" != "$BACKEND_PID" ] && ps -p "$PORT_PID" > /dev/null 2>&1; then
        if ps -p "$PORT_PID" -o cmd= 2>/dev/null | grep -qE "(python.*main\.py|uvicorn|fastapi)" 2>/dev/null; then
            log "WARN" "Port $BACKEND_PORT still in use by backend (PID: $PORT_PID), stopping..."
            if stop_process_tree "$PORT_PID" "Backend (port $BACKEND_PORT)"; then
                log "SUCCESS" "Stopped backend process on port $BACKEND_PORT"
                service_state_unset backend_pid backend_port
                STOPPED=$((STOPPED + 1))
            fi
        fi
    fi

    FRONTEND_PID=""
    FRONTEND_PID=$(service_state_get frontend_pid || true)
    if [ -n "$FRONTEND_PID" ] && ps -p "$FRONTEND_PID" > /dev/null 2>&1; then
        log "INFO" "Stopping frontend service (PID: $FRONTEND_PID)..."
        if stop_process_tree "$FRONTEND_PID" "Frontend service"; then
            log "SUCCESS" "Frontend service stopped (PID: $FRONTEND_PID)"
            service_state_unset frontend_pid frontend_port
            FRONTEND_PID=""
            STOPPED=$((STOPPED + 1))
        else
            log "ERROR" "Failed to stop frontend service (PID: $FRONTEND_PID)"
        fi
    elif [ -n "$FRONTEND_PID" ]; then
        log "WARN" "Frontend not running (services.state has frontend_pid but process not found)"
        service_state_unset frontend_pid frontend_port
        FRONTEND_PID=""
    fi

    FRONTEND_PORT=$(get_frontend_port "${WORK_HOME}/frontend.log" "3000")
    PORT_PID=$(find_pid_by_port "$FRONTEND_PORT")
    if [ -n "$PORT_PID" ] && [ "$PORT_PID" != "$FRONTEND_PID" ] && ps -p "$PORT_PID" > /dev/null 2>&1; then
        if ps -p "$PORT_PID" -o cmd= 2>/dev/null | grep -qE "(node|vite|npm.*dev)" 2>/dev/null; then
            log "WARN" "Port $FRONTEND_PORT still in use by frontend (PID: $PORT_PID), stopping..."
            if stop_process_tree "$PORT_PID" "Frontend (port $FRONTEND_PORT)"; then
                log "SUCCESS" "Stopped frontend process on port $FRONTEND_PORT"
                service_state_unset frontend_pid frontend_port
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
                            service_state_unset frontend_pid frontend_port
                            STOPPED=$((STOPPED + 1))
                        fi
                    fi
                fi
            done
        fi
    fi

    # Stop Runtime Service (aligned with Windows Stop-Services)
    RUNTIME_PID_VAL=""
    RUNTIME_PID_VAL=$(service_state_get runtime_pid || true)
    RUNTIME_PORT_VAL=""
    RUNTIME_PORT_VAL=$(service_state_get runtime_port || true)

    if [ -n "$RUNTIME_PID_VAL" ] && ps -p "$RUNTIME_PID_VAL" > /dev/null 2>&1; then
        log "INFO" "Stopping runtime service (PID: $RUNTIME_PID_VAL)..."
        if stop_process_tree "$RUNTIME_PID_VAL" "Runtime service"; then
            log "SUCCESS" "Runtime service stopped (PID: $RUNTIME_PID_VAL)"
            STOPPED=$((STOPPED + 1))
        else
            log "ERROR" "Failed to stop runtime service (PID: $RUNTIME_PID_VAL)"
        fi
    elif [ -n "$RUNTIME_PID_VAL" ]; then
        log "WARN" "Runtime not running (services.state has runtime_pid but process not found)"
    fi

    if [ -n "$RUNTIME_PORT_VAL" ]; then
        PORT_PID=$(find_pid_by_port "$RUNTIME_PORT_VAL")
        if [ -n "$PORT_PID" ] && ps -p "$PORT_PID" > /dev/null 2>&1; then
            if ps -p "$PORT_PID" -o cmd= 2>/dev/null | grep -qE "(uvicorn|openjiuwen_runtime)" 2>/dev/null; then
                log "WARN" "Port $RUNTIME_PORT_VAL still in use by runtime (PID: $PORT_PID), stopping..."
                if stop_process_tree "$PORT_PID" "Runtime (port $RUNTIME_PORT_VAL)"; then
                    log "SUCCESS" "Stopped runtime process on port $RUNTIME_PORT_VAL"
                    STOPPED=$((STOPPED + 1))
                fi
            fi
        fi
    fi

    service_state_unset runtime_pid runtime_port
    log "INFO" "Cleared runtime_pid / runtime_port in services.state"

    if [ $STOPPED -gt 0 ]; then
        log "SUCCESS" "Stopped $STOPPED service(s)"
    else
        log "INFO" "No running services to stop"
    fi

    return 0
}

# Runtime server: uv, venv, uv sync, editable management/foundation 
install_runtime_dependencies() {
    local RUNTIME_SERVER_DIR="$1"
    if [ -z "$RUNTIME_SERVER_DIR" ]; then
        error_exit "install_runtime_dependencies: RuntimeServerDir is required" \
            "Pass the agent-runtime server directory, e.g. \${RUNTIME_DIR}/server"
    fi

    check_command "uv"
    log "INFO" "uv is installed: $(uv --version 2>&1 | tr -d '\r' | head -1)"

    local venv_path pyvenv_cfg
    venv_path="${RUNTIME_SERVER_DIR}/.venv"
    pyvenv_cfg="${venv_path}/pyvenv.cfg"
    get_uv_index_args_from_user_config

    if [ ! -d "$venv_path" ]; then
        ( cd "$RUNTIME_SERVER_DIR" && uv venv ) || error_exit "Failed to create virtual environment (uv venv)" \
            "cd $RUNTIME_SERVER_DIR && uv venv"
        log "INFO" "Virtual environment created"
    elif [ -f "$pyvenv_cfg" ]; then
        log "INFO" "Virtual environment already exists"
    else
        log "WARN" ".venv is incomplete (missing pyvenv.cfg), recreating..."
        rm -rf "$venv_path"
        ( cd "$RUNTIME_SERVER_DIR" && uv venv ) || error_exit "Failed to recreate virtual environment. Close running servers/terminals that may lock .venv, then retry" \
            "cd $RUNTIME_SERVER_DIR && rm -rf .venv && uv venv"
        log "INFO" "Virtual environment recreated"
    fi

    local uv_sync_args uv_sync_cmd uv_sync_cmd_log uv_sync_output
    uv_sync_args=("sync" "${UV_INDEX_ARGS[@]}")
    uv_sync_cmd="uv ${uv_sync_args[*]}"
    uv_sync_cmd_log=$(echo "$uv_sync_cmd" | sed -E 's#(https?://)([^/[:space:]:@]+):([^/[:space:]@]+)@#\1***:***@#g')
    log "INFO" "Running uv command: $uv_sync_cmd_log"
    uv_sync_output=$(cd "$RUNTIME_SERVER_DIR" && uv "${uv_sync_args[@]}" 2>&1)
    if [ $? -ne 0 ]; then
        log "WARN" "uv sync failed"
        if [ -n "$uv_sync_output" ]; then
            log "WARN" "uv sync output:"
            echo "$uv_sync_output"
        fi
        log "WARN" "uv sync did not succeed (e.g. missing pyproject.toml); continuing per deploy.bat behavior"
    else
        log "INFO" "Dependencies synced (uv sync)"
    fi

    local uv_pip_mgmt_args uv_pip_mgmt_cmd uv_pip_mgmt_cmd_log uv_pip_mgmt_output
    uv_pip_mgmt_args=("pip" "install" "${UV_INDEX_ARGS[@]}" "-e" "../management" "--force-reinstall")
    uv_pip_mgmt_cmd="uv ${uv_pip_mgmt_args[*]}"
    uv_pip_mgmt_cmd_log=$(echo "$uv_pip_mgmt_cmd" | sed -E 's#(https?://)([^/[:space:]:@]+):([^/[:space:]@]+)@#\1***:***@#g')
    log "INFO" "Running uv command: $uv_pip_mgmt_cmd_log"
    uv_pip_mgmt_output=$(cd "$RUNTIME_SERVER_DIR" && uv "${uv_pip_mgmt_args[@]}" 2>&1)
    if [ $? -ne 0 ]; then
        log "ERROR" "Failed to install management SDK. Ensure no old server process is using .venv files"
        if [ -n "$uv_pip_mgmt_output" ]; then
            log "ERROR" "uv pip install (management) output:"
            echo "$uv_pip_mgmt_output"
        fi
        error_exit "Failed to install management SDK. Ensure no old server process is using .venv files" \
            "cd $RUNTIME_SERVER_DIR && uv pip install -e ../management --force-reinstall"
    fi
    log "INFO" "management SDK installed"

    local uv_pip_found_args uv_pip_found_cmd uv_pip_found_cmd_log uv_pip_found_output
    uv_pip_found_args=("pip" "install" "${UV_INDEX_ARGS[@]}" "-e" "../foundation" "--force-reinstall")
    uv_pip_found_cmd="uv ${uv_pip_found_args[*]}"
    uv_pip_found_cmd_log=$(echo "$uv_pip_found_cmd" | sed -E 's#(https?://)([^/[:space:]:@]+):([^/[:space:]@]+)@#\1***:***@#g')
    log "INFO" "Running uv command: $uv_pip_found_cmd_log"
    uv_pip_found_output=$(cd "$RUNTIME_SERVER_DIR" && uv "${uv_pip_found_args[@]}" 2>&1)
    if [ $? -ne 0 ]; then
        log "ERROR" "Failed to install foundation SDK. Ensure no old server process is using .venv files"
        if [ -n "$uv_pip_found_output" ]; then
            log "ERROR" "uv pip install (foundation) output:"
            echo "$uv_pip_found_output"
        fi
        error_exit "Failed to install foundation SDK. Ensure no old server process is using .venv files" \
            "cd $RUNTIME_SERVER_DIR && uv pip install -e ../foundation --force-reinstall"
    fi
    log "INFO" "foundation SDK installed"
}

start_runtime_service() {
    log "INFO" "===== Starting Runtime Service ====="

    local RUNTIME_SERVER_DIR RUNTIME_ENV_FILE RUNTIME_LOG
    RUNTIME_SERVER_DIR="${RUNTIME_DIR:?}/server"
    RUNTIME_ENV_FILE="${RUNTIME_SERVER_DIR}/.env"
    RUNTIME_LOG="${WORK_HOME}/runtime.log"

    check_dir "$RUNTIME_SERVER_DIR"
    check_file "$RUNTIME_ENV_FILE"

    # --start skips full setup; PATH may omit ~/.local/bin (non-interactive bash).
    # Frontend start path already calls load_environments; runtime must do the same so nohup finds uv.
    load_environments
    check_command "uv"
    get_uv_index_args_from_user_config

    local p RuntimeListenPort=""
    for ((p = 8100; p < 8300; p++)); do
        if [ -z "$(find_pid_by_port "$p")" ]; then
            RuntimeListenPort=$p
            break
        fi
    done
    if [ -z "$RuntimeListenPort" ]; then
        error_exit "No available port found in range 8100-8299" \
            "Free a port in 8100-8299 or stop another service using that range"
    fi
    log "INFO" "Selected runtime port: $RuntimeListenPort"

    : > "$RUNTIME_LOG"

    log "INFO" "Starting runtime server in background on port $RuntimeListenPort, log file: $RUNTIME_LOG"
    cd "$RUNTIME_SERVER_DIR" || error_exit "Cannot cd to runtime server directory: $RUNTIME_SERVER_DIR"

    local uv_run_args uv_run_cmd uv_run_cmd_log
    uv_run_args=("run" "${UV_INDEX_ARGS[@]}" "-m" "uvicorn" "openjiuwen_runtime.server.main:app" "--host" "0.0.0.0" "--port" "$RuntimeListenPort")
    uv_run_cmd="uv ${uv_run_args[*]}"
    uv_run_cmd_log=$(echo "$uv_run_cmd" | sed -E 's#(https?://)([^/[:space:]:@]+):([^/[:space:]@]+)@#\1***:***@#g')
    log "INFO" "Running uv command: $uv_run_cmd_log"
    nohup uv "${uv_run_args[@]}" >> "$RUNTIME_LOG" 2>&1 &
    local LAUNCH_PID=$!
    log "INFO" "Runtime server process started (pid: $LAUNCH_PID)"

    local RuntimePort="" RuntimePid="" i
    for ((i = 1; i <= 45; i++)); do
        sleep 1
        RuntimePid=$(find_pid_by_port "$RuntimeListenPort" || true)
        if [ -n "$RuntimePid" ]; then
            RuntimePort="$RuntimeListenPort"
            break
        fi
        if ! ps -p "$LAUNCH_PID" > /dev/null 2>&1; then
            log "ERROR" "Runtime service process exited unexpectedly"
            error_exit "Runtime failed to stay running; see log: $RUNTIME_LOG" \
                "tail -n 50 $RUNTIME_LOG"
        fi
    done

    if [ -n "$RuntimePort" ]; then
        if [ -z "$RuntimePid" ]; then
            RuntimePid=$LAUNCH_PID
        fi
        service_state_set "runtime_pid=$RuntimePid" "runtime_port=$RuntimePort"
        if [ -n "${TARGET_ENV_FILE:-}" ] && [ -f "${TARGET_ENV_FILE}" ]; then
            if grep -q '^RUNTIME_PORT=' "${TARGET_ENV_FILE}" 2>/dev/null; then
                if [[ "$(uname -s)" == "Darwin" ]]; then
                    sed -i '' "s|^RUNTIME_PORT=.*|RUNTIME_PORT=${RuntimePort}|" "${TARGET_ENV_FILE}"
                else
                    sed -i "s|^RUNTIME_PORT=.*|RUNTIME_PORT=${RuntimePort}|" "${TARGET_ENV_FILE}"
                fi
            else
                echo "RUNTIME_PORT=${RuntimePort}" >> "${TARGET_ENV_FILE}"
            fi
            log "INFO" "Updated RUNTIME_PORT in .env: ${RuntimePort}"
        fi
        local WINDOWS_AGENT_ENV_FILE=""
        WINDOWS_AGENT_ENV_FILE="${WORK_HOME}/../setup_scripts_windows/agent-studio/.env"
        if [ -f "${WINDOWS_AGENT_ENV_FILE}" ]; then
            if grep -q '^RUNTIME_PORT=' "${WINDOWS_AGENT_ENV_FILE}" 2>/dev/null; then
                if [[ "$(uname -s)" == "Darwin" ]]; then
                    sed -i '' "s|^RUNTIME_PORT=.*|RUNTIME_PORT=${RuntimePort}|" "${WINDOWS_AGENT_ENV_FILE}"
                else
                    sed -i "s|^RUNTIME_PORT=.*|RUNTIME_PORT=${RuntimePort}|" "${WINDOWS_AGENT_ENV_FILE}"
                fi
            else
                echo "RUNTIME_PORT=${RuntimePort}" >> "${WINDOWS_AGENT_ENV_FILE}"
            fi
            log "INFO" "Updated Windows agent-studio .env RUNTIME_PORT: ${RuntimePort}"
        fi
        log "INFO" "Saved runtime_pid / runtime_port to services.state (pid: $RuntimePid, port: $RuntimePort)"
        log "SUCCESS" "Runtime service started in background: http://localhost:$RuntimePort"
    else
        service_state_unset runtime_port
        service_state_set "runtime_pid=$LAUNCH_PID"
        log "WARN" "Saved runtime_pid (launcher only) to services.state (pid: $LAUNCH_PID)"
        log "WARN" "Runtime background process started but port not detected yet (expected range: 8100-8299). See log: $RUNTIME_LOG"
    fi
}

# Start backend (check dir/.env, read AES key)
start_backend() {
    local BACKEND_LOG="${WORK_HOME}/backend.log"

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
    local OLD_PID
    OLD_PID=$(service_state_get backend_pid || true)
    if [ -n "$OLD_PID" ]; then
        local PORT_PID_NOW
        PORT_PID_NOW=$(find_pid_by_port "$BACKEND_PORT_START")
        if [ -n "$PORT_PID_NOW" ] && [ "$OLD_PID" = "$PORT_PID_NOW" ]; then
            if ps -p "$OLD_PID" > /dev/null 2>&1 && ps -p "$OLD_PID" -o cmd= 2>/dev/null | grep -qE "(python.*main\.py|uvicorn|fastapi)" 2>/dev/null; then
                log "WARN" "Backend already running (PID: $OLD_PID, port: $BACKEND_PORT_START), skipping start"
                return 0
            fi
        fi
        log "INFO" "Removing stale backend_pid / backend_port from services.state"
        service_state_unset backend_pid backend_port
    fi

    log "INFO" "Starting backend service, log file: $BACKEND_LOG"
    cd "$BACKEND_DIR" || error_exit "Cannot cd to backend directory"

    if [ ! -f ".venv/bin/activate" ]; then
        error_exit "Virtual environment not found" \
            "Run full install first: ./setup.sh"
    fi

    # shellcheck source=/dev/null
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
    service_state_set "backend_pid=$LAUNCH_PID"

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
            service_state_set "backend_pid=$PORT_PID" "backend_port=$BACKEND_PORT"
            log "INFO" "Saved backend_pid / backend_port to services.state (port: $BACKEND_PORT)"
            log "SUCCESS" "Backend started (PID: $PORT_PID, port: $BACKEND_PORT)"
        fi
    fi
}

# Start frontend (check dir and deps)
start_frontend() {
    local FRONTEND_LOG="${WORK_HOME}/frontend.log"

    if [ ! -d "$FRONTEND_DIR" ]; then
        log "ERROR" "Frontend directory not found: $FRONTEND_DIR"
        error_exit "Frontend directory not found, cannot start service" \
            "Run full install first: ./setup.sh"
    fi

    local OLD_PID
    OLD_PID=$(service_state_get frontend_pid || true)
    if [ -n "$OLD_PID" ] && ps -p "$OLD_PID" > /dev/null 2>&1; then
        log "WARN" "Frontend already running (PID: $OLD_PID), skipping start"
        return 0
    fi
    if [ -n "$OLD_PID" ]; then
        log "INFO" "Removing stale frontend_pid / frontend_port from services.state"
        service_state_unset frontend_pid frontend_port
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
    service_state_set "frontend_pid=$NPM_PID"

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
            service_state_set "frontend_pid=$PORT_PID" "frontend_port=$FRONTEND_PORT"
            log "INFO" "Saved frontend_pid / frontend_port to services.state (port: $FRONTEND_PORT)"
            log "SUCCESS" "Frontend started (PID: $PORT_PID, port: $FRONTEND_PORT)"
        fi
    fi
}

# Start services (no reinstall of deps)
start_services() {
    log "INFO" "===== Starting services ====="

    local RUNTIME_SERVER_DIR RUNTIME_ENV_FILE
    RUNTIME_SERVER_DIR="${RUNTIME_DIR:?}/server"
    RUNTIME_ENV_FILE="${RUNTIME_SERVER_DIR}/.env"
    if [ -d "$RUNTIME_SERVER_DIR" ] && [ -f "$RUNTIME_ENV_FILE" ]; then
        start_runtime_service
    else
        log "WARN" "Runtime not installed or incomplete (need server/.env), skipping runtime start"
    fi

    start_backend
    start_frontend
    log "SUCCESS" "Services started"
    check_status
    return 0
}

# Restart services (stop then start)
restart_services() {
    log "INFO" "===== Restarting services ====="

    log "INFO" "Stopping services..."
    stop_services

    log "INFO" "Waiting 2s before starting..."
    sleep 2

    log "INFO" "Starting services..."
    start_services

    log "SUCCESS" "Services restarted"
    return 0
}
