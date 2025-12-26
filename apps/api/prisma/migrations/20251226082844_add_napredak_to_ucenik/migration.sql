-- AlterTable
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'ucenici' 
        AND column_name = 'napredak'
    ) THEN
        ALTER TABLE "ucenici" ADD COLUMN "napredak" JSONB;
    END IF;
END $$;

