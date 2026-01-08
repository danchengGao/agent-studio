#!/usr/bin/env bash
set -euo pipefail

# ========== Parses command-line arguments ========== 
parse_args() {
    local i=0
    local args=("$@")
    local cmd=""
    local env_file=""
    local is_new_svc="false"
    local modules=()

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
            -n|--new)
                is_new_svc="true"
                i=$((i+1))
                ;;
            up|down|stop)
                # treat as commands
                if [ -n "$cmd" ]; then
                    error "please not specify two cmds: ${cmd} and ${args[$i]}"
                fi
                cmd="${args[$i]}"
                i=$((i+1))
                ;;
            milvus|jiuwen|mysql|plugin|sandbox)
                # treat as modules
                local module=$(echo "${args[$i]}" | tr 'a-z' 'A-Z')
                modules+=("${module}")
                key="HAS_${module}_CONTAINER"
                DEPLOY_VARS["${key}"]="true"
                i=$((i+1))
                ;;
            *)
                error "Invalid Args: ${args[$i]}"
                ;;
        esac
    done

    if [ -z "${cmd}" ]; then
        error "No command specified"
    fi

    # deduplicate
    if [ ${#modules[@]} -gt 0 ]; then
        local deduped_modules=($(printf "%s\n" "${modules[@]}" | sort -u))
        modules=("${deduped_modules[@]}")
    fi

    # should not specify .env when bring up new services
    if [[ "${is_new_svc}" == "true" && -n "${env_file}" ]]; then
        error "Please do not specify -f and -n in the sametime"
    fi

    # Assign parsed commands to global variables for main function
    ARGS["CMD"]=${cmd}
    ARGS["ENV_FILE"]=${env_file}
    ARGS["IS_NEW_SVC"]=${is_new_svc}
    ARGS_MODULES=("${modules[@]}")

    if [ ${#ARGS_MODULES[@]} -eq 0 ]; then
        info "ARGS_MODULES: <full>"
    else
        info "ARGS_MODULES: ${ARGS_MODULES[*]}"
    fi
}
