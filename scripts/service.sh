#!/usr/bin/env bash
set -euo pipefail

source "./global_vars.sh"
source "./common.sh"
source "./args_handler.sh"
source "./gen_ssl.sh"
source "./ports_handler.sh"
source "./envfile_handler.sh"
source "./template_handler.sh"
source "./container_handler.sh"
source "./vars_handler.sh"
source "./prompt_handler.sh"

# ==== Executes Docker Compose commands (up/down/stop) for enabled modules ====
exec_service() {
    local cmd=${ARGS["CMD"]}
    local exec_cmd=${CONFIG["DOCKER_COMPOSE_CMD"]}

    local cmd_args=""
    if [ "${cmd}" = "up" ]; then
        cmd_args="-d"
    fi

    local modules=("${ARGS_MODULES[@]}")
    if [ ${#modules[@]} -eq 0 ]; then
        modules=("${ALL_MODULES[@]}")
    fi

    for module in "${modules[@]}"; do
        local has_it="${ENV_VARS["HAS_${module}_CONTAINER"]}"
        if [ "${has_it}" == "true" ]; then
            local compose_file=${COMPOSE_FILES["${module}"]}
            case "${module}" in
                MYSQL)
                    eval "${exec_cmd} -f ${compose_file} ${cmd} ${cmd_args}" || error "${cmd} ${module} service failed"
                    if [ "${cmd}" == "up" ]; then
                        wait_for_mysql
                        create_db_if_not_exist
                    fi
                    ;;
                MILVUS)
                    if [ "${cmd}" == "up" ]; then
                        eval "${exec_cmd} -f ${compose_file} ${cmd} ${cmd_args}" || warning "${cmd} ${module} service failed: The system's memory functionality is disabled, but the other system features still works"
                    else
                        eval "${exec_cmd} -f ${compose_file} ${cmd} ${cmd_args}" || error "${cmd} ${module} container" 
                    fi
                    ;;
                JIUWEN|PLUGIN|SANDBOX)
                    eval "${exec_cmd} -f ${compose_file} ${cmd} ${cmd_args}" || error "${cmd} ${module} service failed"
                    if [ "${cmd}" == "up" ]; then
                        check_containers ${CONTAINERS[${module}]}  
                    fi
                    ;;
            esac
            success "${cmd} ${module} container"
        fi
    done
}


# ==================== Main function ====================
main() {
    detect_os
    info "Operating System: ${CONFIG["OS_TYPE"]}"
    info "Executing command: $@"
    parse_args "$@"
    check_docker
    process_env_file
    generate_config_files
    exec_service
    show_deploy_prompt
}

# Execute main function
main "$@"
