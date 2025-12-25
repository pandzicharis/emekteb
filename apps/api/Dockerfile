FROM node:20-alpine

WORKDIR /app

# Install OpenSSL for Prisma, wget for healthchecks, and postgresql-client for database checks
RUN apk add --no-cache openssl wget postgresql-client

# Kopiraj root i workspace package.json
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/

# Install dependencies
RUN npm install

# Ensure PDF libraries are installed in api workspace
RUN cd apps/api && npm install pdf-lib jspdf jspdf-autotable

COPY . .

# Copy PDF template to accessible location
RUN mkdir -p /app/pdf && cp pdf/ILMIHAL.pdf /app/pdf/ILMIHAL.pdf 2>/dev/null || true

# Generate Prisma Client
RUN cd apps/api && npx prisma generate

EXPOSE 3000
