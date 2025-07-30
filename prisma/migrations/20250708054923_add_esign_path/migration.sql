/*
  Fixed migration: Only add missing columns that don't exist yet.
  Removed DROP COLUMN statements for columns that don't exist in current database.
*/

-- AlterTable participants: Add path columns if they don't exist
ALTER TABLE "participants" 
ADD COLUMN IF NOT EXISTS "fotoPath" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "ktpPath" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "qrCodeLink" TEXT,
ADD COLUMN IF NOT EXISTS "qrCodePath" TEXT,
ADD COLUMN IF NOT EXISTS "simAPath" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "simBPath" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "suratBebasNarkobaPath" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "suratSehatButaWarnaPath" VARCHAR(255);

-- AlterTable signatures: Add eSignPath if it doesn't exist
ALTER TABLE "signatures" 
ADD COLUMN IF NOT EXISTS "eSignPath" VARCHAR(255);

-- AlterTable users: Add verification timestamp and alter token column
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "last_verification_email_sent_at" TIMESTAMP(3);

-- Only alter column type if needed
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'users' 
               AND column_name = 'accountVerificationToken' 
               AND data_type = 'text') THEN
        ALTER TABLE "users" ALTER COLUMN "accountVerificationToken" SET DATA TYPE VARCHAR(512);
    END IF;
END $$;
