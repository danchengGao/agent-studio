#!/bin/bash
# Script: clone_agent_studio.sh
# Purpose: Safely clone agent-studio repo (check directory existence first)

set -x
set -euo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Config
REPO_URL="https://gitcode.com/openJiuwen/agent-studio.git"
TARGET_DIR="agent-studio"  # clone target dir name
GIT_BRANCH="${1:-main}"  # branch from CLI arg, default main

# ===================== Core functions =====================
# Check if git is installed
check_git() {
    if ! command -v git &> /dev/null; then
        echo -e "${RED}Error: git is not installed. Please install git and retry.${NC}"
        exit 1
    fi
}

# Check if target dir exists and handle accordingly
check_and_handle_dir() {
    echo -e "${YELLOW}Checking if target directory [${TARGET_DIR}] exists...${NC}"
    
    if [ -d "${TARGET_DIR}" ]; then
        if [ -d "${TARGET_DIR}/.git" ]; then
            echo -e "${YELLOW}⚠ Directory ${TARGET_DIR} already exists and is a git repo.${NC}"
            
            cd "${TARGET_DIR}" || exit 1
            CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
            echo -e "${YELLOW}Current branch: ${CURRENT_BRANCH}, target branch: ${GIT_BRANCH}${NC}"
            
            if [ "$CURRENT_BRANCH" != "$GIT_BRANCH" ]; then
                echo -e "${YELLOW}Branch mismatch, switching to ${GIT_BRANCH}...${NC}"
                if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
                    echo -e "${YELLOW}Uncommitted local changes detected, running git stash...${NC}"
                    if git stash push -m "auto-stash before switching to ${GIT_BRANCH}"; then
                        echo -e "${GREEN}✅ Local changes stashed (run git stash pop after switch to restore)${NC}"
                    else
                        echo -e "${RED}❌ git stash failed, cannot switch branch safely${NC}"
                        exit 1
                    fi
                fi
                if ! git fetch origin; then
                    echo -e "${YELLOW}⚠ git fetch failed, will try to switch branch with existing remote info${NC}"
                fi
                if git show-ref --quiet --verify "refs/heads/${GIT_BRANCH}" 2>/dev/null; then
                    if git checkout "${GIT_BRANCH}"; then
                        echo -e "${GREEN}✅ Switched to local branch ${GIT_BRANCH}${NC}"
                        git pull origin "${GIT_BRANCH}" 2>/dev/null || true
                    else
                        echo -e "${RED}❌ Failed to switch to branch ${GIT_BRANCH}${NC}"
                        exit 1
                    fi
                elif git show-ref --quiet --verify "refs/remotes/origin/${GIT_BRANCH}" 2>/dev/null; then
                    if git checkout -b "${GIT_BRANCH}" "origin/${GIT_BRANCH}"; then
                        echo -e "${GREEN}✅ Created and switched to branch ${GIT_BRANCH} (tracking origin/${GIT_BRANCH})${NC}"
                        git pull origin "${GIT_BRANCH}" 2>/dev/null || true
                    else
                        echo -e "${RED}❌ Failed to create/switch to branch ${GIT_BRANCH}${NC}"
                        exit 1
                    fi
                else
                    echo -e "${RED}❌ Branch ${GIT_BRANCH} does not exist locally or on remote. Check branch name or run: git fetch origin${NC}"
                    exit 1
                fi
            else
                echo -e "${GREEN}Already on branch ${GIT_BRANCH}, pulling latest...${NC}"
                git pull origin "${GIT_BRANCH}" 2>/dev/null || true
            fi
            cd - > /dev/null || exit 1
            exit 0
        else
            echo -e "${YELLOW}⚠ Directory ${TARGET_DIR} exists but is not a git repo.${NC}"
            read -p "Choose: 1=Remove dir and re-clone 2=Keep dir and skip clone (default 2): " OPTION
            
            case "${OPTION:-2}" in
                1)
                    echo -e "${YELLOW}Removing existing directory ${TARGET_DIR}...${NC}"
                    rm -rf "${TARGET_DIR}"
                    echo -e "${GREEN}Directory removed, cloning repo...${NC}"
                    ;;
                2)
                    echo -e "${YELLOW}Keeping existing directory, skipping clone${NC}"
                    exit 0
                    ;;
                *)
                    echo -e "${YELLOW}Invalid input, keeping directory and skipping clone${NC}"
                    exit 0
                    ;;
            esac
        fi
    else
        echo -e "${GREEN}Target directory does not exist, clone can proceed${NC}"
    fi
}

# Clone repo
clone_repo() {
    echo -e "${YELLOW}Cloning repo: ${REPO_URL} (branch: ${GIT_BRANCH})${NC}"
    git clone -b "${GIT_BRANCH}" "${REPO_URL}" "${TARGET_DIR}"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Clone succeeded. Target: $(pwd)/${TARGET_DIR}, branch: ${GIT_BRANCH}${NC}"
    else
        echo -e "${RED}❌ Clone failed. Check network, repo URL or branch (${GIT_BRANCH})${NC}"
        exit 1
    fi
}

# ===================== Main =====================
echo -e "${YELLOW}=== Fetching agent-studio repo (branch: ${GIT_BRANCH}) ===${NC}"

check_git
check_and_handle_dir
clone_repo

echo -e "\n${GREEN}=== Done ===${NC}"
exit 0
