import { Module } from '@nestjs/common';
import { ContractedModulesModule } from 'src/contracted-modules/contracted-modules.module';
import { WorkOrderModule } from 'src/work-order/work-order.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { StockLedger } from './stock-ledger';
import { ItemStockPolicy } from './item-stock.policy';
import { WorkOrderStockListener } from './listeners/work-order-stock.listener';

/**
 * Módulo ESTOQUE DE PEÇAS (contrato à parte).
 * Exporta o StockLedger e a ItemStockPolicy para o financeiro dar baixa nos itens de OS
 * dentro da mesma transação em que grava o item.
 */
@Module({
  imports: [ContractedModulesModule, WorkOrderModule],
  controllers: [InventoryController],
  providers: [InventoryService, StockLedger, ItemStockPolicy, WorkOrderStockListener],
  exports: [StockLedger, ItemStockPolicy],
})
export class InventoryModule {}
