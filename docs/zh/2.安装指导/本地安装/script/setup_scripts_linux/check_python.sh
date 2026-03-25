#!/bin/bash
# Script: install_and_check_python311.sh
# Purpose: Check Python 3.11+ and pip; install via PPA if missing, minimal verification
# Supported: Debian/Ubuntu (apt + PPA only)

set -euo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Config: min 3.11; verification accepts 3.11+
PYTHON_MIN_VERSION="3.11"
PYTHON_VERSION="3.11"
PPA_SOURCE="ppa:deadsnakes/ppa"

# ===================== Core functions =====================
# Check system is Debian/Ubuntu (apt only)
check_apt_system() {
    if ! [ -x "$(command -v apt)" ]; then
        echo -e "${RED}Error: This script only supports Debian/Ubuntu (apt). Current system is not supported.${NC}"
        exit 1
    fi
}

# Detect Ubuntu version
detect_ubuntu_version() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        if [ "$ID" = "ubuntu" ]; then
            VERSION_ID_NUM=$(echo "$VERSION_ID" | cut -d. -f1)
            if [ "$VERSION_ID_NUM" -le 20 ]; then
                return 0
            fi
        fi
    fi
    return 1
}

# Discover installed Python 3.11+ (for verification)
discover_python_version() {
    local v
    for v in 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25; do
        if command -v "python3.${v}" &> /dev/null; then
            PYTHON_VERSION="3.${v}"
            return 0
        fi
    done
    PYTHON_VERSION="$PYTHON_MIN_VERSION"
    return 1
}

