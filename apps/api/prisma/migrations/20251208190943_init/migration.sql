-- CreateEnum
CREATE TYPE "Uloga" AS ENUM ('UCENIK', 'MUALLIM', 'ADMIN');

-- CreateEnum
CREATE TYPE "Spol" AS ENUM ('MUSKO', 'ZENSKO');

-- CreateEnum
CREATE TYPE "StatusUcenika" AS ENUM ('AKTIVAN', 'ARHIVIRAN');

-- CreateEnum
CREATE TYPE "TipRoditelja" AS ENUM ('MAJKA', 'OTAC');

-- CreateEnum
CREATE TYPE "TipKontakta" AS ENUM ('TELEFON', 'MOBITEL', 'EMAIL');

-- CreateEnum
CREATE TYPE "StatusImporta" AS ENUM ('U_TOKU', 'USPJESAN', 'NEUSPJESAN', 'DJELOMICNO_USPJESAN');

-- CreateTable
CREATE TABLE "korisnici" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "lozinka" TEXT NOT NULL,
    "ime" TEXT,
    "prezime" TEXT,
    "uloga" "Uloga" NOT NULL DEFAULT 'UCENIK',
    "aktivan" BOOLEAN NOT NULL DEFAULT true,
    "kreiran" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "azuriran" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "korisnici_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ucenici" (
    "id" TEXT NOT NULL,
    "korisnikId" TEXT,
    "eksterniId" INTEGER,
    "datumRodjenja" TIMESTAMP(3),
    "spol" "Spol",
    "mjestoRodjenja" TEXT,
    "adresaStanovanja" TEXT,
    "status" "StatusUcenika",
    "eksterniDatumKreiran" TIMESTAMP(3),
    "eksterniDatumAzuriran" TIMESTAMP(3),
    "greske" JSONB,
    "imaRoditelje" TEXT,
    "roditeljiZajedno" TEXT,
    "roditeljiRazdvojeni" TEXT,
    "roditeljiClanoviIz" TEXT,
    "brojBrace" INTEGER DEFAULT 0,
    "brojSestara" INTEGER DEFAULT 0,
    "tipStambenogObjekta" TEXT,
    "imaPosebnePotrebe" BOOLEAN NOT NULL DEFAULT false,
    "posebnePotrebeOpis" TEXT,
    "idPunktaDzemata" INTEGER,
    "clanMrezeMladih" TEXT,
    "ucenikSkoleHifza" TEXT,

    CONSTRAINT "ucenici_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obrazovanje" (
    "id" TEXT NOT NULL,
    "ucenikId" TEXT NOT NULL,
    "nivoObrazovanja" TEXT,
    "razred" INTEGER,
    "mektebStepen" TEXT,
    "predskolskaNaziv" TEXT,
    "osnovnaNaziv" TEXT,
    "srednjaNaziv" TEXT,
    "fakultetNaziv" TEXT,
    "kreiran" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "azuriran" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "obrazovanje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roditelji" (
    "id" TEXT NOT NULL,
    "ucenikId" TEXT NOT NULL,
    "tip" "TipRoditelja" NOT NULL,
    "imePrezime" TEXT NOT NULL,
    "datumRodjenja" TIMESTAMP(3),
    "mjestoRodjenja" TEXT,
    "email" TEXT,
    "mobitel" TEXT,
    "telefon" TEXT,
    "zaposlen" BOOLEAN DEFAULT false,
    "obrazovanje" TEXT,
    "zanimanje" TEXT,
    "kreiran" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "azuriran" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roditelji_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kontakti" (
    "id" TEXT NOT NULL,
    "ucenikId" TEXT NOT NULL,
    "tip" "TipKontakta" NOT NULL,
    "vrijednost" TEXT NOT NULL,
    "primarni" BOOLEAN NOT NULL DEFAULT false,
    "kreiran" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "azuriran" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kontakti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imports" (
    "id" TEXT NOT NULL,
    "nazivFajla" TEXT NOT NULL,
    "status" "StatusImporta" NOT NULL DEFAULT 'U_TOKU',
    "ukupnoRedova" INTEGER NOT NULL DEFAULT 0,
    "uspjesnoSacuvano" INTEGER NOT NULL DEFAULT 0,
    "novih" INTEGER NOT NULL DEFAULT 0,
    "updateanih" INTEGER NOT NULL DEFAULT 0,
    "gresaka" INTEGER NOT NULL DEFAULT 0,
    "logovi" JSONB,
    "kreiran" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "azuriran" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "korisnici_email_key" ON "korisnici"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ucenici_korisnikId_key" ON "ucenici"("korisnikId");

-- CreateIndex
CREATE UNIQUE INDEX "ucenici_eksterniId_key" ON "ucenici"("eksterniId");

-- CreateIndex
CREATE UNIQUE INDEX "obrazovanje_ucenikId_key" ON "obrazovanje"("ucenikId");

-- AddForeignKey
ALTER TABLE "ucenici" ADD CONSTRAINT "ucenici_korisnikId_fkey" FOREIGN KEY ("korisnikId") REFERENCES "korisnici"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obrazovanje" ADD CONSTRAINT "obrazovanje_ucenikId_fkey" FOREIGN KEY ("ucenikId") REFERENCES "ucenici"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roditelji" ADD CONSTRAINT "roditelji_ucenikId_fkey" FOREIGN KEY ("ucenikId") REFERENCES "ucenici"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kontakti" ADD CONSTRAINT "kontakti_ucenikId_fkey" FOREIGN KEY ("ucenikId") REFERENCES "ucenici"("id") ON DELETE CASCADE ON UPDATE CASCADE;
