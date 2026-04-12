#!/bin/bash
# config_mysql.sh - MySQL DB config (sourced by setup.sh; interactive_mysql_setup receives APP_DB_USER / APP_DB_PASSWORD)
# Requires utils.sh (load_db_host_port_from_user_config); setup.sh sources utils before this file.

# Interactive MySQL user setup (depends on log, WORK_HOME, color vars from setup.sh)
# Args: $1 = app DB user, $2 = app DB password (from setup.sh --app_db_user / --app_db_password)

# Run mysql command with timeout and visible stderr/stdout on failure.
# Sets a global variable `MYSQL_CMD_OUTPUT` to the captured command output.
# Expects DB_HOST / DB_PORT (call load_db_host_port_from_user_config first).

run_mysql_sql() {
    local sql="$1"
    local action="$2"
    local rc=0
    local MYSQL_TIMEOUT_SECONDS="${MYSQL_TIMEOUT_SECONDS:-30}"

    local mysql_tcp_args=(--protocol=TCP -h "$DB_HOST" -P "$DB_PORT")
    local -a mysql_exec_cmd=()

    MYSQL_CMD_OUTPUT=""

    if [ -n "${MYSQL_PWD:-}" ]; then
        mysql_exec_cmd=(sudo env MYSQL_PWD="${MYSQL_PWD}" mysql)
    else
        mysql_exec_cmd=(sudo mysql)
    fi

    if command -v timeout >/dev/null 2>&1; then
        MYSQL_CMD_OUTPUT=$(timeout "${MYSQL_TIMEOUT_SECONDS}s" "${mysql_exec_cmd[@]}" "${mysql_tcp_args[@]}" -u root -e "$sql" 2>&1)
        rc=$?
        if [ $rc -ne 0 ]; then
            # Keep host/port in fallback as well; do not fall back to localhost socket implicitly.
            MYSQL_CMD_OUTPUT=$(timeout "${MYSQL_TIMEOUT_SECONDS}s" "${mysql_exec_cmd[@]}" -h "$DB_HOST" -P "$DB_PORT" -u root -e "$sql" 2>&1)
            rc=$?
        fi
        if [ $rc -eq 124 ]; then
            log "ERROR" "${action} timed out after ${MYSQL_TIMEOUT_SECONDS}s"
            [ -n "$MYSQL_CMD_OUTPUT" ] && echo "$MYSQL_CMD_OUTPUT"
            return $rc
        fi
    else
        MYSQL_CMD_OUTPUT=$("${mysql_exec_cmd[@]}" "${mysql_tcp_args[@]}" -u root -e "$sql" 2>&1)
        rc=$?
        if [ $rc -ne 0 ]; then
            # Keep host/port in fallback as well; do not fall back to localhost socket implicitly.
            MYSQL_CMD_OUTPUT=$("${mysql_exec_cmd[@]}" -h "$DB_HOST" -P "$DB_PORT" -u root -e "$sql" 2>&1)
            rc=$?
        fi
    fi

    if [ $rc -ne 0 ]; then
        log "ERROR" "${action} failed (exit code: $rc)"
        [ -n "$MYSQL_CMD_OUTPUT" ] && echo "$MYSQL_CMD_OUTPUT"
        return $rc
    fi

    return 0
}