# Check Python 3.11+ installed (uses discover version)
check_python_installed() {
    if command -v python${PYTHON_VERSION} &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Check pip installed (for Python3.11)
check_pip_installed() {
    if python${PYTHON_VERSION} -m pip --version &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Check if conda is installed
check_conda_installed() {
    if command -v conda &> /dev/null; then
        return 0
    elif [ -f "$HOME/miniconda3/bin/conda" ] || [ -f "$HOME/anaconda3/bin/conda" ]; then
        return 0
    else
        return 1
    fi
}

# Init conda (if installed but not initialized)
init_conda() {
    if [ -f "$HOME/miniconda3/etc/profile.d/conda.sh" ]; then
        source "$HOME/miniconda3/etc/profile.d/conda.sh"
    elif [ -f "$HOME/anaconda3/etc/profile.d/conda.sh" ]; then
        source "$HOME/anaconda3/etc/profile.d/conda.sh"
    elif [ -f "/opt/conda/etc/profile.d/conda.sh" ]; then
        source "/opt/conda/etc/profile.d/conda.sh"
    fi
}

# Auto-install Miniconda
install_miniconda() {
    echo -e "${YELLOW}Installing Miniconda...${NC}"
    
    ARCH=$(uname -m)
    if [ "$ARCH" = "x86_64" ]; then
        MINICONDA_URL="https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh"
        MINICONDA_FILE="Miniconda3-latest-Linux-x86_64.sh"
    elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
        MINICONDA_URL="https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-aarch64.sh"
        MINICONDA_FILE="Miniconda3-latest-Linux-aarch64.sh"
    else
        echo -e "${RED}❌ Unsupported architecture: $ARCH${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}Downloading Miniconda (may take a few minutes)...${NC}"
    DOWNLOAD_DIR=$(mktemp -d)
    cd "$DOWNLOAD_DIR" || return 1
    
    if ! curl -fsSL "$MINICONDA_URL" -o "$MINICONDA_FILE"; then
        echo -e "${RED}❌ Miniconda download failed${NC}"
        rm -rf "$DOWNLOAD_DIR"
        return 1
    fi
    
    echo -e "${YELLOW}Installing Miniconda (may take a few minutes)...${NC}"
    bash "$MINICONDA_FILE" -b -p "$HOME/miniconda3" || {
        echo -e "${RED}❌ Miniconda installation failed${NC}"
        rm -rf "$DOWNLOAD_DIR"
        return 1
    }
    
    source "$HOME/miniconda3/etc/profile.d/conda.sh" || {
        echo -e "${RED}❌ Conda initialization failed${NC}"
        rm -rf "$DOWNLOAD_DIR"
        return 1
    }
    
    rm -rf "$DOWNLOAD_DIR"
    
    echo -e "${GREEN}✅ Miniconda installed${NC}"
    return 0
}

# Install Python 3.11 with Conda
install_python_with_conda() {
    echo -e "${YELLOW}Installing Python${PYTHON_VERSION} with Conda...${NC}"
    
    if check_conda_installed; then
        init_conda
    else
        if ! install_miniconda; then
            return 1
        fi
    fi
    
    if ! command -v conda &> /dev/null; then
        echo -e "${RED}❌ Conda not available, check installation${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}Accepting Conda terms of service...${NC}"
    conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main > /dev/null 2>&1 || true
    conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r > /dev/null 2>&1 || true
    conda tos accept --override-channels --channel defaults > /dev/null 2>&1 || true
    echo -e "${GREEN}✅ Conda terms of service accepted${NC}"
    
    ENV_NAME="py311"
    if ! conda env list | grep -q "^${ENV_NAME} "; then
        echo -e "${YELLOW}Creating Conda env ${ENV_NAME} (Python ${PYTHON_VERSION})...${NC}"
        CREATE_OUTPUT=$(mktemp)
        if ! conda create -n "$ENV_NAME" python="${PYTHON_VERSION}" -y > "$CREATE_OUTPUT" 2>&1; then
            if grep -q "Terms of Service" "$CREATE_OUTPUT"; then
                echo -e "${YELLOW}Terms of service issue detected, re-accepting...${NC}"
                conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main > /dev/null 2>&1 || true
                conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r > /dev/null 2>&1 || true
                rm -f "$CREATE_OUTPUT"
                CREATE_OUTPUT=$(mktemp)
                if ! conda create -n "$ENV_NAME" python="${PYTHON_VERSION}" -y > "$CREATE_OUTPUT" 2>&1; then
                    echo -e "${RED}❌ Failed to create Conda env. Output:${NC}"
                    cat "$CREATE_OUTPUT"
                    rm -f "$CREATE_OUTPUT"
                    return 1
                fi
            else
                echo -e "${RED}❌ Failed to create Conda env. Output:${NC}"
                cat "$CREATE_OUTPUT"
                rm -f "$CREATE_OUTPUT"
                return 1
            fi
        fi
        grep -E "(Collecting|Downloading|Installing|done|completed)" "$CREATE_OUTPUT" | head -20 || true
        rm -f "$CREATE_OUTPUT"
        echo -e "${GREEN}✅ Conda env created${NC}"
    else
        echo -e "${GREEN}Conda env ${ENV_NAME} already exists${NC}"
    fi
    
    CONDA_BASE=$(conda info --base)
    PYTHON_PATH="${CONDA_BASE}/envs/${ENV_NAME}/bin/python${PYTHON_VERSION}"
    
    if [ ! -f "$PYTHON_PATH" ]; then
        PYTHON_PATH="${CONDA_BASE}/envs/${ENV_NAME}/bin/python"
        if [ ! -f "$PYTHON_PATH" ]; then
            echo -e "${RED}❌ Python not found in Conda env${NC}"
            return 1
        fi
        PYTHON_ACTUAL_VERSION=$("$PYTHON_PATH" --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
        if [ "$PYTHON_ACTUAL_VERSION" != "${PYTHON_VERSION}" ]; then
            echo -e "${YELLOW}⚠ Conda env Python version is ${PYTHON_ACTUAL_VERSION}, expected ${PYTHON_VERSION}${NC}"
            echo -e "${YELLOW}Using current version...${NC}"
        fi
    fi
    
    SYMLINK_PATH="/usr/local/bin/python${PYTHON_VERSION}"
    CURRENT_LINK=$(readlink -f "$SYMLINK_PATH" 2>/dev/null || echo "")
    TARGET_PATH=$(readlink -f "$PYTHON_PATH" 2>/dev/null || echo "$PYTHON_PATH")
    
    if [ ! -f "$SYMLINK_PATH" ] || [ "$CURRENT_LINK" != "$TARGET_PATH" ]; then
        echo -e "${YELLOW}Creating symlink: ${SYMLINK_PATH} -> ${PYTHON_PATH}${NC}"
        if [ -f "$SYMLINK_PATH" ] || [ -L "$SYMLINK_PATH" ]; then
            sudo rm -f "$SYMLINK_PATH"
        fi
        sudo ln -sf "$PYTHON_PATH" "$SYMLINK_PATH" || {
            echo -e "${YELLOW}⚠ Symlink creation failed; Python is installed at: ${PYTHON_PATH}${NC}"
        }
    else
        echo -e "${GREEN}Symlink already exists and is correct${NC}"
    fi
    
    if command -v python${PYTHON_VERSION} &> /dev/null; then
        echo -e "${GREEN}✅ python${PYTHON_VERSION} is available${NC}"
    else
        echo -e "${YELLOW}⚠ python${PYTHON_VERSION} not in PATH; Python at: ${PYTHON_PATH}${NC}"
    fi
    
    if ! "$PYTHON_PATH" --version &> /dev/null; then
        echo -e "${RED}❌ Python${PYTHON_VERSION} verification failed${NC}"
        return 1
    fi
    
    if ! "$PYTHON_PATH" -m pip --version &> /dev/null; then
        echo -e "${YELLOW}Installing pip...${NC}"
        "$PYTHON_PATH" -m ensurepip --upgrade || {
            curl -sS https://bootstrap.pypa.io/get-pip.py | "$PYTHON_PATH" || {
                echo -e "${RED}❌ pip installation failed${NC}"
                return 1
            }
        }
    fi
    
    echo -e "${GREEN}✅ Python${PYTHON_VERSION} installed with Conda${NC}"
    return 0
}

# Add PPA and install Python3.11 + pip
install_python_pip() {
    echo -e "${YELLOW}\nInstalling Python${PYTHON_VERSION} and pip...${NC}"
    
    if ! sudo -v &> /dev/null; then
        echo -e "${RED}Error: sudo required to install. Run this script with a user that has sudo.${NC}"
        exit 1
    fi

    echo -e "${YELLOW}Adding deadsnakes PPA...${NC}"
    sudo add-apt-repository -y "$PPA_SOURCE" 2>&1 | grep -v "^$" || true
    
    echo -e "${YELLOW}Updating apt (may take a few minutes)...${NC}"
    UPDATE_OUTPUT=$(mktemp)
    if ! sudo apt update -y > "$UPDATE_OUTPUT" 2>&1; then
        echo -e "${RED}❌ apt update failed. Output:${NC}"
        sudo apt clean > /dev/null 2>&1
        cat "$UPDATE_OUTPUT"
        rm -f "$UPDATE_OUTPUT"
        exit 1
    fi
    grep -E "(Reading|Fetched|Get:|Hit:|Ign:|Err:|WARN)" "$UPDATE_OUTPUT" || true
    rm -f "$UPDATE_OUTPUT"
    
    echo -e "${YELLOW}Installing Python${PYTHON_VERSION} and components (may take a few minutes)...${NC}"
    INSTALL_OUTPUT=$(mktemp)
    if ! sudo apt install -y python${PYTHON_VERSION} python${PYTHON_VERSION}-dev python${PYTHON_VERSION}-distutils python${PYTHON_VERSION}-venv > "$INSTALL_OUTPUT" 2>&1; then
        echo -e "${RED}❌ Python${PYTHON_VERSION} installation failed. Output:${NC}"
        cat "$INSTALL_OUTPUT"
        rm -f "$INSTALL_OUTPUT"
        
        if detect_ubuntu_version; then
            echo ""
            echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
            echo -e "${YELLOW}Ubuntu 20.04 or earlier detected.${NC}"
            echo -e "${YELLOW}Deadsnakes PPA no longer supports Ubuntu 20.04 (Focal) and below.${NC}"
            echo ""
            echo -e "${GREEN}Switching to Conda to install Python 3.11...${NC}"
            echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
            echo ""
            
            if install_python_with_conda; then
                echo -e "${GREEN}✅ Python${PYTHON_VERSION} installed with Conda${NC}"
                if check_python_installed && check_pip_installed; then
                    echo -e "${GREEN}✅ Python${PYTHON_VERSION} and pip verified${NC}"
                    rm -f "$INSTALL_OUTPUT"
                    echo -e "${YELLOW}Note: Script uses python${PYTHON_VERSION} (not python3) to avoid affecting system tools.${NC}"
                    return 0
                else
                    echo -e "${YELLOW}⚠ Install completed but verification failed. Please check.${NC}"
                    rm -f "$INSTALL_OUTPUT"
                    exit 1
                fi
            else
                echo ""
                echo -e "${RED}❌ Auto install failed${NC}"
                echo -e "${YELLOW}Install Python 3.11 manually and re-run this script.${NC}"
                echo ""
                echo -e "${YELLOW}Manual steps:${NC}"
                echo -e "1. Download and install Miniconda:"
                echo -e "   ${GREEN}wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh${NC}"
                echo -e "   ${GREEN}bash Miniconda3-latest-Linux-x86_64.sh${NC}"
                echo ""
                echo -e "2. Create Python 3.11 env:"
                echo -e "   ${GREEN}conda create -n py311 python=3.11 -y${NC}"
                echo ""
                echo -e "3. Create symlink:"
                echo -e "   ${GREEN}sudo ln -s \$(conda info --base)/envs/py311/bin/python3.11 /usr/local/bin/python3.11${NC}"
            fi
        else
            echo -e "${YELLOW}Check network and apt sources, then retry.${NC}"
        fi
        rm -f "$INSTALL_OUTPUT"
        exit 1
    fi
    grep -E "(Reading|Preparing|Unpacking|Setting|Selecting|Processing|Done|%|Err:|WARN|E:)" "$INSTALL_OUTPUT" || true
    rm -f "$INSTALL_OUTPUT"
    echo -e "${GREEN}✅ Python${PYTHON_VERSION} installed${NC}"
    
    echo -e "${YELLOW}Installing pip for Python${PYTHON_VERSION}...${NC}"
    if ! python${PYTHON_VERSION} -m pip --version &> /dev/null; then
        echo -e "${YELLOW}Trying ensurepip to install pip...${NC}"
        python${PYTHON_VERSION} -m ensurepip --upgrade 2>&1 | grep -v "^$" || {
            echo -e "${YELLOW}ensurepip not available, using get-pip.py...${NC}"
            curl -sS https://bootstrap.pypa.io/get-pip.py | python${PYTHON_VERSION} 2>&1 | grep -v "^$" || {
                echo -e "${RED}❌ pip installation failed. Install manually.${NC}"
                exit 1
            }
        }
    fi
    
    echo -e "${GREEN}✅ Python${PYTHON_VERSION} and pip installed.${NC}"
    echo -e "${YELLOW}Note: Script uses python${PYTHON_VERSION} (not python3) to avoid affecting system tools.${NC}"
}

# Minimal verification of Python and pip
verify_python_pip() {
    echo -e "${YELLOW}\nVerifying Python${PYTHON_VERSION} and pip...${NC}"
    
    if check_python_installed; then
        PYTHON_FULL_VERSION=$(python${PYTHON_VERSION} --version 2>&1)
        echo -e "${GREEN}✅ Python installed. Version: ${PYTHON_FULL_VERSION}${NC}"
        
        if python${PYTHON_VERSION} -c "" &> /dev/null; then
            echo -e "${GREEN}✅ Python basic test passed${NC}"
        else
            echo -e "${YELLOW}⚠ Python installed but basic test failed${NC}"
        fi
    else
        echo -e "${RED}❌ Python${PYTHON_VERSION} installation failed${NC}"
        exit 1
    fi

    if check_pip_installed; then
        PIP_FULL_VERSION=$(python${PYTHON_VERSION} -m pip --version 2>&1 | awk '{print $2}')
        echo -e "${GREEN}✅ pip installed. Version: ${PIP_FULL_VERSION}${NC}"
        
        if python${PYTHON_VERSION} -m pip -V &> /dev/null; then
            echo -e "${GREEN}✅ pip basic test passed${NC}"
        else
            echo -e "${YELLOW}⚠ pip installed but basic test failed${NC}"
        fi
    else
        echo -e "${RED}❌ pip installation failed${NC}"
        exit 1
    fi
}

# Load and apply pip index config
apply_pip_config() {
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROXY_CONFIG_PATH="${SCRIPT_DIR}/user_config.sh"
    
    if [ ! -f "$PROXY_CONFIG_PATH" ]; then
        return 0
    fi
    
    if ! source "$PROXY_CONFIG_PATH" 2>/dev/null; then
        echo -e "${YELLOW}⚠ Warning: Failed to load config: $PROXY_CONFIG_PATH${NC}"
        return 1
    fi
    
    if [ -n "${PIP_INDEX_URL:-}" ] && [ -n "${PIP_TRUSTED_HOST:-}" ]; then
        echo -e "${YELLOW}Configuring pip index: ${PIP_INDEX_URL}${NC}"
        python${PYTHON_VERSION} -m pip config set global.index-url "$PIP_INDEX_URL" 2>/dev/null || true
        python${PYTHON_VERSION} -m pip config set global.trusted-host "$PIP_TRUSTED_HOST" 2>/dev/null || true
        echo -e "${GREEN}✅ pip index configured${NC}"
    elif [ -n "${PIP_INDEX_URL:-}" ] || [ -n "${PIP_TRUSTED_HOST:-}" ]; then
        echo -e "${YELLOW}⚠ Warning: Both PIP_INDEX_URL and PIP_TRUSTED_HOST must be set; skipping pip config${NC}"
    fi
}

# ===================== Main =====================
echo -e "${YELLOW}=== Checking Python${PYTHON_VERSION} and pip ===${NC}"

check_apt_system

if detect_ubuntu_version; then
    echo -e "${YELLOW}⚠ Ubuntu 20.04 or earlier detected.${NC}"
    echo -e "${YELLOW}⚠ Deadsnakes PPA may not support this version; if install fails, use Miniconda.${NC}"
    echo ""
fi

discover_python_version || true
PYTHON_INSTALLED=false
PIP_INSTALLED=false

if check_python_installed; then
    PYTHON_FULL_VERSION=$(python${PYTHON_VERSION} --version 2>&1)
    echo -e "${GREEN}Python${PYTHON_VERSION} installed. Version: ${PYTHON_FULL_VERSION}${NC}"
    PYTHON_INSTALLED=true
else
    echo -e "${RED}Python${PYTHON_VERSION} not installed${NC}"
fi

if check_pip_installed; then
    PIP_FULL_VERSION=$(python${PYTHON_VERSION} -m pip --version 2>&1 | awk '{print $2}')
    echo -e "${GREEN}pip installed. Version: ${PIP_FULL_VERSION}${NC}"
    PIP_INSTALLED=true
else
    echo -e "${RED}pip not installed${NC}"
fi

if ! $PYTHON_INSTALLED || ! $PIP_INSTALLED; then
    install_python_pip
fi

verify_python_pip
apply_pip_config

echo -e "\n${GREEN}=== Done ===${NC}"
echo -e "${YELLOW}Verify manually:${NC}"
echo -e "${YELLOW}  python${PYTHON_VERSION} -V              # Python version${NC}"
echo -e "${YELLOW}  python${PYTHON_VERSION} -m pip --version # pip version${NC}"
echo -e "${YELLOW}Note: Script uses python${PYTHON_VERSION} (not python3) to avoid affecting system tools.${NC}"
exit 0
