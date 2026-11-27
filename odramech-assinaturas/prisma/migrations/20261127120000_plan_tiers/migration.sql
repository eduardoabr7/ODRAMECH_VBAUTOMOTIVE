-- Planos por nível (Basic / Intermediário / Pro / Ultra): limite de estabelecimentos e recursos
ALTER TABLE "assinaturas"."plans" ADD COLUMN "tier" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "assinaturas"."plans" ADD COLUMN "max_establishments" INTEGER;
ALTER TABLE "assinaturas"."plans" ADD COLUMN "features" TEXT[] DEFAULT ARRAY[]::TEXT[];
