import { OrderStatus } from "@prisma/client";
import { IsArray, IsEnum, IsNumber, IsOptional, ValidateNested } from "class-validator";
import { AppointmentCreateDTO } from "./appointment-create.dto";
import { Type } from "class-transformer";

export class WoCreateDTO {
  
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsNumber()
  establishmentId: number;

  @IsNumber()
  userCreationId: number;

  @IsNumber()
  @IsOptional()
  userResponsibleId?: number | null;

  @IsNumber()
  clientId: number;

  @IsNumber()
  vehicleId: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => AppointmentCreateDTO)
  appointment?: AppointmentCreateDTO | null;
}