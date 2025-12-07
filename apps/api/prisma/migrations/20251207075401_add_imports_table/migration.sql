-- CreateEnum
CREATE TYPE "StatusImporta" AS ENUM ('U_TOKU', 'USPJESAN', 'NEUSPJESAN', 'DJELOMICNO_USPJESAN');

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
