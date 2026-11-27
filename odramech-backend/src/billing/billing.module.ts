import { Module } from '@nestjs/common';
import { WorkOrderModule } from 'src/work-order/work-order.module';
import { NotesController, QuoteController, WorkOrderMoneyController } from './controllers/billing.controller';
import { QuoteService } from './services/quote.service';
import { WorkOrderMoneyService } from './services/work-order-money.service';
import { NoteService } from './services/note.service';
import { AttachmentService } from './services/attachment.service';
import {
  NoteRepository, PaymentRepository, QuoteRepository, ReviewRepository, ServiceItemRepository,
} from './repositories/billing.repositories';
import {
  PrismaNoteRepository, PrismaPaymentRepository, PrismaQuoteRepository, PrismaReviewRepository,
  PrismaServiceItemRepository,
} from './repositories/prisma-billing.repositories';

/**
 * Módulo financeiro. As abstrações (repositórios) são ligadas às implementações Prisma
 * aqui — trocar de banco/ORM é mudar estas linhas, não os serviços (Dependency Inversion).
 */
@Module({
  imports: [WorkOrderModule],
  controllers: [QuoteController, WorkOrderMoneyController, NotesController],
  providers: [
    QuoteService,
    WorkOrderMoneyService,
    NoteService,
    AttachmentService,
    { provide: QuoteRepository, useClass: PrismaQuoteRepository },
    { provide: ServiceItemRepository, useClass: PrismaServiceItemRepository },
    { provide: PaymentRepository, useClass: PrismaPaymentRepository },
    { provide: ReviewRepository, useClass: PrismaReviewRepository },
    { provide: NoteRepository, useClass: PrismaNoteRepository },
  ],
  exports: [WorkOrderMoneyService],
})
export class BillingModule {}
