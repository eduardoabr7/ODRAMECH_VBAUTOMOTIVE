// Espelha o enum OrderStatus do schema.prisma
export enum StatusOS {
    PENDENTE = 'PENDENTE',
    EM_ATENDIMENTO = 'EM_ATENDIMENTO',
    AGUARDANDO_PECAS = 'AGUARDANDO_PECAS',
    FINALIZADA = 'FINALIZADA',
    CANCELADA = 'CANCELADA',
}

export const STATUS_LABEL: Record<StatusOS, string> = {
    [StatusOS.PENDENTE]: 'Pendente',
    [StatusOS.EM_ATENDIMENTO]: 'Em atendimento',
    [StatusOS.AGUARDANDO_PECAS]: 'Aguardando peças',
    [StatusOS.FINALIZADA]: 'Finalizada',
    [StatusOS.CANCELADA]: 'Cancelada',
};

export const STATUS_ORDER: StatusOS[] = [
    StatusOS.PENDENTE,
    StatusOS.EM_ATENDIMENTO,
    StatusOS.AGUARDANDO_PECAS,
    StatusOS.FINALIZADA,
    StatusOS.CANCELADA,
];

export const OPEN_STATUSES: StatusOS[] = [
    StatusOS.PENDENTE,
    StatusOS.EM_ATENDIMENTO,
    StatusOS.AGUARDANDO_PECAS,
];
