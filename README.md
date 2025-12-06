# E-Mekteb Monorepo

Monorepo za E-Mekteb aplikaciju koja uključuje API, web frontend i mobile aplikaciju.

## Struktura

```
emekteb/
├── apps/
│   ├── api/          # Backend API (NestJS)
│   ├── web/          # Frontend web aplikacija (React + Vite)
│   └── mobile/       # Mobile aplikacija (React Native/Flutter)
├── packages/
│   ├── shared-types/ # Dijeljeni TypeScript tipovi
│   └── shared-utils/ # Dijeljene utility funkcije
├── docker-compose.yml # Docker Compose konfiguracija
└── Makefile          # Make komande za upravljanje
```

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Make (opcionalno, ali preporučeno)
- Node.js 20+ (samo za lokalni development bez Docker-a)

### Pokretanje aplikacije

1. **Instaliraj dependencies:**
   ```bash
   make install
   ```

2. **Pokreni sve servise (database, API, frontend):**
   ```bash
   make run
   ```

3. **Pristup aplikacijama:**
   - Frontend: http://localhost:5173
   - API: http://localhost:3000
   - API Health Check: http://localhost:3000/health
   - Database: localhost:5432

## 📋 Make Komande

```bash
make help      # Prikaži sve dostupne komande
make install   # Instaliraj dependencies
make run       # Pokreni sve servise
make down      # Zaustavi sve servise
make build     # Build Docker images
make rebuild   # Rebuild i restart servisa
make logs      # Prikaži logove svih servisa
make logs-api  # Prikaži samo API logove
make logs-web  # Prikaži samo frontend logove
make logs-db   # Prikaži samo database logove
make restart   # Restart svih servisa
make clean     # Zaustavi servise i ukloni volumes
```

## 🔥 Hot Reload

Oba servisa (API i frontend) imaju omogućen hot reload:
- **API**: Automatski restartuje se na promjene u `apps/api/src/`
- **Frontend**: Automatski se osvježava na promjene u `apps/web/src/`

## 🗄️ Database

PostgreSQL baza podataka je pokrenuta u Docker kontejneru:
- **Host**: localhost (ili `postgres` iz Docker network-a)
- **Port**: 5432
- **Database**: emekteb
- **Username**: postgres
- **Password**: postgres

## 📦 Packages

### Shared Types (`@emekteb/shared-types`)

Dijeljeni TypeScript tipovi koji se koriste u API-ju, web-u i mobile aplikaciji.

```typescript
import { User, UserRole, ApiResponse } from '@emekteb/shared-types';
```

### Shared Utils (`@emekteb/shared-utils`)

Dijeljene utility funkcije.

```typescript
import { formatDate, isValidEmail } from '@emekteb/shared-utils';
```

## 🛠️ Development

### Lokalni development (bez Docker-a)

Ako želiš raditi lokalno bez Docker-a:

```bash
# Terminal 1: Database (trebaš lokalno instaliran PostgreSQL)
# Terminal 2: API
npm run start:api

# Terminal 3: Frontend
npm run start:web
```

### Dodavanje novih dependencies

```bash
# Za API
npm install <package> --workspace=@emekteb/api

# Za Frontend
npm install <package> --workspace=@emekteb/web

# Za shared packages
npm install <package> --workspace=@emekteb/shared-types
```

## 🐳 Docker Services

- **postgres**: PostgreSQL 16 database
- **api**: NestJS backend server (port 3000)
- **web**: React frontend (port 5173)

Svi servisi su povezani preko Docker network-a `emekteb-network`.

## 📝 Notes

- Database volume se čuva u `postgres_data` volume-u
- Hot reload radi preko volume mount-ova
- Svi servisi se automatski restartuju na promjene koda
