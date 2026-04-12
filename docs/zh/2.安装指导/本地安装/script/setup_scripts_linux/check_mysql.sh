#!/bin/bash
# Script: check_mysql.sh
# Purpose: Check MySQL config, suggest and fix

set -uo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UTILS_SH="${SCRIPT_DIR}/utils.sh"
if [ ! -f "$UTILS_SH" ]; then
    echo -e "${RED}❌ utils.sh not found: ${UTILS_SH}${NC}"
    exit 1
fi
# shellcheck source=utils.sh
source "$UTILS_SH"

# DB_HOST / DB_PORT from user_config.sh (see load_db_host_port_from_user_config in utils.sh)
load_db_host_port_from_user_config

# Version requirement
REQUIRED_MAJOR_VERSION=8
REQUIRED_MINOR_VERSION=0

echo -e "${BLUE}=== MySQL configuration check ===${NC}"
echo -e "${BLUE}Database host: ${DB_HOST}  port: ${DB_PORT}${NC}\n"

# Get MySQL version
get_mysql_version() {
    local mysql_cmd="$1"
    if [ -z "$mysql_cmd" ]; then
        mysql_cmd="mysql"
    fi
    
    local version_output
    version_output=$($mysql_cmd --version 2>/dev/null)
    
    if [ -z "$version_output" ]; then
        return 1
    fi
    
    local version_match
    if echo "$version_output" | grep -qE "Ver[[:space:]]+[0-9]+\.[0-9]+\.[0-9]+"; then
        version_match=$(echo "$version_output" | grep -oE "Ver[[:space:]]+[0-9]+\.[0-9]+\.[0-9]+" | grep -oE "[0-9]+\.[0-9]+\.[0-9]+")
        if [ -n "$version_match" ]; then
            echo "$version_match"
            return 0
        fi
    fi
    
    return 1
}

run_mysql_client_check() {
    local password="$1"
    local sql="${2:-SELECT 1;}"

    if MYSQL_PWD="$password" mysql --protocol=TCP -h "$DB_HOST" -P "$DB_PORT" -u root -e "$sql" 2>/dev/null | grep -q "1"; then
        return 0
    fi

    return 1
}

# Check if version meets requirement
check_version_requirement() {
    local version_str="$1"
    if [ -z "$version_str" ]; then
        return 1
    fi
    
    local major minor
    major=$(echo "$version_str" | cut -d. -f1)
    minor=$(echo "$version_str" | cut -d. -f2)
    
    if [ -z "$major" ] || [ -z "$minor" ]; then
        return 1
    fi
    
    if [ "$major" -gt "$REQUIRED_MAJOR_VERSION" ] || \
       ([ "$major" -eq "$REQUIRED_MAJOR_VERSION" ] && [ "$minor" -ge "$REQUIRED_MINOR_VERSION" ]); then
        return 0
    else
        return 1
    fi
}

# Detect Linux distro
detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo "$ID"
    elif [ -f /etc/redhat-release ]; then
        echo "rhel"
    elif [ -f /etc/debian_version ]; then
        echo "debian"
    else
        echo "unknown"
    fi
}

