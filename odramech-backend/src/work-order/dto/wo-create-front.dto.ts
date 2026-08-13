import { OrderStatus } from "@prisma/client";
import { IsEnum, IsNumber, IsOptional, IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { AppointmentCreateFrontDTO } from "./appointment-create-front.dto";

export class WoCreateFrontDTO {
  
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsNumber()
  @IsOptional()
  userResponsibleId?: number | null;

  @IsNumber()
  clientId: number;

  @IsNumber()
  vehicleId: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => AppointmentCreateFrontDTO)
  appointment?: AppointmentCreateFrontDTO | null;
}