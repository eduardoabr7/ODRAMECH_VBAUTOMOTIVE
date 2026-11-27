import {
  BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Res,
  UploadedFiles, UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Response } from 'express';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { CurrentAuth } from 'src/core/auth/current-auth.decorator';
import { QuoteService } from '../services/quote.service';
import { WorkOrderMoneyService } from '../services/work-order-money.service';
import { NoteService } from '../services/note.service';
import {
  AttachmentService, ensureUploadDir, isAllowedMime, MAX_UPLOAD_BYTES, storedFileName, uploadDir,
} from '../services/attachment.service';
import {
  NoteDTO, PaymentDTO, QuoteCreateDTO, QuoteListQueryDTO, QuoteUpdateDTO, ReviewDTO,
  ServiceItemDTO, UpdateServiceItemDTO,
} from '../dto/billing.dto';

// Controllers finos: só traduzem HTTP ↔ caso de uso. Regras ficam nos serviços.

@Controller('quote')
export class QuoteController {
  constructor(private readonly quotes: QuoteService) {}

  @Get()
  list(@Query() q: QuoteListQueryDTO, @CurrentAuth() auth: AuthPayload) { return this.quotes.list(auth, q); }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number, @CurrentAuth() auth: AuthPayload) { return this.quotes.get(auth, id); }

  @Post()
  create(@Body() dto: QuoteCreateDTO, @CurrentAuth() auth: AuthPayload) { return this.quotes.create(auth, dto); }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: QuoteUpdateDTO, @CurrentAuth() auth: AuthPayload) {
    return this.quotes.update(auth, id, dto);
  }

  @Post(':id/items')
  addItem(@Param('id', ParseIntPipe) id: number, @Body() dto: ServiceItemDTO, @CurrentAuth() auth: AuthPayload) {
    return this.quotes.addItem(auth, id, dto);
  }

  @Post(':id/convert')
  convert(@Param('id', ParseIntPipe) id: number, @CurrentAuth() auth: AuthPayload) { return this.quotes.convert(auth, id); }
}

@Controller()
export class WorkOrderMoneyController {
  constructor(private readonly money: WorkOrderMoneyService, private readonly attachments: AttachmentService) {}

  @Post('workorder/:id/items')
  addItem(@Param('id', ParseIntPipe) id: number, @Body() dto: ServiceItemDTO, @CurrentAuth() auth: AuthPayload) {
    return this.money.addItem(auth, id, dto);
  }

  @Put('items/:itemId')
  updateItem(@Param('itemId', ParseIntPipe) itemId: number, @Body() dto: UpdateServiceItemDTO, @CurrentAuth() auth: AuthPayload) {
    return this.money.updateItem(auth, itemId, dto);
  }

  @Delete('items/:itemId')
  deleteItem(@Param('itemId', ParseIntPipe) itemId: number, @CurrentAuth() auth: AuthPayload) {
    return this.money.deleteItem(auth, itemId);
  }

  @Post('workorder/:id/payments')
  addPayment(@Param('id', ParseIntPipe) id: number, @Body() dto: PaymentDTO, @CurrentAuth() auth: AuthPayload) {
    return this.money.addPayment(auth, id, dto);
  }

  @Delete('payments/:paymentId')
  deletePayment(@Param('paymentId', ParseIntPipe) paymentId: number, @CurrentAuth() auth: AuthPayload) {
    return this.money.deletePayment(auth, paymentId);
  }

  @Post('workorder/:id/review')
  review(@Param('id', ParseIntPipe) id: number, @Body() dto: ReviewDTO, @CurrentAuth() auth: AuthPayload) {
    return this.money.review(auth, id, dto);
  }

  // ── Anexos ───────────────────────────────────────────────
  @Post('appointments/:id/files')
  @UseInterceptors(FilesInterceptor('files', 10, {
    limits: { fileSize: MAX_UPLOAD_BYTES },
    fileFilter: (_req, file, cb) => isAllowedMime(file.mimetype)
      ? cb(null, true)
      : cb(new BadRequestException(`Tipo de arquivo não permitido: ${file.mimetype}`), false),
    storage: diskStorage({
      destination: (_req, _file, cb) => { ensureUploadDir(); cb(null, uploadDir()); },
      filename: (_req, file, cb) => cb(null, storedFileName(file.originalname)),
    }),
  }))
  upload(@Param('id', ParseIntPipe) id: number, @UploadedFiles() files: Express.Multer.File[], @CurrentAuth() auth: AuthPayload) {
    return this.attachments.attach(auth, id, files);
  }

  @Get('files/:id')
  async download(@Param('id', ParseIntPipe) id: number, @CurrentAuth() auth: AuthPayload, @Res() res: Response) {
    const { path, archive } = await this.attachments.resolveFile(auth, id);
    res.setHeader('Content-Type', archive.mimeType);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(archive.originalName)}`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(path);
  }

  @Delete('files/:id')
  removeFile(@Param('id', ParseIntPipe) id: number, @CurrentAuth() auth: AuthPayload) {
    return this.attachments.remove(auth, id);
  }
}

@Controller('notes')
export class NotesController {
  constructor(private readonly notes: NoteService) {}

  @Get()
  get(@CurrentAuth() auth: AuthPayload) { return this.notes.get(auth); }

  @Put()
  save(@Body() dto: NoteDTO, @CurrentAuth() auth: AuthPayload) { return this.notes.save(auth, dto.content); }
}
