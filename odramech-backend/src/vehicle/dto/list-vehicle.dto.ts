import { IsNumber, IsOptional, IsString } from "class-validator";

export class CreateVehicleDTO {

  @IsNumber()
  id: number;
  
  @IsString()
  plate: string;

  @IsString()
  name: string;

  @IsString()
  make: string;

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

  @IsNumber()
  userId: number;
}