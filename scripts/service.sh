#!/usr/bin/env bash
set -euo pipefail


# =============================================================================
# CORE DATA STRUCTURE
# =============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${SCRIPT_DIR}/.."

declare -A CONFIG=(
    ["PACKAGE_PREFIX"]="openjiuwen_studio_server"
    ["BACKEND_DIR"]="${PROJECT_DIR}/backend"
    ["SETUPCFG_TEMPLATE_FILE"]="${PROJECT_DIR}/backend/setup.cfg.template"
    ["SETUPCFG_FILE"]="${PROJECT_DIR}/backend/setup.cfg"
    ["ENV_FILE"]="${SCRIPT_DIR}/.env"
    ["DEFAULT_ENV_FILE"]="${SCRIPT_DIR}/.env.default"
    ["CUSTOM_ENV_FILE"]="${SCRIPT_DIR}/.env.custom"
    ["CONFIG_DIR"]="${SCRIPT_DIR}/conf"
    ["JIUWEN_COMPOSE_TEMPLATE_FILE"]="${SCRIPT_DIR}/conf/docker-jiuwen.template.yml"
    ["JIUWEN_COMPOSE_FILE"]="${SCRIPT_DIR}/conf/docker-jiuwen.yml"
    ["MYSQL_COMPOSE_TEMPLATE_FILE"]="${SCRIPT_DIR}/conf/docker-mysql.template.yml"
    ["MYSQL_COMPOSE_FILE"]="${SCRIPT_DIR}/conf/docker-mysql.yml"
    ["MILVUS_COMPOSE_TEMPLATE_FILE"]="${SCRIPT_DIR}/conf/docker-milvus.template.yml"
    ["MILVUS_COMPOSE_FILE"]="${SCRIPT_DIR}/conf/docker-milvus.yml"
    ["PLUGIN_COMPOSE_TEMPLATE_FILE"]="${SCRIPT_DIR}/conf/docker-plugin.template.yml"
    ["PLUGIN_COMPOSE_FILE"]="${SCRIPT_DIR}/conf/docker-plugin.yml"
    ["NGINX_TEMPLE_FILE"]="${SCRIPT_DIR}/conf/nginx.template.conf"
    ["DOCKER_COMPOSE_CMD"]=""
    ["START_PORT"]="1024"
    ["END_PORT"]="65535"
    ["ALLOC_PORT_NUM"]="7"
    ["OS_TYPE"]=""
)


declare -A NAMES=(
    ["MYSQL_SERVICE_NAME"]="mysql"
    ["MYSQL_DOCKER_NAME"]="jiuwen-mysql"
    ["MYSQL_VOLUME"]="mysql-data"
    ["ETCD_SERVICE_NAME"]="etcd"
    ["ETCD_DOCKER_NAME"]="jiuwen-milvus-etcd"
    ["ETCD_VOLUME"]="etcd-data"
    ["MINIO_SERVICE_NAME"]="minio"
    ["MINIO_DOCKER_NAME"]="jiuwen-milvus-minio"
    ["MINIO_VOLUME"]="minio-data"
    ["MILVUS_SERVICE_NAME"]="milvus"
    ["MILVUS_DOCKER_NAME"]="jiuwen-milvus-standalone"
    ["MILVUS_VOLUME"]="milvus-data"
    ["FRONTEND_SERVICE_NAME"]="frontend"
    ["FRONTEND_DOCKER_NAME"]="jiuwen-frontend"
    ["BACKEND_SERVICE_NAME"]="backend"
    ["BACKEND_DOCKER_NAME"]="jiuwen-backend"
    ["JIUWEN_NETWORK_NAME"]="jiuwen-network"
    ["NGINX_FILE_NAME"]="nginx.conf"
    ["PLUGIN_SERVER_SERVICE_NAME"]="plugin-server"
    ["PLUGIN_SERVER_DOCKER_NAME"]="jiuwen-plugin-server"
    ["SANDBOX_GATEWAY_SERVICE_NAME"]="sandbox-gateway"
    ["SANDBOX_GATEWAY_DOCKER_NAME"]="jiuwen-sandbox-gateway"
    ["PYTHON_SERVER_SERVICE_NAME"]="python-server"
    ["PYTHON_SERVER_DOCKER_NAME"]="jiuwen-python-server"
    ["JS_SERVER_SERVICE_NAME"]="js-server"
    ["JS_SERVER_DOCKER_NAME"]="jiuwen-js-server"
)

declare -ga PORTS=(
    MYSQL_HOST_PORT
    ETCD_HOST_PORT
    MINIO_SERVICE_HOST_PORT
    MINIO_CONSOLE_HOST_PORT
    MILVUS_HOST_PORT
    FRONTEND_HOST_PORT
    BACKEND_HOST_PORT
    PLUGIN_SERVER_HOST_PORT
    SANDBOX_GATEWAY_HOST_PORT
    PYTHON_SERVER_HOST_PORT
    JS_SERVER_HOST_PORT
)

# ==== Global associative array: Stores all variables from .env (key=variable name, value=variable value) ====
declare -A ENV_VARS=(
)

# ==================== Available port list ====================
declare -ga AVAILABLE_PORTS=()
declare -ga ALLOCATED_PORTS=()

# ==================== Argument list ====================
# Allowed first-level commands
FIRST_LEVEL_CMDS=("up" "down" "conf" "milvus" "mysql" "jiuwen" "plugin")

# First-level commands requiring second-level command (milvus/mysql/jiuwen must be followed by up/down)
NEED_SECOND_LEVEL_CMDS=("milvus" "mysql" "jiuwen" "plugin")

# Allowed second-level commands
SECOND_LEVEL_CMDS=("up" "down")

declare -A ARGS=(
    ["CMD1"]=""
    ["CMD2"]=""
    ["ENV_FILE"]=""
)

