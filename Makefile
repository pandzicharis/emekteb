.PHONY: help install run start down build rebuild logs clean

# Default target
help:
	@echo "E-Mekteb Monorepo - Available commands:"
	@echo ""
	@echo "  make install    - Install all dependencies"
	@echo "  make start      - Start all services with auto-setup (migrations, seed, browser)"
	@echo "  make run        - Start all services (database, API, frontend)"
	@echo "  make down       - Stop all services"
	@echo "  make build      - Build all Docker images"
	@echo "  make rebuild    - Rebuild and restart all services"
	@echo "  make logs       - Show logs from all services"
	@echo "  make logs-api   - Show API logs"
	@echo "  make logs-web   - Show frontend logs"
	@echo "  make logs-db    - Show database logs"
	@echo "  make clean      - Stop services and remove volumes"
	@echo "  make restart    - Restart all services"
	@echo ""
	@echo "Prisma commands:"
	@echo "  make prisma-generate - Generate Prisma Client"
	@echo "  make prisma-migrate  - Run Prisma migrations"
	@echo "  make prisma-studio  - Open Prisma Studio"
	@echo ""
	@echo "Quick start:"
	@echo "  On Mac/Linux: ./start.sh"
	@echo "  On Windows:   start.bat"
	@echo ""

# Install dependencies
install:
	@echo "📦 Installing dependencies..."
	npm install

# Start all services with full setup (migrations, seed, browser)
start:
	@echo "🚀 Starting E-Mekteb with full setup..."
	@if [ -f "./start.sh" ]; then \
		./start.sh; \
	else \
		echo "❌ start.sh not found. Please run: ./start.sh (Mac/Linux) or start.bat (Windows)"; \
	fi

# Start all services (simple)
run:
	@echo "🚀 Starting all services..."
	docker compose up -d
	@echo ""
	@echo "✅ Services started!"
	@echo "   - Database: localhost:5439"
	@echo "   - API: http://localhost:3000"
	@echo "   - Frontend: http://localhost:5173"
	@echo ""
	@echo "View logs with: make logs"

# Stop all services
down:
	@echo "🛑 Stopping all services..."
	docker compose down

# Build Docker images
build:
	@echo "🔨 Building Docker images..."
	docker compose build

# Rebuild and restart
rebuild:
	@echo "🔄 Rebuilding and restarting services..."
	docker compose up -d --build

# Show logs
logs:
	docker compose logs -f

# Show API logs
logs-api:
	docker compose logs -f api

# Show frontend logs
logs-web:
	docker compose logs -f web

# Show database logs
logs-db:
	docker compose logs -f postgres

# Clean everything (stop + remove volumes)
clean:
	@echo "🧹 Cleaning up..."
	docker compose down -v
	@echo "✅ Cleanup complete!"

# Restart all services
restart:
	@echo "🔄 Restarting services..."
	docker compose restart

# Start only database
db-up:
	@echo "🗄️  Starting database..."
	docker compose up -d postgres

# Start only API
api-up:
	@echo "🚀 Starting API..."
	docker compose up -d api

# Start only frontend
web-up:
	@echo "🌐 Starting frontend..."
	docker compose up -d web

# Prisma commands
prisma-generate:
	@echo "🔧 Generating Prisma Client..."
	docker compose exec api npm run prisma:generate

prisma-migrate:
	@echo "🗄️  Running Prisma migrations..."
	docker compose exec api npm run prisma:migrate

prisma-studio:
	@echo "🎨 Opening Prisma Studio..."
	docker compose exec api npm run prisma:studio

