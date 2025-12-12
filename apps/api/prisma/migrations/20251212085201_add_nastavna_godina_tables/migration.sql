-- CreateEnum
CREATE TYPE "StatusNastavneGodine" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DanUNedelji" AS ENUM ('subota', 'nedjelja');

-- DropIndex
DROP INDEX "razred_lekcije_lekcijaId_idx";

-- CreateTable
CREATE TABLE "nastavne_godine" (
    "id" TEXT NOT NULL,
    "naziv" TEXT NOT NULL,
    "opis" TEXT,
    "datumOd" TIMESTAMP(3) NOT NULL,
    "datumDo" TIMESTAMP(3) NOT NULL,
    "nastavniPlanId" TEXT NOT NULL,
    "status" "StatusNastavneGodine" NOT NULL DEFAULT 'ACTIVE',
    "kreiran" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "azuriran" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nastavne_godine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "razred_nastavna_godina" (
    "id" TEXT NOT NULL,
    "nastavnaGodinaId" TEXT NOT NULL,
    "razredId" TEXT NOT NULL,
    "muallimId" TEXT NOT NULL,
    "split" BOOLEAN NOT NULL DEFAULT false,
    "kreiran" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "azuriran" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "razred_nastavna_godina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupe" (
    "id" TEXT NOT NULL,
    "razredNastavnaGodinaId" TEXT NOT NULL,
    "naziv" TEXT NOT NULL,
    "kuran" BOOLEAN NOT NULL DEFAULT false,
    "sufara" BOOLEAN NOT NULL DEFAULT false,
    "kreiran" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "azuriran" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grupe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rasporedi" (
    "id" TEXT NOT NULL,
    "grupaId" TEXT NOT NULL,
    "dan" "DanUNedelji" NOT NULL,
    "slot" TEXT NOT NULL,
    "lokacija" TEXT,
    "trajanje" INTEGER NOT NULL DEFAULT 45,
    "kreiran" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "azuriran" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rasporedi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ucenik_grupa" (
    "id" TEXT NOT NULL,
    "ucenikId" TEXT NOT NULL,
    "grupaId" TEXT NOT NULL,
    "kreiran" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "azuriran" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ucenik_grupa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "razred_nastavna_godina_nastavnaGodinaId_razredId_key" ON "razred_nastavna_godina"("nastavnaGodinaId", "razredId");

-- CreateIndex
CREATE UNIQUE INDEX "grupe_razredNastavnaGodinaId_naziv_key" ON "grupe"("razredNastavnaGodinaId", "naziv");

-- CreateIndex
CREATE UNIQUE INDEX "rasporedi_grupaId_key" ON "rasporedi"("grupaId");

-- CreateIndex
CREATE UNIQUE INDEX "ucenik_grupa_ucenikId_grupaId_key" ON "ucenik_grupa"("ucenikId", "grupaId");

-- AddForeignKey
ALTER TABLE "nastavne_godine" ADD CONSTRAINT "nastavne_godine_nastavniPlanId_fkey" FOREIGN KEY ("nastavniPlanId") REFERENCES "nastavni_planovi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "razred_nastavna_godina" ADD CONSTRAINT "razred_nastavna_godina_nastavnaGodinaId_fkey" FOREIGN KEY ("nastavnaGodinaId") REFERENCES "nastavne_godine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "razred_nastavna_godina" ADD CONSTRAINT "razred_nastavna_godina_razredId_fkey" FOREIGN KEY ("razredId") REFERENCES "razredi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "razred_nastavna_godina" ADD CONSTRAINT "razred_nastavna_godina_muallimId_fkey" FOREIGN KEY ("muallimId") REFERENCES "ucenici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupe" ADD CONSTRAINT "grupe_razredNastavnaGodinaId_fkey" FOREIGN KEY ("razredNastavnaGodinaId") REFERENCES "razred_nastavna_godina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rasporedi" ADD CONSTRAINT "rasporedi_grupaId_fkey" FOREIGN KEY ("grupaId") REFERENCES "grupe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ucenik_grupa" ADD CONSTRAINT "ucenik_grupa_ucenikId_fkey" FOREIGN KEY ("ucenikId") REFERENCES "ucenici"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ucenik_grupa" ADD CONSTRAINT "ucenik_grupa_grupaId_fkey" FOREIGN KEY ("grupaId") REFERENCES "grupe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