# Install MySQL
install_mysql() {
    local distro=$(detect_distro)
    echo -e "${BLUE}Installing MySQL 8.0+...${NC}"
    
    case "$distro" in
        ubuntu|debian)
            echo -e "${YELLOW}Debian/Ubuntu detected, installing MySQL via apt...${NC}"
            
            if ! sudo apt update; then
                echo -e "${RED}❌ apt update failed${NC}"
                return 1
            fi
            
            local available_version
            available_version=$(apt-cache madison mysql-server 2>/dev/null | head -n 1 | awk '{print $3}' | cut -d: -f2 | cut -d- -f1)
            
            local needs_repo=false
            if [ -n "$available_version" ]; then
                local major minor
                major=$(echo "$available_version" | cut -d. -f1)
                minor=$(echo "$available_version" | cut -d. -f2)
                
                if [ "$major" -lt "$REQUIRED_MAJOR_VERSION" ] || \
                   ([ "$major" -eq "$REQUIRED_MAJOR_VERSION" ] && [ "$minor" -lt "$REQUIRED_MINOR_VERSION" ]); then
                    needs_repo=true
                fi
            else
                needs_repo=true
            fi
            
            if [ "$needs_repo" = true ]; then
                echo -e "${YELLOW}Default repo may not have MySQL 8.0+, adding MySQL official repo...${NC}"
                
                sudo apt install -y wget gnupg lsb-release 2>/dev/null
                
                if [ "$distro" = "ubuntu" ]; then
                    if ! wget -q https://dev.mysql.com/get/mysql-apt-config_0.8.24-1_all.deb -O /tmp/mysql-apt-config.deb 2>/dev/null; then
                        echo -e "${YELLOW}⚠ Cannot download MySQL APT config, trying default repo${NC}"
                    else
                        echo "mysql-apt-config mysql-apt-config/select-server select mysql-8.0" | sudo debconf-set-selections 2>/dev/null
                        if sudo DEBIAN_FRONTEND=noninteractive dpkg -i /tmp/mysql-apt-config.deb 2>/dev/null; then
                            sudo apt update
                            rm -f /tmp/mysql-apt-config.deb
                        else
                            echo -e "${YELLOW}⚠ MySQL APT config install failed, trying default repo${NC}"
                        fi
                    fi
                fi
            fi
            
            if ! sudo DEBIAN_FRONTEND=noninteractive apt install -y mysql-server; then
                echo -e "${RED}❌ MySQL installation failed${NC}"
                return 1
            fi
            ;;
        rhel|centos|fedora|rocky|almalinux)
            echo -e "${YELLOW}RHEL/CentOS/Fedora detected, installing MySQL via yum/dnf...${NC}"
            
            if command -v dnf &> /dev/null; then
                if [ "$distro" = "fedora" ] || [ "$distro" = "rocky" ] || [ "$distro" = "almalinux" ]; then
                    echo -e "${YELLOW}Trying MySQL 8.0+ repo...${NC}"
                    if ! sudo dnf install -y mysql-server mysql; then
                        echo -e "${YELLOW}Installing MySQL from default repo...${NC}"
                        if ! sudo dnf install -y mysql-server; then
                            echo -e "${RED}❌ MySQL installation failed${NC}"
                            return 1
                        fi
                    fi
                else
                    if ! sudo dnf install -y mysql-server; then
                        echo -e "${RED}❌ MySQL installation failed${NC}"
                        return 1
                    fi
                fi
            elif command -v yum &> /dev/null; then
                if ! sudo yum install -y mysql-server; then
                    echo -e "${RED}❌ MySQL installation failed${NC}"
                    return 1
                fi
            else
                echo -e "${RED}❌ yum or dnf not found${NC}"
                return 1
            fi
            ;;
        *)
            echo -e "${RED}❌ Unknown Linux distro, cannot install MySQL automatically${NC}"
            echo -e "${YELLOW}Install MySQL 8.0+ manually and re-run this script${NC}"
            return 1
            ;;
    esac
    
    echo -e "${GREEN}✅ MySQL installed${NC}"
    return 0
}

