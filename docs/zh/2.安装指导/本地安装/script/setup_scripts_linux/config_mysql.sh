#!/bin/bash
# config_mysql.sh - MySQL DB config (sourced by setup.sh; interactive_mysql_setup receives APP_DB_USER / APP_DB_PASSWORD)

# Interactive MySQL user setup (depends on log, WORK_HOME, color vars from setup.sh)
# Args: $1 = app DB user, $2 = app DB password (from setup.sh --app_db_user / --app_db_password)

# Run mysql command with timeout and visible stderr/stdout on failure.
# Sets a global variable `MYSQL_CMD_OUTPUT` to the captured command output.
run_mysql_sql() {
    local sql="$1"
    local action="$2"
    local rc=0
    local MYSQL_TIMEOUT_SECONDS="${MYSQL_TIMEOUT_SECONDS:-30}"

    MYSQL_CMD_OUTPUT=""

    if command -v timeout >/dev/null 2>&1; then
        MYSQL_CMD_OUTPUT=$(timeout "${MYSQL_TIMEOUT_SECONDS}s" sudo mysql -u root -e "$sql" 2>&1)
        rc=$?
        if [ $rc -eq 124 ]; then
            log "ERROR" "${action} timed out after ${MYSQL_TIMEOUT_SECONDS}s"
            [ -n "$MYSQL_CMD_OUTPUT" ] && echo "$MYSQL_CMD_OUTPUT"
            return $rc
        fi
    else
        MYSQL_CMD_OUTPUT=$(sudo mysql -u root -e "$sql" 2>&1)
        rc=$?
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

    if ! run_mysql_sql "SELECT COUNT(*) FROM mysql.user WHERE user='${NEW_DB_USER}' AND host='localhost';" "Check user existence"; then
        log "ERROR" "Failed to check whether MySQL user exists"
        return 1
    fi
    USER_EXISTS=$(echo "$MYSQL_CMD_OUTPUT" | tail -n 1 | xargs)

    if [ "$USER_EXISTS" = "0" ] || [ -z "$USER_EXISTS" ]; then
        CREATE_USER_SQL="CREATE USER '${NEW_DB_USER}'@'localhost' IDENTIFIED BY '${NEW_DB_PASSWORD}';"
        if ! run_mysql_sql "$CREATE_USER_SQL" "Create MySQL user"; then
            log "ERROR" "Failed to create user"
            return 1
        fi
    else
        ALTER_USER_SQL="ALTER USER '${NEW_DB_USER}'@'localhost' IDENTIFIED BY '${NEW_DB_PASSWORD}';"
        if ! run_mysql_sql "$ALTER_USER_SQL" "Alter MySQL user password"; then
            log "WARN" "User exists but password update failed, continuing with grant..."
        fi
    fi

    GRANT_SQL="GRANT ALL PRIVILEGES ON openjiuwen_agent.* TO '${NEW_DB_USER}'@'localhost'; GRANT ALL PRIVILEGES ON openjiuwen_ops.* TO '${NEW_DB_USER}'@'localhost'; GRANT ALL PRIVILEGES ON ${RUNTIME_DB_NAME}.* TO '${NEW_DB_USER}'@'localhost'; FLUSH PRIVILEGES;"
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
        echo "  CREATE USER '${NEW_DB_USER}'@'localhost' IDENTIFIED BY 'your_password';"
        echo "  GRANT ALL PRIVILEGES ON openjiuwen_agent.* TO '${NEW_DB_USER}'@'localhost';"
        echo "  GRANT ALL PRIVILEGES ON openjiuwen_ops.* TO '${NEW_DB_USER}'@'localhost';"
        echo "  GRANT ALL PRIVILEGES ON ${RUNTIME_DB_NAME}.* TO '${NEW_DB_USER}'@'localhost';"
        echo "  FLUSH PRIVILEGES;"
        return 1
    fi
}
