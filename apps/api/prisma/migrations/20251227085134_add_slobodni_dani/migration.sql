-- CreateTable
CREATE TABLE "slobodni_dani" (
    "id" TEXT NOT NULL,
    "nastavnaGodinaId" TEXT NOT NULL,
    "datum" TIMESTAMP(3) NOT NULL,
    "razlog" TEXT NOT NULL,
    "kreiran" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "azuriran" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slobodni_dani_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "slobodni_dani_nastavnaGodinaId_datum_key" ON "slobodni_dani"("nastavnaGodinaId", "datum");

-- AddForeignKey
ALTER TABLE "slobodni_dani" ADD CONSTRAINT "slobodni_dani_nastavnaGodinaId_fkey" FOREIGN KEY ("nastavnaGodinaId") REFERENCES "nastavne_godine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
