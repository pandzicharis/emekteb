# Local Setup Scripts

Ova mapa sadrži skripte za lokalno pokretanje E-Mekteb aplikacije.

## Struktura

```
local-setup/
├── demo-app/              # Demo verzija aplikacije sa kompletnim demo podacima
│   ├── demo-app-mac.command
│   ├── demo-app-windows.bat
│   └── README.md
├── emekteb-app/           # Standardna verzija aplikacije sa osnovnim seedom
│   ├── emekteb-app-mac.command
│   ├── emekteb-app-windows.bat
│   └── README.md
├── setup-mac.command      # Setup za Mac (Docker + servisi)
├── setup-windows.bat      # Setup za Windows (Docker + servisi)
├── start.sh               # Start skripta za Linux/Mac
└── start.bat              # Start skripta za Windows
```

## Kako koristiti

### Demo App (sa demo podacima)

**Mac:** Dvokliknite na `demo-app/demo-app-mac.command`  
**Windows:** Dvokliknite na `demo-app/demo-app-windows.bat`

Ova skripta će:
- Obrisati sve postojeće podatke
- Kreirati osnovni seed
- Kreirati demo podatke (90 učenika, nastavni plan, časovi, ocjene, itd.)

### E-Mekteb App (standardna verzija)

**Mac:** Dvokliknite na `emekteb-app/emekteb-app-mac.command`  
**Windows:** Dvokliknite na `emekteb-app/emekteb-app-windows.bat`

Ova skripta će:
- Kreirati osnovni seed (ako već ne postoji)
- Kreirati admin, muallim, razrede i osnovne lekcije

### Full Setup (Docker + servisi)

**Mac:** Dvokliknite na `setup-mac.command`  
**Windows:** Dvokliknite na `setup-windows.bat`

Ova skripta će:
- Pokrenuti Docker kontejnere
- Inicijalizovati bazu
- Pokrenuti API i Web servise

## Napomene

- Sve skripte automatski pronalaze root direktorijum projekta
- Na Mac-u, `.command` fajlovi se mogu pokrenuti dvoklikom
- Na Windows-u, `.bat` fajlovi se mogu pokrenuti dvoklikom
- Demo app skripta će obrisati sve postojeće podatke!



