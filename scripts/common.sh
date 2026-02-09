#!/usr/bin/env bash
set -euo >/dev/null 2>&1

# ==================== Log functions ====================
info() { echo -e "\033[36m=== $@ ===\033[0m"; }
success() { echo -e "\033[32m✅ $@\033[0m"; }
warning() { echo -e "\033[33m⚠️  $@\033[0m"; }
error() { echo -e "\033[31m❌ $@\033[0m"; exit 1; }

# ==================== Detect OS functions ====================
detect_os() {
    local os_type=$(uname -s)
    case "${os_type}" in
        Darwin)
            DEPLOY_VARS["OS_TYPE"]="macos"
            ;;
        Linux)
            DEPLOY_VARS["OS_TYPE"]="linux"
            ;;
        MINGW*|MSYS*|CYGWIN*)
            DEPLOY_VARS["OS_TYPE"]="windows"
            ;;
        *)
            error "Unsupported OS: ${os_type}"
            ;;
    esac
    info "Operating System: ${DEPLOY_VARS["OS_TYPE"]}"
}

# ============= Generate 5-character random string =================
generate_random_chars() {
    # Predefined character set
    local chars="abcdefghijklmnopqrstuvwxyz0123456789"
    local char_count=${#chars}  # Character set length (36)
    local random_str=""
    local i=0
    local os_type=${DEPLOY_VARS["OS_TYPE"]}

    # Loop 5 times, each time take 1 random character
    while [ $i -lt 5 ]; do
        local random_idx=0  # Random index (0-35)
        case "${os_type}" in
            macos)
                # macOS: use jrand48 for better randomness
                random_idx=$(( $(jot -r 1 0 32767) % 36 ))
                ;;
            linux)
                # Linux: use /dev/urandom for true random numbers, modulo 36 to get 0-35
                random_idx=$(head -c 2 /dev/urandom | od -An -tu2 | awk '{print $1 % 36}')
                ;;
            windows)
                # Windows Git Bash: use $RANDOM modulo 36 ($RANDOM range 0-32767)
                random_idx=$((RANDOM % 36))
                ;;
        esac
        # Take character by index, append to result
        random_str+=${chars:$random_idx:1}
        i=$((i + 1))
    done

    # Output result (guaranteed 5 characters, no validation needed)
    echo "$random_str"
}

# ===================== Check Docker availability =====================
check_docker() {
    info "Checking Docker..."
    command -v docker >/dev/null 2>&1 || {
        error "Docker is not installed. Please install Docker 20.10 or higher first."
    }
    
    docker info >/dev/null 2>&1 || {
        error "Docker daemon is not running. Please start it first."
    }
    
    # Standardize to x.y.z format, then extract major and minor versions,
    # padding with 0 if insufficient
    local docker_version=$(docker version --format '{{.Server.Version}}')
    local major=$(echo "${docker_version}" | cut -d. -f1)
    local minor=$(echo "${docker_version}" | cut -d. -f2)
    local docker_version_num=$((100 * major + minor))
    local min_version_num=$((100 * 20 + 10))

    info "Docker Version: ${docker_version}"
    if [[ "${docker_version_num}" -lt "${min_version_num}" ]]; then
        error "Unsupported Docker version: ${docker_version}. Required minimum version is 20.10."
    fi
    info "Docker version check passed: ${docker_version} (≥ 20.10)"

    # Only support Docker Compose V2, remove docker-compose V1 completely
    info "Checking Docker Compose V2..."
    if ! docker compose version >/dev/null 2>&1; then
        error "Docker Compose V2 is required (command: docker compose)"
    fi
    
    success "Docker is ready"
}

# ===================== Fetch public IP =====================
get_public_ip() {
    local local_ip=""
    local os_type=${DEPLOY_VARS["OS_TYPE"]}
    local cmd=${ARGS["CMD"]}

    if [ -n "${DEPLOY_VARS["IP"]:-}" ]; then
        info "Predefined IP address detected: ${DEPLOY_VARS["IP"]}"
        return
    fi

    if [ "${cmd}" == "down" ]; then
        return
    fi

    case "${os_type}" in
        macos)
            # macOS: Use ifconfig to get IP address
            local_ip=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -n 1 | awk '{print $2}')       
            ;;
        linux)
            local default_interface=$(ip route show default | awk '/default/ {print $5; exit}')
            if [ -n "${default_interface}" ]; then
                # Extract IPv4 address of the default gateway interface (strip subnet mask)
                local_ip=$(ip addr show "${default_interface}" | awk '/inet / {gsub(/\/.*/, "", $2); print $2; exit}')
            fi

            # fallback: Retain original logic (hostname -I) if all above fail
            if [ -z "${local_ip}" ]; then
                local_ip=$(hostname -I | awk '{print $1}')
            fi
            ;;
        windows)
            # Windows Git Bash/Cygwin: Use PowerShell
            local_ip=$(powershell -Command "& { \
                Get-NetIPAddress | \
                Where-Object { \
                    \$_.AddressFamily -eq 'IPv4' -and \
                    !\$_.IPAddress.StartsWith('127.') -and \
                    !\$_.IPAddress.StartsWith('169.254.') -and \
                    \$_.InterfaceAlias -match 'WLAN|Ethernet' -and \
                    \$_.InterfaceAlias -notmatch 'Bluetooth|Hyper-V|WSL|Virtual|vEthernet' \
                } | \
                Select-Object -ExpandProperty IPAddress -First 1
            }" 2>/dev/null)
            local_ip=$(echo "${local_ip}" | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | head -n 1)
            ;;
    esac

    DEPLOY_VARS["IP"]=${local_ip}
}

# Print all key-value pairs of bash array
print_array() {
    local array_name="$1"
    local -n arr_ref="$1"
    
    echo -e "\033[33m$ ${array_name}\033[0m"
    
    if [[ ! "$(declare -p ${array_name})" =~ "declare -a" && ! "$(declare -p ${array_name})" =~ "declare -A" ]]; then
        echo -e "\033[31m[ERROR] ${array_name} is not a bash array variable!\033[0m"
        return
    fi

    for key in "${!arr_ref[@]}"; do
        echo -e "\033[36m  ├─ ${array_name}[${key}] = ${arr_ref[${key}]}\033[0m"
    done
    
    echo -e "\033[33m  └─ Total elements count: ${#arr_ref[@]}\033[0m\n"
}

# Convert string: uppercase → lowercase + hyphen(-) → underscore(_)
format_dir_str() {
    local original_str="$1"
    local lower_str="${original_str,,}"
    local final_str="${lower_str//_/-}"
    echo "${final_str}"
}

# Set value for associative array if the key is empty/unset
set_if_empty() {
    local -n vars=$1
    local key=$2
    local value=$3
    if [ -z "${vars["${key}"]:-}" ]; then
        vars["${key}"]="${value}"
    fi 
}
