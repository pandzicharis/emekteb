-- AlterTable
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'skola_hifza_casovi' 
        AND column_name = 'komentari'
    ) THEN
        ALTER TABLE "skola_hifza_casovi" ADD COLUMN "komentari" JSONB;
    END IF;
END $$;

