-- AlterTable
ALTER TABLE "ucenici" ADD COLUMN     "greske" JSONB,
ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "status" DROP DEFAULT;
