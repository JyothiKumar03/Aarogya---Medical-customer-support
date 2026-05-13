-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "customer_email" TEXT,
ADD COLUMN "customer_name" TEXT,
ADD COLUMN "customer_phone" TEXT;

-- CreateTable
CREATE TABLE "SearchSettings" (
    "id" TEXT NOT NULL,
    "allowed_domains" TEXT NOT NULL DEFAULT '["prudential.com"]',
    "blocked_domains" TEXT NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchSettings_pkey" PRIMARY KEY ("id")
);
