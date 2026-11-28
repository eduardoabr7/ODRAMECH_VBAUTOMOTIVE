-- Módulo Estoque de peças (contrato à parte): peças, livro-razão de movimentações,
-- vínculo do item de OS/orçamento com a peça e última situação conhecida dos módulos.
CREATE TYPE "odramech"."StockMovementType" AS ENUM ('ENTRADA', 'SAIDA', 'AJUSTE', 'OS_BAIXA', 'OS_ESTORNO');

CREATE TABLE "odramech"."inv_parts" (
    "id" SERIAL NOT NULL,
    "id_establishment" INTEGER NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "oem_code" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'UN',
    "cost_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sale_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "min_quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "location" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inv_parts_pkey" PRIMARY KEY ("id"),
    -- defesa no banco: saldo nunca fica negativo, mesmo com bug ou corrida
    CONSTRAINT "inv_parts_quantity_check" CHECK ("quantity" >= 0),
    CONSTRAINT "inv_parts_min_quantity_check" CHECK ("min_quantity" >= 0),
    CONSTRAINT "inv_parts_prices_check" CHECK ("cost_price" >= 0 AND "sale_price" >= 0)
);
CREATE UNIQUE INDEX "inv_parts_id_establishment_code_key" ON "odramech"."inv_parts"("id_establishment", "code");
CREATE INDEX "inv_parts_id_establishment_active_name_idx" ON "odramech"."inv_parts"("id_establishment", "active", "name");
ALTER TABLE "odramech"."inv_parts" ADD CONSTRAINT "inv_parts_id_establishment_fkey"
    FOREIGN KEY ("id_establishment") REFERENCES "odramech"."cad_establishment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "odramech"."inv_stock_movements" (
    "id" SERIAL NOT NULL,
    "id_part" INTEGER NOT NULL,
    "id_establishment" INTEGER NOT NULL,
    "type" "odramech"."StockMovementType" NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "balance_after" DECIMAL(12,2) NOT NULL,
    "unit_cost" DECIMAL(10,2),
    "note" TEXT,
    "id_work_order" INTEGER,
    "id_service_item" INTEGER,
    "id_user" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inv_stock_movements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "inv_stock_movements_id_part_created_at_idx" ON "odramech"."inv_stock_movements"("id_part", "created_at");
CREATE INDEX "inv_stock_movements_id_establishment_created_at_idx" ON "odramech"."inv_stock_movements"("id_establishment", "created_at");
CREATE INDEX "inv_stock_movements_id_work_order_idx" ON "odramech"."inv_stock_movements"("id_work_order");
ALTER TABLE "odramech"."inv_stock_movements" ADD CONSTRAINT "inv_stock_movements_id_part_fkey"
    FOREIGN KEY ("id_part") REFERENCES "odramech"."inv_parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "odramech"."service_items" ADD COLUMN "id_part" INTEGER;
ALTER TABLE "odramech"."service_items" ADD COLUMN "stock_quantity" DECIMAL(12,2) NOT NULL DEFAULT 0;
CREATE INDEX "service_items_id_part_idx" ON "odramech"."service_items"("id_part");
ALTER TABLE "odramech"."service_items" ADD CONSTRAINT "service_items_id_part_fkey"
    FOREIGN KEY ("id_part") REFERENCES "odramech"."inv_parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "odramech"."module_access_snapshot" (
    "enterprise_id" INTEGER NOT NULL,
    "modules" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "module_access_snapshot_pkey" PRIMARY KEY ("enterprise_id")
);
