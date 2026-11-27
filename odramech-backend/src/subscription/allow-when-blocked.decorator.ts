import { SetMetadata } from '@nestjs/common';

export const ALLOW_WHEN_BLOCKED = 'allowWhenBlocked';

/**
 * Marca uma rota de CONSULTA que continua funcionando quando a assinatura da empresa está
 * bloqueada (teste vencido, inadimplente além da tolerância, cancelada, suspensa).
 *
 * É uma lista de permissão: rota sem esta marca fica bloqueada (402) — inclusive GETs.
 * Por isso exportação, PDF/impressão de orçamento e download de anexos ficam de fora.
 * Rota nova nasce bloqueada até alguém decidir, de propósito, que ela é só leitura.
 */
export const AllowWhenBlocked = () => SetMetadata(ALLOW_WHEN_BLOCKED, true);