interactive_mysql_setup() {
    local NEW_DB_USER="${1:-}"
    local NEW_DB_PASSWORD="${2:-}"

    if [ -z "$NEW_DB_USER" ]; then
        log "ERROR" "MySQL app user is required (pass from setup.sh: --app_db_user=...)"
        return 1
    fi
    load_db_host_port_from_user_config
    log "INFO" "MySQL setup uses host: ${DB_HOST}, port: ${DB_PORT}"

    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}MySQL database configuration wizard${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    echo -e "${YELLOW}Configure database user and password${NC}"

    echo ""
    echo -e "${BLUE}Create new MySQL user${NC}"
    echo -e "${BLUE}User: ${NEW_DB_USER}  (from setup.sh --app_db_user)${NC}"
    echo ""
    echo -e "${YELLOW}Creating MySQL user and databases...${NC}"

    RUNTIME_DB_NAME="jiuwen_runtime"

    if ! run_mysql_sql "CREATE DATABASE IF NOT EXISTS openjiuwen_agent; CREATE DATABASE IF NOT EXISTS openjiuwen_ops; CREATE DATABASE IF NOT EXISTS ${RUNTIME_DB_NAME};" "Create databases"; then
        log "ERROR" "Failed to create databases"
        return 1
    fi

    if ! run_mysql_sql "SELECT COUNT(*) FROM mysql.user WHERE user='${NEW_DB_USER}' AND host='%';" "Check user existence"; then
        log "ERROR" "Failed to check whether MySQL user exists"
        return 1
    fi
    USER_EXISTS=$(echo "$MYSQL_CMD_OUTPUT" | tail -n 1 | xargs)

    if [ "$USER_EXISTS" = "0" ] || [ -z "$USER_EXISTS" ]; then
        CREATE_USER_SQL="CREATE USER '${NEW_DB_USER}'@'%' IDENTIFIED BY '${NEW_DB_PASSWORD}';"
        if ! run_mysql_sql "$CREATE_USER_SQL" "Create MySQL user"; then
            log "ERROR" "Failed to create user"
            return 1
        fi
    else
        ALTER_USER_SQL="ALTER USER '${NEW_DB_USER}'@'%' IDENTIFIED BY '${NEW_DB_PASSWORD}';"
        if ! run_mysql_sql "$ALTER_USER_SQL" "Alter MySQL user password"; then
            log "WARN" "User exists but password update failed, continuing with grant..."
        fi
    fi

    GRANT_SQL="GRANT ALL PRIVILEGES ON openjiuwen_agent.* TO '${NEW_DB_USER}'@'%'; GRANT ALL PRIVILEGES ON openjiuwen_ops.* TO '${NEW_DB_USER}'@'%'; GRANT ALL PRIVILEGES ON ${RUNTIME_DB_NAME}.* TO '${NEW_DB_USER}'@'%'; FLUSH PRIVILEGES;"
    if run_mysql_sql "$GRANT_SQL" "Grant privileges"; then
        log "SUCCESS" "MySQL user and databases created"

        echo ""
        echo -e "${GREEN}✅ Configuration complete.${NC}"
        echo -e "${GREEN}   - User: ${NEW_DB_USER}${NC}"
        echo -e "${GREEN}   - Databases: openjiuwen_agent, openjiuwen_ops, ${RUNTIME_DB_NAME}${NC}"
        echo ""
        return 0
    else
        log "ERROR" "Failed to create MySQL user. Check if MySQL service is running."
        echo -e "${YELLOW}Run the following manually:${NC}"
        echo "  sudo mysql -u root"
        echo "  Then run:"
        echo "  CREATE DATABASE IF NOT EXISTS openjiuwen_agent;"
        echo "  CREATE DATABASE IF NOT EXISTS openjiuwen_ops;"
        echo "  CREATE DATABASE IF NOT EXISTS ${RUNTIME_DB_NAME};"
        echo "  CREATE USER '${NEW_DB_USER}'@'%' IDENTIFIED BY 'your_password';"
        echo "  GRANT ALL PRIVILEGES ON openjiuwen_agent.* TO '${NEW_DB_USER}'@'%';"
        echo "  GRANT ALL PRIVILEGES ON openjiuwen_ops.* TO '${NEW_DB_USER}'@'%';"
        echo "  GRANT ALL PRIVILEGES ON ${RUNTIME_DB_NAME}.* TO '${NEW_DB_USER}'@'%';"
        echo "  FLUSH PRIVILEGES;"
        return 1
    fi
}