# Check if MySQL is installed and version OK (sets MYSQL_INSTALLED, MYSQL_VERSION)
check_mysql_installed() {
    MYSQL_INSTALLED=false
    MYSQL_VERSION=""

    if command -v mysql &> /dev/null; then
        echo -e "${GREEN}✅ MySQL is installed${NC}"

        MYSQL_VERSION=$(get_mysql_version "mysql")
        if [ -n "$MYSQL_VERSION" ]; then
            echo -e "${BLUE}MySQL version: $MYSQL_VERSION${NC}"

            if check_version_requirement "$MYSQL_VERSION"; then
                echo -e "${GREEN}✅ MySQL version OK (>= $REQUIRED_MAJOR_VERSION.$REQUIRED_MINOR_VERSION)${NC}"
                MYSQL_INSTALLED=true
                if ! systemctl is-active --quiet mysql 2>/dev/null && ! systemctl is-active --quiet mysqld 2>/dev/null; then
                    echo -e "${YELLOW}⚠ MySQL service not running, starting...${NC}"
                    if sudo systemctl start mysql 2>/dev/null || sudo systemctl start mysqld 2>/dev/null; then
                        sleep 2
                        echo -e "${GREEN}✅ MySQL service started${NC}"
                    else
                        echo -e "${RED}❌ MySQL service failed to start. Check with journalctl -u mysql or reinstall${NC}"
                        MYSQL_INSTALLED=false
                    fi
                fi
            else
                echo -e "${YELLOW}⚠ MySQL version $MYSQL_VERSION does not meet requirement (>= $REQUIRED_MAJOR_VERSION.$REQUIRED_MINOR_VERSION)${NC}"
                echo -e "${YELLOW}Will try to install MySQL 8.0+...${NC}"
                MYSQL_INSTALLED=false
            fi
        else
            echo -e "${YELLOW}⚠ Cannot get MySQL version${NC}"
            MYSQL_INSTALLED=false
        fi
    else
        echo -e "${YELLOW}⚠ MySQL not installed${NC}"
        MYSQL_INSTALLED=false
    fi
}

# Apply root password for local admin accounts (TCP + socket naming) and Docker bridge.
# - 'root'@'localhost' / 'root'@'127.0.0.1': ALTER (each may fail if account absent; ignored).
# - 'root'@'172.17.0.1': CREATE IF NOT EXISTS + GRANT + ALTER (Docker client source IP on default bridge).
# Returns 0 if at least one step succeeds (mysqladmin or any mysql statement).
_mysql_apply_root_password_all_hosts() {
    local pwd="$1"
    local ok=0

    if command -v mysqladmin &>/dev/null; then
        if sudo mysqladmin --protocol=TCP -h "$DB_HOST" -P "$DB_PORT" -u root password "$pwd" 2>/dev/null; then
            ok=1
        fi
    fi

    local rh
    for rh in localhost 127.0.0.1; do
        if echo "ALTER USER 'root'@'${rh}' IDENTIFIED BY '${pwd}';" | sudo mysql --protocol=TCP -h "$DB_HOST" -P "$DB_PORT" -u root 2>/dev/null; then
            ok=1
        fi
    done

    if echo "CREATE USER IF NOT EXISTS 'root'@'172.17.0.1' IDENTIFIED BY '${pwd}';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'172.17.0.1' WITH GRANT OPTION;
ALTER USER 'root'@'172.17.0.1' IDENTIFIED BY '${pwd}';
FLUSH PRIVILEGES;" | sudo mysql --protocol=TCP -h "$DB_HOST" -P "$DB_PORT" -u root 2>/dev/null; then
        ok=1
    fi

    [ "$ok" -eq 1 ]
}

