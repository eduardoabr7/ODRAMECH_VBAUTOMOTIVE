import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma-service";
import { CreateVehicleDTO } from "../dto/create-vehicle.dto";

@Injectable()
export class VehicleService {
    constructor(
        private readonly _prismaService: PrismaService
    ) {}

    async createVehicle({ userId, ...vehicleData }: CreateVehicleDTO) {
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

    async getByUser(userId: number) {
        return await this._prismaService.vehicle.findMany({
            where: {
                users: {
                    some: { userId },
                },
            },
        });
    }

    async checkPlate(plate: string) {
        const vehicle = await this._prismaService.vehicle.findUnique({
            where: { plate },
        });

        return {
            exists: !!vehicle,
            vehicle: vehicle ?? undefined,
        };
    }

    async linkToUser(vehicleId: number, userId: number) {
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