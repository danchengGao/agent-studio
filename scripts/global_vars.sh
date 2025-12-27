#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# CORE DATA STRUCTURE
# =============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${SCRIPT_DIR}/.."

# ===== Core project configuration (paths, ports, commands, OS info) =====
declare -A CONFIG=(
    ["ENV_DIR"]="${SCRIPT_DIR}/.envs"
    ["ENV_FILE"]="${SCRIPT_DIR}/.env"
    ["DEFAULT_ENV_FILE"]="${SCRIPT_DIR}/.env.default"
    ["CUSTOM_ENV_FILE"]="${SCRIPT_DIR}/.env.custom"
    ["CONFIG_DIR"]="${SCRIPT_DIR}/conf"
    ["NGINX_TEMPLE_FILE"]="${SCRIPT_DIR}/conf/nginx.template.conf"
    ["DOCKER_COMPOSE_CMD"]=""
    ["START_PORT"]="1024"
    ["END_PORT"]="65535"
    ["ALLOC_PORT_NUM"]="7"
    ["OS_TYPE"]=""
)

# ===== Prefix-Naming conventions for Docker services/containers/volumes =====
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
    ["SSL_DIR_NAME"]="ssl"
    ["PLUGIN_SERVER_SERVICE_NAME"]="plugin-server"
    ["PLUGIN_SERVER_DOCKER_NAME"]="jiuwen-plugin-server"
    ["SANDBOX_GATEWAY_SERVICE_NAME"]="sandbox-gateway"
    ["SANDBOX_GATEWAY_DOCKER_NAME"]="jiuwen-sandbox-gateway"
    ["PYTHON_SERVER_SERVICE_NAME"]="python-server"
    ["PYTHON_SERVER_DOCKER_NAME"]="jiuwen-python-server"
    ["JS_SERVER_SERVICE_NAME"]="js-server"
    ["JS_SERVER_DOCKER_NAME"]="jiuwen-js-server"
)

# ===== Host port variables to allocate for services (dynamic assignment) =====
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

# ===== Container/service name variables for network address resolution =====
declare -ga CONTAINERS_ADDRS=(
    MYSQL_SERVICE_NAME
    MYSQL_DOCKER_NAME
    ETCD_SERVICE_NAME
    ETCD_DOCKER_NAME
    MINIO_SERVICE_NAME
    MINIO_DOCKER_NAME
    MILVUS_SERVICE_NAME
    MILVUS_DOCKER_NAME
    FRONTEND_SERVICE_NAME
    FRONTEND_DOCKER_NAME
    BACKEND_SERVICE_NAME
    BACKEND_DOCKER_NAME
    PLUGIN_SERVER_SERVICE_NAME
    PLUGIN_SERVER_DOCKER_NAME
    SANDBOX_GATEWAY_SERVICE_NAME
    SANDBOX_GATEWAY_DOCKER_NAME
    PYTHON_SERVER_SERVICE_NAME
    PYTHON_SERVER_DOCKER_NAME
    JS_SERVER_SERVICE_NAME
    JS_SERVER_DOCKER_NAME
)

# ==== Global associative array: Stores all variables from .env  ====
# ==== (key=variable name, value=variable value) ====
declare -A ENV_VARS=(
    ["HAS_MYSQL_CONTAINER"]="false"
    ["HAS_MILVUS_CONTAINER"]="false"
    ["HAS_PLUGIN_CONTAINER"]="false"
    ["HAS_SANDBOX_CONTAINER"]="false"
    ["HAS_JIUWEN_CONTAINER"]="false"
)

#  ==== List of available ports for service allocation (dynamic generated) ====
declare -ga AVAILABLE_PORTS=()

# ==== List of ports already allocated to services (dynamic generated)  ==== 
declare -ga ALLOCATED_PORTS=()

# ==== All available modules ==== 
declare -ga ALL_MODULES=("MYSQL" "MILVUS" "PLUGIN" "SANDBOX" "JIUWEN")

# ==== Paths to Docker Compose template files per module ==== 
declare -A COMPOSE_TEMPLATE_FILES=(
    ["MYSQL"]="${SCRIPT_DIR}/conf/docker-mysql.template.yml"
    ["MILVUS"]="${SCRIPT_DIR}/conf/docker-milvus.template.yml"
    ["PLUGIN"]="${SCRIPT_DIR}/conf/docker-plugin.template.yml"
    ["SANDBOX"]="${SCRIPT_DIR}/conf/docker-sandbox.template.yml"
    ["JIUWEN"]="${SCRIPT_DIR}/conf/docker-jiuwen.template.yml"
)

# ==== Paths to final generated Docker Compose files per module ==== 
declare -A COMPOSE_FILES=(
    ["MYSQL"]="${SCRIPT_DIR}/conf/docker-mysql.yml"
    ["MILVUS"]="${SCRIPT_DIR}/conf/docker-milvus.yml"
    ["PLUGIN"]="${SCRIPT_DIR}/conf/docker-plugin.yml"
    ["SANDBOX"]="${SCRIPT_DIR}/conf/docker-sandbox.yml"
    ["JIUWEN"]="${SCRIPT_DIR}/conf/docker-jiuwen.yml"
)

# ==== Mapping of modules to their associated Docker container name keys ==== 
declare -A CONTAINER_KEYS=(
    ["MYSQL"]="MYSQL_DOCKER_NAME" 
    ["MILVUS"]="ETCD_DOCKER_NAME MINIO_DOCKER_NAME MILVUS_DOCKER_NAME"
    ["PLUGIN"]="PLUGIN_SERVER_DOCKER_NAME"
    ["SANDBOX"]="PYTHON_SERVER_DOCKER_NAME JS_SERVER_DOCKER_NAME SANDBOX_GATEWAY_DOCKER_NAME"
    ["JIUWEN"]="BACKEND_DOCKER_NAME FRONTEND_DOCKER_NAME"
)

# == Final resolved container names for each module (populated dynamically) ==
declare -A CONTAINERS=(
    ["MYSQL"]="" 
    ["MILVUS"]=""
    ["PLUGIN"]=""
    ["SANDBOX"]=""
    ["JIUWEN"]=""
)

# ==== Parsed command-line arguments (command and custom env file path) ====
declare -A ARGS=(
    ["CMD"]=""
    ["ENV_FILE"]=""
)

# ==== Modules specified via command-line arguments ====
declare -ga ARGS_MODULES=()
