-- CreateEnum
CREATE TYPE "TipLekcije" AS ENUM ('ILMIHAL', 'KURAN', 'SUFARA');

-- CreateTable
CREATE TABLE "lekcije" (
    "id" TEXT NOT NULL,
    "naslov" TEXT NOT NULL,
    "opis" TEXT NOT NULL,
    "tezina" INTEGER NOT NULL,
    "redoslijed" INTEGER NOT NULL,
    "aktivan" BOOLEAN NOT NULL DEFAULT true,
    "tip" "TipLekcije" NOT NULL,
    "kreiran" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "azuriran" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lekcije_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "razred_lekcije" (
    "id" TEXT NOT NULL,
    "razredId" TEXT NOT NULL,
    "lekcijaId" TEXT NOT NULL,

    CONSTRAINT "razred_lekcije_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "razred_lekcije_razredId_lekcijaId_key" ON "razred_lekcije"("razredId", "lekcijaId");
CREATE INDEX "razred_lekcije_lekcijaId_idx" ON "razred_lekcije"("lekcijaId");

-- AddForeignKey
ALTER TABLE "razred_lekcije" ADD CONSTRAINT "razred_lekcije_razredId_fkey" FOREIGN KEY ("razredId") REFERENCES "razredi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "razred_lekcije" ADD CONSTRAINT "razred_lekcije_lekcijaId_fkey" FOREIGN KEY ("lekcijaId") REFERENCES "lekcije"("id") ON DELETE CASCADE ON UPDATE CASCADE;
