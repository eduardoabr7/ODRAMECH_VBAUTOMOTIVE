import { IsInt, IsNumber, IsOptional, IsString } from "class-validator";

export class UpdateVehicleDTO {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  make?: string;

  @IsString()
  @IsOptional()
  color?: string | null;

  @IsString()
  @IsOptional()
  km?: string | null;

  @IsNumber()
  @IsOptional()
  modelYear?: number | null;

  @IsNumber()
  @IsOptional()
  manufactureYear?: number | null;
}

export class LinkVehicleDTO {
  @IsInt()
  vehicleId: number;

  @IsInt()
  userId: number;
}
