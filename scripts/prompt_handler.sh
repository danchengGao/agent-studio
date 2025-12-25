#!/usr/bin/env bash
set -euo pipefail

# ==== Displays access prompts for openJiuwen Agent Platform ====
show_jiuwen_deploy_prompt() {
    local frontend_port=${ENV_VARS["FRONTEND_HOST_PORT"]}
    local ip_addr=${ENV_VARS["IP"]}
    info "openJiuwen Agent Platform:"
    info "\tLocal access: https://localhost:${frontend_port}"
    if [ -n "${ip_addr}" ]; then
        info "\tNetwork access: https://${ip_addr}:${frontend_port}"
    fi
}

# ==== Shows deployment prompts for started modules ====
show_deploy_prompt() {
    local i=0
    local cmd=${ARGS["CMD"]}
    local env_file=${ARGS["ENV_FILE"]}
    local modules=("${ARGS_MODULES[@]}")
    local has_jiuwen=${ENV_VARS["HAS_JIUWEN_CONTAINER"]}

    if [ "${cmd}" != "up" ]; then
        return
    fi

    if [ -z "${env_file}" ]; then
        local backup_env_file="${CONFIG["ENV_DIR"]}/env.${ENV_VARS["NAME_SUFFIX"]}"
        info "Backup ENV file: ${backup_env_file}"
    fi
    

    if [ "${has_jiuwen}" == "true" ]; then
        show_jiuwen_deploy_prompt
        return
    fi

    while [ $i -lt ${#modules[@]} ]; do
        case "${modules[$i]}" in
            MYSQL)
                success "MYSQL Server started" 
                info "To use it, please set the following value in .env:"
                echo "DB_HOST=localhost"
                echo "DB_PORT=${ENV_VARS["MYSQL_HOST_PORT"]}"
                echo "DB_USER=root"
                echo "DB_PASSWORD=${ENV_VARS["DB_ROOT_PASSWORD"]}"
                info ""
                ;;
            MILVUS)
                success "Milvus Server started"
                info "To use it, please set the following value in .env:"
                echo "MILVUS_HOST=localhost"
                echo "MILVUS_PORT=${ENV_VARS["MILVUS_HOST_PORT"]}"
                info ""
                ;;
            PLUGIN)
                success "Plugin Server started"
                info "To use it, please set the following value in .env:"
                echo "VITE_PLUGIN_CONFIG_PATH=/config.json"
                echo "VITE_PLUGIN_SERVICE_URL=http://localhost:${ENV_VARS["PLUGIN_SERVER_HOST_PORT"]}"
                info ""
                ;;
            SANDBOX)
                success "Sandbox Server started"
                info "To use it, please set the following value in .env:"
                echo "CODE_SANDBOX_URL=http://localhost:${ENV_VARS["SANDBOX_GATEWAY_HOST_PORT"]}/run"
                info ""
                ;;
        esac
        i=$((i + 1))
    done
}
