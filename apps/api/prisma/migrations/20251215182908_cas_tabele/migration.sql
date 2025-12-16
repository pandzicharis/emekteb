-- CreateEnum
CREATE TYPE "TipCasa" AS ENUM ('LEKCIJA', 'PROVJERA', 'POSEBNO');

-- CreateEnum
CREATE TYPE "StatusPrisustva" AS ENUM ('PRISUTAN', 'OPRAVDAN', 'NEOPRAVDAN');

-- CreateTable
CREATE TABLE "casovi" (
    "id" TEXT NOT NULL,
    "nastavnaGodinaId" TEXT NOT NULL,
    "razredNastavnaGodinaId" TEXT NOT NULL,
    "grupaId" TEXT NOT NULL,
    "rasporedId" TEXT NOT NULL,
    "datum" TIMESTAMP(3) NOT NULL,
    "tipovi" "TipCasa"[],
    "napomena" TEXT,
    "kreiran" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "azuriran" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "casovi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cas_lekcije" (
    "id" TEXT NOT NULL,
    "casId" TEXT NOT NULL,
    "lekcijaId" TEXT NOT NULL,

    CONSTRAINT "cas_lekcije_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cas_prisustva" (
    "id" TEXT NOT NULL,
    "casId" TEXT NOT NULL,
    "ucenikId" TEXT NOT NULL,
    "status" "StatusPrisustva" NOT NULL,
    "napomena" TEXT,
    "kreiran" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "azuriran" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cas_prisustva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cas_ocjene" (
    "id" TEXT NOT NULL,
    "casId" TEXT NOT NULL,
    "ucenikId" TEXT NOT NULL,
    "lekcijaId" TEXT NOT NULL,
    "ocjena" INTEGER NOT NULL,
    "komentar" TEXT,
    "vrijeme" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cas_ocjene_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cas_lekcije_casId_lekcijaId_key" ON "cas_lekcije"("casId", "lekcijaId");

-- CreateIndex
CREATE UNIQUE INDEX "cas_prisustva_casId_ucenikId_key" ON "cas_prisustva"("casId", "ucenikId");

-- CreateIndex
CREATE UNIQUE INDEX "cas_ocjene_casId_ucenikId_lekcijaId_key" ON "cas_ocjene"("casId", "ucenikId", "lekcijaId");

-- AddForeignKey
ALTER TABLE "casovi" ADD CONSTRAINT "casovi_nastavnaGodinaId_fkey" FOREIGN KEY ("nastavnaGodinaId") REFERENCES "nastavne_godine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casovi" ADD CONSTRAINT "casovi_razredNastavnaGodinaId_fkey" FOREIGN KEY ("razredNastavnaGodinaId") REFERENCES "razred_nastavna_godina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casovi" ADD CONSTRAINT "casovi_grupaId_fkey" FOREIGN KEY ("grupaId") REFERENCES "grupe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casovi" ADD CONSTRAINT "casovi_rasporedId_fkey" FOREIGN KEY ("rasporedId") REFERENCES "rasporedi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cas_lekcije" ADD CONSTRAINT "cas_lekcije_casId_fkey" FOREIGN KEY ("casId") REFERENCES "casovi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cas_lekcije" ADD CONSTRAINT "cas_lekcije_lekcijaId_fkey" FOREIGN KEY ("lekcijaId") REFERENCES "lekcije"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cas_prisustva" ADD CONSTRAINT "cas_prisustva_casId_fkey" FOREIGN KEY ("casId") REFERENCES "casovi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cas_prisustva" ADD CONSTRAINT "cas_prisustva_ucenikId_fkey" FOREIGN KEY ("ucenikId") REFERENCES "ucenici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cas_ocjene" ADD CONSTRAINT "cas_ocjene_casId_fkey" FOREIGN KEY ("casId") REFERENCES "casovi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cas_ocjene" ADD CONSTRAINT "cas_ocjene_ucenikId_fkey" FOREIGN KEY ("ucenikId") REFERENCES "ucenici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cas_ocjene" ADD CONSTRAINT "cas_ocjene_lekcijaId_fkey" FOREIGN KEY ("lekcijaId") REFERENCES "lekcije"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
