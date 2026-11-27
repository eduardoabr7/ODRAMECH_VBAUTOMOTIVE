import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma-service";
import { CreateVehicleDTO } from "../dto/create-vehicle.dto";
import { UpdateVehicleDTO } from "../dto/update-vehicle.dto";
import { AuthPayload } from "src/auth/interfaces/auth-payload.interface";
import { isStaff } from "src/shared/utils/role.util";

@Injectable()
export class VehicleService {
    constructor(
        private readonly _prismaService: PrismaService
    ) {}

    /** a pessoa tem vínculo com o estabelecimento da sessão? */
    private async inEstablishment(userId: number, establishmentId: number): Promise<boolean> {
        const link = await this._prismaService.userCorporation.findFirst({
            where: { idUser: userId, idEstablishment: establishmentId },
            select: { idUser: true },
        });
        return !!link;
    }

    private async assertClientHere(auth: AuthPayload, userId: number) {
        if (!(await this.inEstablishment(userId, auth.establishmentId))) {
            throw new NotFoundException('Usuário não encontrado neste estabelecimento.');
        }
    }

    async createVehicle(auth: AuthPayload, { userId, ...input }: CreateVehicleDTO) {
        await this.assertClientHere(auth, userId);
        const vehicleData = { ...input, plate: input.plate.toUpperCase().replace(/[^A-Z0-9]/g, '') };
        const existing = await this._prismaService.vehicle.findUnique({
            where: { plate: vehicleData.plate },
        });

        if (existing) {
            throw new ConflictException('Já existe um veículo cadastrado com essa placa.');
        }

        const user = await this._prismaService.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('Usuário não encontrado.');
        }

        return await this._prismaService.vehicle.create({
            data: {
                ...vehicleData,
                users: {
                    create: { userId },
                },
            },
            include: {
                users: true,
            },
        });
    }

    async getByUser(auth: AuthPayload, userId: number) {
        if (auth.sub !== userId) {
            if (!isStaff(auth.role)) throw new ForbiddenException('Seu perfil não tem permissão para esta ação.');
            await this.assertClientHere(auth, userId);
        }
        return await this._prismaService.vehicle.findMany({
            where: {
                users: {
                    some: { userId },
                },
            },
        });
    }

    async listByEstablishment(auth: AuthPayload, search?: string) {
        const term = search?.trim();
        const plate = term?.toUpperCase().replace(/[^A-Z0-9]/g, '');

        const vehicles = await this._prismaService.vehicle.findMany({
            where: {
                users: {
                    some: {
                        user: {
                            userCorporation: { some: { idEstablishment: auth.establishmentId } },
                            ...(isStaff(auth.role) ? {} : { id: auth.sub }),
                        },
                    },
                },
                ...(term && {
                    OR: [
                        { name: { contains: term, mode: 'insensitive' } },
                        { make: { contains: term, mode: 'insensitive' } },
                        ...(plate ? [{ plate: { contains: plate } }] : []),
                        { users: { some: { user: { name: { contains: term, mode: 'insensitive' } } } } },
                    ],
                }),
            },
            include: {
                users: { include: { user: { select: { id: true, name: true, principalPhone: true } } } },
                workOrders: {
                    where: { establishmentId: auth.establishmentId },
                    select: { id: true, numberOs: true, status: true, dateTimeCreation: true },
                    orderBy: { dateTimeCreation: 'desc' },
                    take: 1,
                },
                _count: { select: { workOrders: true } },
            },
            orderBy: { id: 'desc' },
            take: 200,
        });

        return vehicles.map(({ users, workOrders, _count, ...v }) => ({
            ...v,
            owners: users.map((u) => u.user),
            lastWorkOrder: workOrders[0] ?? null,
            workOrdersCount: _count.workOrders,
        }));
    }

    async update(auth: AuthPayload, id: number, data: UpdateVehicleDTO) {
        // só edita veículo de cliente deste estabelecimento
        const exists = await this._prismaService.vehicle.findFirst({
            where: { id, users: { some: { user: { userCorporation: { some: { idEstablishment: auth.establishmentId } } } } } },
            select: { id: true },
        });
        if (!exists) throw new NotFoundException('Veículo não encontrado.');

        return this._prismaService.vehicle.update({ where: { id }, data });
    }

    async checkPlate(rawPlate: string) {
        const plate = rawPlate.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const vehicle = await this._prismaService.vehicle.findUnique({
            where: { plate },
        });

        return {
            exists: !!vehicle,
            vehicle: vehicle ?? undefined,
        };
    }

    async linkToUser(auth: AuthPayload, vehicleId: number, userId: number) {
        await this.assertClientHere(auth, userId);
        const vehicle = await this._prismaService.vehicle.findUnique({
            where: { id: vehicleId },
        });

        if (!vehicle) {
            throw new NotFoundException('Veículo não encontrado.');
        }

        const alreadyLinked = await this._prismaService.userVehicle.findUnique({
            where: { userId_vehicleId: { userId, vehicleId } },
        });

        if (alreadyLinked) {
            throw new ConflictException('Veículo já vinculado a este usuário.');
        }

        return await this._prismaService.userVehicle.create({
            data: { userId, vehicleId },
        });
    }
}