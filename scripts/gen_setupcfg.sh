#!/usr/bin/env bash
set -euo pipefail
source "./global_vars.sh"
source "./common.sh"
source "./template_handler.sh"

# =============================================================================
# CORE DATA STRUCTURE
# =============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${SCRIPT_DIR}/.."
BACKEND_DIR="${PROJECT_DIR}/backend"
PACKAGE_PREFIX="openjiuwen_studio_server"
SETUPCFG_TEMPLATE_FILE="${SCRIPT_DIR}/conf/setup.cfg.template"

#declare -ga ALL_MODULES=("PLUGIN" "GATEWAY" "PYSEVER" "JIUWEN")
declare -ga ALL_MODULES=("JIUWEN")

declare -A PROJECTS=(
    ["PLUGIN"]="openjiuwen-plugin-server"
    ["GATEWAY"]="openjiuwen-sandbox-gateway"
    ["PYSEVER"]="openjiuwen-py-server"
    ["JIUWEN"]="openjiuwen-studio-server"
)

declare -A PACKAGES=(
    ["PLUGIN"]="openjiuwen_plugin_server"
    ["GATEWAY"]="openjiuwen_sandbox_gateway"
    ["PYSEVER"]="openjiuwen_sandbox_pyserver"
    ["JIUWEN"]="openjiuwen_studio_server"
)

declare -A SOURCE_DIRS=(
    ["PLUGIN"]="${PROJECT_DIR}/plugin_server"
    ["GATEWAY"]="${PROJECT_DIR}/sandbox_server/gateway"
    ["PYSEVER"]="${PROJECT_DIR}/sandbox_server/python_server"
    ["JIUWEN"]="${PROJECT_DIR}/backend"
)

declare -A PLACEHOLDER_VARS=(
)

# ================ Check if in source code directory ================
check_source_code_dir() {
    local module=$1
    local source_dir=${SOURCE_DIRS[${module}]}

    if [ ! -d "${source_dir}" ]; then
        error "Please confirm if complete source code repository has been cloned"
    fi
}

# ================ Generate py_modules (backend/setup.cfg) ================
generate_py_modules() {
    local module=${1}
    local source_dir=${SOURCE_DIRS[${module}]}
    local package_name=${PACKAGES[${module}]}

    cd "${source_dir}" || exit 1
    find . -maxdepth 1 -type f -name "*.py" ! -name "__init__.py" | \
        sed -e 's|^\./||' -e 's|\.py$||' | \
        sort | \
        awk -v prefix="${package_name}." '{print "    " prefix $0}'
}

# ================ Generate packages (backend/setup.cfg) ================
generate_packages() {
    local module=${1}
    local source_dir=${SOURCE_DIRS[${module}]}
    local package_name=${PACKAGES[${module}]}
    # Directory names to exclude (these directories will be completely skipped at any level)
    local exclude_dir_names=(".venv" "dist" "build" ".git" "logs" "tests" ".egg-info" "__pycache__")

    cd "${source_dir}" || exit 1

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
        awk -v prefix="${package_name}." '{print prefix $0}' | \
        sort | \
        awk '{print "    " $0}')

    # Add top-level package
    echo -e "    ${package_name}\n${sub_packages}"
}

set_placeholder_vars() {
    local module="$1"
    PLACEHOLDER_VARS["PROJECT_NAME"]=${PROJECTS["${module}"]}
    PLACEHOLDER_VARS["PACKAGE_NAME"]=${PACKAGES["${module}"]}
    PLACEHOLDER_VARS["PY_MODULES"]=$(generate_py_modules ${module})
    PLACEHOLDER_VARS["PACKAGES"]=$(generate_packages ${module})
    PLACEHOLDER_VARS["PACKAGE_DATAS"]=""

    if [ ${module} == "JIUWEN" ]; then
        PLACEHOLDER_VARS["PACKAGE_DATAS"]=$(cat <<'EOF'
[options.package_data]
* = config.yaml
    config.json
openjiuwen_studio_server.ops = conf/default_model_config.yaml
EOF
        )
    fi
}

# ==================== Main function ====================
main() {
    detect_os
    for module in "${ALL_MODULES[@]}"; do
        local file="${SOURCE_DIRS["${module}"]}/setup.cfg"

        check_source_code_dir "${module}"
        set_placeholder_vars "${module}"
        generate_config_file "${SETUPCFG_TEMPLATE_FILE}" "${file}" "PLACEHOLDER_VARS"
    done
}

# ================ Execute main function =================
main 