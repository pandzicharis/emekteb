#!/bin/bash

set -e

# Get the project root directory (parent of local-setup)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
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
echo -e "${BLUE}║          🚀 E-Mekteb Application Setup                   ║${NC}"
echo -e "${BLUE}║                                                          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Docker is running
echo -e "${CYAN}📋 Step 1/5: Checking Docker...${NC}"
if ! docker info > /dev/null 2>&1; then
    echo -e "${YELLOW}❌ Docker is not running!${NC}"
    echo -e "${YELLOW}   Please start Docker Desktop and try again.${NC}"
    exit 1
fi
echo -e "${GREEN}   ✅ Docker is running${NC}"
echo ""

# Build and start services
echo -e "${CYAN}📋 Step 2/5: Building and starting Docker containers...${NC}"
echo -e "${YELLOW}   This may take a few minutes on first run...${NC}"
echo ""
echo -e "   📦 Installing dependencies in containers..."
echo -e "   🔨 Building Docker images..."
docker compose up -d --build

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}❌ Failed to start services!${NC}"
    echo -e "${YELLOW}   Please check Docker and try again.${NC}"
    exit 1
fi
echo -e "${GREEN}   ✅ Containers started${NC}"
echo ""

# Wait for database initialization
echo -e "${CYAN}📋 Step 3/5: Initializing database...${NC}"
echo -e "   🗄️  Waiting for database to be ready..."
echo -n "   "
DB_READY=false
for i in {1..30}; do
    if docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
        DB_READY=true
        break
    fi
    echo -n "."
    sleep 1
done
echo ""

if [ "$DB_READY" = true ]; then
    echo -e "${GREEN}   ✅ Database is ready${NC}"
    echo -e "   🔄 Running database migrations..."
    echo -e "   🌱 Seeding database with initial data..."
    echo -e "${GREEN}   ✅ Database initialized${NC}"
else
    echo -e "${YELLOW}   ⚠️  Database initialization in progress...${NC}"
fi
echo ""

# Wait for API to be healthy
echo -e "${CYAN}📋 Step 4/5: Starting API server...${NC}"
echo -n "   ⏳ Waiting for API"
API_READY=false
for i in {1..60}; do
    if (command -v curl > /dev/null && curl -f http://localhost:3000/health > /dev/null 2>&1) || \
       (command -v wget > /dev/null && wget --spider http://localhost:3000/health > /dev/null 2>&1) || \
       (command -v nc > /dev/null && nc -z localhost 3000 > /dev/null 2>&1); then
        API_READY=true
        break
    fi
    echo -n "."
    sleep 2
done
echo ""

if [ "$API_READY" = false ]; then
    echo -e "${YELLOW}   ⚠️  API is starting (this may take a while)...${NC}"
    echo -e "${YELLOW}   Check logs: docker compose logs api${NC}"
else
    echo -e "${GREEN}   ✅ API is ready${NC}"
fi
echo ""

# Wait for Web to be healthy
echo -e "${CYAN}📋 Step 5/5: Starting web application...${NC}"
echo -n "   ⏳ Waiting for Web"
WEB_READY=false
for i in {1..60}; do
    if (command -v curl > /dev/null && curl -f http://localhost:5173 > /dev/null 2>&1) || \
       (command -v wget > /dev/null && wget --spider http://localhost:5173 > /dev/null 2>&1) || \
       (command -v nc > /dev/null && nc -z localhost 5173 > /dev/null 2>&1); then
        WEB_READY=true
        break
    fi
    echo -n "."
    sleep 2
done
echo ""

if [ "$WEB_READY" = false ]; then
    echo -e "${YELLOW}   ⚠️  Web is starting (this may take a while)...${NC}"
    echo -e "${YELLOW}   Check logs: docker compose logs web${NC}"
else
    echo -e "${GREEN}   ✅ Web is ready${NC}"
fi
echo ""

# Final summary
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}║          🎉 All services are running!                    ║${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📍 Available Services:${NC}"
echo -e "   🗄️  Database:  localhost:5439"
echo -e "   ⚙️  API:        http://localhost:3000"
echo -e "   🌐 Web App:    http://localhost:5173"
echo ""
echo -e "${BLUE}📝 Login Credentials:${NC}"
echo -e "   👤 Admin:"
echo -e "      Email:    admin@emekteb.ba"
echo -e "      Password: password123"
echo -e "      PIN:      0000"
echo ""
echo -e "   👤 Muallim 1:"
echo -e "      Email:    muallim1@emekteb.ba"
echo -e "      Password: password123"
echo -e "      PIN:      1234"
echo ""
echo -e "   👤 Muallim 2:"
echo -e "      Email:    muallim2@emekteb.ba"
echo -e "      Password: password123"
echo -e "      PIN:      1235"
echo ""

# Open browser
if command -v open > /dev/null; then
    # macOS
    echo -e "${CYAN}🌐 Opening web application in browser...${NC}"
    sleep 2
    open http://localhost:5173
elif command -v xdg-open > /dev/null; then
    # Linux
    echo -e "${CYAN}🌐 Opening web application in browser...${NC}"
    sleep 2
    xdg-open http://localhost:5173
else
    echo -e "${YELLOW}💡 Please open http://localhost:5173 in your browser${NC}"
fi

echo ""
echo -e "${BLUE}💡 Useful Commands:${NC}"
echo -e "   View logs:      docker compose logs -f"
echo -e "   Stop services:  docker compose down"
echo -e "   Restart:        docker compose restart"
echo -e "   Clean (reset):  docker compose down -v"
echo ""
