#!/usr/bin/env bash
set -euo pipefail


# ================ Check if in source code directory ================
check_source_code_dir() {
    local backend_dir=${CONFIG["BACKEND_DIR"]}

    if [ ! -d "${backend_dir}" ]; then
        error "Please confirm if complete source code repository has been cloned"
    fi
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

# ========== Generate configuration file (backend/setup.cfg) ===========
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