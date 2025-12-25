FROM node:20-alpine

# Install wget for healthchecks
RUN apk add --no-cache wget

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Copy and make entrypoint script executable
COPY apps/web/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port
EXPOSE 5173

# Use entrypoint script
ENTRYPOINT ["/docker-entrypoint.sh"]

