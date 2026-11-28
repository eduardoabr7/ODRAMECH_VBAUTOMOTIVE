import { Module } from '@nestjs/common';
import { WorkOrderModule } from 'src/work-order/work-order.module';
import { SettingsModule } from 'src/settings/settings.module';
import { NotesController, PublicQuoteController, QuoteController, WorkOrderMoneyController } from './controllers/billing.controller';
import { QuoteService } from './services/quote.service';
import { WorkOrderMoneyService } from './services/work-order-money.service';
import { NoteService } from './services/note.service';
import { AttachmentService } from './services/attachment.service';
import { QuoteMailService } from './services/quote-mail.service';
import { PublicQuoteService } from './services/public-quote.service';
import { PdfService } from './document/pdf.service';
import { MailModule } from 'src/mail/mail.module';
import {
  NoteRepository, PaymentRepository, QuoteRepository, ReviewRepository, ServiceItemRepository,
} from './repositories/billing.repositories';
import { SubscriptionModule } from 'src/subscription/subscription.module';
import { InventoryModule } from 'src/inventory/inventory.module';
import {
  PrismaNoteRepository, PrismaPaymentRepository, PrismaQuoteRepository, PrismaReviewRepository,
  PrismaServiceItemRepository,
} from './repositories/prisma-billing.repositories';

/**
 * Módulo financeiro. As abstrações (repositórios) são ligadas às implementações Prisma
 * aqui — trocar de banco/ORM é mudar estas linhas, não os serviços (Dependency Inversion).
 */
@Module({
  imports: [WorkOrderModule, SettingsModule, MailModule, SubscriptionModule, InventoryModule],
  controllers: [QuoteController, WorkOrderMoneyController, NotesController, PublicQuoteController],
  providers: [
    QuoteService,
    WorkOrderMoneyService,
    NoteService,
    AttachmentService,
    QuoteMailService,
    PublicQuoteService,
    PdfService,
    { provide: QuoteRepository, useClass: PrismaQuoteRepository },
    { provide: ServiceItemRepository, useClass: PrismaServiceItemRepository },
    { provide: PaymentRepository, useClass: PrismaPaymentRepository },
    { provide: ReviewRepository, useClass: PrismaReviewRepository },
    { provide: NoteRepository, useClass: PrismaNoteRepository },
  ],
  exports: [WorkOrderMoneyService, QuoteRepository],
})
export class BillingModule {}
