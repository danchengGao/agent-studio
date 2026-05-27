#!/bin/bash
# Utility library: OS / package-manager helpers, HTTP proxy, and setup.sh orchestration helpers
# setup.sh must set before sourcing: WORK_HOME, LOG_FILE, PROGRESS_FILE, INSTALL_STEPS

# Load optional per-user config (proxy, mirrors, registries, etc.) and apply HTTP(S) proxy
# This will:
# - source user_config.sh if present under WORK_HOME
# - export HTTP_PROXY/HTTPS_PROXY (and lower-case variants) for current shell
apply_http_proxy() {
    # Require WORK_HOME to be set by caller script
    if [ -z "${WORK_HOME:-}" ]; then
        return 0
    fi

    local USER_CONFIG="${WORK_HOME}/user_config.sh"
    if [ -f "$USER_CONFIG" ]; then
        # shellcheck source=user_config.sh
        . "$USER_CONFIG" 2>/dev/null || true

        if [ -n "${HTTP_PROXY:-}" ]; then
            export HTTP_PROXY
            export http_proxy="$HTTP_PROXY"
        fi
        if [ -n "${HTTPS_PROXY:-}" ]; then
            export HTTPS_PROXY
            export https_proxy="$HTTPS_PROXY"
        fi
    fi
}

