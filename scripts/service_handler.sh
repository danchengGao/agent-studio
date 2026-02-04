#!/usr/bin/env bash
set -euo >/dev/null 2>&1

# Perform post-start setup operations for specific service modules
post_start_setup(){
    local module="$1"
    if [ "${module}" == "milvus" ]; then
        return
    fi

    if [ "${module}" == "mysql" ]; then
        wait_for_mysql
        if [ "${ARGS["IS_UPGRADE"]}" == "false" ]; then
            create_db_if_not_exist
        fi
        return
    fi

    local container="$2"
    wait_for_container_healthy "${container}"
}

# Process a single service of a specified module (handle start/stop/etc. via docker compose)
process_service() {
    local module="$1"
    local component="$2"
    if [ "${DEPLOY_VARS["HAS_${module}"]}" == "false" ]; then
        return
    fi
    if [ "${DEPLOY_VARS["IS_UP_${component}"]}" == "false" ]; then
        return
    fi

    local cmd=${ARGS["CMD"]}
    local docker_compose=${CONFIG["DOCKER_COMPOSE_CMD"]}
    local compose_file=${COMPOSE_FILES["${module}"]}
    local service="${DEPLOY_VARS["${component}_SERVICE"]}"
    local container="${DEPLOY_VARS["${component}_DOCKER"]}"
    local cmd_args=""
    if [ "${cmd}" = "up" ]; then
        cmd_args="-d"
    fi
    
    exec_cmd "${docker_compose} -f ${compose_file} ${cmd} ${cmd_args} ${service}"
    if [ "${cmd}" == "up" ]; then
        post_start_setup "${module}" "${container}"
    fi

    success "${cmd} ${service} container"
}

# Process all services of the specified module
process_services() {
    for module in $1
    do
        for component in ${COMPONENTS["${module}"]}
        do
            process_service "${module}" "${component}"
        done
    done

}

# Process all services of all modules
process_all_services() {
    process_services "UPGRADE"
    process_services "MYSQL"
    uprade_mysql
    process_services "MILVUS"
    upgrade_milvus
    process_services "PLUGIN"
    process_services "SANDBOX"
    process_service "JIUWEN" "BACKEND"
    upgrade_sqlite
    process_service "JIUWEN" "FRONTEND"
}