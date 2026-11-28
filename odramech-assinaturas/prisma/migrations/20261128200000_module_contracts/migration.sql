-- Contratos de módulos adicionais (Estoque de peças), separados das assinaturas
CREATE TYPE "assinaturas"."ContractModule" AS ENUM ('INVENTORY');
CREATE TYPE "assinaturas"."ModuleContractStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELED');

CREATE TABLE "assinaturas"."module_contracts" (
    "id" TEXT NOT NULL,
    "enterprise_id" INTEGER NOT NULL,
    "enterprise_name" TEXT,
    "module" "assinaturas"."ContractModule" NOT NULL,
    "status" "assinaturas"."ModuleContractStatus" NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "price_cents" INTEGER,
    "suspended_reason" TEXT,
    "admin_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "module_contracts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "module_contracts_enterprise_id_module_key" ON "assinaturas"."module_contracts"("enterprise_id", "module");

CREATE TABLE "assinaturas"."module_contract_events" (
    "id" SERIAL NOT NULL,
    "contract_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "module_contract_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "module_contract_events_contract_id_created_at_idx" ON "assinaturas"."module_contract_events"("contract_id", "created_at");
ALTER TABLE "assinaturas"."module_contract_events" ADD CONSTRAINT "module_contract_events_contract_id_fkey"
    FOREIGN KEY ("contract_id") REFERENCES "assinaturas"."module_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
