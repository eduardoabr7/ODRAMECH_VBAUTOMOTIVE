-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "assinaturas";

-- CreateEnum
CREATE TYPE "assinaturas"."BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "assinaturas"."SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "assinaturas"."InvoiceStatus" AS ENUM ('OPEN', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "assinaturas"."PaymentMethod" AS ENUM ('PIX', 'CARD', 'BOLETO');

-- CreateTable
CREATE TABLE "assinaturas"."plans" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "interval" "assinaturas"."BillingInterval" NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assinaturas"."subscriptions" (
    "id" TEXT NOT NULL,
    "enterprise_id" INTEGER NOT NULL,
    "enterprise_name" TEXT,
    "plan_id" INTEGER NOT NULL,
    "status" "assinaturas"."SubscriptionStatus" NOT NULL,
    "payment_method" "assinaturas"."PaymentMethod",
    "trial_ends_at" TIMESTAMP(3),
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "canceled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assinaturas"."invoices" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "plan_code" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "status" "assinaturas"."InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "method" "assinaturas"."PaymentMethod",
    "gateway_ref" TEXT,
    "instructions" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assinaturas"."subscription_events" (
    "id" SERIAL NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "assinaturas"."plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_enterprise_id_key" ON "assinaturas"."subscriptions"("enterprise_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_current_period_end_idx" ON "assinaturas"."subscriptions"("status", "current_period_end");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "assinaturas"."invoices"("number");

-- CreateIndex
CREATE INDEX "invoices_subscription_id_status_idx" ON "assinaturas"."invoices"("subscription_id", "status");

-- CreateIndex
CREATE INDEX "subscription_events_subscription_id_created_at_idx" ON "assinaturas"."subscription_events"("subscription_id", "created_at");

-- AddForeignKey
ALTER TABLE "assinaturas"."subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "assinaturas"."plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinaturas"."invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "assinaturas"."subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinaturas"."subscription_events" ADD CONSTRAINT "subscription_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "assinaturas"."subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

