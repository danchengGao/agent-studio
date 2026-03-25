#!/bin/bash
# Utility library: common OS detection and package-manager helpers

# Load optional per-user config (proxy, mirrors, registries, etc.) and apply HTTP(S) proxy
# This will:
# - source user_config.sh if present under WORK_HOME
# - export HTTP_PROXY/HTTPS_PROXY (and lower-case variants) for current shell
apply_http_proxy() {
    # Require WORK_HOME to be set by caller script
    if [ -z "${WORK_HOME:-}" ]; then
        return 0
    fi

    local USER_CONFIG="${WORK_HOME}/user_config.sh"
    if [ -f "$USER_CONFIG" ]; then
        # shellcheck source=user_config.sh
        . "$USER_CONFIG" 2>/dev/null || true

        if [ -n "${HTTP_PROXY:-}" ]; then
            export HTTP_PROXY
            export http_proxy="$HTTP_PROXY"
        fi
        if [ -n "${HTTPS_PROXY:-}" ]; then
            export HTTPS_PROXY
            export https_proxy="$HTTPS_PROXY"
        fi
    fi
}

# Detect Linux distro and package manager.
# Sets globals: OS_TYPE, PKG_MANAGER, OS_ID (from /etc/os-release ID), OS_VERSION (VERSION_ID)
detect_os() {
    OS_TYPE="unknown"
    PKG_MANAGER="unknown"
    OS_ID="unknown"
    OS_VERSION="unknown"
    
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_ID="${ID:-unknown}"
        OS_VERSION="${VERSION_ID:-unknown}"
        
        case "${ID:-}" in
            ubuntu|debian)
                OS_TYPE="debian"
                if command -v apt &> /dev/null; then
                    PKG_MANAGER="apt"
                elif command -v apt-get &> /dev/null; then
                    PKG_MANAGER="apt-get"
                else
                    PKG_MANAGER="apt"
                fi
                ;;
            centos|rhel|rocky|almalinux)
                OS_TYPE="rhel"
                if command -v dnf &> /dev/null; then
                    PKG_MANAGER="dnf"
                elif command -v yum &> /dev/null; then
                    PKG_MANAGER="yum"
                else
                    PKG_MANAGER="yum"
                fi
                ;;
            fedora)
                OS_TYPE="fedora"
                if command -v dnf &> /dev/null; then
                    PKG_MANAGER="dnf"
                else
                    PKG_MANAGER="dnf"
                fi
                ;;
            opensuse*|sles)
                OS_TYPE="suse"
                if command -v zypper &> /dev/null; then
                    PKG_MANAGER="zypper"
                else
                    PKG_MANAGER="zypper"
                fi
                ;;
            arch|manjaro)
                OS_TYPE="arch"
                if command -v pacman &> /dev/null; then
                    PKG_MANAGER="pacman"
                else
                    PKG_MANAGER="pacman"
                fi
                ;;
            *)
                case "${ID_LIKE:-}" in
                    *debian*)
                        OS_TYPE="debian"
                        if command -v apt &> /dev/null; then
                            PKG_MANAGER="apt"
                        elif command -v apt-get &> /dev/null; then
                            PKG_MANAGER="apt-get"
                        else
                            PKG_MANAGER="apt"
                        fi
                        ;;
                    *rhel*|*fedora*)
                        OS_TYPE="rhel"
                        if command -v dnf &> /dev/null; then
                            PKG_MANAGER="dnf"
                        elif command -v yum &> /dev/null; then
                            PKG_MANAGER="yum"
                        else
                            PKG_MANAGER="yum"
                        fi
                        ;;
                    *)
                        OS_TYPE="unknown"
                        ;;
                esac
                ;;
        esac
    else
        if command -v apt &> /dev/null || command -v apt-get &> /dev/null; then
            OS_TYPE="debian"
            if command -v apt &> /dev/null; then
                PKG_MANAGER="apt"
            else
                PKG_MANAGER="apt-get"
            fi
        elif command -v dnf &> /dev/null; then
            OS_TYPE="rhel"
            PKG_MANAGER="dnf"
        elif command -v yum &> /dev/null; then
            OS_TYPE="rhel"
            PKG_MANAGER="yum"
        elif command -v zypper &> /dev/null; then
            OS_TYPE="suse"
            PKG_MANAGER="zypper"
        elif command -v pacman &> /dev/null; then
            OS_TYPE="arch"
            PKG_MANAGER="pacman"
        fi
    fi
    
    if [ "${DEBUG:-0}" = "1" ]; then
        echo "Detected: OS_ID=$OS_ID OS_VERSION=$OS_VERSION OS_TYPE=$OS_TYPE PKG_MANAGER=$PKG_MANAGER"
    fi
}

# Get install command for package manager. Args: package names (space-separated). Returns full install command (requires sudo).
get_install_command() {
    local packages="$*"
    
    if [ "$OS_TYPE" = "unknown" ] || [ "$PKG_MANAGER" = "unknown" ]; then
        detect_os
    fi
    
    case "$PKG_MANAGER" in
        apt|apt-get)
            echo "sudo $PKG_MANAGER update -y && sudo $PKG_MANAGER install -y $packages"
            ;;
        dnf)
            echo "sudo dnf install -y $packages"
            ;;
        yum)
            echo "sudo yum install -y $packages"
            ;;
        zypper)
            echo "sudo zypper install -y $packages"
            ;;
        pacman)
            echo "sudo pacman -S --noconfirm $packages"
            ;;
        *)
            echo ""
            return 1
            ;;
    esac
}

# Run package install. Args: package names (space-separated).
install_packages() {
    local packages="$*"
    
    if [ -z "$packages" ]; then
        return 1
    fi
    
    if [ "$OS_TYPE" = "unknown" ] || [ "$PKG_MANAGER" = "unknown" ]; then
        detect_os
    fi
    
    case "$PKG_MANAGER" in
        apt|apt-get)
            sudo $PKG_MANAGER update -y
            sudo $PKG_MANAGER install -y $packages
            ;;
        dnf)
            sudo dnf install -y $packages
            ;;
        yum)
            sudo yum install -y $packages
            ;;
        zypper)
            sudo zypper install -y $packages
            ;;
        pacman)
            sudo pacman -S --noconfirm $packages
            ;;
        *)
            echo "Error: Unsupported package manager: $PKG_MANAGER"
            return 1
            ;;
    esac
}

