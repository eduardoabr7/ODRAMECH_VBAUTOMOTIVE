import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma-service";
import { WoCreateDTO } from "../dto/wo-create.dto";

@Injectable()
export class WorkOrderService {
    constructor(
        private readonly _prismaService: PrismaService
    ) {}

    async create(dataReceived: WoCreateDTO) {
        const { establishmentId, userCreationId, userResponsibleId, clientId, vehicleId, status, appointment } = dataReceived;

        try {
            return await this._prismaService.$transaction(async (tx) => {
                const counter = await tx.establishmentOsCounter.update({
                    where: { establishmentId },
                    data: { lastNumberOs: { increment: 1 } },
                });

                return tx.workOrder.create({
                    data: {
                        status,
                        numberOs: counter.lastNumberOs,
                        establishment: { connect: { id: establishmentId } },
                        userCreation: { connect: { id: userCreationId } },
                        ...(userResponsibleId && {
                            userResponsible: { connect: { id: userResponsibleId } },
                        }),
                        client: { connect: { id: clientId } },
                        vehicle: { connect: { id: vehicleId } },
                        ...(appointment && {
                            appointments: {
                                create: {
                                    dateTime: new Date(),
                                    contentHtml: appointment.contentHtml,
                                    appointmentType: appointment.appointmentType,
                                    userAppointment: { connect: { id: appointment.userAppointmentId } },
                                },
                            },
                        }),
                    },
                    include: {
                        appointments: true,
                    },
                });
            });
        } catch (error: any) {
            if (error.code === 'P2025') {
                throw new NotFoundException('Estabelecimento ou contador não encontrado');
            }

            if (error.code === 'P2002') {
                throw new ConflictException('Número de OS já existe para este estabelecimento');
            }

            console.error('Erro ao criar ordem de serviço:', error);
            throw new InternalServerErrorException('Erro ao criar ordem de serviço', error);
        }
    }
}