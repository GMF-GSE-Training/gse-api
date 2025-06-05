-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "sessionId" VARCHAR(255);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "oauthRefreshToken" TEXT,
ADD COLUMN     "photo" TEXT;
