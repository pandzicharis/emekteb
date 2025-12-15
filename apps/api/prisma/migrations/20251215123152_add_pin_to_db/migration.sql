/*
  Warnings:

  - A unique constraint covering the columns `[pin]` on the table `korisnici` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "korisnici" ADD COLUMN     "pin" TEXT,
ADD COLUMN     "poslednjeLogiranje" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "korisnici_pin_key" ON "korisnici"("pin");
