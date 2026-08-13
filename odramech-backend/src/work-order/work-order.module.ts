import { Module } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma-service";
import { WorkOrderService } from "./services/work-order.service";
import { WorkOrderController } from "./controllers/work-order.controller";

@Module({
    imports: [],
    controllers: [WorkOrderController],
    providers: [WorkOrderService, PrismaService],
})
    
export class WorkOrderModule {}