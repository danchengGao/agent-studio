#!/bin/bash
# Script: install_and_check_nodejs.sh
# Purpose: Check Node.js; install via NVM if missing or too old, then verify
set -euo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Config: Node.js 20.0+ required; NVM install version when missing or too old
NODEJS_MIN_MAJOR=20
NODEJS_INSTALL_VERSION="22"
NVM_VERSION="v0.39.7"

# NVM install script URLs (priority order)
NVM_INSTALL_URLS=(
    "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh"
    "https://gitee.com/mirrors/nvm/raw/${NVM_VERSION}/install.sh"
    "https://openjiuwen-ci.obs.cn-north-4.myhuaweicloud.com/agentstudio/setup_scripts/nvm-${NVM_VERSION}-install.sh"
)

# ===================== Core functions =====================
# Check Node.js installed and version >= 20.0
check_node_installed() {
    if command -v node &> /dev/null; then
        INSTALLED_MAJOR=$(node -v | sed -n 's/^v\([0-9]*\)\..*/\1/p')
        if [ -n "$INSTALLED_MAJOR" ] && [ "$INSTALLED_MAJOR" -ge "$NODEJS_MIN_MAJOR" ] 2>/dev/null; then
            return 0
        else
            echo -e "${YELLOW}Node.js is installed but version is $(node -v); Node.js ${NODEJS_MIN_MAJOR}.0+ required${NC}"
            return 1
        fi
    else
        return 1
    fi
}

# Check NVM installed; install if not
install_nvm() {
    export NVM_DIR="$HOME/.nvm"
    if [ -s "$NVM_DIR/nvm.sh" ]; then
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
        
        if command -v nvm &> /dev/null; then
            echo -e "${GREEN}✅ NVM already installed. Version: $(nvm --version)${NC}"
            return 0
        fi
    fi
    
    echo -e "${YELLOW}\nNVM not found, installing NVM...${NC}"
    
    if ! command -v curl &> /dev/null; then
        echo -e "${YELLOW}NVM requires curl. Installing curl...${NC}"
        if [ -x "$(command -v apt-get)" ]; then
            sudo apt-get update -y > /dev/null 2>&1
            sudo apt-get install -y curl
        elif [ -x "$(command -v dnf)" ]; then
            sudo dnf install -y curl
        elif [ -x "$(command -v yum)" ]; then
            sudo yum install -y curl
        elif [ -x "$(command -v zypper)" ]; then
            sudo zypper install -y curl
        elif [ -x "$(command -v pacman)" ]; then
            sudo pacman -S --noconfirm curl
        else
            echo -e "${RED}Error: Unknown system, cannot install curl automatically. Install curl manually and retry.${NC}"
            exit 1
        fi
    fi

    echo -e "${YELLOW}Downloading NVM install script...${NC}"
    
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    LOCAL_NVM_SCRIPT="${SCRIPT_DIR}/nvm-${NVM_VERSION}-install.sh"
    if [ -f "$LOCAL_NVM_SCRIPT" ]; then
        echo -e "${GREEN}✅ Local NVM install script found, using offline install...${NC}"
        bash "$LOCAL_NVM_SCRIPT"
    else
        INSTALL_SUCCESS=false
        LAST_ERROR=""
        
        for NVM_URL in "${NVM_INSTALL_URLS[@]}"; do
            echo -e "${YELLOW}Trying source: ${NVM_URL}${NC}"
            
            CURL_OUTPUT=$(curl -k -o- "$NVM_URL" 2>&1)
            CURL_EXIT_CODE=$?
            
            if [ $CURL_EXIT_CODE -eq 0 ]; then
                echo -e "${GREEN}✅ Download OK, installing NVM...${NC}"
                set +e
                echo "$CURL_OUTPUT" | bash 2>&1
                INSTALL_EXIT_CODE=$?
                set -e
                
                if [ $INSTALL_EXIT_CODE -eq 0 ]; then
                    INSTALL_SUCCESS=true
                    break
                else
                    LAST_ERROR="NVM install script failed (exit code: $INSTALL_EXIT_CODE)"
                    echo -e "${YELLOW}⚠ This source failed, trying next...${NC}"
                    continue
                fi
            else
                LAST_ERROR="$CURL_OUTPUT"
                echo -e "${YELLOW}⚠ Download from this source failed, trying next...${NC}"
            fi
        done
        
        if [ "$INSTALL_SUCCESS" = false ]; then
            echo -e "${RED}❌ All online sources failed. Cannot install NVM.${NC}"
            if [ -n "$LAST_ERROR" ]; then
                echo -e "${YELLOW}Last error: ${LAST_ERROR}${NC}"
            fi
            echo ""
            echo -e "${YELLOW}=== Offline install options ===${NC}"
            echo -e "${YELLOW}Option 1: Download NVM install script manually${NC}"
            echo -e "  1. On a machine with network, download from one of:"
            for NVM_URL in "${NVM_INSTALL_URLS[@]}"; do
                echo -e "     - ${NVM_URL}"
            done
            echo -e "  2. Save the script as: ${LOCAL_NVM_SCRIPT}"
            echo -e "  3. Re-run this script; it will use the local script"
            echo ""
            echo -e "${YELLOW}Option 2: Install Node.js via system package manager (version may differ)${NC}"
            echo -e "  Ubuntu/Debian: sudo apt-get update && sudo apt-get install -y nodejs npm"
            echo -e "  CentOS/RHEL: sudo yum install -y nodejs npm"
            echo -e "  Fedora: sudo dnf install -y nodejs npm"
            echo ""
            echo -e "${YELLOW}Option 3: Set proxy and retry${NC}"
            echo -e "  export https_proxy=http://your-proxy:port"
            echo -e "  export http_proxy=http://your-proxy:port"
            echo ""
            exit 1
        fi
    fi
    
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
    
    if command -v nvm &> /dev/null; then
        echo -e "${GREEN}✅ NVM installed. Version: $(nvm --version)${NC}"
    else
        echo -e "${RED}❌ NVM installation failed. Check manually.${NC}"
        exit 1
    fi
}

