/*
  Warnings:

  - You are about to drop the column `rasporedId` on the `skola_hifza_casovi` table. All the data in the column will be lost.
  - You are about to drop the `skola_hifza_rasporedi` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `slotId` to the `skola_hifza_casovi` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "skola_hifza_casovi" DROP CONSTRAINT "skola_hifza_casovi_rasporedId_fkey";

-- DropForeignKey
ALTER TABLE "skola_hifza_rasporedi" DROP CONSTRAINT "skola_hifza_rasporedi_skolaHifzaId_fkey";

-- AlterTable
ALTER TABLE "skola_hifza_casovi" DROP COLUMN "rasporedId",
ADD COLUMN     "slotId" TEXT NOT NULL;

-- DropTable
DROP TABLE "skola_hifza_rasporedi";

-- AddForeignKey
ALTER TABLE "skola_hifza_casovi" ADD CONSTRAINT "skola_hifza_casovi_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "rasporedi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
