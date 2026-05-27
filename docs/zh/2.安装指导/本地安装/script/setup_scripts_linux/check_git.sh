#!/bin/bash
# Script: install_and_check_git.sh
# Purpose: Check Git; install if missing, then verify

set -euo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ===================== Core functions =====================
# Check if Git is installed
check_git_installed() {
    if command -v git &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Install Git via system package manager
install_git() {
    echo -e "${YELLOW}\nInstalling Git...${NC}"
    
    if [ -x "$(command -v apt-get)" ]; then
        sudo apt-get update -y > /dev/null 2>&1
        sudo apt-get install -y git
    elif [ -x "$(command -v dnf)" ]; then
        sudo dnf install -y git
    elif [ -x "$(command -v yum)" ]; then
        sudo yum install -y git
    elif [ -x "$(command -v zypper)" ]; then
        sudo zypper install -y git
    elif [ -x "$(command -v pacman)" ]; then
        sudo pacman -S --noconfirm git
    else
        echo -e "${RED}Error: Unknown package manager, cannot install Git automatically${NC}"
        exit 1
    fi
}

# Verify Git (version + functional test)
verify_git() {
    echo -e "${YELLOW}\nVerifying Git installation...${NC}"
    if check_git_installed; then
        GIT_VERSION=$(git --version)
        echo -e "${GREEN}✅ Git installed. Version: ${GIT_VERSION}${NC}"
        
        echo -e "${YELLOW}Testing Git (creating temp repo)...${NC}"
        TEMP_DIR=$(mktemp -d -t git-test-XXXXXX)
        cd "$TEMP_DIR" || exit 1
        
        git init -q > /dev/null 2>&1
        git config user.name "Git Install Checker"
        git config user.email "git-check@example.com"
        touch test.txt
        git add test.txt > /dev/null 2>&1
        git commit -m "test commit" -q > /dev/null 2>&1
        
        if git log --oneline | grep -q "test commit"; then
            echo -e "${GREEN}✅ Git test passed${NC}"
        else
            echo -e "${YELLOW}⚠ Git installed but test failed (check permissions)${NC}"
        fi
        
        cd - > /dev/null 2>&1
        rm -rf "$TEMP_DIR"
    else
        echo -e "${RED}❌ Git installation failed. Check manually.${NC}"
        exit 1
    fi
}

# Apply Git proxy config from user_config.sh (HTTP_PROXY / HTTPS_PROXY / SSL_VERIFY)
apply_git_proxy_config() {
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local config_path="${script_dir}/user_config.sh"
    if [ ! -f "$config_path" ]; then
        return 0
    fi
    if ! source "$config_path" 2>/dev/null; then
        echo -e "${YELLOW}⚠ Failed to load proxy config: $config_path${NC}"
        return 1
    fi
    if [ -n "${HTTP_PROXY:-}" ]; then
        echo -e "${YELLOW}Setting git http.proxy: ${HTTP_PROXY}${NC}"
        git config --global http.proxy "$HTTP_PROXY"
    fi
    if [ -n "${HTTPS_PROXY:-}" ]; then
        echo -e "${YELLOW}Setting git https.proxy: ${HTTPS_PROXY}${NC}"
        git config --global https.proxy "$HTTPS_PROXY"
    fi
    if [ -n "${SSL_VERIFY:-}" ]; then
        echo -e "${YELLOW}Setting git http.sslVerify: ${SSL_VERIFY}${NC}"
        git config --global http.sslVerify "$SSL_VERIFY"
    fi
    if [ -n "${HTTP_PROXY:-}" ] || [ -n "${HTTPS_PROXY:-}" ] || [ -n "${SSL_VERIFY:-}" ]; then
        echo -e "${GREEN}✅ Git proxy config applied${NC}"
    fi
}

# ===================== Main =====================
echo -e "${YELLOW}=== Checking Git installation ===${NC}"

if check_git_installed; then
    GIT_VERSION=$(git --version)
    echo -e "${GREEN}Git is installed. Version: ${GIT_VERSION}${NC}"
    verify_git
else
    echo -e "${RED}Git not installed${NC}"
    
    if ! sudo -v &> /dev/null; then
        echo -e "${RED}Error: sudo required to install. Run as a user with sudo.${NC}"
        exit 1
    fi
    
    install_git
    verify_git
fi

if command -v git &> /dev/null; then
    apply_git_proxy_config
fi

echo -e "\n${GREEN}==== Done ====${NC}"
exit 0
