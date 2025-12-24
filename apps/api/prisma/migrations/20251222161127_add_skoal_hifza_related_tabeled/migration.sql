-- AlterEnum
ALTER TYPE "Ilmihal" ADD VALUE 'ŠKOLA HIFZA';

-- AlterEnum
ALTER TYPE "TipLekcije" ADD VALUE 'SKOLA_HIFZA';

-- AlterTable
ALTER TABLE "lekcije" ADD COLUMN     "brojAjeta" INTEGER;

-- AlterTable
ALTER TABLE "skola_hifza" ADD COLUMN     "lekcije" JSONB;
