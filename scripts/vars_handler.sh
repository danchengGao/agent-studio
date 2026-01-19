#!/usr/bin/env bash
set -euo >/dev/null 2>&1

# === Generates unique suffix for container/service/volume/... names (uses random chars if not set in .env)  =====
generate_final_names() {
    local name_suffix=$(generate_random_chars)
    DEPLOY_VARS["NAME_SUFFIX"]=${name_suffix}

    info "Generating name...."
    for key in "${!NAMES[@]}"; do
        # info "Generating name for ${key}"
        local value="${NAMES[$key]}" # Predefined default value

        if [[ -n "${DEPLOY_VARS["${key:-}"]:-}" ]]; then
            DEPLOY_VARS["${key}"]="${DEPLOY_VARS[$key]}"
            # success "[$key] using .env defined value: ${DEPLOY_VARS[$key]}"
        else
            local final_value="${value}-${name_suffix}"
            DEPLOY_VARS["${key}"]="${final_value}"
            # info "[$key] undefined in .env, generating random name: ${final_value}"
        fi
    done
}

# === Configures no_proxy/NO_PROXY env vars to bypass proxy for internal container/host connections =====
setup_no_proxy_vars() {
    local no_proxy_addrs="localhost,127.0.0.1"

    # Public IP Address of host machine
    if [[ -n "${DEPLOY_VARS["IP"]:-}" ]]; then
        no_proxy_addrs="${no_proxy_addrs},${DEPLOY_VARS["IP"]}"
    fi

    # all containers
    for addr in "${CONTAINERS_ADDRS[@]}"; do
        if [[ -n "${DEPLOY_VARS[$addr]:-}" ]]; then
            no_proxy_addrs="${no_proxy_addrs},${DEPLOY_VARS[$addr]}"
        fi
    done

    if [ -n "${no_proxy:-}" ]; then
        no_proxy_str="no_proxy=${no_proxy_addrs},${no_proxy}"
    else
        no_proxy_str="no_proxy=${no_proxy_addrs}"
    fi

    if [ -n "${NO_PROXY:-}" ]; then
        NO_PROXY_STR="NO_PROXY=${no_proxy_addrs},${NO_PROXY}"
    else
        NO_PROXY_STR="NO_PROXY=${no_proxy_addrs}"
    fi

    DEPLOY_VARS["no_proxy_str"]="${no_proxy_str}"
    DEPLOY_VARS["NO_PROXY_STR"]="${NO_PROXY_STR}"
}

# === Populates CONTAINERS array with generated docker container names per module ===
fill_containers_name() {
    local module
    local docker_keys
    local docker_key
    local docker_names=()

    for module in "${!CONTAINER_KEYS[@]}"; do
        docker_names=()
        docker_keys="${CONTAINER_KEYS[$module]}"
        IFS=' ' read -r -a docker_key_arr <<< "$docker_keys"

        for docker_key in "${docker_key_arr[@]}"; do
            if [ -n "${DEPLOY_VARS[$docker_key]-}" ]; then
                docker_names+=("${DEPLOY_VARS[$docker_key]}")
            else
                warning "Key ${docker_key} not found in DEPLOY_VARS (module: ${module})"
            fi
        done

        CONTAINERS[$module]="${docker_names[*]}"
    done
}

# === env variable setup (ports, names, proxy, module config, nginx timeout) ===
setup_env_vars() {
    count_undefined_ports
    alloc_available_ports
    assign_ports
    generate_final_names
    setup_no_proxy_vars
    configure_module_env

    local nginx_read_timeout_ms=${RUNTIME_VARS["VITE_API_PROXY_TIMEOUT"]}
    if ! [[ "${nginx_read_timeout_ms}" =~ ^[0-9]+$ ]]; then
        error "Error: The value of VITE_API_PROXY_TIMEOUT [${nginx_read_timeout_ms}] is not a valid number (only non-negative integers are supported)!"
    fi

    local nginx_read_timeout=$(( nginx_read_timeout_ms / 1000 ))
    DEPLOY_VARS["NGINX_READ_TIMEOUT"]=${nginx_read_timeout}
}

# =========  Detect if it start the container, set env vars if yes =========
configure_module_env() {
    local modules=("${ARGS_MODULES[@]}")
    if [ ${#modules[@]} -eq 0 ]; then
        modules=("${ALL_MODULES[@]}")
    fi

    local i=0
    while [ $i -lt ${#modules[@]} ]; do
        case "${modules[$i]}" in
            MYSQL)
                if [[ "${RUNTIME_VARS["DB_TYPE"]:-}" == "mysql" ]]; then
                    if [ -z "${RUNTIME_VARS["DB_HOST"]:-}" ]; then
                        RUNTIME_VARS["DB_HOST"]=${DEPLOY_VARS["MYSQL_SERVICE"]}
                        DEPLOY_VARS["HAS_MYSQL_CONTAINER"]="true"
                    fi
                fi
                ;;
            MILVUS)
                if [[ -z "${RUNTIME_VARS["MILVUS_HOST"]:-}" ]]; then
                    RUNTIME_VARS["MILVUS_HOST"]=${DEPLOY_VARS["MILVUS_SERVICE"]}
                    DEPLOY_VARS["HAS_MILVUS_CONTAINER"]="true"
                fi

                if [[ -z "${RUNTIME_VARS["MINIO_HOST"]:-}" ]]; then
                    RUNTIME_VARS["MINIO_HOST"]=${DEPLOY_VARS["MINIO_SERVICE"]}
                fi
                ;;
            PLUGIN)
                if [[ -z "${RUNTIME_VARS["VITE_PLUGIN_SERVICE_URL"]:-}" ]]; then
                    local plugin_service=${DEPLOY_VARS["PLUGIN_SERVER_SERVICE"]}
                    local plugin_port=${DEPLOY_VARS["PLUGIN_SERVER_PORT"]}
                    RUNTIME_VARS["VITE_PLUGIN_SERVICE_URL"]="http://${plugin_service}:${plugin_port}"
                    DEPLOY_VARS["HAS_PLUGIN_CONTAINER"]="true"
                fi
                ;;
            SANDBOX)
                if [[ -z "${RUNTIME_VARS["CODE_SANDBOX_URL"]:-}" ]]; then
                    local gateway_service=${DEPLOY_VARS["SANDBOX_GATEWAY_SERVICE"]}
                    local gateway_port=${DEPLOY_VARS["SANDBOX_GATEWAY_PORT"]}
                    RUNTIME_VARS["CODE_SANDBOX_URL"]="http://${gateway_service}:${gateway_port}/run"
                    DEPLOY_VARS["HAS_SANDBOX_CONTAINER"]="true"
                fi
                ;;
            JIUWEN)
                if [[ -z "${RUNTIME_VARS["VITE_API_PROXY_TARGET"]:-}" ]]; then
                    local backend_service=${DEPLOY_VARS["BACKEND_SERVICE"]}
                    local backend_port=${RUNTIME_VARS["BACKEND_PORT"]}
                    RUNTIME_VARS["VITE_API_PROXY_TARGET"]="http://${backend_service}:${backend_port}/"
                fi
                DEPLOY_VARS["HAS_JIUWEN_CONTAINER"]="true"
                ;;
        esac
        i=$((i + 1))
    done
}
