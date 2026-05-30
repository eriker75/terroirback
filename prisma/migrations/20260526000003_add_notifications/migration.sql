-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENT');

-- CreateEnum
CREATE TYPE "NotificationAudience" AS ENUM ('ALL_USERS', 'NEW_USERS', 'VIP', 'INACTIVE', 'CART_ABANDONMENT', 'NEWSLETTER');

-- CreateTable
CREATE TABLE "Notification" (
    "id"          TEXT        NOT NULL,
    "title"       TEXT        NOT NULL,
    "message"     TEXT        NOT NULL,
    "audience"    "NotificationAudience" NOT NULL DEFAULT 'ALL_USERS',
    "status"      "NotificationStatus"   NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "sentAt"      TIMESTAMP(3),
    "sentCount"   INTEGER     NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
