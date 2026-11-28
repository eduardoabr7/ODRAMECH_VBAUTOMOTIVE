import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ArchiveType, TypeAppointment } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { PrismaService } from 'src/core/database/prisma.service';
import { AppConfig } from 'src/core/config/app-config';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { isStaff } from 'src/shared/utils/role.util';
import { AppointmentAccess } from 'src/work-order/domain/appointment-access';
import { DomainEventBus } from 'src/core/events/domain-event-bus';
import { WorkOrderContentChanged } from 'src/work-order/domain/work-order.events';

/** pasta dos anexos (AppConfig.uploadDir ou ./uploads) */
export function uploadDir(): string {
  return resolve(AppConfig.get().values.uploadDir || join(process.cwd(), 'uploads'));
}
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED = /^(image\/(png|jpe?g|webp|gif|heic)|application\/pdf|video\/(mp4|quicktime|webm))$/;

export function ensureUploadDir() {
  const dir = uploadDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function storedFileName(original: string) {
  return `${randomUUID()}${extname(original).toLowerCase().slice(0, 10)}`;
}

export function isAllowedMime(mime: string) {
  return ALLOWED.test(mime);
}

function typeFromMime(mime: string): ArchiveType {
  if (mime.startsWith('image/')) return ArchiveType.IMAGEM;
  if (mime.startsWith('video/')) return ArchiveType.VIDEO;
  return ArchiveType.DOCUMENTO;
}

@Injectable()
export class AttachmentService {
  constructor(
    private readonly _prisma: PrismaService,
    private readonly access: AppointmentAccess,
    private readonly events: DomainEventBus,
  ) {}

  /** quem está com a OS aberta recebe o aviso "Recarregar" (anexo de nota interna: só a equipe) */
  private async touched(appointmentId: number, auth: AuthPayload) {
    const appt = await this._prisma.appointment.findUnique({ where: { id: appointmentId }, select: { workOrderId: true, appointmentType: true } });
    if (appt) await this.events.publish(new WorkOrderContentChanged(appt.workOrderId, auth.sub, appt.appointmentType === TypeAppointment.INTERNO));
  }

  async attach(auth: AuthPayload, appointmentId: number, files: Express.Multer.File[]) {
    if (!files?.length) throw new BadRequestException('Nenhum arquivo enviado.');

    try {
      await this.assertCanAttach(auth, appointmentId);
    } catch (e) {
      files.forEach(f => this.safeUnlink(f.path));
      throw e;
    }

    await this._prisma.archiveAppointment.createMany({
      data: files.map(f => ({
        appointmentId,
        archiveType: typeFromMime(f.mimetype),
        url: f.filename,                      // nome gerado no disco; servido via /files/:id
        mimeType: f.mimetype,
        originalName: Buffer.from(f.originalname, 'latin1').toString('utf8'),
        sizeBytes: f.size,
      })),
    });

    await this.touched(appointmentId, auth);
    return this._prisma.archiveAppointment.findMany({ where: { appointmentId }, orderBy: { id: 'asc' } });
  }

  /** equipe anexa em qualquer apontamento; cliente só no próprio apontamento público da própria OS */
  private async assertCanAttach(auth: AuthPayload, appointmentId: number) {
    const appt = await this._prisma.appointment.findFirst({
      where: { id: appointmentId, workOrder: { establishmentId: auth.establishmentId } },
      select: { userAppointmentId: true, appointmentType: true, workOrder: { select: { establishmentId: true, clientId: true } } },
    });
    const ownPublic = appt && appt.userAppointmentId === auth.sub && appt.appointmentType === TypeAppointment.PUBLICO;
    if (!appt || (!isStaff(auth.role) && !ownPublic)) throw new NotFoundException('Apontamento não encontrado');
    await this.access.assertCanAttach(auth, appt.workOrder);
  }

  /** Resolve o arquivo garantindo que pertence ao estabelecimento (e ao cliente, se for USER). */
  async resolveFile(auth: AuthPayload, archiveId: number) {
    const archive = await this._prisma.archiveAppointment.findFirst({
      where: {
        id: archiveId,
        appointment: {
          workOrder: {
            establishmentId: auth.establishmentId,
            ...(isStaff(auth.role) ? {} : { clientId: auth.sub }),
          },
          ...(isStaff(auth.role) ? {} : { appointmentType: TypeAppointment.PUBLICO }),
        },
      },
    });
    if (!archive) throw new NotFoundException('Arquivo não encontrado');

    const path = join(uploadDir(), archive.url);
    if (!path.startsWith(uploadDir()) || !existsSync(path)) throw new NotFoundException('Arquivo não está mais disponível');
    return { path, archive };
  }

  /** equipe remove qualquer anexo; cliente só os do próprio apontamento */
  async remove(auth: AuthPayload, archiveId: number) {
    const { path, archive } = await this.resolveFile(auth, archiveId);
    if (!isStaff(auth.role)) {
      const appt = await this._prisma.appointment.findUnique({ where: { id: archive.appointmentId }, select: { userAppointmentId: true } });
      if (appt?.userAppointmentId !== auth.sub) throw new ForbiddenException('Você só pode excluir os seus anexos.');
    }
    await this._prisma.archiveAppointment.delete({ where: { id: archive.id } });
    this.safeUnlink(path);
    await this.touched(archive.appointmentId, auth);
    return { deleted: true };
  }

  private safeUnlink(path?: string) {
    try { if (path) unlinkSync(path); } catch { /* arquivo já removido */ }
  }
}