# Set MySQL root password
set_mysql_root_password() {
    local is_newly_installed="$1"
    local root_password=""
    
    echo -e "${BLUE}Configuring MySQL root password...${NC}"
    
    if ! systemctl is-active --quiet mysql && ! systemctl is-active --quiet mysqld; then
        echo -e "${YELLOW}⚠ MySQL service not running, starting...${NC}"
        if ! sudo systemctl start mysql 2>/dev/null && ! sudo systemctl start mysqld 2>/dev/null; then
            echo -e "${RED}❌ Cannot start MySQL service${NC}"
            return 1
        fi
        sleep 3
    fi
    
    echo -e "${GREEN}✅ MySQL service is running${NC}"
    
    echo -e "${BLUE}Waiting for MySQL to be ready...${NC}"
    sleep 3
    
    if [ "$is_newly_installed" = "true" ]; then
        echo -e "${YELLOW}New MySQL install detected. Set root password.${NC}"
        
        local password_confirmed=false
        while [ "$password_confirmed" = false ]; do
            echo -n "Enter MySQL root password: "
            read -s password1
            echo ""
            
            if [ -z "$password1" ]; then
                echo -e "${YELLOW}⚠ Password cannot be empty. Retry.${NC}"
                continue
            fi
            
            echo -n "Confirm MySQL root password: "
            read -s password2
            echo ""
            
            if [ "$password1" = "$password2" ]; then
                root_password="$password1"
                password_confirmed=true
                echo -e "${GREEN}✅ Password confirmed${NC}"
            else
                echo -e "${YELLOW}⚠ Passwords do not match. Retry.${NC}"
            fi
        done
        
        echo -e "${BLUE}Setting MySQL root password (localhost, 127.0.0.1, 172.17.0.1 for Docker)...${NC}"

        if _mysql_apply_root_password_all_hosts "$root_password"; then
            echo -e "${GREEN}✅ MySQL root password set${NC}"
        else
            echo -e "${YELLOW}⚠ Cannot set MySQL root password automatically${NC}"
            echo -e "${YELLOW}Set manually (connect with: sudo mysql --protocol=TCP -h ${DB_HOST} -P ${DB_PORT} -u root):${NC}"
            echo -e "  ${GREEN}ALTER USER 'root'@'localhost' IDENTIFIED BY 'your_password';${NC}"
            echo -e "  ${GREEN}ALTER USER 'root'@'127.0.0.1' IDENTIFIED BY 'your_password';${NC}"
            echo -e "  ${GREEN}CREATE USER IF NOT EXISTS 'root'@'172.17.0.1' IDENTIFIED BY 'your_password';${NC}"
            echo -e "  ${GREEN}GRANT ALL PRIVILEGES ON *.* TO 'root'@'172.17.0.1' WITH GRANT OPTION;${NC}"
            echo -e "  ${GREEN}FLUSH PRIVILEGES;${NC}"
            return 1
        fi
        
        sleep 2
        if run_mysql_client_check "$root_password" "SELECT 1;"; then
            echo -e "${GREEN}✅ MySQL root password verified${NC}"
        else
            echo -e "${YELLOW}⚠ Password verification failed but password may be set${NC}"
        fi
    else
        echo -e "${YELLOW}Existing MySQL install detected. Enter root password.${NC}"
        
        local password_entered=false
        local max_attempts=3
        local attempts=0
        
        while [ "$password_entered" = false ] && [ "$attempts" -lt "$max_attempts" ]; do
            echo -n "Enter MySQL root password: "
            read -s root_password
            echo ""
            
            if [ -z "$root_password" ]; then
                echo -e "${YELLOW}⚠ Password cannot be empty. Retry.${NC}"
                attempts=$((attempts + 1))
                continue
            fi
            
            if run_mysql_client_check "$root_password" "SELECT 1;"; then
                password_entered=true
                echo -e "${GREEN}✅ MySQL root password verified${NC}"
            else
                attempts=$((attempts + 1))
                if [ "$attempts" -lt "$max_attempts" ]; then
                    echo -e "${YELLOW}⚠ Password verification failed. Retry [$attempts/$max_attempts]${NC}"
                else
                    echo -e "${RED}❌ Too many failed attempts${NC}"
                    return 1
                fi
            fi
        done
        
        if [ "$password_entered" = false ]; then
            echo -e "${RED}❌ Cannot verify MySQL root password${NC}"
            return 1
        fi
    fi
    
    if [ -n "$root_password" ]; then
        export MYSQL_PWD="$root_password"
        echo -e "${GREEN}✅ MySQL root password set in MYSQL_PWD${NC}"
        return 0
    else
        echo -e "${RED}❌ Could not get MySQL root password${NC}"
        return 1
    fi
}

