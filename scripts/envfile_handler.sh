#!/usr/bin/env bash
set -euo pipefail


# ===== Merges default/custom .env files, and writes to final .env file ===== 
generate_env_file() {
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

# ===== Writes sorted ENV_VARS key-value pairs to .env file ===== 
write_env_to_file() {
    local env_file=$1
    local env_dirs=${CONFIG["ENV_DIR"]}
    local backup_env_file="${env_dirs}/env.${ENV_VARS["NAME_SUFFIX"]}"
    
    info "Writing variable array ENV_VARS to file: ${env_file}"
    > "${env_file}"
    printf "%s\n" "${!ENV_VARS[@]}" | sort | while read -r key; do
        if [[ -n "${key}" ]]; then
            echo "${key}=${ENV_VARS[$key]}" >> "${env_file}"
        fi
    done

    info "Copy ${env_file} to ${backup_env_file}"
    mkdir -p ${env_dirs}
    cp ${env_file} ${backup_env_file}
}

# ==== Loads key-value pairs from .env file into ENV_VARS array ===
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
            key="${line_trimmed%%=*}"
            value="${line_trimmed#*=}"
            ENV_VARS["${key}"]="${value}"
        fi
    done < "${env_file}"
}

# ============ Processes .env file per command (up/down/stop) ========
process_env_file() {
    local cmd=${ARGS["CMD"]}
    local arg_env_file=${ARGS["ENV_FILE"]}
    local arg_new_svc=${ARGS["IS_NEW_SVC"]}
    local current_env_file=${CONFIG["ENV_FILE"]}

    get_public_ip
    case "${cmd}" in
        up)
            if [[ "${arg_new_svc}" == "true" || ( -z "${arg_env_file}" && ! -f "${current_env_file}" ) ]]; then
                generate_env_file
            elif [ -z "${arg_env_file}" ]; then
                read_env_from_file ${current_env_file}
            else
                read_env_from_file ${arg_env_file}
            fi
            generate_ssl_certs .ssl-dirs/${ENV_VARS["SSL_DIR_NAME"]}
            ;;
    
        down|stop)
            if [ -z "${arg_env_file}" ]; then
                read_env_from_file ${current_env_file}
            else
                read_env_from_file ${arg_env_file}
            fi
            ;;
    esac
    fill_containers_name
}