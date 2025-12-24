-- CreateTable
CREATE TABLE "skola_hifza" (
    "id" TEXT NOT NULL,
    "nastavnaGodinaId" TEXT NOT NULL,
    "kreiran" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "azuriran" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skola_hifza_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skola_hifza_muallimi" (
    "id" TEXT NOT NULL,
    "skolaHifzaId" TEXT NOT NULL,
    "muallimId" TEXT NOT NULL,
    "kreiran" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "azuriran" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skola_hifza_muallimi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skola_hifza_ucenici" (
    "id" TEXT NOT NULL,
    "skolaHifzaId" TEXT NOT NULL,
    "ucenikId" TEXT NOT NULL,
    "muallimId" TEXT NOT NULL,
    "napredak" JSONB,
    "kreiran" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "azuriran" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skola_hifza_ucenici_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skola_hifza_rasporedi" (
    "id" TEXT NOT NULL,
    "skolaHifzaId" TEXT NOT NULL,
    "dan" "DanUNedelji" NOT NULL,
    "slot" TEXT NOT NULL,
    "lokacija" TEXT,
    "trajanje" INTEGER NOT NULL DEFAULT 45,
    "kreiran" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "azuriran" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skola_hifza_rasporedi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skola_hifza_casovi" (
    "id" TEXT NOT NULL,
    "skolaHifzaId" TEXT NOT NULL,
    "rasporedId" TEXT NOT NULL,
    "datum" TIMESTAMP(3) NOT NULL,
    "napomena" TEXT,
    "napredak" JSONB,
    "kreiran" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "azuriran" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skola_hifza_casovi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skola_hifza_prisustva" (
    "id" TEXT NOT NULL,
    "casId" TEXT NOT NULL,
    "ucenikId" TEXT NOT NULL,
    "status" "StatusPrisustva" NOT NULL,
    "napomena" TEXT,
    "kreiran" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "azuriran" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skola_hifza_prisustva_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "skola_hifza_nastavnaGodinaId_key" ON "skola_hifza"("nastavnaGodinaId");

-- CreateIndex
CREATE UNIQUE INDEX "skola_hifza_muallimi_skolaHifzaId_muallimId_key" ON "skola_hifza_muallimi"("skolaHifzaId", "muallimId");

-- CreateIndex
CREATE UNIQUE INDEX "skola_hifza_ucenici_skolaHifzaId_ucenikId_key" ON "skola_hifza_ucenici"("skolaHifzaId", "ucenikId");

-- CreateIndex
CREATE UNIQUE INDEX "skola_hifza_rasporedi_skolaHifzaId_key" ON "skola_hifza_rasporedi"("skolaHifzaId");

-- CreateIndex
CREATE UNIQUE INDEX "skola_hifza_prisustva_casId_ucenikId_key" ON "skola_hifza_prisustva"("casId", "ucenikId");

-- AddForeignKey
ALTER TABLE "skola_hifza" ADD CONSTRAINT "skola_hifza_nastavnaGodinaId_fkey" FOREIGN KEY ("nastavnaGodinaId") REFERENCES "nastavne_godine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skola_hifza_muallimi" ADD CONSTRAINT "skola_hifza_muallimi_skolaHifzaId_fkey" FOREIGN KEY ("skolaHifzaId") REFERENCES "skola_hifza"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skola_hifza_muallimi" ADD CONSTRAINT "skola_hifza_muallimi_muallimId_fkey" FOREIGN KEY ("muallimId") REFERENCES "ucenici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skola_hifza_ucenici" ADD CONSTRAINT "skola_hifza_ucenici_skolaHifzaId_fkey" FOREIGN KEY ("skolaHifzaId") REFERENCES "skola_hifza"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skola_hifza_ucenici" ADD CONSTRAINT "skola_hifza_ucenici_ucenikId_fkey" FOREIGN KEY ("ucenikId") REFERENCES "ucenici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skola_hifza_ucenici" ADD CONSTRAINT "skola_hifza_ucenici_muallimId_fkey" FOREIGN KEY ("muallimId") REFERENCES "ucenici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skola_hifza_rasporedi" ADD CONSTRAINT "skola_hifza_rasporedi_skolaHifzaId_fkey" FOREIGN KEY ("skolaHifzaId") REFERENCES "skola_hifza"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skola_hifza_casovi" ADD CONSTRAINT "skola_hifza_casovi_skolaHifzaId_fkey" FOREIGN KEY ("skolaHifzaId") REFERENCES "skola_hifza"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skola_hifza_casovi" ADD CONSTRAINT "skola_hifza_casovi_rasporedId_fkey" FOREIGN KEY ("rasporedId") REFERENCES "skola_hifza_rasporedi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skola_hifza_prisustva" ADD CONSTRAINT "skola_hifza_prisustva_casId_fkey" FOREIGN KEY ("casId") REFERENCES "skola_hifza_casovi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skola_hifza_prisustva" ADD CONSTRAINT "skola_hifza_prisustva_ucenikId_fkey" FOREIGN KEY ("ucenikId") REFERENCES "ucenici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
