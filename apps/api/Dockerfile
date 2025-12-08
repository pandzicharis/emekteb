FROM node:20-slim

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client (after copying all files to ensure latest schema)
# This ensures Prisma client is generated with the latest schema
RUN cd apps/api && npx prisma generate

# Expose port
EXPOSE 3000

# Start with hot reload (will be overridden by docker-compose)
CMD ["sh", "-c", "cd /app/apps/api && npx nest start --watch"]
