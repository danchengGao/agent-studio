#!/bin/bash
# config_mysql.sh - MySQL DB config (sourced by setup.sh, then interactive_mysql_setup is called)

# Interactive MySQL user setup (depends on log, TARGET_ENV_FILE, color vars from setup.sh)
interactive_mysql_setup() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}MySQL database configuration wizard${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    echo -e "${YELLOW}Configure database user and password${NC}"

    NEW_DB_USER="openjiuwen"
    NEW_DB_PASSWORD="openjiuwen2026"

    echo ""
    echo -e "${BLUE}Create new MySQL user${NC}"
    echo -e "${BLUE}Default user: ${NEW_DB_USER}  Default password: see .env file${NC}"
    echo ""
    echo -e "${YELLOW}Creating MySQL user and databases...${NC}"

    if ! sudo mysql -u root -e "CREATE DATABASE IF NOT EXISTS openjiuwen_agent; CREATE DATABASE IF NOT EXISTS openjiuwen_ops;" 2>/dev/null; then
        log "ERROR" "Failed to create databases"
        return 1
    fi

    USER_EXISTS=$(sudo mysql -u root -e "SELECT COUNT(*) FROM mysql.user WHERE user='${NEW_DB_USER}' AND host='localhost';" 2>/dev/null | tail -n 1)

    if [ "$USER_EXISTS" = "0" ] || [ -z "$USER_EXISTS" ]; then
        CREATE_USER_SQL="CREATE USER '${NEW_DB_USER}'@'localhost' IDENTIFIED BY '${NEW_DB_PASSWORD}';"
        if ! sudo mysql -u root -e "$CREATE_USER_SQL" 2>/dev/null; then
            log "ERROR" "Failed to create user"
            return 1
        fi
    else
        ALTER_USER_SQL="ALTER USER '${NEW_DB_USER}'@'localhost' IDENTIFIED BY '${NEW_DB_PASSWORD}';"
        if ! sudo mysql -u root -e "$ALTER_USER_SQL" 2>/dev/null; then
            log "WARN" "User exists but password update failed, continuing with grant..."
        fi
    fi

    GRANT_SQL="GRANT ALL PRIVILEGES ON openjiuwen_agent.* TO '${NEW_DB_USER}'@'localhost'; GRANT ALL PRIVILEGES ON openjiuwen_ops.* TO '${NEW_DB_USER}'@'localhost'; FLUSH PRIVILEGES;"
    if sudo mysql -u root -e "$GRANT_SQL" 2>/dev/null; then
        log "SUCCESS" "MySQL user and databases created"

        if [ -f "$TARGET_ENV_FILE" ]; then
            cp "$TARGET_ENV_FILE" "${TARGET_ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)" 2>/dev/null || true

            if grep -q "^DB_USER=" "$TARGET_ENV_FILE"; then
                if [[ "$(uname -s)" == "Darwin" ]]; then
                    sed -i '' "s|^DB_USER=.*|DB_USER=${NEW_DB_USER}|" "$TARGET_ENV_FILE"
                else
                    sed -i "s|^DB_USER=.*|DB_USER=${NEW_DB_USER}|" "$TARGET_ENV_FILE"
                fi
            else
                echo "DB_USER=${NEW_DB_USER}" >> "$TARGET_ENV_FILE"
            fi

            ESCAPED_PASSWORD=$(printf '%s\n' "$NEW_DB_PASSWORD" | sed 's/[[\.*^$()+?{|]/\\&/g')
            if grep -q "^DB_PASSWORD=" "$TARGET_ENV_FILE"; then
                if [[ "$(uname -s)" == "Darwin" ]]; then
                    sed -i '' "s|^DB_PASSWORD=.*|DB_PASSWORD=${ESCAPED_PASSWORD}|" "$TARGET_ENV_FILE"
                else
                    sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${ESCAPED_PASSWORD}|" "$TARGET_ENV_FILE"
                fi
            else
                echo "DB_PASSWORD=${NEW_DB_PASSWORD}" >> "$TARGET_ENV_FILE"
            fi

            log "SUCCESS" ".env updated: DB_USER=${NEW_DB_USER}"
            echo ""
            echo -e "${GREEN}✅ Configuration complete.${NC}"
            echo -e "${GREEN}   - User: ${NEW_DB_USER}${NC}"
            echo -e "${GREEN}   - Databases: openjiuwen_agent, openjiuwen_ops${NC}"
            echo -e "${GREEN}   - .env has been updated${NC}"
            echo ""
            return 0
        else
            log "ERROR" ".env file not found, cannot update automatically"
            echo -e "${YELLOW}Update .env manually:${NC}"
            echo "  DB_USER=${NEW_DB_USER}"
            echo "  DB_PASSWORD=${NEW_DB_PASSWORD}"
            return 1
        fi
    else
        log "ERROR" "Failed to create MySQL user. Check if MySQL service is running."
        echo -e "${YELLOW}Run the following manually:${NC}"
        echo "  sudo mysql -u root"
        echo "  Then run:"
        echo "  CREATE DATABASE IF NOT EXISTS openjiuwen_agent;"
        echo "  CREATE DATABASE IF NOT EXISTS openjiuwen_ops;"
        echo "  CREATE USER '${NEW_DB_USER}'@'localhost' IDENTIFIED BY 'your_password';"
        echo "  GRANT ALL PRIVILEGES ON openjiuwen_agent.* TO '${NEW_DB_USER}'@'localhost';"
        echo "  GRANT ALL PRIVILEGES ON openjiuwen_ops.* TO '${NEW_DB_USER}'@'localhost';"
        echo "  FLUSH PRIVILEGES;"
        return 1
    fi
}
