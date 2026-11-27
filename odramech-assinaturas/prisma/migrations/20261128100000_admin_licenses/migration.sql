-- Licenças manuais (cortesia/suspensão) e administradores do painel de assinaturas
ALTER TABLE "assinaturas"."subscriptions" ADD COLUMN "complimentary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "assinaturas"."subscriptions" ADD COLUMN "complimentary_until" TIMESTAMP(3);
ALTER TABLE "assinaturas"."subscriptions" ADD COLUMN "suspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "assinaturas"."subscriptions" ADD COLUMN "suspended_reason" TEXT;
ALTER TABLE "assinaturas"."subscriptions" ADD COLUMN "admin_note" TEXT;

CREATE TABLE "assinaturas"."admin_users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "totp_secret" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "admin_users_email_key" ON "assinaturas"."admin_users"("email");

CREATE TABLE "assinaturas"."admin_sessions" (
    "id" TEXT NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "admin_sessions_admin_id_idx" ON "assinaturas"."admin_sessions"("admin_id");
ALTER TABLE "assinaturas"."admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_fkey"
  FOREIGN KEY ("admin_id") REFERENCES "assinaturas"."admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