# Verify MySQL installation
verify_mysql() {
    local is_newly_installed="$1"
    
    echo -e "${BLUE}Verifying MySQL installation...${NC}"
    
    local mysql_path
    mysql_path=$(command -v mysql)
    
    if [ -z "$mysql_path" ]; then
        echo -e "${RED}❌ MySQL executable not found${NC}"
        return 1
    fi
    
    export MYSQL_EXE_PATH="$mysql_path"
    echo -e "${GREEN}✅ MySQL executable: $mysql_path${NC}"
    echo -e "${BLUE}MYSQL_EXE_PATH=$mysql_path${NC}"
    
    local mysql_bin_dir
    mysql_bin_dir=$(dirname "$mysql_path")
    export MYSQL_BIN_DIR="$mysql_bin_dir"
    echo -e "${BLUE}MYSQL_BIN_DIR=$mysql_bin_dir${NC}"
    
    local version
    version=$(get_mysql_version "mysql")
    if [ -z "$version" ]; then
        echo -e "${RED}❌ Cannot get MySQL version${NC}"
        return 1
    fi
    
    if check_version_requirement "$version"; then
        echo -e "${GREEN}✅ MySQL installed. Version: $version${NC}"
    else
        echo -e "${RED}❌ MySQL version $version does not meet requirement (>= $REQUIRED_MAJOR_VERSION.$REQUIRED_MINOR_VERSION)${NC}"
        return 1
    fi
    
    if ! systemctl is-active --quiet mysql && ! systemctl is-active --quiet mysqld; then
        echo -e "${YELLOW}⚠ MySQL service not running, starting...${NC}"
        if sudo systemctl start mysql 2>/dev/null || sudo systemctl start mysqld 2>/dev/null; then
            sleep 3
            echo -e "${GREEN}✅ MySQL service started${NC}"
        else
            echo -e "${RED}❌ Cannot start MySQL service${NC}"
            return 1
        fi
    else
        echo -e "${GREEN}✅ MySQL service is running${NC}"
    fi
    
    if set_mysql_root_password "$is_newly_installed"; then
        if [ -n "${MYSQL_PWD:-}" ]; then
            echo -e "${GREEN}✅ MySQL root password configured${NC}"
        else
            echo -e "${YELLOW}⚠ Password setup may be incomplete${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ Password setup failed, continuing checks${NC}"
    fi
    
    return 0
}


run_check_mysql_main() {
    MYSQL_INSTALLED=false
    MYSQL_VERSION=""
    MYSQL_WAS_NEWLY_INSTALLED=false

    check_mysql_installed

    if [ "$MYSQL_INSTALLED" = false ]; then
        if install_mysql; then
            MYSQL_WAS_NEWLY_INSTALLED=true

            sleep 3

            if command -v mysql &> /dev/null; then
                MYSQL_VERSION=$(get_mysql_version "mysql")
                if [ -n "$MYSQL_VERSION" ]; then
                    if check_version_requirement "$MYSQL_VERSION"; then
                        echo -e "${GREEN}✅ MySQL $MYSQL_VERSION installed and meets version requirement${NC}"
                        MYSQL_INSTALLED=true
                    else
                        echo -e "${RED}❌ MySQL installed but version $MYSQL_VERSION still does not meet requirement${NC}"
                        return 1
                    fi
                else
                    echo -e "${RED}❌ MySQL installed but cannot get version${NC}"
                    return 1
                fi
            else
                echo -e "${RED}❌ MySQL installation failed, mysql command not available${NC}"
                return 1
            fi
        else
            echo -e "${RED}❌ MySQL installation failed${NC}"
            return 1
        fi
    fi

    if ! verify_mysql "$MYSQL_WAS_NEWLY_INSTALLED"; then
        echo -e "${RED}❌ MySQL verification failed${NC}"
        return 1
    fi

    echo ""
    echo -e "${BLUE}=== MySQL configuration ===${NC}"
    echo "DB_HOST=${DB_HOST}"
    echo "DB_PORT=${DB_PORT}"
    if [ -n "${MYSQL_EXE_PATH:-}" ]; then
        echo "MYSQL_EXE_PATH=${MYSQL_EXE_PATH}"
    fi
    if [ -n "${MYSQL_BIN_DIR:-}" ]; then
        echo "MYSQL_BIN_DIR=${MYSQL_BIN_DIR}"
    fi
    if [ -n "${MYSQL_PWD:-}" ]; then
        echo "MYSQL_PWD=***"
        echo -e "${GREEN}✅ MySQL root password set in environment${NC}"
    fi

    echo -e "\n${BLUE}=== Check complete ===${NC}"
    return 0
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    run_check_mysql_main
    exit $?
else
    run_check_mysql_main
    return $?
fi

