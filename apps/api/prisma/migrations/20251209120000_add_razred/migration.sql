-- CreateEnum
CREATE TYPE "Ilmihal" AS ENUM ('ILMIHAL I', 'ILMIHAL II', 'ILMIHAL III');

-- CreateTable
CREATE TABLE "razredi" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ilmihal" "Ilmihal" NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "razredi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "razredi_name_key" ON "razredi"("name");






