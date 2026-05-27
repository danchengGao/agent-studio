#!/bin/bash
# Script: install_and_check_curl.sh
# Purpose: Check curl; install if missing, then verify

set -euo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if curl is installed
check_curl_installed() {
    if command -v curl &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Install curl via system package manager
install_curl() {
    echo -e "${YELLOW}Installing curl...${NC}"
    
    if [ -x "$(command -v apt-get)" ]; then
        sudo apt-get update -y
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
        echo -e "${RED}Error: Unknown package manager, cannot install curl automatically${NC}"
        exit 1
    fi
}

# Verify curl installation
verify_curl() {
    echo -e "${YELLOW}Verifying curl installation...${NC}"
    if check_curl_installed; then
        CURL_VERSION=$(curl --version | head -n1)
        echo -e "${GREEN}✅ curl installed. Version: ${CURL_VERSION}${NC}"
        
        echo -e "${YELLOW}Testing curl (simple HTTP request)...${NC}"
        if curl -s -o /dev/null -w "%{http_code}" https://www.baidu.com | grep -q "200"; then
            echo -e "${GREEN}✅ curl test passed${NC}"
        else
            echo -e "${YELLOW}⚠ curl installed but test failed (check network)${NC}"
        fi
    else
        echo -e "${RED}❌ curl installation failed. Check manually.${NC}"
        exit 1
    fi
}

# Main
echo -e "${YELLOW}=== Checking curl installation ===${NC}"

if check_curl_installed; then
    CURL_VERSION=$(curl --version | head -n1)
    echo -e "${GREEN}curl is installed. Version: ${CURL_VERSION}${NC}"
    verify_curl
else
    echo -e "${RED}curl not installed${NC}"
    if ! sudo -v &> /dev/null; then
        echo -e "${RED}Error: sudo required to install. Run as a user with sudo.${NC}"
        exit 1
    fi
    install_curl
    verify_curl
fi

echo -e "${GREEN}=== Done ===${NC}"
exit 0
