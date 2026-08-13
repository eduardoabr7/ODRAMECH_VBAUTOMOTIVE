import { TypeAppointment } from "@prisma/client";
import { IsEnum, IsNumber, IsString } from "class-validator";

export class AppointmentCreateDTO {

  @IsString()
  contentHtml: string;

  @IsEnum(TypeAppointment)
  appointmentType: TypeAppointment;

  @IsNumber()
  userAppointmentId: number;

}