# Read UV_INDEX / UV_TRUSTED_HOST from user_config.sh and build uv args.
# Output via global array UV_INDEX_ARGS, e.g. ("--index" "https://mirror/simple" "--allow-insecure-host" "pypi.example.com")
get_uv_index_args_from_user_config() {
    UV_INDEX_ARGS=()

    if [ -z "${WORK_HOME:-}" ]; then
        return 0
    fi

    local user_cfg uv_idx uv_trusted_hosts host
    user_cfg="${WORK_HOME}/user_config.sh"
    if [ ! -f "$user_cfg" ]; then
        return 0
    fi

    # shellcheck source=user_config.sh
    source "$user_cfg" 2>/dev/null || true
    if [ -n "${UV_INDEX:-}" ]; then
        uv_idx="$(echo "$UV_INDEX" | xargs)"
        if [ -n "$uv_idx" ]; then
            UV_INDEX_ARGS=(--index "$uv_idx")
            log "INFO" "uv uses --index from user_config.sh: $uv_idx"
        fi
    fi

    if [ -n "${UV_TRUSTED_HOST:-}" ]; then
        uv_trusted_hosts="${UV_TRUSTED_HOST//,/ }"
        for host in $uv_trusted_hosts; do
            host="$(echo "$host" | xargs)"
            if [ -n "$host" ]; then
                UV_INDEX_ARGS+=(--allow-insecure-host "$host")
            fi
        done
        if [ ${#UV_INDEX_ARGS[@]} -gt 0 ]; then
            log "INFO" "uv uses --allow-insecure-host from user_config.sh: ${UV_TRUSTED_HOST}"
        fi
    fi
}

# Read a single KEY=value from user_config.sh without sourcing the file (avoids side effects).
# Uses the first matching assignment line only.
# Args:
#   $1  Variable name (e.g. DB_PORT, HTTP_PROXY). Must match [A-Za-z_][A-Za-z0-9_]*
#   $2  Path to user_config.sh (optional). Default: ${WORK_HOME}/user_config.sh if WORK_HOME is set,
#       otherwise <directory of utils.sh>/user_config.sh
# Stdout: value with surrounding quotes stripped and outer whitespace trimmed; empty if file/key missing
# Returns: 0 on success (including empty value); 1 if $1 is missing or not a valid identifier
get_user_config_value() {
    local key="${1:-}"
    local user_cfg="${2:-}"
    local line val

    if [ -z "$key" ] || [[ ! "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
        return 1
    fi

    if [ -z "$user_cfg" ]; then
        if [ -n "${WORK_HOME:-}" ]; then
            user_cfg="${WORK_HOME}/user_config.sh"
        else
            user_cfg="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/user_config.sh"
        fi
    fi

    if [ ! -f "$user_cfg" ]; then
        printf '%s\n' ""
        return 0
    fi

    line=$(grep -E "^[[:space:]]*${key}=" "$user_cfg" 2>/dev/null | head -n 1)
    if [ -z "$line" ]; then
        printf '%s\n' ""
        return 0
    fi

    val=$(echo "$line" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | xargs)
    printf '%s\n' "$val"
    return 0
}

# Set globals DB_HOST / DB_PORT from user_config.sh via get_user_config_value (default path: see get_user_config_value).
load_db_host_port_from_user_config() {
    DB_HOST="$(get_user_config_value DB_HOST)"
    local _configured_db_port
    _configured_db_port="$(get_user_config_value DB_PORT)"
    if [ -z "$DB_HOST" ]; then
        DB_HOST="127.0.0.1"
    fi
    if [[ "$_configured_db_port" =~ ^[0-9]+$ ]] && [ "$_configured_db_port" -ge 1 ] && [ "$_configured_db_port" -le 65535 ]; then
        DB_PORT="$_configured_db_port"
    else
        DB_PORT="3306"
    fi
}

# Detect Linux distro and package manager.
# Sets globals: OS_TYPE, PKG_MANAGER, OS_ID (from /etc/os-release ID), OS_VERSION (VERSION_ID)
detect_os() {
    OS_TYPE="unknown"
    PKG_MANAGER="unknown"
    OS_ID="unknown"
    OS_VERSION="unknown"
    
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_ID="${ID:-unknown}"
        OS_VERSION="${VERSION_ID:-unknown}"
        
        case "${ID:-}" in
            ubuntu|debian)
                OS_TYPE="debian"
                if command -v apt &> /dev/null; then
                    PKG_MANAGER="apt"
                elif command -v apt-get &> /dev/null; then
                    PKG_MANAGER="apt-get"
                else
                    PKG_MANAGER="apt"
                fi
                ;;
            centos|rhel|rocky|almalinux)
                OS_TYPE="rhel"
                if command -v dnf &> /dev/null; then
                    PKG_MANAGER="dnf"
                elif command -v yum &> /dev/null; then
                    PKG_MANAGER="yum"
                else
                    PKG_MANAGER="yum"
                fi
                ;;
            fedora)
                OS_TYPE="fedora"
                if command -v dnf &> /dev/null; then
                    PKG_MANAGER="dnf"
                else
                    PKG_MANAGER="dnf"
                fi
                ;;
            opensuse*|sles)
                OS_TYPE="suse"
                if command -v zypper &> /dev/null; then
                    PKG_MANAGER="zypper"
                else
                    PKG_MANAGER="zypper"
                fi
                ;;
            arch|manjaro)
                OS_TYPE="arch"
                if command -v pacman &> /dev/null; then
                    PKG_MANAGER="pacman"
                else
                    PKG_MANAGER="pacman"
                fi
                ;;
            *)
                case "${ID_LIKE:-}" in
                    *debian*)
                        OS_TYPE="debian"
                        if command -v apt &> /dev/null; then
                            PKG_MANAGER="apt"
                        elif command -v apt-get &> /dev/null; then
                            PKG_MANAGER="apt-get"
                        else
                            PKG_MANAGER="apt"
                        fi
                        ;;
                    *rhel*|*fedora*)
                        OS_TYPE="rhel"
                        if command -v dnf &> /dev/null; then
                            PKG_MANAGER="dnf"
                        elif command -v yum &> /dev/null; then
                            PKG_MANAGER="yum"
                        else
                            PKG_MANAGER="yum"
                        fi
                        ;;
                    *)
                        OS_TYPE="unknown"
                        ;;
                esac
                ;;
        esac
    else
        if command -v apt &> /dev/null || command -v apt-get &> /dev/null; then
            OS_TYPE="debian"
            if command -v apt &> /dev/null; then
                PKG_MANAGER="apt"
            else
                PKG_MANAGER="apt-get"
            fi
        elif command -v dnf &> /dev/null; then
            OS_TYPE="rhel"
            PKG_MANAGER="dnf"
        elif command -v yum &> /dev/null; then
            OS_TYPE="rhel"
            PKG_MANAGER="yum"
        elif command -v zypper &> /dev/null; then
            OS_TYPE="suse"
            PKG_MANAGER="zypper"
        elif command -v pacman &> /dev/null; then
            OS_TYPE="arch"
            PKG_MANAGER="pacman"
        fi
    fi
    
    if [ "${DEBUG:-0}" = "1" ]; then
        echo "Detected: OS_ID=$OS_ID OS_VERSION=$OS_VERSION OS_TYPE=$OS_TYPE PKG_MANAGER=$PKG_MANAGER"
    fi
}

# Get install command for package manager. Args: package names (space-separated). Returns full install command (requires sudo).
get_install_command() {
    local packages="$*"
    
    if [ "$OS_TYPE" = "unknown" ] || [ "$PKG_MANAGER" = "unknown" ]; then
        detect_os
    fi
    
    case "$PKG_MANAGER" in
        apt|apt-get)
            echo "sudo $PKG_MANAGER update -y && sudo $PKG_MANAGER install -y $packages"
            ;;
        dnf)
            echo "sudo dnf install -y $packages"
            ;;
        yum)
            echo "sudo yum install -y $packages"
            ;;
        zypper)
            echo "sudo zypper install -y $packages"
            ;;
        pacman)
            echo "sudo pacman -S --noconfirm $packages"
            ;;
        *)
            echo ""
            return 1
            ;;
    esac
}

