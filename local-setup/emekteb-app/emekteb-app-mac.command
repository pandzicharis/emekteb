#!/bin/bash

# Get the project root directory (parent of local-setup)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

clear
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                          ║${NC}"
echo -e "${BLUE}║          🚀 E-Mekteb App Setup                         ║${NC}"
echo -e "${BLUE}║                                                          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Provjeri da li seed već postoji
echo -e "${CYAN}🔍 Checking if seed already exists...${NC}"
npm run prisma:seed --prefix apps/api

if [ $? -ne 0 ]; then
  echo -e "${YELLOW}❌ Error running seed${NC}"
  echo ""
  echo -e "${YELLOW}Press any key to exit...${NC}"
  read -n 1
  exit 1
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}║          ✅ E-Mekteb app setup completed!               ║${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Press any key to exit...${NC}"
read -n 1



