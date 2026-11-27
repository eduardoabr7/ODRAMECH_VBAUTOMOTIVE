import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';

export const STAFF_ROLES: Role[] = [Role.ADMIN, Role.WORKER, Role.SUPERUSER];
export const MANAGER_ROLES: Role[] = [Role.ADMIN, Role.SUPERUSER];

export function isStaff(role?: Role | null): boolean {
  return !!role && STAFF_ROLES.includes(role);
}

export function assertStaff(role?: Role | null): void {
  if (!isStaff(role)) {
    throw new ForbiddenException('Seu perfil não tem permissão para esta ação.');
  }
}

export function assertManager(role?: Role | null): void {
  if (!role || !MANAGER_ROLES.includes(role)) {
    throw new ForbiddenException('Apenas administradores podem executar esta ação.');
  }
}