# Run package install. Args: package names (space-separated).
install_packages() {
    local packages="$*"
    
    if [ -z "$packages" ]; then
        return 1
    fi
    
    if [ "$OS_TYPE" = "unknown" ] || [ "$PKG_MANAGER" = "unknown" ]; then
        detect_os
    fi
    
    case "$PKG_MANAGER" in
        apt|apt-get)
            sudo $PKG_MANAGER update -y
            sudo $PKG_MANAGER install -y $packages
            ;;
        dnf)
            sudo dnf install -y $packages
            ;;
        yum)
            sudo yum install -y $packages
            ;;
        zypper)
            sudo zypper install -y $packages
            ;;
        pacman)
            sudo pacman -S --noconfirm $packages
            ;;
        *)
            echo "Error: Unsupported package manager: $PKG_MANAGER"
            return 1
            ;;
    esac
}

# ===================== setup.sh orchestration helpers =====================
# Expect globals from setup.sh: LOG_FILE, PROGRESS_FILE, INSTALL_STEPS

# Colors for console output (log, error_exit, setup.sh / config_mysql.sh echo -e)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'  # reset

log() {
    local LEVEL=$1
    shift
    local MSG="$*"
    local TIMESTAMP
    TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
    local LOG_MSG="[${TIMESTAMP}] [${LEVEL}] ${MSG}"

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

    echo "${LOG_MSG}" >> "$LOG_FILE" 2>/dev/null || true
}

save_progress() {
    local STEP=$1
    echo "$STEP" > "$PROGRESS_FILE" 2>/dev/null || true
    log "INFO" "Progress saved: $STEP"
}

read_progress() {
    if [ -f "$PROGRESS_FILE" ]; then
        cat "$PROGRESS_FILE" 2>/dev/null || echo ""
    else
        echo ""
    fi
}

clear_progress() {
    rm -f "$PROGRESS_FILE" 2>/dev/null || true
}

# Args: $1 current step name, $2 last progress. Return: 0 = skip, 1 = run
should_skip_step() {
    local current_step="$1"
    local last_progress="$2"

    if [[ -z "$last_progress" ]]; then
        return 1
    fi

    local current_index=-1
    local last_index=-1
    local i

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

    if [[ $last_index -ge $current_index ]]; then
        return 0
    else
        return 1
    fi
}

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

load_environments() {
    if [ -s "$HOME/.nvm/nvm.sh" ]; then
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" 2>/dev/null || true
        [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion" 2>/dev/null || true
    fi

    if [ -s "$HOME/miniconda3/etc/profile.d/conda.sh" ]; then
        source "$HOME/miniconda3/etc/profile.d/conda.sh" 2>/dev/null || true
    elif [ -s "$HOME/anaconda3/etc/profile.d/conda.sh" ]; then
        source "$HOME/anaconda3/etc/profile.d/conda.sh" 2>/dev/null || true
    elif [ -s "/opt/conda/etc/profile.d/conda.sh" ]; then
        source "/opt/conda/etc/profile.d/conda.sh" 2>/dev/null || true
    fi

    if [ -d "$HOME/.local/bin" ] && [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
        export PATH="$HOME/.local/bin:$PATH"
    fi
    if [ -d "/root/.local/bin" ] && [[ ":$PATH:" != *":/root/.local/bin:"* ]]; then
        export PATH="/root/.local/bin:$PATH"
    fi
}

check_command() {
    local CMD="$1"

    load_environments

    if ! command -v "$CMD" &> /dev/null; then
        case "$CMD" in
            node|npm)
                if [ -s "$HOME/.nvm/nvm.sh" ]; then
                    export NVM_DIR="$HOME/.nvm"
                    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" 2>/dev/null || true
                fi
                ;;
            uv)
                if [ -f "$HOME/.local/bin/uv" ] && [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
                    export PATH="$HOME/.local/bin:$PATH"
                elif [ -f "/root/.local/bin/uv" ] && [[ ":$PATH:" != *":/root/.local/bin:"* ]]; then
                    export PATH="/root/.local/bin:$PATH"
                fi
                ;;
            python3.11)
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

check_dir() {
    local DIR=$1
    if [ ! -d "$DIR" ]; then
        error_exit "Directory $DIR not found, cannot continue" \
            "Check code fetch or create directory: mkdir -p $DIR"
    fi
}

# Args: option name (for messages), port value. Exits via error_exit if not integer 1-65535.
check_port() {
    local name="$1"
    local val="$2"
    if ! [[ "$val" =~ ^[0-9]+$ ]] || [ "$val" -lt 1 ] || [ "$val" -gt 65535 ]; then
        error_exit "Option --${name} must be an integer 1-65535, got: $val"
    fi
}

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