# ==================== Log functions ====================
info() { echo -e "\033[36m=== $@ ===\033[0m"; }
success() { echo -e "\033[32m✅ $@\033[0m"; }
warning() { echo -e "\033[33m⚠️  $@\033[0m"; }
error() { echo -e "\033[31m❌ $@\033[0m"; exit 1; }
# 检测操作系统类型
detect_os() {
    local os_type=$(uname -s)
    case "${os_type}" in
        Darwin)
            CONFIG["OS_TYPE"]="macos"
            ;;
        Linux)
            CONFIG["OS_TYPE"]="linux"
            ;;
        MINGW*|MSYS*|CYGWIN*)
            CONFIG["OS_TYPE"]="windows"
            ;;
        *)
            error "Unsupported OS: ${os_type}"
            ;;
    esac
}

parse_args() {
    local args=("$@")
    local cmd1=""  # First-level command (up/down/milvus etc.)
    local cmd2=""  # Second-level command (only needed after milvus etc.)
    local i=0
    local env_file=""

    # Parse arguments: handle options (-f) first, then commands
    while [ $i -lt ${#args[@]} ]; do
        case "${args[$i]}" in
            -f|--file)
                # Parse -f option: must be followed by file path
                if [ $((i+1)) -ge ${#args[@]} ]; then
                    error "-f/--file option must be followed by .env file path!"
                fi
                env_file="${args[$((i+1))]}"
                # Check if file exists (optional, can also check in read_env_from_file)
                if [ ! -f "${env_file}" ]; then
                    error "-f specified file does not exist: ${env_file}"
                fi
                i=$((i+2))  # Skip -f and file path
                ;;
            *)
                # Non-option arguments: treat as commands (first cmd1, then cmd2)
                if [ -z "${cmd1}" ]; then
                    cmd1="${args[$i]}"
                elif [ -z "${cmd2}" ]; then
                    cmd2="${args[$i]}"
                else
                    # Extra arguments are invalid
                    error "Invalid extra argument: ${args[$i]}! Only supports command + [-f .env] format"
                fi
                i=$((i+1))
                ;;
        esac
    done

    # ==================== Command validation ====================
    # 1. No command arguments: default cmd1=up
    if [ -z "${cmd1}" ]; then
        cmd1="up"
        info "No command specified, defaulting to: up"
    fi

    # 2. Validate first-level command
    if [[ ! " ${FIRST_LEVEL_CMDS[@]} " =~ " ${cmd1} " ]]; then
        error "Invalid first-level command: ${cmd1}! Only supports: ${FIRST_LEVEL_CMDS[*]}"
    fi

    # 3. Validate second-level command (only required for milvus/mysql/jiuwen)
    if [[ " ${NEED_SECOND_LEVEL_CMDS[@]} " =~ " ${cmd1} " ]]; then
        if [ -z "${cmd2}" ]; then
            error "Command ${cmd1} must be followed by a second-level command (up/down)! Example: ./service ${cmd1} up"
        fi
        if [[ ! " ${SECOND_LEVEL_CMDS[@]} " =~ " ${cmd2} " ]]; then
            error "Invalid second-level command for ${cmd1}: ${cmd2}! Only supports: ${SECOND_LEVEL_CMDS[*]}"
        fi
    else
        # Non-milvus  commands: no second-level command allowed
        if [ -n "${cmd2}" ]; then
            error "Command ${cmd1} does not support second-level commands! Extra argument: ${cmd2}"
        fi
    fi

    # Assign parsed commands to global variables for main function
    ARGS["CMD1"]=${cmd1}
    ARGS["CMD2"]=${cmd2}
    ARGS["ENV_FILE"]=${env_file}
}

# ==================== Count undefined ports ====================
count_undefined_ports() {
    local undefined_count=0

    # Traverse port list, count undefined (empty/no key) ports
    for port_name in "${PORTS[@]}"; do
        if [[ -z "${ENV_VARS[$port_name]:-}" ]]; then
            undefined_count=$((undefined_count + 1))
            info "[$port_name] undefined, requires available port allocation"
        else
            local port=${ENV_VARS[$port_name]}
            ALLOCATED_PORTS+=("${port}")
            info "[$port_name] defined, value: ${port}"

            if is_port_occupied "$port"; then
                error "[$port_name]:${port} is occupied. Please specify an unoccupied port instead."
            fi
        fi
    done

    # Update configuration: number of ports to allocate = undefined port count
    CONFIG["ALLOC_PORT_NUM"]=${undefined_count}
    info "====================================="
    info "Total undefined ports: ${undefined_count} → Need to allocate ${undefined_count} available ports"
    info "====================================="
}

# ===================== Check if a single port is occupied =====================
# Function: Check whether the specified port is occupied by any process
# Parameter: $1 - Port number to check (required, numeric only)
# Return Values:
#   0 - Port is occupied
#   1 - Port is available (not occupied)
# Compatibility: Supports macOS (lsof), Linux (ss/netstat), Windows Git Bash/Cygwin (netstat)
is_port_occupied() {
    local port="$1"
    local port_occupied=0
    local os_type=${CONFIG["OS_TYPE"]}

    if [[ "$os_type" == "macos" ]]; then
        # macOS: use lsof which is more reliable
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            port_occupied=1
        fi
    elif [[ "$os_type" == "linux" ]]; then
        # Linux: prefer ss command (more efficient)
        netstat_output=$(netstat -tuln 2>&1)
        if echo "${netstat_output}" | grep -q ":$port"; then
            port_occupied=1
        fi
    else
        # Windows Git Bash/Cygwin: Match LISTENING state in netstat -an output
        if netstat -an | grep -qiE ":$port[^0-9].*LISTENING.*" 2>/dev/null; then
            port_occupied=1
        fi
    fi
    # Return result: 0 = occupied, 1 = available
    if [ "$port_occupied" -eq 1 ]; then
        return 0
    else
        return 1
    fi
}

# ===================== Allocate multiple available ports at once =====================
alloc_available_ports() {
    local start_port=${CONFIG["START_PORT"]}
    local end_port=${CONFIG["END_PORT"]}
    local need_port_num=${CONFIG["ALLOC_PORT_NUM"]}
    local allocated_ports=("${ALLOCATED_PORTS[@]:-}")

    if [ "$need_port_num" -eq 0 ]; then
        return 0
    fi
    
    info "Current allocated port list: ${allocated_ports[*]:-empty}"
    info "Scanning port range: $start_port ~ $end_port, need to allocate $need_port_num available ports"

    # Traverse ports, collect enough available ports
    for port in $(seq "$start_port" "$end_port"); do
        # Skip already allocated ports
        local is_allocated=0
        for allocated_port in "${allocated_ports[@]}"; do
            if [ -n "$allocated_port" ]; then
                if [ "$port" -eq "$allocated_port" ]; then
                    is_allocated=1
                    break
                fi
            fi 
        done

        if [ "$is_allocated" -eq 1 ]; then
            info "Port $port already allocated, skipping"
            continue
        fi

        # Check port occupancy via the reusable function
        if is_port_occupied "$port"; then
            # Return 0 means port is occupied → skip
            continue
        else
            # Return 1 means port is available → add to list
            AVAILABLE_PORTS+=("$port")
            info "Found available port: $port (collected ${#AVAILABLE_PORTS[@]}/$need_port_num)"

            # Stop traversal when enough ports are collected
            if [ "${#AVAILABLE_PORTS[@]}" -ge "$need_port_num" ]; then
                break
            fi
        fi
    done

    # 4. Verify enough ports were collected
    if [ "${#AVAILABLE_PORTS[@]}" -lt "$need_port_num" ]; then
        error "Only found ${#AVAILABLE_PORTS[@]} available ports, insufficient for $need_port_num (port range: $start_port-$end_port)"
    fi

    # 5. Update global allocated port list (mark as allocated to avoid reuse)
    allocated_ports+=("${AVAILABLE_PORTS[@]}")
    info "Successfully collected $need_port_num available ports: ${AVAILABLE_PORTS[*]}"
}

# ===================== Dynamically assign ports =====================
assign_ports() {
    local port_index=0  # Available port index (starting from 0)

    info "====================================="
    info "Starting to assign values to undefined ports..."
    info "====================================="

    # Traverse all port names, assign dynamically
    for port_name in "${PORTS[@]}"; do
        if [[ -n "${ENV_VARS[$port_name]:-}" ]]; then
            # Already defined: keep original value
            success "[$port_name] already defined, keeping original value: ${ENV_VARS[$port_name]}"
        else
            # Undefined: take value from available port list by index
            if [[ $port_index -lt ${#AVAILABLE_PORTS[@]} ]]; then
                ENV_VARS["$port_name"]=${AVAILABLE_PORTS[$port_index]}
                success "[$port_name] undefined, assigning available port: ${ENV_VARS[$port_name]}"
                port_index=$((port_index + 1))  # Increment index for next undefined port
            else
                # Extreme case: insufficient available ports (shouldn't happen as alloc_available_ports already validates)
                error "[$port_name] no available ports to assign (available ports: ${#AVAILABLE_PORTS[@]})"
            fi
        fi
    done

    info "============== All port assignments complete! =============="
}

# ===================== Generate 5-character random string =====================
# Fixed character set + random index selection, precisely generates 5 characters
generate_random_chars() {
    # 1. Predefined character set (customizable, e.g., add uppercase: a-zA-Z0-9)
    local chars="abcdefghijklmnopqrstuvwxyz0123456789"
    local char_count=${#chars}  # Character set length (36)
    local random_str=""
    local i=0
    local os_type=${CONFIG["OS_TYPE"]}

    # 2. Loop 5 times, each time take 1 random character
    while [ $i -lt 5 ]; do
        local random_idx=0  # Random index (0-35)

        if [[ "$os_type" == "macos" ]]; then
            # macOS: use jrand48 for better randomness
            random_idx=$(( $(jot -r 1 0 32767) % 36 ))
        elif [[ "$os_type" == "linux" ]]; then
            # Linux: use /dev/urandom for true random numbers, modulo 36 to get 0-35
            random_idx=$(head -c 2 /dev/urandom | od -An -tu2 | awk '{print $1 % 36}')
        else
            # Windows Git Bash: use $RANDOM modulo 36 ($RANDOM range 0-32767)
            random_idx=$((RANDOM % 36))
        fi

        # 4. Take character by index, append to result
        random_str+=${chars:$random_idx:1}
        i=$((i + 1))
    done

    # 5. Output result (guaranteed 5 characters, no validation needed)
    echo "$random_str"
}

# ===================== Generate final service names, container names, volume names =====================
generate_final_names() {
    local name_suffix=$(generate_random_chars)
    ENV_VARS["NAME_SUFFIX"]=${name_suffix}


    for key in "${!NAMES[@]}"; do
        info "Generating name for ${key}"
        local value="${NAMES[$key]}" # Predefined default value

        if [[ -n "${ENV_VARS["${key:-}"]:-}" ]]; then
            # Case 1: Defined in ENV_VARS (non-empty), use .env value
            ENV_VARS["${key}"]="${ENV_VARS[$key]}"
            success "[$key] using .env defined value: ${ENV_VARS[$key]}"
        else
            # Case 2: Undefined, generate: predefined_value_random_string
            local final_value="${value}-${name_suffix}"
            ENV_VARS["${key}"]="${final_value}"
            info "[$key] undefined in .env, generating random name: ${final_value}"
        fi
    done
}

generate_env() {
    local default_env_file=${CONFIG["DEFAULT_ENV_FILE"]}
    local custom_env_file=${CONFIG["CUSTOM_ENV_FILE"]}
    local final_env_file=${CONFIG["ENV_FILE"]}

    read_env_from_file ${default_env_file}
    if [ -f ${custom_env_file} ]; then
        read_env_from_file ${custom_env_file}
    fi

    setup_env_vars
    write_env_to_file ${final_env_file}
}

write_env_to_file() {
    local env_file=$1
    local name_suffix=${ENV_VARS["NAME_SUFFIX"]}

    info "Writing variable array ENV_VARS to file: ${env_file}"

    > "${env_file}"
    printf "%s\n" "${!ENV_VARS[@]}" | sort | while read -r key; do
        if [[ -n "${key}" ]]; then
            echo "${key}=${ENV_VARS[$key]}" >> "${env_file}"
        fi
    done

    info "Copy ${env_file} to ${env_file}.${name_suffix}"
    cp ${env_file} ${env_file}.${name_suffix}
}

# ======== Read all .env variables into ENV_VARS associative array ========
read_env_from_file() {
    local env_file=$1
    local os_type=${CONFIG["OS_TYPE"]}

    if [ ! -f "${env_file}" ]; then
        error ".env file does not exist: ${env_file}"
    fi
    info "Loading .env file into variable array: ${env_file}"

    # Read .env line by line, exclude comments and empty lines, store in associative array
    while IFS= read -r line || [[ -n "${line}" ]]; do
        if [[
            ! "${line}" =~ ^[[:space:]]*# &&  # Not a comment line
            -n "${line//[[:space:]]/}"        # Not empty (has content after removing all whitespace)
        ]]; then
            # Remove leading/trailing whitespace
            if [[ "$os_type" == "macos" ]]; then
                line_trimmed=$(echo "${line}" | sed -E 's/^[[:space:]]*//;s/[[:space:]]*$//')
            else
                line_trimmed=$(echo "${line}" | sed -e 's/^[ \t]*//' -e 's/[ \t]*$//')
            fi

            # Skip invalid lines without equals sign
            if [[ "${line_trimmed}" != *"="* ]]; then
                info "Skipping invalid line without equals sign: ${line_trimmed}"
                continue
            fi

            # Split key and value (supports values containing =)
            # Find first = position, left is key, right is value
            key="${line_trimmed%%=*}"  # From left to right, content before first = (variable name)
            value="${line_trimmed#*=}" # From left to right, content after first = (variable value)
            # Store in associative array (key=variable name, value=variable value)
            ENV_VARS["${key}"]="${value}"
        fi
    done < "${env_file}"
}

setup_env_vars() {
    # Detect free ports, assign port numbers to undefined ports
    count_undefined_ports
    alloc_available_ports
    assign_ports

    # If service names, container names, volume names not set, generate non-conflicting names
    generate_final_names

    # Set no_proxy, NO_PROXY values, backend connects to milvus container without proxy
    local milvus_service_name=${ENV_VARS["MILVUS_SERVICE_NAME"]}
    local plugin_service_name=${ENV_VARS["PLUGIN_SERVER_SERVICE_NAME"]}
    local sandbox_gateway_service_name=${ENV_VARS["SANDBOX_GATEWAY_SERVICE_NAME"]}

    local no_proxy_str="no_proxy=${milvus_service_name},${plugin_service_name},${sandbox_gateway_service_name}"
    local NO_PROXY_STR="NO_PROXY=${milvus_service_name},${plugin_service_name},${sandbox_gateway_service_name}"

    if [ -n "${no_proxy:-}" ]; then
        no_proxy_str="${no_proxy_str},${no_proxy:-}"
    fi
    if [ -n "${NO_PROXY:-}" ]; then
        NO_PROXY_STR="${NO_PROXY_STR},${NO_PROXY:-}"
    fi

    ENV_VARS["no_proxy_str"]="${no_proxy_str}"
    ENV_VARS["NO_PROXY_STR"]="${NO_PROXY_STR}"

    if [[ -z "${ENV_VARS["VITE_API_PROXY_TARGET"]:-}" ]]; then
        local backend_service=${ENV_VARS["BACKEND_SERVICE_NAME"]}
        local backend_port=${ENV_VARS["BACKEND_PORT"]}
        ENV_VARS["VITE_API_PROXY_TARGET"]="http://${backend_service}:${backend_port}/"
    fi

    if [[ -z "${ENV_VARS["DB_HOST"]:-}" ]]; then
        ENV_VARS["DB_HOST"]=${ENV_VARS["MYSQL_SERVICE_NAME"]}
    fi

    if [[ -z "${ENV_VARS["MILVUS_HOST"]:-}" ]]; then
        ENV_VARS["MILVUS_HOST"]=${ENV_VARS["MILVUS_SERVICE_NAME"]}
    fi

    if [[ -z "${ENV_VARS["CODE_SANDBOX_URL"]:-}" ]]; then
        local gateway_service=${ENV_VARS["SANDBOX_GATEWAY_SERVICE_NAME"]}
        local gateway_port=${ENV_VARS["SANDBOX_GATEWAY_PORT"]}
        ENV_VARS["CODE_SANDBOX_URL"]="http://${gateway_service}:${gateway_port}/run"
    fi

    if [[ -z "${ENV_VARS["VITE_PLUGIN_SERVICE_URL"]:-}" ]]; then
        local plugin_service=${ENV_VARS["PLUGIN_SERVER_SERVICE_NAME"]}
        local plugin_port=${ENV_VARS["PLUGIN_SERVER_PORT"]}
        ENV_VARS["VITE_PLUGIN_SERVICE_URL"]="http://${plugin_service}:${plugin_port}"
    fi

    local nginx_read_timeout_ms=${ENV_VARS["VITE_API_PROXY_TIMEOUT"]}
    if ! [[ "${nginx_read_timeout_ms}" =~ ^[0-9]+$ ]]; then
        error "Error: The value of VITE_API_PROXY_TIMEOUT [${nginx_read_timeout_ms}] is not a valid number (only non-negative integers are supported)!"
    fi

    local nginx_read_timeout=$(( nginx_read_timeout_ms / 1000 ))
    ENV_VARS["NGINX_READ_TIMEOUT"]=${nginx_read_timeout}
}

# ==== Extract template placeholders (docker/docker-compose.yml, frontend/nginx.conf) ====
extract_placeholders() {
    # Extract all <<variable_name>> placeholders from template (deduplicated, return array)
    local templatefile="$1"
    local -a placeholders=($(grep -oE '<<[^>]+>>' "${templatefile}" | sort -u))
    echo "${placeholders[@]}"
}

# ==== Replace template (docker/docker-compose.yml, frontend/nginx.conf) ====
replace_placeholder() {
    local placeholder="$1"
    local destfile="$2"  # Iteratively replace based on target file
    local os_type=${CONFIG["OS_TYPE"]}
    # Extract variable name (e.g., <<BACKEND_SERVICE_NAME>> → BACKEND_SERVICE_NAME)
    local var_name=$(echo "${placeholder}" | sed -e 's/^<<//' -e 's/>>$//')

    # Get value from associative array (error if not found)
    if [ -z "${ENV_VARS["${var_name:-}"]:-}" ]; then
        error "Variable [${var_name}] not found! Please define in .env file"
    fi
    local var_value="${ENV_VARS["${var_name}"]}"

    info "  Replacing placeholder: ${placeholder} → ${var_value}"

    if [[ "$os_type" == "macos" ]]; then
        # macOS sed requires backup extension with -i
        sed -i.bak "s|${placeholder}|${var_value}|g" "${destfile}"
        rm -f "${destfile}.bak"
    else
        # Linux/Windows: use awk
        awk -v ph="${placeholder}" -v val="${var_value}" '
            { gsub(ph, val); print }
        ' "${destfile}" > "${destfile}.tmp" && mv -f "${destfile}.tmp" "${destfile}"
    fi
}

# ==== Generate configuration file (docker/docker-compose.yml, frontend/nginx.conf) ====
generate_config_file() {
    local templatefile="$1"
    local destfile="$2"
    # 1. Verify template file exists
    if [ ! -f "${templatefile}" ]; then
        error "Template file does not exist: ${templatefile}"
    fi
    info "Using template file: ${templatefile}"

    # 2. Extract all placeholders
    local -a placeholders=($(extract_placeholders "${templatefile}"))
    if [ ${#placeholders[@]} -eq 0 ]; then
        warning "No <<variable_name>> format placeholders found in template file"
    fi

    # 3. Copy template as target file
    cp -f "${templatefile}" "${destfile}" || error "Cannot create target file: ${destfile}"

    # 4. Loop to replace each placeholder
    info "Starting placeholder replacement..."
    for placeholder in "${placeholders[@]}"; do
        replace_placeholder "${placeholder}" "${destfile}"
    done

    success "Final file: ${destfile}"
}

# ================ Generate py_modules (backend/setup.cfg) ================
generate_py_modules() {
    local backend_dir=${CONFIG["BACKEND_DIR"]}
    local package_prefix=${CONFIG["PACKAGE_PREFIX"]}

    cd "${backend_dir}" || exit 1
    find . -maxdepth 1 -type f -name "*.py" ! -name "__init__.py" | \
        sed -e 's|^\./||' -e 's|\.py$||' | \
        sort | \
        awk -v prefix="${package_prefix}." '{print "    " prefix $0}'
}

# ================ Generate packages (backend/setup.cfg) ================
generate_packages() {
    # Directory names to exclude (these directories will be completely skipped at any level)
    local exclude_dir_names=(".venv" "dist" "build" ".git" "logs" "tests" ".egg-info" "__pycache__")
    local backend_dir=${CONFIG["BACKEND_DIR"]}
    local package_prefix=${CONFIG["PACKAGE_PREFIX"]}

    cd "${backend_dir}" || exit 1

    # Build find exclude rules: -prune (completely skip) for specified directory names
    prune_rules=""
    for dir in "${exclude_dir_names[@]}"; do
        prune_rules+="-name '${dir}' -o "
    done
    prune_rules="\( ${prune_rules% -o } \) -prune -o"

    # find command logic:
    # 1. Match exclude directories → -prune (skip, don't recurse)
    # 2. Other directories → check if __init__.py exists → output path
    sub_packages=$(eval "find . -type d ${prune_rules} -exec test -f \"{}/__init__.py\" \; -print" | \
        sed -e 's|^\./||' -e 's|/|.|g' | \
        awk -v prefix="${package_prefix}." '{print prefix $0}' | \
        sort | \
        awk '{print "    " $0}')

    # Add top-level package
    echo -e "    ${package_prefix}\n${sub_packages}"
}

# ================ Replace template (backend/setup.cfg) ================
replace_setup_cfg_placeholders() {
    local template="$1"
    local output="$2"
    local py_modules="$3"
    local packages="$4"

    awk -v py_modules="$py_modules" -v packages="$packages" '
    BEGIN {
        split(py_modules, py_arr, "\n");
        split(packages, pkg_arr, "\n");
    }
    {
        if ($0 ~ /{{PY_MODULES}}/) {
            for (i in py_arr) {
                print py_arr[i];
            }
        }
        else if ($0 ~ /{{PACKAGES}}/) {
            for (i in pkg_arr) {
                print pkg_arr[i];
            }
        }
        else {
            print $0;
        }
    }' "$template" > "$output"
}

# ================ Generate configuration file (backend/setup.cfg) ================
generate_setup_cfg() {
    local template_path=${CONFIG["SETUPCFG_TEMPLATE_FILE"]}
    local output_path=${CONFIG["SETUPCFG_FILE"]}

    if [ ! -f "${template_path}" ]; then
        error "\033[31m❌ Template file does not exist: ${template_path}\033[0m"
    fi

    info "\033[32mℹ️ Starting project file scan...\033[0m"
    py_modules_content=$(generate_py_modules)
    packages_content=$(generate_packages)
    [ -z "${py_modules_content}" ] && py_modules_content="    "

    info "\033[32mℹ️ Reading template and replacing dynamic content...\033[0m"
    replace_setup_cfg_placeholders "${template_path}" "${output_path}" "${py_modules_content}" "${packages_content}"

    info "\033[32m✅ setup.cfg generated successfully! Path: ${output_path}\033[0m"
}

# Check Docker availability
check_docker() {
    info "Checking Docker..."
    
    command -v docker >/dev/null 2>&1 || {
        log_error "Docker is not installed. Please install Docker first."
        log_error "Solution: Visit https://docs.docker.com/get-docker/"
        return 1
    }
    
    docker info >/dev/null 2>&1 || {
        error "Docker daemon is not running. Please start Docker."
        error "Solution: Start Docker Desktop or run 'sudo systemctl start docker'"
        return 1
    }
    
    # Detect Docker Compose command
    if docker compose version >/dev/null 2>&1; then
        CONFIG["DOCKER_COMPOSE_CMD"]="docker compose"
    elif command -v docker-compose >/dev/null 2>&1; then
        CONFIG["DOCKER_COMPOSE_CMD"]="docker-compose"
    else
        error "Docker Compose is not available."
        error "Solution: Install Docker Compose from https://docs.docker.com/compose/install/"
        return 1
    fi
    
    success "Docker is ready"
}

exec_service() {
    local env_file=${CONFIG["ENV_FILE"]}
    local exec_cmd=${CONFIG["DOCKER_COMPOSE_CMD"]}
    local jiuwen_compose_file=${CONFIG["JIUWEN_COMPOSE_FILE"]}
    local mysql_compose_file=${CONFIG["MYSQL_COMPOSE_FILE"]}
    local milvus_compose_file=${CONFIG["MILVUS_COMPOSE_FILE"]}
    local plugin_compose_file=${CONFIG["PLUGIN_COMPOSE_FILE"]}
    local mysql_container=${ENV_VARS["MYSQL_DOCKER_NAME"]}
    local milvus_container=${ENV_VARS["MILVUS_DOCKER_NAME"]}
    local plugin_server_container=${ENV_VARS["PLUGIN_SERVER_DOCKER_NAME"]}
    local sandbox_gateway_container=${ENV_VARS["SANDBOX_GATEWAY_DOCKER_NAME"]}
    local python_server_container=${ENV_VARS["PYTHON_SERVER_DOCKER_NAME"]}
    local js_server_container=${ENV_VARS["JS_SERVER_DOCKER_NAME"]}
    local frontend_container=${ENV_VARS["FRONTEND_DOCKER_NAME"]}

    local cmd=${ARGS["CMD1"]}

    if [ "${cmd}" = "up" ]; then
        ## Build SSL certificates if script exists
        source "${SCRIPT_DIR}/build_SSL_files.sh"
        local cmd_args="-d"  # -d only as argument for up, placed after up

        # Use local MYSQL
        if [ ${ENV_VARS["DB_HOST"]} == ${ENV_VARS["MYSQL_SERVICE_NAME"]} ]; then
            ## Start mysql container
            eval "${exec_cmd} -f ${mysql_compose_file} ${cmd} ${cmd_args}" || error "${cmd} mysql container failed"

            wait_for_mysql
            create_db_if_not_exist
        fi

        # Use local MILVUS
        if [ ${ENV_VARS["MILVUS_HOST"]} == ${ENV_VARS["MILVUS_SERVICE_NAME"]} ]; then
            ## Start milvus container cluster
            eval "${exec_cmd} -f ${milvus_compose_file} ${cmd} ${cmd_args}" || warning "Milvus container cluster ${cmd} operation failed: The system's memory functionality is disabled, but the other system features still works"
            #wait_for_container_healthy ${milvus_container}
        fi

        eval "${exec_cmd} -f ${plugin_compose_file} ${cmd} ${cmd_args}" || error "${cmd} Plugin + Sandbox Server failed"

        wait_for_container_healthy ${plugin_server_container}
        wait_for_container_healthy ${sandbox_gateway_container}
        wait_for_container_healthy ${python_server_container}
        wait_for_container_healthy ${js_server_container}

        eval "${exec_cmd} -f ${jiuwen_compose_file} ${cmd} ${cmd_args}" || error "${cmd} JiuwenAgentStudio container cluster failed"

        wait_for_container_healthy ${frontend_container}

    elif [ "${cmd}" = "down" ]; then
        local compose_files="-f ${jiuwen_compose_file} -f ${plugin_compose_file}"

        # Use local MILVUS
        if [ ${ENV_VARS["MILVUS_HOST"]} == ${ENV_VARS["MILVUS_SERVICE_NAME"]} ]; then
            compose_files="${compose_files} -f ${milvus_compose_file}"
        fi

        # Use local MYSQL
        if [ ${ENV_VARS["DB_HOST"]} == ${ENV_VARS["MYSQL_SERVICE_NAME"]} ]; then
            compose_files="${compose_files} -f ${mysql_compose_file}"
        fi

        eval "${exec_cmd} ${compose_files} ${cmd}" || error "shutdown JiuwenAgentStudio container cluster failed"
        eval "${exec_cmd} ${compose_files} rm -f" || error "remove JiuwenAgentStudio container cluster failed"
    else
        error "Invalid operation: ${cmd}! Only supports: up/down"
    fi

    success "${cmd} mysql container, milvus container cluster, JiuwenAgentStudio container cluster"
}

# ==================== Core logic: Check and create database ====================
create_db_if_not_exist() {
    local agent_db=${ENV_VARS["AGENT_DB_NAME"]}
    local ops_db=${ENV_VARS["OPS_DB_NAME"]}
    local mysql_container=${ENV_VARS["MYSQL_DOCKER_NAME"]}
    local db_password=${ENV_VARS["DB_ROOT_PASSWORD"]}

    info "Checking if database [${agent_db} ${ops_db}] is ready"
    info "docker exec -i ${mysql_container} mysql -u root -p${db_password}"
    docker exec -i "${mysql_container}" mysql -u root -p"${db_password}" << EOF
CREATE DATABASE IF NOT EXISTS ${agent_db} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS ${ops_db} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EOF
    if [ $? -eq 0 ]; then
        success "Database [${agent_db} ${ops_db}] is ready"
    else
        error "Database [${agent_db} ${ops_db}] creation failed! Check container logs or network connection"
    fi
}

# Wait for MySQL container to fully start (can connect + execute SQL)
wait_for_mysql() {
    # Parameters: 
    #   - MySQL container name (from ENV_VARS["MYSQL_DOCKER_NAME"])
    #   - Root password (from ENV_VARS["DB_ROOT_PASSWORD"])
    # Behavior: Infinite loop to check MySQL readiness (user can interrupt with Ctrl+C)
    local mysql_container=${ENV_VARS["MYSQL_DOCKER_NAME"]}
    local db_password=${ENV_VARS["DB_ROOT_PASSWORD"]}
    local check_interval=3

    # Log startup message (inform user about infinite wait and interrupt method)
    info "Waiting for MySQL container [${mysql_container}] to start (infinite wait - press Ctrl+C to interrupt)"

    # Infinite loop to check MySQL status
    while true; do
        # Core check: Execute test SQL to verify MySQL is ready (connect + run simple query)
        # Use docker exec to run "SELECT 1" - success means MySQL is fully ready
        if docker exec -i "${mysql_container}" mysql -u root -p"${db_password}" -e "SELECT 1" 2>/dev/null; then
            success "MySQL container [${mysql_container}] is fully ready!"
            return 0  # Exit function - MySQL is ready
        fi

        # MySQL not ready yet: print progress dot and retry after 1 second
        echo -n "."
        sleep "${check_interval}"
    done
}

# ==================== Wait for container to reach Healthy status (infinite wait) ====================
wait_for_container_healthy() {
    # Parameter 1: Container name (required)
    # Parameter 2: Check interval (seconds, optional, default 10)
    # Note: Infinite wait (no timeout), user can interrupt with Ctrl+C
    local container_name="$1"
    local check_interval=${2:-10}  # Default check interval 10 seconds

    # Validate parameters
    if [ -z "${container_name}" ]; then
        error "wait_for_container_healthy function missing required parameter: container name"
    fi

    # Log startup message (inform user about infinite wait and interrupt method)
    info "Waiting for container [${container_name}] to reach Healthy status (infinite wait - press Ctrl+C to interrupt)"

    local start_time=$(date +%s)  # Only for calculating elapsed wait time (no timeout)
    local health_status
    local current_time
    local elapsed_time

    # Infinite loop to check health status (user can Ctrl+C to interrupt)
    while true; do
        # Calculate elapsed time (only for log display)
        current_time=$(date +%s)
        elapsed_time=$((current_time - start_time))

        # Get container health status (docker inspect precise value)
        # Status values: healthy / starting / unhealthy / none (no health check configured)
        health_status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no_healthcheck{{end}}' "${container_name}" 2>/dev/null)

        # Status evaluation
        case "${health_status}" in
            "healthy")
                echo ""
                success "Container [${container_name}] reached Healthy status! (total wait ${elapsed_time} seconds)"
                return 0
                ;;
            "starting")
                echo -n "."
                ;;
            "unhealthy")
                echo ""
                error "Container [${container_name}] health check failed (unhealthy)!"
                ;;
            "no_healthcheck")
                echo ""
                error "Container [${container_name}] has no health check configured, cannot wait for Healthy status!"
                ;;
            *)
                info "Container [${container_name}] unknown status (${health_status}), waited ${elapsed_time} seconds..."
                ;;
        esac

        # Not ready, wait and retry
        sleep "${check_interval}"
    done
}


up_down_service() {
    local service=${ARGS["CMD1"]}
    local cmd=${ARGS["CMD2"]}
    local docker_compose_cmd=${CONFIG["DOCKER_COMPOSE_CMD"]}
    local docker_compose_file="${CONFIG["CONFIG_DIR"]}/docker-${service}.yml"
    local exec_cmd="${docker_compose_cmd} -f ${docker_compose_file}"
    local frontend_container=${ENV_VARS["FRONTEND_DOCKER_NAME"]}

    if [ ${cmd} == "up" ]; then
        eval "${exec_cmd} up -d" || error "up ${service} failed"

        local mysql_container=${ENV_VARS["MYSQL_DOCKER_NAME"]:-}
        if [ ${service} == "mysql" ]; then
            wait_for_mysql
            create_db_if_not_exist
        elif [ ${service} == "jiuwen" ]; then
            wait_for_container_healthy ${frontend_container}
        fi

    elif [ ${cmd} == "down" ]; then
        eval "${exec_cmd} down" || error "down ${service} failed"
        eval "${exec_cmd} rm -f" || error "remove ${service} failed"
        clean ${service}
    else
        error "Invalid operation: ${cmd}! Only supports: up/down"
    fi
}

# Check if in source code directory by checking if BACKEND_DIR exists and is a directory
check_source_code_dir() {
    local backend_dir=${CONFIG["BACKEND_DIR"]}

    if [ ! -d "${backend_dir}" ]; then
        error "Please confirm if complete source code repository has been cloned"
    fi
}

generate_config_files() {
    local jiuwen_template_file=${CONFIG["JIUWEN_COMPOSE_TEMPLATE_FILE"]}
    local jiuwen_compose_file=${CONFIG["JIUWEN_COMPOSE_FILE"]}
    local milvus_template_file=${CONFIG["MILVUS_COMPOSE_TEMPLATE_FILE"]}
    local milvus_compose_file=${CONFIG["MILVUS_COMPOSE_FILE"]}
    local mysql_template_file=${CONFIG["MYSQL_COMPOSE_TEMPLATE_FILE"]}
    local mysql_compose_file=${CONFIG["MYSQL_COMPOSE_FILE"]}
    local plugin_template_file=${CONFIG["PLUGIN_COMPOSE_TEMPLATE_FILE"]}
    local plugin_compose_file=${CONFIG["PLUGIN_COMPOSE_FILE"]}
    local nginx_template_file=${CONFIG["NGINX_TEMPLE_FILE"]}
    local nginx_file="${CONFIG["CONFIG_DIR"]}/${ENV_VARS["NGINX_FILE_NAME"]}"

    generate_config_file ${jiuwen_template_file} ${jiuwen_compose_file}
    generate_config_file ${milvus_template_file} ${milvus_compose_file}
    generate_config_file ${mysql_template_file} ${mysql_compose_file}
    generate_config_file ${plugin_template_file} ${plugin_compose_file}
    generate_config_file ${nginx_template_file} ${nginx_file}
}

get_local_ip() {
    local local_ip=""
    local os_type=${CONFIG["OS_TYPE"]}

    if [[ "$os_type" == "macos" ]]; then
        # macOS: Use ifconfig to get IP address
        local_ip=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -n 1 | awk '{print $2}')
    elif [[ "$os_type" == "windows" ]]; then
        # Windows Git Bash/Cygwin: Use PowerShell
        local_ip=$(powershell -Command "& { \
            Get-NetIPAddress | \
            Where-Object { \
                \$_.AddressFamily -eq 'IPv4' -and \
                !\$_.IPAddress.StartsWith('127.') -and \
                !\$_.IPAddress.StartsWith('169.254.') -and \
                !\$_.IPAddress.StartsWith('172.16.') -and !\$_.IPAddress.StartsWith('172.17.') -and !\$_.IPAddress.StartsWith('172.18.') -and !\$_.IPAddress.StartsWith('172.19.') -and !\$_.IPAddress.StartsWith('172.20.') -and !\$_.IPAddress.StartsWith('172.21.') -and !\$_.IPAddress.StartsWith('172.22.') -and !\$_.IPAddress.StartsWith('172.23.') -and !\$_.IPAddress.StartsWith('172.24.') -and !\$_.IPAddress.StartsWith('172.25.') -and !\$_.IPAddress.StartsWith('172.26.') -and !\$_.IPAddress.StartsWith('172.27.') -and !\$_.IPAddress.StartsWith('172.28.') -and !\$_.IPAddress.StartsWith('172.29.') -and !\$_.IPAddress.StartsWith('172.30.') -and !\$_.IPAddress.StartsWith('172.31.') -and \
                \$_.InterfaceAlias -match 'WLAN|Ethernet' -and \
                \$_.InterfaceAlias -notmatch 'Bluetooth|Hyper-V|WSL|Virtual' \
            } | \
            Select-Object -ExpandProperty IPAddress -First 1
        }" 2>/dev/null)

        local_ip=$(echo "${local_ip}" | tr -d '\r\n' | sed -e 's/^[ \t]*//' -e 's/[ \t]*$//')
    else
        local default_interface=$(ip route show default | awk '/default/ {print $5; exit}')

        if [[ -n "$default_interface" ]]; then
            # Extract IPv4 address of the default gateway interface (strip subnet mask)
            local_ip=$(ip addr show "$default_interface" | awk '/inet / {gsub(/\/.*/, "", $2); print $2; exit}')
        fi

        # fallback: Retain original logic (hostname -I) if all above fail
        if [[ -z "$local_ip" ]]; then
            local_ip=$(hostname -I | awk '{print $1}')
        fi
    fi
    ENV_VARS["IP"]=$local_ip
}

process_env() {
    local cmd1=${ARGS["CMD1"]}
    local cmd2=${ARGS["CMD2"]}

    if [ "${cmd1}" == "up" -o "${cmd2}" == "up" ]; then
         if [ -z ${ARGS["ENV_FILE"]} ]; then
            generate_env
        else
            read_env_from_file ${ARGS["ENV_FILE"]}
        fi
    elif [ "${cmd1}" == "down" -o "${cmd2}" == "down" ]; then
        if [ -z ${ARGS["ENV_FILE"]} ]; then
            read_env_from_file ${CONFIG["ENV_FILE"]}
        else
            read_env_from_file ${ARGS["ENV_FILE"]}
        fi
    fi

}

clean() {
    local env_file="${CONFIG["ENV_FILE"]}.${ENV_VARS["NAME_SUFFIX"]}"
    local config_dir="${CONFIG["CONFIG_DIR"]}"
    local milvus_dir="${config_dir}/${ENV_VARS["MILVUS_VOLUME"]}"
    local nginx_file="${config_dir}/${ENV_VARS["NGINX_FILE_NAME"]}"
    local phase="$1"

    if [ ${phase} == "down" -o ${phase} == "milvus" ]; then
        if [ -d ${milvus_dir} ]; then
            rm -rf ${milvus_dir}
        fi
    fi
    rm -f "${env_file}"
    rm -f "${nginx_file}"
    #rm -f "${CONFIG["JIUWEN_COMPOSE_FILE"]}"
    #rm -f "${CONFIG["MYSQL_COMPOSE_FILE"]}"
    #rm -f "${CONFIG["MILVUS_COMPOSE_FILE"]}"
    #rm -f "${CONFIG["PLUGIN_COMPOSE_FILE"]}"
}

# ==================== Main function ====================
main() {
    detect_os
    info "${CONFIG["OS_TYPE"]}"
    info "Executing command: $@"
    parse_args "$@"
    local cmd1=${ARGS["CMD1"]}
    local cmd2=${ARGS["CMD2"]}

    if [ "${cmd1}" == "conf" ]; then
        check_source_code_dir
        generate_setup_cfg
    elif [ "${cmd1}" == "up" ]; then
        process_env
        check_docker
        generate_config_files
        exec_service
    elif [ "${cmd1}" == "down" ]; then
        process_env
        check_docker
        generate_config_files
        exec_service
        clean ${cmd1}
    elif [ "${cmd1}" == "milvus" -o "${cmd1}" == "jiuwen" -o "${cmd1}" == "mysql" -o "${cmd1}" == "plugin"]; then
        process_env
        check_docker
        generate_config_files
        up_down_service
    fi

    if [[ "${cmd1}" == "up" || "${cmd2}" == "up"  ]]; then
        local env_file=${CONFIG["ENV_FILE"]}
        local name_suffix=${ENV_VARS["NAME_SUFFIX"]}

        #cp ${env_file} ${env_file}.${name_suffix}
        info "Backup ENV file: ${env_file}.${name_suffix}"
    fi

    if [[ "${cmd1}" == "up" || ( "${cmd1}" == "jiuwen" && "${cmd2}" == "up" ) ]]; then
        get_local_ip
        local frontend_port=${ENV_VARS["FRONTEND_HOST_PORT"]}
        local ip_addr=${ENV_VARS["IP"]}
        info "OpenJiuwen Intelligent Platform:"
        info "\tLocal access: https://localhost:${frontend_port}"
        if [ -n "${ip_addr}" ]; then
            info "\tNetwork access: https://${ip_addr}:${frontend_port}"
        fi
    fi
}

# Execute main function
main "$@"
