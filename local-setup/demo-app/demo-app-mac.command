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
RED='\033[0;31m'
NC='\033[0m' # No Color

clear
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                          ║${NC}"
echo -e "${BLUE}║          🎭 E-Mekteb DEMO App Setup                     ║${NC}"
echo -e "${BLUE}║                                                          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Truncate baze
echo -e "${CYAN}🗑️  Step 1/3: Truncating database...${NC}"
npm run prisma:truncate --prefix apps/api

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Error truncating database${NC}"
  echo ""
  echo -e "${YELLOW}Press any key to exit...${NC}"
  read -n 1
  exit 1
fi

echo -e "${GREEN}   ✅ Database truncated${NC}"
echo ""

# Osnovni seed
echo -e "${CYAN}🌱 Step 2/3: Running basic seed...${NC}"
npm run prisma:seed --prefix apps/api

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Error running basic seed${NC}"
  echo ""
  echo -e "${YELLOW}Press any key to exit...${NC}"
  read -n 1
  exit 1
fi

echo -e "${GREEN}   ✅ Basic seed completed${NC}"
echo ""

# Demo seed
echo -e "${CYAN}🎭 Step 3/3: Running demo seed...${NC}"
npm run prisma:seed:demo --prefix apps/api

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Error running demo seed${NC}"
  echo ""
  echo -e "${YELLOW}Press any key to exit...${NC}"
  read -n 1
  exit 1
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}║          🎉 DEMO app setup completed!                   ║${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📝 Demo podaci su uspješno kreirani!${NC}"
echo ""
echo -e "${YELLOW}Press any key to exit...${NC}"
read -n 1



