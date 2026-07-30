# E-Mekteb

Monorepo sa dvije aplikacije:

| Dio          | Folder     | Tehnologija     | Deploy   |
| ------------ | ---------- | --------------- | -------- |
| **Backend**  | `apps/api` | NestJS + Prisma | Render   |
| **Frontend** | `apps/web` | React + Vite    | Vercel   |
| **Baza**     | -          | PostgreSQL      | Supabase |

---

## Lokalno pokretanje

Jednom, na početku:

```bash
npm install
cp apps/api/.env.example apps/api/.env     # backend env (baza, JWT, admin)
cp apps/web/.env.example apps/web/.env     # frontend env (adresa API-ja)
docker compose up -d                       # opcionalno: lokalni Postgres na portu 5439
npm run db:deploy                          # primijeni migracije
```

Zatim, svaki put - dva terminala:

```bash
npm run dev:api      # backend  -> http://localhost:3000
npm run dev:web      # frontend -> http://localhost:5173
```

Prijava: `admin@emekteb.ba` / `password123` (mijenja se kroz `ADMIN_*` u `apps/api/.env`).
Admin račun i osnovni razredi (Razred 1-9, Škola Hifza) kreiraju se automatski na startu
API-ja ako ne postoje. Baza je inače prazna - učenici se uvoze CSV-om iz admin panela.

Ako radiš direktno na Supabase bazi, ne treba ti Docker - samo upiši Supabase konekcije u
`apps/api/.env`.

### Korisne komande

```bash
npm run db:migrate     # nova migracija (nakon promjene schema.prisma)
npm run db:deploy      # primijeni postojeće migracije
npm run db:generate    # regeneriši Prisma Client
npm run db:studio      # Prisma Studio (pregled baze)
npm run build:api      # produkcijski build backenda
npm run build:web      # produkcijski build frontenda (uključuje typecheck)
```

---

## Deploy

### 1. Baza - Supabase (free)

1. [supabase.com](https://supabase.com) → New project (region: Frankfurt / Central EU).
2. Project Settings → Database → Connection string, uzmi dvije konekcije:
   - **Transaction pooler** (port `6543`) → `DATABASE_URL`, dodaj
     `?pgbouncer=true&connection_limit=1`
   - **Direct connection / Session pooler** (port `5432`) → `DIRECT_URL` (za migracije)

> Free Supabase projekt se pauzira nakon ~7 dana neaktivnosti; iz dashboarda se vraća jednim klikom.

### 2. Backend - Render (free)

1. [render.com](https://render.com) → New → **Blueprint** → odaberi ovaj repo (čita `render.yaml`).
2. Popuni env varijable: `DATABASE_URL`, `DIRECT_URL`, `FRONTEND_URL`, `ADMIN_EMAIL`,
   `ADMIN_PASSWORD` (`JWT_SECRET` Render generiše sam).
3. Deploy. Migracije se primjenjuju automatski na svakom startu.
4. Provjera: `https://<tvoj-api>.onrender.com/health`

> Free instanca se uspava nakon ~15 min neaktivnosti - prvi request nakon toga traje
> 30-60 sekundi. Starter plan ($7/mj) uklanja uspavljivanje.
> Uploadovane fotografije (`uploads/`) se na free planu gube pri redeployu.

### 3. Frontend - Vercel (free)

1. [vercel.com](https://vercel.com) → Add New Project → odaberi ovaj repo
   (`vercel.json` u rootu već definiše build).
2. Environment Variables → `VITE_API_URL` = adresa Render API-ja
   (npr. `https://emekteb-api.onrender.com`).
3. Deploy.
4. Vrati se na Render i u `FRONTEND_URL` upiši Vercel domen. Za preview deploymente
   dodaj i wildcard: `https://emekteb.vercel.app,*.vercel.app`

> `VITE_API_URL` se upisuje u build - nakon promjene te varijable treba novi deploy.

---

## Admin panel

- **Učenici → Import** - upload CSV-a s učenicima (jedini način unosa učenika).
  Očekivane kolone vraća `GET /import/mapping`, historija importa `GET /import`.
- **Postavke → Baza podataka** - stanje baze po tabelama i **brisanje svih podataka**
  (truncate). Traži potvrdu `OBRISI SVE`; opcija "Zadrži admin korisnike" uključena je
  po defaultu. Struktura baze i migracije ostaju nepromijenjene.
  Endpoint se može onemogućiti sa `ALLOW_DB_TRUNCATE=false`.

## Env varijable

Backend `apps/api/.env`, frontend `apps/web/.env` - popis i opisi su u `.env.example`
fajlovima u tim folderima.
