-- Última decisão de acesso por empresa (proteção quando o serviço de assinaturas está fora)
CREATE TABLE "odramech"."subscription_access_snapshot" (
    "enterprise_id" INTEGER NOT NULL,
    "decision" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscription_access_snapshot_pkey" PRIMARY KEY ("enterprise_id")
);