# Install Node.js via NVM (default v22)
install_nodejs() {
    echo -e "${YELLOW}\nInstalling Node.js v${NODEJS_INSTALL_VERSION} (${NODEJS_MIN_MAJOR}.0+ required)...${NC}"
    
    if ! command -v nvm &> /dev/null; then
        install_nvm
    fi

    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [ -f "${SCRIPT_DIR}/user_config.sh" ]; then
        # shellcheck source=user_config.sh
        source "${SCRIPT_DIR}/user_config.sh" 2>/dev/null || true
        if [ -n "${NVM_NODEJS_ORG_MIRROR:-}" ]; then
            export NVM_NODEJS_ORG_MIRROR
            echo -e "${YELLOW}Using NVM mirror: ${NVM_NODEJS_ORG_MIRROR}${NC}"
            echo -e "${YELLOW}(Mirror applies for this run only; for current shell: source ${SCRIPT_DIR}/user_config.sh)${NC}"
        fi
    fi

    NVM_VERSION_STR="v${NODEJS_INSTALL_VERSION}"
    set +e
    NVM_INSTALL_OUTPUT=$(nvm install "$NVM_VERSION_STR" 2>&1)
    NVM_INSTALL_EXIT_CODE=$?
    set -e

    if [ "$NVM_INSTALL_EXIT_CODE" -ne 0 ]; then
        echo -e "${RED}❌ Failed to install Node.js ${NVM_VERSION_STR} via nvm.${NC}"
        echo -e "${YELLOW}nvm error output (a common one: Version ''v22' not found - try 'nvm ls-remote' to browse available versions):${NC}"
        echo "$NVM_INSTALL_OUTPUT"
        echo ""
        echo -e "${YELLOW}=== How to diagnose ===${NC}"
        echo -e "  1. Check the current Node.js mirror:"
        echo -e "     echo \$NVM_NODEJS_ORG_MIRROR"
        echo -e "  2. Use curl to see whether the mirror is reachable:"
        echo -e "     curl -v \${NVM_NODEJS_ORG_MIRROR:-https://nodejs.org/dist}/index.tab"
        echo ""
        echo -e "${YELLOW}=== Possible causes and fixes ===${NC}"

        if [ -z "${NVM_NODEJS_ORG_MIRROR:-}" ]; then
            echo -e "  1. ${YELLOW}NVM_NODEJS_ORG_MIRROR is NOT configured${NC}"
            echo -e "     - Please configure something like the following in ${SCRIPT_DIR}/user_config.sh:"
            echo -e "         export NVM_NODEJS_ORG_MIRROR=\"http://nodejs.org/dist\""
            echo -e "       or use a Node.js mirror that is reachable in your environment."
        else
            if [[ "${NVM_NODEJS_ORG_MIRROR}" == https://* ]]; then
                echo -e "  1. ${YELLOW}NVM_NODEJS_ORG_MIRROR uses https, which may fail due to SSL certificate issues in this environment${NC}"
                echo -e "     - Recommended workaround: change the mirror to http, for example:"
                echo -e "         export NVM_NODEJS_ORG_MIRROR=\"http://${NVM_NODEJS_ORG_MIRROR#https://}\""
                echo -e "       or ask your ops team to ensure https access to this mirror works correctly."
            fi
            echo -e "  2. Check the curl output above for any network/proxy/SSL errors, fix them, and then retry."
        fi

        echo ""
        echo -e "${RED}Please follow the hints above, then re-run this install script.${NC}"
        exit 1
    fi

    nvm alias default "$NVM_VERSION_STR"
    nvm use default
}

# Verify Node.js and npm
verify_nodejs() {
    if check_node_installed; then
        NODE_VERSION=$(node -v)
        NPM_VERSION=$(npm -v)
        echo -e "${GREEN}✅ Node.js installed. Version: ${NODE_VERSION}${NC}"
        echo -e "${GREEN}✅ npm installed. Version: ${NPM_VERSION}${NC}"
        
        echo -e "${YELLOW}Testing Node.js...${NC}"
        if node -e "console.log('Node.js OK')" &> /dev/null; then
            echo -e "${GREEN}✅ Node.js test passed${NC}"
        else
            echo -e "${YELLOW}⚠ Node.js installed but test failed${NC}"
        fi
    else
        echo -e "${RED}❌ Node.js installation failed. Check manually.${NC}"
        exit 1
    fi
}

# Apply npm registry config from user_config.sh
apply_npm_config() {
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROXY_CONFIG_PATH="${SCRIPT_DIR}/user_config.sh"
    
    if [ ! -f "$PROXY_CONFIG_PATH" ]; then
        return 0
    fi
    
    if ! source "$PROXY_CONFIG_PATH" 2>/dev/null; then
        echo -e "${YELLOW}⚠ Warning: Failed to load config: $PROXY_CONFIG_PATH${NC}"
        return 1
    fi
    
    if [ -n "${NPM_REGISTRY:-}" ]; then
        echo -e "${YELLOW}Configuring npm registry: ${NPM_REGISTRY}${NC}"
        npm config set registry "$NPM_REGISTRY" 2>/dev/null || true
        echo -e "${GREEN}✅ npm registry configured${NC}"
    fi
}

# ===================== Main =====================
echo -e "${YELLOW}=== Checking Node.js (${NODEJS_MIN_MAJOR}.0+ required) ===${NC}"

if check_node_installed; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}Node.js installed and meets requirement. Version: ${NODE_VERSION}${NC}"
    verify_nodejs
else
    echo -e "${RED}Node.js not installed or version below ${NODEJS_MIN_MAJOR}.0${NC}"
    
    install_nodejs
    verify_nodejs
fi

if command -v node &> /dev/null && command -v npm &> /dev/null; then
    apply_npm_config
else
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    if command -v node &> /dev/null && command -v npm &> /dev/null; then
        apply_npm_config
    fi
fi

echo -e "\n${GREEN}=== Done ===${NC}"
echo -e "${YELLOW}If node is not available in a new terminal, run: source ~/.bashrc or restart the terminal${NC}"
exit 0
