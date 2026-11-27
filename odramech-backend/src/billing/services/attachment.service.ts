import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ArchiveType, TypeAppointment } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { PrismaService } from 'src/core/database/prisma.service';
import { AppConfig } from 'src/core/config/app-config';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { assertStaff, isStaff } from 'src/shared/utils/role.util';

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
  constructor(private readonly _prisma: PrismaService) {}

  async attach(auth: AuthPayload, appointmentId: number, files: Express.Multer.File[]) {
    assertStaff(auth.role);
    if (!files?.length) throw new BadRequestException('Nenhum arquivo enviado.');

    const appt = await this._prisma.appointment.findFirst({
      where: { id: appointmentId, workOrder: { establishmentId: auth.establishmentId } },
    });
    if (!appt) {
      files.forEach(f => this.safeUnlink(f.path));
      throw new NotFoundException('Apontamento não encontrado');
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

    return this._prisma.archiveAppointment.findMany({ where: { appointmentId }, orderBy: { id: 'asc' } });
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

  async remove(auth: AuthPayload, archiveId: number) {
    assertStaff(auth.role);
    const { path, archive } = await this.resolveFile(auth, archiveId);
    await this._prisma.archiveAppointment.delete({ where: { id: archive.id } });
    this.safeUnlink(path);
    return { deleted: true };
  }

  private safeUnlink(path?: string) {
    try { if (path) unlinkSync(path); } catch { /* arquivo já removido */ }
  }
}
